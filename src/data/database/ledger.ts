import type { SqlConnection, SqlValue } from './connection';
import type { RulesRegistry } from './decoders';
import { PersistenceError } from './errors';
import { loadState } from './records';
import { loadJourney } from './journey';
import { loadHabit } from './habit';
import { validateCompletions } from './completions';
import { restoreDeleteGuards, suspendDeleteGuards } from './reset-practice';
import { sha256Hex } from './sha256';
import { canonical, integer, object, requireData, text, timestamp } from './validation';
import { MIGRATIONS } from './migrations';

/**
 * The synchronizable practice ledger: fixed tables in insertion (foreign-key) order with
 * stable keys. Device-only state (timer, migrations, sync bookkeeping) is excluded, as is
 * practice_completions.acknowledged_at, which only records this device's completion screen.
 */
export const LEDGER_TABLES = [
  { name: 'progression_rules', key: ['version'] },
  { name: 'progression_generations', key: ['id'] },
  { name: 'meditation_sessions', key: ['id'] },
  { name: 'progression_awards', key: ['id'] },
  { name: 'progression_checkpoint', key: ['id'] },
  { name: 'practice_completions', key: ['session_id'], omit: ['acknowledged_at'] },
  { name: 'journey_completions', key: ['session_id'] },
  { name: 'journey_animation_receipts', key: ['session_id'] },
  { name: 'journey_checkpoint', key: ['id'] },
  { name: 'legacy_journey_checkpoint', key: ['id'] },
  { name: 'journey_legacy_peaks', key: ['generation_id'] },
  { name: 'habit_checkpoints', key: ['generation_id'] },
  { name: 'habit_reward_receipts', key: ['session_id'] },
  { name: 'progression_consistency_activations', key: ['generation_id', 'rules_version'] },
  { name: 'sync_set_aside_sessions', key: ['session_id'] },
] as const satisfies readonly { name: string; key: readonly string[]; omit?: readonly string[] }[];

export type LedgerTable = (typeof LEDGER_TABLES)[number]['name'];
/**
 * Continuation singletons rewritten by ordinary reads as time passes (decay settlement, asOf).
 * Changes confined to them are recomputed by every device from the same history and time,
 * so on their own they are never pushed and never force a merge.
 */
export const CONTINUATION_TABLES: readonly LedgerTable[] = ['progression_checkpoint', 'habit_checkpoints', 'journey_checkpoint'];
export const isSignificant = (diff: LedgerDiff) => [...diff.removes, ...diff.adds].some((ref) => !CONTINUATION_TABLES.includes(ref.table));
/**
 * Whether a ledger records anything a person did: a practice, a set-aside practice or a reset.
 * A freshly created file has none, so it adopts the cloud instead of merging with it.
 */
export const recordsPractice = (rows: readonly LedgerRow[]) => rows.some((row) => row.table === 'meditation_sessions' ||
  row.table === 'sync_set_aside_sessions' || (row.table === 'progression_generations' && row.row.boundary_json !== null));
export const LEDGER_FORMAT = 'ona_ledger_v1';
/** Number of applied migrations the ledger's row shapes correspond to. */
export const LEDGER_SCHEMA_VERSION = MIGRATIONS.length;

export type LedgerRecord = Readonly<Record<string, SqlValue>>;
export interface LedgerRow {
  readonly table: LedgerTable;
  readonly key: string;
  readonly hash: string;
  readonly row: LedgerRecord;
}
export interface LedgerSnapshot {
  readonly format: typeof LEDGER_FORMAT;
  readonly schemaVersion: number;
  readonly rows: readonly LedgerRow[];
}
export interface LedgerRef { readonly table: LedgerTable; readonly key: string }
export interface LedgerDiff { readonly removes: readonly LedgerRef[]; readonly adds: readonly LedgerRow[] }
/** Row identity → content hash. */
export type LedgerManifest = ReadonlyMap<string, string>;

