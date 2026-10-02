import { advanceProgression, recordSession } from '../../domain/progression';
import type { MeditationSession, ProgressionState } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { decodeSessionRow } from './decoders';
import { appendTransition } from './records';
import { integer, object, requireData, text, timestamp } from './validation';

/** Presentation receipt, not another XP balance or mutable practice counter. */
export interface PracticeCompletion {
  readonly session: MeditationSession;
  readonly awardedXpCenti: number;
  readonly beforeProgressionCenti: number;
  readonly afterProgressionCenti: number;
  readonly previousCompletedPractices: number;
  readonly completedPractices: number;
  readonly acknowledgedAt: number | null;
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
  }
  await sql.run("DELETE FROM meditation_timer WHERE id = 1 AND json_extract(draft_json, '$.id') = ?", [session.id]);
  return after;
}

export async function loadCompletion(sql: SqlConnection, id: string): Promise<PracticeCompletion | null> {
  const result = (await sql.all(`SELECT s.*, c.before_progression_centi, c.after_progression_centi, c.acknowledged_at,
      COALESCE(a.xp_centi, 0) AS awarded_xp_centi,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed' AND h.sequence < s.sequence) AS previous_count,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed') AS completed_count
    FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
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
  return { session, beforeProgressionCenti: before, afterProgressionCenti: after, awardedXpCenti: awarded,
    previousCompletedPractices, completedPractices, acknowledgedAt };
}

export async function pendingCompletion(sql: SqlConnection) {
  const row = (await sql.all(`SELECT c.session_id FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
    WHERE c.acknowledged_at IS NULL ORDER BY s.sequence DESC LIMIT 1`))[0];
  return row ? loadCompletion(sql, text(object(row).session_id)) : null;
}

export async function validateCompletions(sql: SqlConnection) {
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
}
