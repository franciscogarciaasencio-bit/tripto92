import { advanceHabit, createHabitCheckpoint, habitJourney, recordHabitReward, validateHabit, HABIT_RULES, getLifetimeJourney, practiceCredits, HABIT_LEVELS, HABIT_JOURNEY_VERSION,
  protectedHabitLevel, type HabitCheckpoint, type HabitRewardReceipt, type ProgressionState } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { decodeContext } from './decoders';
import { currentGeneration } from './generations';
import { loadJourney, decodeJourneyTransition } from './journey';
import { canonical, integer, json, object, requireData, text, localDate } from './validation';
import { dayNumber } from '../../domain/progression/calendar';
import { PersistenceError } from './errors';

function decodeHabit(value: unknown): HabitCheckpoint {
  const row = object(value);
  const checkpoint = { version: text(row.version), asOf: decodeContext(row.asOf), settledThroughDate: localDate(row.settledThroughDate),
    effectiveXpCenti: integer(row.effectiveXpCenti), highestLevel: integer(row.highestLevel),
    sessionCount: integer(row.sessionCount), awardCount: integer(row.awardCount), seedEffectiveXpCenti: integer(row.seedEffectiveXpCenti),
    seedLevel: integer(row.seedLevel), activationAwardCount: integer(row.activationAwardCount) };
  try { validateHabit(checkpoint); }
  catch (cause) { throw new PersistenceError('INVALID_DATA', 'Invalid habit checkpoint', { cause }); }
  return checkpoint;
}
export function decodeHabitReceipt(value: unknown): HabitRewardReceipt {
  const row = object(value), baseCentiXp = integer(row.baseCentiXp), bonusCentiXp = integer(row.bonusCentiXp), totalCentiXp = integer(row.totalCentiXp);
  const c = (value: unknown) => { requireData(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'Invalid habit consistency'); return value; };
  const explanation = row.explanation;
  requireData(text(row.version) === HABIT_RULES.version && totalCentiXp === baseCentiXp + bonusCentiXp &&
    (explanation === null || explanation === 'short' || explanation === 'too_close' || explanation === 'daily_cap'), 'Invalid habit reward receipt');
  const before = c(row.consistencyBefore), after = c(row.consistencyAfter);
  requireData(after >= before, 'Completion consistency cannot decrease');
  return { version: HABIT_RULES.version, baseCentiXp, bonusCentiXp, totalCentiXp, consistencyBefore: before, consistencyAfter: after,
    beforeCheckpoint: decodeHabit(row.beforeCheckpoint), afterCheckpoint: decodeHabit(row.afterCheckpoint),
    baseProgress: decodeJourneyTransition(row.baseProgress,HABIT_JOURNEY_VERSION), bonusProgress: decodeJourneyTransition(row.bonusProgress,HABIT_JOURNEY_VERSION), explanation };
}
export async function writeHabit(sql: SqlConnection, generationId: number, checkpoint: HabitCheckpoint) {
  await sql.run('INSERT INTO habit_checkpoints(generation_id, checkpoint_json) VALUES(?, ?) ON CONFLICT(generation_id) DO UPDATE SET checkpoint_json=excluded.checkpoint_json',
    [generationId, JSON.stringify(checkpoint)]);
}
export async function loadHabit(sql: SqlConnection, state: ProgressionState, initialize = false) {
  if (!state.ruleSets.find((rules) => rules.version === state.activeRulesVersion)?.continuousConsistency) return null;
  const generation = await currentGeneration(sql);
  const row = (await sql.all('SELECT checkpoint_json FROM habit_checkpoints WHERE generation_id=?', [generation.id]))[0];
  let checkpoint: HabitCheckpoint;
  if (!row) {
    requireData(initialize, 'Habit checkpoint is missing; practice has not been changed');
    checkpoint = createHabitCheckpoint(state, (await loadJourney(sql, state)).level.number);
  } else {
    checkpoint = decodeHabit(json(object(row).checkpoint_json));
    requireData(checkpoint.sessionCount === state.sessions.length && checkpoint.awardCount === state.awards.length &&
      checkpoint.asOf.timestamp <= state.asOf.timestamp && checkpoint.asOf.timestamp >= generation.startedAt,
    'Habit checkpoint disagrees with history');
    requireData(dayNumber(checkpoint.settledThroughDate) <= dayNumber(state.settledThroughDate), 'Habit checkpoint advances beyond known calendar');
    const permanent = await loadJourney(sql, state);
    const upper = checkpoint.seedEffectiveXpCenti + state.awards.slice(checkpoint.activationAwardCount).reduce((sum, award) => integer(sum + award.xpCenti), 0);
    const originalXp = state.awards.slice(0, checkpoint.activationAwardCount).reduce((sum, award) => integer(sum + award.xpCenti), 0);
    const seedThreshold = checkpoint.seedLevel === 0 ? 0 : HABIT_LEVELS[checkpoint.seedLevel - 1]!.xpCenti;
    const credit = practiceCredits(state.sessions.map((entry) => entry.session));
    const maximum = getLifetimeJourney({ ...credit, lifetimeXpCenti: state.lifetimeXpCenti, effectiveXpCenti: upper, asOf: state.asOf.timestamp },
      { version: HABIT_JOURNEY_VERSION, level: checkpoint.seedLevel, achievedAt: state.asOf.timestamp }, { version: HABIT_JOURNEY_VERSION });
    const protectedLevel = protectedHabitLevel(checkpoint.highestLevel);
    const floor = protectedLevel === 0 ? 0 : HABIT_LEVELS[protectedLevel - 1]!.xpCenti;
    requireData(checkpoint.seedEffectiveXpCenti === Math.max(originalXp, seedThreshold) && checkpoint.seedLevel <= permanent.level.number &&
      checkpoint.highestLevel <= maximum.level.number && checkpoint.effectiveXpCenti >= floor && checkpoint.effectiveXpCenti <= upper,
      'Invalid effective habit balance or highest level');
  }
  const projected = advanceHabit(checkpoint, state, state.asOf);
  await writeHabit(sql, generation.id, projected);
  return { checkpoint: projected, journey: habitJourney(projected, state) };
}
export async function persistHabitReward(sql: SqlConnection, checkpoint: HabitCheckpoint, before: ProgressionState, after: ProgressionState, id: string) {
  const result = recordHabitReward(checkpoint, before, after);
  await writeHabit(sql, (await currentGeneration(sql)).id, result.checkpoint);
  await sql.run('INSERT INTO habit_reward_receipts(session_id, receipt_json) VALUES(?, ?)', [id, JSON.stringify(result.receipt)]);
}