const tableSpec = new Map<string, (typeof LEDGER_TABLES)[number]>(LEDGER_TABLES.map((spec) => [spec.name, spec]));
const omitted = (spec: (typeof LEDGER_TABLES)[number]): readonly string[] => ('omit' in spec ? spec.omit : []);
export const refId = (ref: LedgerRef) => `${ref.table}\u0000${ref.key}`;
export function ledgerTable(value: unknown): LedgerTable {
  const spec = tableSpec.get(text(value));
  requireData(spec, 'Unknown ledger table');
  return spec.name;
}

function keyOf(spec: (typeof LEDGER_TABLES)[number], row: LedgerRecord) {
  return JSON.stringify(spec.key.map((column) => {
    const value = row[column];
    requireData(typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value)), `Invalid ${spec.name} key`);
    return value;
  }));
}
export const hashRow = (table: LedgerTable, row: LedgerRecord) => sha256Hex(canonical({ table, row }));

function sqlValue(value: unknown, table: string): SqlValue {
  requireData(value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)),
    `Unsupported ${table} value`);
  return value as SqlValue;
}

/** Decode an untrusted row (from the cloud) into a typed ledger row; recomputes key and hash. */
export function ledgerRow(table: unknown, value: unknown): LedgerRow {
  const spec = tableSpec.get(text(table));
  requireData(spec, 'Unknown ledger table');
  const source = object(value);
  const row: Record<string, SqlValue> = {};
  for (const [column, entry] of Object.entries(source)) {
    requireData(/^[a-z_]+$/.test(column) && !omitted(spec).includes(column), `Invalid ${spec.name} column`);
    row[column] = sqlValue(entry, spec.name);
  }
  return { table: spec.name, key: keyOf(spec, row), hash: hashRow(spec.name, row), row };
}

async function columns(sql: SqlConnection, table: LedgerTable): Promise<readonly string[]> {
  const spec = tableSpec.get(table)!;
  return (await sql.all(`PRAGMA table_info(${table})`)).map((value) => text(object(value).name))
    .filter((name) => !omitted(spec).includes(name));
}

/** Read-only export of the current ledger, deterministic in table and key order. */
export async function exportLedger(sql: SqlConnection): Promise<LedgerSnapshot> {
  const rows: LedgerRow[] = [];
  for (const spec of LEDGER_TABLES) {
    const names = await columns(sql, spec.name);
    const tableRows = (await sql.all(`SELECT ${names.join(', ')} FROM ${spec.name}`)).map((value) => ledgerRow(spec.name, value));
    tableRows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    rows.push(...tableRows);
  }
  return { format: LEDGER_FORMAT, schemaVersion: LEDGER_SCHEMA_VERSION, rows };
}

export function manifestOf(rows: readonly LedgerRow[]): Map<string, string> {
  return new Map(rows.map((row) => [refId(row), row.hash]));
}

/** Changes that turn `from` into the state `to`. A modified row is a remove plus an add. */
export function diffLedger(from: LedgerManifest, to: readonly LedgerRow[]): LedgerDiff {
  const target = manifestOf(to);
  const removes: LedgerRef[] = [];
  for (const id of from.keys()) {
    if (target.get(id) !== from.get(id)) {
      const [table, key] = id.split('\u0000') as [LedgerTable, string];
      removes.push({ table, key });
    }
  }
  const adds = to.filter((row) => from.get(refId(row)) !== row.hash);
  return { removes, adds };
}

/** Apply a diff to a full row list (e.g. cloud base + pulled changes = cloud head). */
export function applyLedgerDiff(rows: readonly LedgerRow[], diff: LedgerDiff): LedgerRow[] {
  const result = new Map(rows.map((row) => [refId(row), row]));
  for (const ref of diff.removes) {
    requireData(result.delete(refId(ref)), 'Ledger change removes a row that does not exist');
  }
  for (const row of diff.adds) {
    requireData(!result.has(refId(row)), 'Ledger change adds a row that already exists');
    result.set(refId(row), row);
  }
  return [...result.values()];
}

