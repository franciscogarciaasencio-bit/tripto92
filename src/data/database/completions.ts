import { advanceProgression, appendability, getConsistencyIndicator, getLifetimeJourney, getJourneyProgressTransition, LEGACY_JOURNEY_VERSION, JOURNEY_VERSION, practiceCreditOutcome, practiceCredits, recordSession } from '../../domain/progression';
import type { MeditationSession, ProgressionState, JourneyProgressTransition, HabitRewardReceipt } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { decodeSessionRow } from './decoders';
import { appendTransition, loadGenerationStates } from './records';
import { canonical, integer, json, localDate, object, requireData, text, timestamp } from './validation';
import { decodeJourneyCompletion, decodeJourneyTransition, legacyJourneyPeak, persistJourneyCompletion } from './journey';
import { sameSession } from '../../domain/meditation/session';
import { currentGeneration, permitsPracticeStart } from './generations';
import type { RulesRegistry } from './decoders';
import { loadHabit, persistHabitReward, decodeHabitReceipt, validateHabitRecords } from './habit';
import { multiplyRatio } from '../../domain/progression/numeric';

/** Presentation receipt, not another XP balance or mutable practice counter. */
export interface PracticeCompletion {
  readonly session: MeditationSession;
  readonly awardedXpCenti: number;
  readonly baseXpCenti: number;
  readonly bonusXpCenti: number;
  readonly beforeProgressionCenti: number;
  readonly afterProgressionCenti: number;
  readonly previousCompletedPractices: number;
  readonly completedPractices: number;
  readonly acknowledgedAt: number | null;
  readonly progressTransition: JourneyProgressTransition | null;
  readonly habitReward: HabitRewardReceipt | null;
  /** Derived presentation endpoints, not stored rewards or another consistency balance. */
  readonly consistencyIndicator: { readonly before: number; readonly after: number };
  readonly journey: (NonNullable<ReturnType<typeof decodeJourneyCompletion>> & { readonly creditOutcome: ReturnType<typeof practiceCreditOutcome> }) | null;
}

export async function completedPracticeCount(sql: SqlConnection): Promise<number> {
  const row = object((await sql.all("SELECT COUNT(*) AS count FROM meditation_sessions WHERE status = 'completed'"))[0]);
  return integer(row.count);
}

/** Shared by live completion and startup recovery inside their caller-owned transaction. */
/** Keep an unplaceable practice, whole and immutable, in the synced set-aside record. */
export async function setAsidePractice(sql: SqlConnection, session: MeditationSession, createdAt: number) {
  await sql.run(`INSERT OR IGNORE INTO sync_set_aside_sessions(session_id, session_json, created_at, set_aside_at, reason)
    VALUES (?, ?, ?, ?, 'overlap')`, [session.id, JSON.stringify(session), createdAt, createdAt]);
}
export async function isSetAside(sql: SqlConnection, id: string) {
  return (await sql.all('SELECT 1 FROM sync_set_aside_sessions WHERE session_id = ?', [id])).length > 0;
}

export async function persistCompletion(sql: SqlConnection, before: ProgressionState, session: MeditationSession, createdAt: number) {
  // IDs stay unique across resets: old session retries preserve their original receipts, never earn again.
  const existing = (await sql.all('SELECT * FROM meditation_sessions WHERE id = ?', [session.id]))[0];
  if (existing) {
    requireData(sameSession(decodeSessionRow(existing).session, session), `Conflicting session ID: ${session.id}`);
    await sql.run("DELETE FROM meditation_timer WHERE id = 1 AND json_extract(draft_json, '$.id') = ?", [session.id]);
    return before;
  }
  const generation = await currentGeneration(sql);
  // Deletion wins: practice begun before a confirmed reset never returns, not even set aside.
  requireData(permitsPracticeStart(generation, session.startedAt), 'Meditation begins before the current progression reset boundary');
  // A finished practice that can never join history (it overlaps a practice already recorded, e.g. one
  // synced from another phone, or cannot be placed in time) is kept whole in the set-aside record
  // instead of failing on every retry and every launch.
  if (['overlap', 'rewind'].includes(appendability(before, session))) {
    await setAsidePractice(sql, session, createdAt);
    await sql.run("DELETE FROM meditation_timer WHERE id = 1 AND json_extract(draft_json, '$.id') = ?", [session.id]);
    return before;
  }
  const habit = await loadHabit(sql, before);
  const after = recordSession(before, session); // Also verifies exact duplicate content, before any writes.
  if (after !== before) {
    const settledBefore = advanceProgression(before, { timestamp: session.endedAt, localDate: session.localDate, timeZone: session.timeZone });
    await appendTransition(sql, before, after, createdAt);
    await sql.run(`INSERT INTO practice_completions(session_id, before_progression_centi, after_progression_centi)
      VALUES (?, ?, ?)`, [session.id, settledBefore.currentProgressionCenti, after.currentProgressionCenti]);
    await persistJourneyCompletion(sql, settledBefore, after, session.id);
    if (habit) await persistHabitReward(sql, habit.checkpoint, before, after, session.id);
  }
  await sql.run("DELETE FROM meditation_timer WHERE id = 1 AND json_extract(draft_json, '$.id') = ?", [session.id]);
  return after;
}

