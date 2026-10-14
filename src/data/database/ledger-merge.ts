import { changeProgressionRules, createProgressionState, advanceProgression, type CalendarContext, type MeditationSession } from '../../domain/progression';
import { sameSession } from '../../domain/meditation/session';
import type { SqlConnection } from './connection';
import { decodeContext, decodeSession, decodeSessionRow, type RulesRegistry } from './decoders';
import { persistCompletion, validateCompletions } from './completions';
import { appendTransition, loadState, writeCheckpoint } from './records';
import { loadJourney } from './journey';
import { loadHabit } from './habit';
import { resetAllPracticeData } from './reset-practice';
import { clearLedgerTables, replaceLedger, type LedgerRow } from './ledger';
import { canonical, json, object, requireData, text, timestamp } from './validation';

/*
 * Combining a phone's offline practice with a cloud state that moved on (docs/SYNC.md, Merge).
 * Planning is pure; applying happens inside one caller-owned transaction and is validated like
 * startup. Synced history up to the chosen start revision is never recalculated.
 */

export interface PracticeEvent { readonly session: MeditationSession; readonly createdAt: number }

function sessionsOf(rows: readonly LedgerRow[]): Map<string, PracticeEvent> {
  return new Map(rows.filter((row) => row.table === 'meditation_sessions').map((row) => {
    const decoded = decodeSessionRow(row.row);
    return [decoded.session.id, { session: decoded.session, createdAt: decoded.createdAt }] as const;
  }));
}
const generationsKey = (rows: readonly LedgerRow[]) => canonical(rows.filter((row) => row.table === 'progression_generations')
  .map((row) => row.row).sort((a, b) => Number(a.id) - Number(b.id)));
function checkpointMetadata(rows: readonly LedgerRow[]) {
  const checkpoint = rows.find((row) => row.table === 'progression_checkpoint');
  requireData(checkpoint, 'Ledger has no progression checkpoint');
  return object(json(checkpoint.row.metadata_json));
}

/** The most recent reset boundary recorded in a ledger, if any. */
export function resetBoundary(rows: readonly LedgerRow[]): CalendarContext | null {
  const boundaries = rows.filter((row) => row.table === 'progression_generations' && row.row.boundary_json !== null)
    .map((row) => decodeContext(json(row.row.boundary_json)));
  return boundaries.sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
}
export const settledAt = (rows: readonly LedgerRow[]) => timestamp(object(checkpointMetadata(rows).asOf).timestamp);

export interface MergePlan {
  /** Local practice can simply follow the cloud state; nothing already synced is recalculated. */
  readonly fastForward: boolean;
  /** A replay must start from a state settled no later than this moment. */
  readonly earliest: CalendarContext;
  /** Latest reset made on either side since the base, if any (deletion wins). */
  readonly reset: CalendarContext | null;
}

/** Decide how to combine `local` with `head`, both descended from `base`. Pure. */
export function planMerge(base: readonly LedgerRow[], head: readonly LedgerRow[], local: readonly LedgerRow[]): MergePlan {
  const b = sessionsOf(base), h = sessionsOf(head), l = sessionsOf(local);
  const localOnly = [...l.values()].filter((event) => !b.has(event.session.id));
  const remoteOnly = [...h.values()].filter((event) => !b.has(event.session.id));
  const remoteReset = generationsKey(head) !== generationsKey(base) ? resetBoundary(head) : null;
  const localReset = generationsKey(local) !== generationsKey(base) ? resetBoundary(local) : null;
  const reset = [remoteReset, localReset].filter((value): value is CalendarContext => value !== null)
    .sort((x, y) => y.timestamp - x.timestamp)[0] ?? null;
  const fastForward = localReset === null && localOnly.every((event) => event.session.startedAt >= settledAt(head));
  const moments: CalendarContext[] = [...localOnly, ...remoteOnly].map(({ session }) =>
    ({ timestamp: session.startedAt, localDate: session.localDate, timeZone: session.timeZone }));
  if (remoteReset) moments.push(remoteReset);
  if (localReset) moments.push(localReset);
  moments.sort((x, y) => x.timestamp - y.timestamp);
  return { fastForward, earliest: moments[0] ?? decodeContext(checkpointMetadata(head).asOf), reset };
}

/** Practices to replay on top of `start`: everything newer on either side, in time order. */
export function mergeEvents(start: readonly LedgerRow[], head: readonly LedgerRow[], local: readonly LedgerRow[], reset: CalendarContext | null): PracticeEvent[] {
  const present = sessionsOf(start);
  const events = new Map<string, PracticeEvent>();
  for (const side of [sessionsOf(head), sessionsOf(local)]) {
    for (const event of side.values()) {
      if (present.has(event.session.id)) continue;
      if (reset && event.session.startedAt <= reset.timestamp) continue; // Deleted by the reset.
      const existing = events.get(event.session.id);
      if (existing) requireData(sameSession(existing.session, event.session), `Conflicting session ID: ${event.session.id}`);
      else events.set(event.session.id, event);
    }
  }
  return [...events.values()].sort((a, b) => a.session.startedAt - b.session.startedAt || (a.session.id < b.session.id ? -1 : 1));
}

