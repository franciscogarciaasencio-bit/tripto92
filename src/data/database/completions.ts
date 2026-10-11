import { advanceProgression, getLifetimeJourney, practiceCreditOutcome, practiceCredits, recordSession } from '../../domain/progression';
import type { MeditationSession, ProgressionState } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { decodeSessionRow } from './decoders';
import { appendTransition } from './records';
import { integer, object, requireData, text, timestamp } from './validation';
import { decodeJourneyCompletion, persistJourneyCompletion } from './journey';

/** Presentation receipt, not another XP balance or mutable practice counter. */
export interface PracticeCompletion {
  readonly session: MeditationSession;
  readonly awardedXpCenti: number;
  readonly beforeProgressionCenti: number;
  readonly afterProgressionCenti: number;
  readonly previousCompletedPractices: number;
  readonly completedPractices: number;
  readonly acknowledgedAt: number | null;
  readonly journey: (NonNullable<ReturnType<typeof decodeJourneyCompletion>> & { readonly creditOutcome: ReturnType<typeof practiceCreditOutcome> }) | null;
}

export async function completedPracticeCount(sql: SqlConnection): Promise<number> {
  const row = object((await sql.all("SELECT COUNT(*) AS count FROM meditation_sessions WHERE status = 'completed'"))[0]);
  return integer(row.count);
}

/** Shared by live completion and startup recovery inside their caller-owned transaction. */
export async function persistCompletion(sql: SqlConnection, before: ProgressionState, session: MeditationSession, createdAt: number) {
  const after = recordSession(before, session); // Also verifies exact duplicate content, before any writes.
  if (after !== before) {
    const settledBefore = advanceProgression(before, { timestamp: session.endedAt, localDate: session.localDate, timeZone: session.timeZone });
    await appendTransition(sql, before, after, createdAt);
    await sql.run(`INSERT INTO practice_completions(session_id, before_progression_centi, after_progression_centi)
      VALUES (?, ?, ?)`, [session.id, settledBefore.currentProgressionCenti, after.currentProgressionCenti]);
    await persistJourneyCompletion(sql, settledBefore, after, session.id);
  }
  await sql.run("DELETE FROM meditation_timer WHERE id = 1 AND json_extract(draft_json, '$.id') = ?", [session.id]);
  return after;
}

export async function loadCompletion(sql: SqlConnection, id: string): Promise<PracticeCompletion | null> {
  const result = (await sql.all(`SELECT s.*, c.before_progression_centi, c.after_progression_centi, c.acknowledged_at,
      j.before_level, j.after_level, j.credits_added, j.date_credits,
      COALESCE(a.xp_centi, 0) AS awarded_xp_centi,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed' AND h.sequence < s.sequence) AS previous_count,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed') AS completed_count
    FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
    LEFT JOIN journey_completions j ON j.session_id = s.id
    LEFT JOIN progression_awards a ON a.session_id = s.id WHERE c.session_id = ?`, [id]))[0];
  if (!result) return null; // Legacy history has no fabricated before/after presentation receipt.
  const row = object(result);
  const { session } = decodeSessionRow(row);
  const before = integer(row.before_progression_centi);
  const after = integer(row.after_progression_centi);
  const awarded = integer(row.awarded_xp_centi);
  requireData(after - before === awarded, 'Completion summary disagrees with immutable XP receipt');
  const acknowledgedAt = row.acknowledged_at === null ? null : timestamp(row.acknowledged_at);
  requireData(acknowledgedAt === null || acknowledgedAt >= session.endedAt, 'Completion acknowledged before it ended');
  const previousCompletedPractices = integer(row.previous_count);
  const completedPractices = integer(row.completed_count);
  requireData(completedPractices >= previousCompletedPractices + (session.status === 'completed' ? 1 : 0), 'Invalid practice count');
  const journey = decodeJourneyCompletion(row.before_level === null ? null : row);
  return { session, beforeProgressionCenti: before, afterProgressionCenti: after, awardedXpCenti: awarded,
    previousCompletedPractices, completedPractices, acknowledgedAt,
    journey: journey ? { ...journey, creditOutcome: practiceCreditOutcome(session, journey.creditsAdded, journey.dateCredits) } : null };
}

export async function pendingCompletion(sql: SqlConnection) {
  const row = (await sql.all(`SELECT c.session_id FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
    WHERE c.acknowledged_at IS NULL ORDER BY s.sequence DESC LIMIT 1`))[0];
  return row ? loadCompletion(sql, text(object(row).session_id)) : null;
}

export async function validateCompletions(sql: SqlConnection, state: ProgressionState) {
  // One query for startup integrity. The two history counts are only needed for the pending summary.
  for (const value of await sql.all(`SELECT c.*, s.ended_at, COALESCE(a.xp_centi, 0) AS awarded_xp_centi
    FROM practice_completions c LEFT JOIN meditation_sessions s ON s.id = c.session_id
    LEFT JOIN progression_awards a ON a.session_id = c.session_id`)) {
    const row = object(value);
    text(row.session_id);
    const endedAt = timestamp(row.ended_at);
    requireData(integer(row.after_progression_centi) - integer(row.before_progression_centi) === integer(row.awarded_xp_centi),
      'Completion summary disagrees with immutable XP receipt');
    requireData(row.acknowledged_at === null || timestamp(row.acknowledged_at) >= endedAt, 'Completion acknowledged before it ended');
  }
  for (const value of await sql.all('SELECT * FROM journey_completions')) {
    const row = object(value);
    const id = text(row.session_id);
    const index = state.sessions.findIndex((entry) => entry.session.id === id);
    requireData(index >= 0, 'Orphan journey completion');
    const before = practiceCredits(state.sessions.slice(0, index).map((entry) => entry.session));
    const after = practiceCredits(state.sessions.slice(0, index + 1).map((entry) => entry.session));
    const captured = decodeJourneyCompletion(row)!;
    requireData(captured.creditsAdded === after.credits - before.credits && captured.dateCredits ===
      (after.dates.find((date) => date.localDate === state.sessions[index]!.session.localDate)?.credits ?? 0),
    'Journey completion disagrees with history');
    const precedingIds = new Set(state.sessions.slice(0, index).map((entry) => entry.session.id));
    const priorXp = state.awards.filter((award) => precedingIds.has(award.sessionId))
      .reduce((sum, award) => integer(sum + award.xpCenti), 0);
    const awardedXp = state.awards.find((award) => award.sessionId === id)?.xpCenti ?? 0;
    const asOf = state.sessions[index]!.session.endedAt;
    const beforeLevel = getLifetimeJourney({ ...before, lifetimeXpCenti: priorXp, asOf }).level.number;
    const afterLevel = getLifetimeJourney({ ...after, lifetimeXpCenti: integer(priorXp + awardedXp), asOf }).level.number;
    requireData(captured.beforeLevel === beforeLevel && captured.afterLevel === afterLevel,
      'Journey completion levels disagree with their historical requirements');
  }
}