export async function loadCompletion(sql: SqlConnection, id: string): Promise<PracticeCompletion | null> {
  const result = (await sql.all(`SELECT s.*, c.before_progression_centi, c.after_progression_centi, c.acknowledged_at,
      j.before_level, j.after_level, j.credits_added, j.date_credits,
      animation.projection_json,
      habit.receipt_json,
      a.breakdown_json AS reward_breakdown, r.rules_json AS session_rules_json,
      (SELECT p.breakdown_json FROM progression_awards p WHERE p.occasion_id = a.occasion_id AND p.sequence < a.sequence
        ORDER BY p.sequence DESC LIMIT 1) AS previous_reward_breakdown,
      COALESCE(a.xp_centi, 0) AS awarded_xp_centi,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed' AND h.sequence < s.sequence) AS previous_count,
      (SELECT COUNT(*) FROM meditation_sessions h WHERE h.status = 'completed') AS completed_count
    FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
    LEFT JOIN journey_completions j ON j.session_id = s.id
    LEFT JOIN journey_animation_receipts animation ON animation.session_id = s.id
    LEFT JOIN habit_reward_receipts habit ON habit.session_id = s.id
    LEFT JOIN progression_rules r ON r.version = s.qualification_rules_version
    LEFT JOIN progression_awards a ON a.session_id = s.id WHERE c.session_id = ?`, [id]))[0];
  if (!result) return null; // Legacy history has no fabricated before/after presentation receipt.
  const row = object(result);
  const { session } = decodeSessionRow(row);
  const before = integer(row.before_progression_centi);
  const after = integer(row.after_progression_centi);
  const awarded = integer(row.awarded_xp_centi);
  const weightedBase = (value: unknown) => {
    if (value === null) return 0;
    const b = object(json(value)); return multiplyRatio(integer(b.baseCentiXp), integer(b.weightBasisPoints), 10_000);
  };
  const captured = row.reward_breakdown === null ? null : object(json(row.reward_breakdown));
  // Historical joint rounding can carry a cent between awards. Allocate display parts inside the immutable total.
  const baseXpCenti = captured?.incrementalBaseCentiXp !== undefined ? integer(captured.incrementalBaseCentiXp)
    : Math.min(awarded, Math.max(0, weightedBase(row.reward_breakdown) - weightedBase(row.previous_reward_breakdown)));
  requireData(after - before === awarded, 'Completion summary disagrees with immutable XP receipt');
  const acknowledgedAt = row.acknowledged_at === null ? null : timestamp(row.acknowledged_at);
  requireData(acknowledgedAt === null || acknowledgedAt >= session.endedAt, 'Completion acknowledged before it ended');
  const previousCompletedPractices = integer(row.previous_count);
  const completedPractices = integer(row.completed_count);
  requireData(completedPractices >= previousCompletedPractices + (session.status === 'completed' ? 1 : 0), 'Invalid practice count');
  const journey = decodeJourneyCompletion(row.before_level === null ? null : row);
  const indicatorContext = { timestamp: session.endedAt, localDate: captured?.continuousConsistencyDate === undefined
    ? session.localDate : localDate(captured.continuousConsistencyDate), timeZone: session.timeZone };
  const history = (await sql.all('SELECT * FROM meditation_sessions WHERE generation_id = ? AND sequence <= ? ORDER BY sequence',
    [integer(row.generation_id, 1), integer(row.sequence, 1)])).map(value => decodeSessionRow(value).session);
  const habitReward = row.receipt_json === null ? null : decodeHabitReceipt(json(row.receipt_json));
  requireData(row.session_rules_json !== null, 'Completion qualification rules are missing');
  const rule = object(json(row.session_rules_json));
  const linear = rule.continuousConsistency !== undefined && object(rule.continuousConsistency).algorithm === 'linear_contributions_v1';
  requireData(!linear || habitReward !== null, 'Linear completion is missing its consistency receipt');
  const consistencyIndicator = linear
    ? { before: habitReward!.consistencyBefore, after: habitReward!.consistencyAfter }
    : { before: getConsistencyIndicator(history.filter(value => value.id !== session.id), indicatorContext),
      after: getConsistencyIndicator(history, indicatorContext) };
  return { session, beforeProgressionCenti: before, afterProgressionCenti: after, awardedXpCenti: awarded,
    baseXpCenti, bonusXpCenti: integer(awarded - baseXpCenti),
    previousCompletedPractices, completedPractices, acknowledgedAt, consistencyIndicator,
    progressTransition: row.projection_json === null ? null : decodeJourneyTransition(json(row.projection_json)),
    habitReward,
    journey: journey ? { ...journey, creditOutcome: practiceCreditOutcome(session, journey.creditsAdded, journey.dateCredits) } : null };
}