/** Set-aside practices from either side that survive the reset and are not already in `start`. */
export function mergeSetAside(start: readonly LedgerRow[], head: readonly LedgerRow[], local: readonly LedgerRow[], reset: CalendarContext | null) {
  const present = new Set(start.filter((row) => row.table === 'sync_set_aside_sessions').map((row) => row.key));
  const result = new Map<string, LedgerRow>();
  for (const row of [...head, ...local]) {
    if (row.table !== 'sync_set_aside_sessions' || present.has(row.key) || result.has(row.key)) continue;
    if (reset && decodeSession(json(row.row.session_json)).startedAt <= reset.timestamp) continue;
    result.set(row.key, row);
  }
  return [...result.values()];
}

/** A brand-new ledger settled at `asOf`, built exactly as a fresh install builds one. */
async function createEmptyLedger(sql: SqlConnection, registry: RulesRegistry, asOf: CalendarContext, rulesVersion: string) {
  await clearLedgerTables(sql);
  await sql.run('INSERT INTO progression_generations(id, started_at) VALUES (1, 0)');
  const initial = createProgressionState(asOf);
  await appendTransition(sql, null, initial, asOf.timestamp);
  await loadJourney(sql, initial, true);
  const current = initial.activeRulesVersion === rulesVersion ? initial : changeProgressionRules(initial, registry.get(rulesVersion), asOf);
  if (current !== initial) await appendTransition(sql, initial, current, asOf.timestamp);
  await writeCheckpoint(sql, current);
  await loadHabit(sql, current, true);
}

export interface ApplyMergeInput {
  /** Cloud state the replay starts from; null when no revision is early enough (fresh ledger). */
  readonly start: readonly LedgerRow[] | null;
  readonly earliest: CalendarContext;
  readonly head: readonly LedgerRow[];
  readonly local: readonly LedgerRow[];
  readonly reset: CalendarContext | null;
  readonly now: CalendarContext;
}

async function setAside(sql: SqlConnection, sessionId: string, sessionJson: string, createdAt: number, at: number, reason: string) {
  await sql.run(`INSERT OR IGNORE INTO sync_set_aside_sessions(session_id, session_json, created_at, set_aside_at, reason)
    VALUES (?, ?, ?, ?, ?)`, [sessionId, sessionJson, createdAt, at, reason]);
}

/**
 * Inside the caller's BEGIN IMMEDIATE: rebuild this device's ledger from `start`, apply the latest
 * reset, replay newer practices from both sides in time order (setting aside overlaps), carry
 * set-aside practices, settle to `now` and validate like startup. Any inconsistency throws.
 */
export async function applyMerge(sql: SqlConnection, registry: RulesRegistry, input: ApplyMergeInput) {
  const at = input.now.timestamp;
  if (input.start) await replaceLedger(sql, registry, input.start, at);
  else await createEmptyLedger(sql, registry, input.earliest, text(checkpointMetadata(input.head).activeRulesVersion));
  const startRows = input.start ?? [];
  if (input.reset && resetBoundary(startRows)?.timestamp !== input.reset.timestamp) {
    await resetAllPracticeData(sql, registry, input.reset);
  }
  let lastEnd = Math.max(0, ...(await loadState(sql, registry)).sessions.map((entry) => entry.session.endedAt));
  for (const event of mergeEvents(startRows, input.head, input.local, input.reset)) {
    if (event.session.startedAt < lastEnd) {
      // Two phones recorded overlapping practice: keep the earlier one and never lose the other.
      await setAside(sql, event.session.id, JSON.stringify(event.session), event.createdAt, at, 'overlap');
      continue;
    }
    await persistCompletion(sql, await loadState(sql, registry), event.session, event.createdAt);
    lastEnd = event.session.endedAt;
  }
  for (const { row } of mergeSetAside(startRows, input.head, input.local, input.reset)) {
    await setAside(sql, text(row.session_id), text(row.session_json), timestamp(row.created_at), timestamp(row.set_aside_at), text(row.reason));
  }
  // Settle to now exactly as an ordinary read would, then validate everything like startup.
  const loaded = await loadState(sql, registry);
  const settled = at >= loaded.asOf.timestamp ? advanceProgression(loaded, input.now) : loaded;
  await writeCheckpoint(sql, settled);
  await loadJourney(sql, settled);
  await loadHabit(sql, settled);
  await sql.run(`UPDATE practice_completions SET acknowledged_at = MAX(?, (SELECT s.ended_at FROM meditation_sessions s
    WHERE s.id = practice_completions.session_id)) WHERE acknowledged_at IS NULL`, [at]);
  await validateCompletions(sql, registry);
  return settled;
}