export function decodeSnapshot(value: unknown): LedgerSnapshot {
  const source = object(value);
  if (source.format !== LEDGER_FORMAT) throw new PersistenceError('UNSUPPORTED_SCHEMA', 'This saved practice needs a newer version of Ona');
  const schemaVersion = integer(source.schemaVersion, 1);
  if (schemaVersion > LEDGER_SCHEMA_VERSION) throw new PersistenceError('UNSUPPORTED_SCHEMA', 'This saved practice needs a newer version of Ona');
  requireData(Array.isArray(source.rows), 'Invalid ledger rows');
  const rows = source.rows.map((value) => { const row = object(value); return ledgerRow(row.table, row.row); });
  return { format: LEDGER_FORMAT, schemaVersion, rows };
}

/**
 * Replace this device's ledger with `rows` inside the caller's BEGIN IMMEDIATE, then run the
 * same validation as startup. Any inconsistency throws and the caller's transaction rolls back.
 * Requires no running practice and no unacknowledged completion on this device.
 */
export async function replaceLedger(sql: SqlConnection, registry: RulesRegistry, rows: readonly LedgerRow[], acknowledgedAt: number) {
  const at = timestamp(acknowledgedAt);
  requireData((await sql.all('SELECT 1 FROM meditation_timer')).length === 0, 'Finish or discard the current practice before syncing');
  requireData((await sql.all('SELECT 1 FROM practice_completions WHERE acknowledged_at IS NULL')).length === 0,
    'Return Home from the saved practice before syncing');
  const byTable = new Map<LedgerTable, LedgerRow[]>();
  const seen = new Set<string>();
  for (const row of rows) {
    const decoded = ledgerRow(row.table, row.row);
    requireData(decoded.key === row.key && !seen.has(refId(decoded)), 'Duplicate or mismatched ledger row');
    seen.add(refId(decoded));
    byTable.set(decoded.table, [...(byTable.get(decoded.table) ?? []), decoded]);
  }
  await suspendDeleteGuards(sql);
  // Rule snapshots are global and survive resets, but a replaced ledger brings its own exact sequence.
  requireData((await sql.all("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = 'progression_rules_immutable_delete'")).length === 1,
    'Rules deletion guard is missing');
  await sql.exec('DROP TRIGGER progression_rules_immutable_delete');
  for (const spec of [...LEDGER_TABLES].reverse()) await sql.run(`DELETE FROM ${spec.name}`);
  for (const spec of LEDGER_TABLES) {
    const names = await columns(sql, spec.name);
    const ordered = [...(byTable.get(spec.name) ?? [])];
    // Sessions and awards are inserted while their generation is open; closures are applied afterwards.
    if (spec.name === 'meditation_sessions' || spec.name === 'progression_awards') ordered.sort((a, b) => integer(a.row.sequence, 1) - integer(b.row.sequence, 1));
    for (const { row } of ordered) {
      const keys = Object.keys(row).sort();
      requireData(canonical(keys) === canonical([...names].sort()), `Ledger ${spec.name} row has unexpected columns`);
      const values = names.map((name) => spec.name === 'progression_generations' && name.startsWith('closed_') ? null : row[name]!);
      await sql.run(`INSERT INTO ${spec.name}(${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, values);
    }
  }
  for (const { row } of byTable.get('progression_generations') ?? []) {
    if (row.closed_checkpoint_json !== null) await sql.run(`UPDATE progression_generations SET closed_checkpoint_json = ?,
      closed_progression_centi = ?, closed_journey_json = ? WHERE id = ?`,
    [row.closed_checkpoint_json!, row.closed_progression_centi!, row.closed_journey_json!, row.id!]);
  }
  await restoreDeleteGuards(sql);
  await sql.exec(`CREATE TRIGGER progression_rules_immutable_delete BEFORE DELETE ON progression_rules
    BEGIN SELECT RAISE(ABORT, 'Historical records are immutable'); END;`);
  await sql.run(`UPDATE practice_completions SET acknowledged_at = MAX(?, (SELECT s.ended_at FROM meditation_sessions s
    WHERE s.id = practice_completions.session_id))`, [at]);
  // Startup validation: generations/integrity/activations, permanent journey, habit balance, receipts.
  const state = await loadState(sql, registry);
  await loadJourney(sql, state);
  await loadHabit(sql, state);
  await validateCompletions(sql, registry);
  return state;
}