export async function pendingCompletion(sql: SqlConnection) {
  const row = (await sql.all(`SELECT c.session_id FROM practice_completions c JOIN meditation_sessions s ON s.id = c.session_id
    WHERE c.acknowledged_at IS NULL ORDER BY s.sequence DESC LIMIT 1`))[0];
  return row ? loadCompletion(sql, text(object(row).session_id)) : null;
}

export async function validateCompletions(sql: SqlConnection, registry: RulesRegistry) {
  const generations = await loadGenerationStates(sql, registry);
  const animations = new Map((await sql.all('SELECT * FROM journey_animation_receipts')).map((value) => {
    const row = object(value);
    return [text(row.session_id), row.projection_json] as const;
  }));
  const legacyPeaks = new Map<number, Awaited<ReturnType<typeof legacyJourneyPeak>>>();
  for (const entry of generations) legacyPeaks.set(entry.generation.id,
    await legacyJourneyPeak(sql, entry.state, entry.generation.id, entry.generation.startedAt));
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
  for (const value of await sql.all('SELECT j.*, s.generation_id FROM journey_completions j JOIN meditation_sessions s ON s.id = j.session_id')) {
    const row = object(value);
    const entry = generations.find((entry) => entry.generation.id === integer(row.generation_id, 1));
    requireData(entry, 'Journey completion has an unknown generation');
    const state = entry.state;
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
    const displayVersion = integer(row.display_version, 1);
    requireData(displayVersion <= 3, 'Unsupported journey completion display version');
    const options = { legacyLevelOneStart: displayVersion === 1, version: displayVersion < 3 ? LEGACY_JOURNEY_VERSION : JOURNEY_VERSION };
    const oldPeak = displayVersion === 3 ? legacyPeaks.get(entry.generation.id) : null;
    const retained = oldPeak && oldPeak.achievedAt <= asOf ? oldPeak : null;
    const beforeJourney = getLifetimeJourney({ ...before, lifetimeXpCenti: priorXp, asOf }, retained, options);
    const afterJourney = getLifetimeJourney({ ...after, lifetimeXpCenti: integer(priorXp + awardedXp), asOf }, retained, options);
    requireData(captured.beforeLevel === beforeJourney.level.number && captured.afterLevel === afterJourney.level.number,
      'Journey completion levels disagree with their historical requirements');
    const hasAnimation = animations.has(id);
    requireData(displayVersion === 3 ? hasAnimation : !hasAnimation, 'Reward animation receipt is missing or unexpected');
    if (hasAnimation) requireData(canonical(decodeJourneyTransition(json(animations.get(id)))) ===
      canonical(getJourneyProgressTransition(beforeJourney, afterJourney)), 'Reward animation disagrees with saved practice');
    animations.delete(id);
  }
  requireData(animations.size === 0, 'Orphan reward animation receipt');
  await validateHabitRecords(sql, generations);
}