/** Validate saved presentation against immutable prefixes without re-awarding or rewriting history. */
export async function validateHabitRecords(sql: SqlConnection, entries: readonly { generation: { id: number }; state: ProgressionState }[]) {
  const rows = new Map((await sql.all('SELECT * FROM habit_reward_receipts')).map((value) => {
    const row = object(value); return [text(row.session_id), row.receipt_json] as const;
  }));
  for (const { generation, state } of entries) {
    let previous: HabitCheckpoint | null = null;
    for (let index = 0; index < state.sessions.length; index++) {
      const session = state.sessions[index]!.session;
      const continuous = state.ruleSets.find((rule) => rule.version === state.sessions[index]!.qualificationRulesVersion)?.continuousConsistency;
      const stored = rows.get(session.id);
      requireData(continuous ? stored !== undefined : stored === undefined, 'Habit reward receipt is missing or unexpected');
      if (stored === undefined) continue;
      const receipt = decodeHabitReceipt(json(stored)); rows.delete(session.id);
      const priorIds = new Set(state.sessions.slice(0, index).map((entry) => entry.session.id));
      const priorAwards = state.awards.filter((award) => priorIds.has(award.sessionId));
      const before: ProgressionState = { ...state, sessions: state.sessions.slice(0, index), awards: priorAwards,
        activeRulesVersion: state.sessions[index]!.qualificationRulesVersion,
        consistencyActivations: (state.consistencyActivations ?? []).filter(anchor => anchor.sessionCount <= index && anchor.asOf.timestamp <= session.endedAt),
        lifetimeXpCenti: priorAwards.reduce((sum, award) => integer(sum + award.xpCenti), 0) };
      const award = state.awards.find((award) => award.sessionId === session.id);
      const after: ProgressionState = { ...before, sessions: state.sessions.slice(0, index + 1), awards: [...priorAwards, ...(award ? [award] : [])],
        lifetimeXpCenti: integer(before.lifetimeXpCenti + (award?.xpCenti ?? 0)) };
      requireData(receipt.beforeCheckpoint.sessionCount === index && receipt.beforeCheckpoint.awardCount === priorAwards.length,
        'Habit reward cursor disagrees with history');
      if (previous) requireData(canonical(advanceHabit(previous, before, receipt.beforeCheckpoint.asOf)) === canonical(receipt.beforeCheckpoint),
        'Habit reward sequence disagrees with history');
      const expected = recordHabitReward(receipt.beforeCheckpoint, before, after).receipt;
      requireData(canonical(expected) === canonical(receipt), 'Habit reward animation disagrees with saved practice');
      previous = receipt.afterCheckpoint;
    }
    const checkpointRow = (await sql.all('SELECT checkpoint_json FROM habit_checkpoints WHERE generation_id=?', [generation.id]))[0];
    if (previous && checkpointRow) requireData(canonical(advanceHabit(previous, state, state.asOf)) ===
      canonical(decodeHabit(json(object(checkpointRow).checkpoint_json))), 'Habit checkpoint conflicts with receipt sequence');
  }
  requireData(rows.size === 0, 'Orphan habit reward receipt');
}
