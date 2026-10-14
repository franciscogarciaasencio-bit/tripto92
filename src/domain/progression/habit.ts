import { dayNumber, dateFromDay, validateContext, type CalendarContext } from './calendar';
import { progressionConsistency, CONTINUOUS_CONSISTENCY } from './consistency';
import { getJourneyFromState, getLifetimeJourney, getJourneyProgressTransition, HABIT_LEVELS, HABIT_JOURNEY_VERSION, practiceCredits, type JourneyProgressTransition } from './journey';
import { assertNonnegativeInteger, freeze, multiplyRatio } from './numeric';
import type { ProgressionState } from './types';

export const HABIT_RULES = freeze({ version: 'ona_habit_v1', graceDays: 3,
  dailyExcessRetentionMillionths: 981_099, scale: 1_000_000, floorDivisor: 2 });
export interface HabitCheckpoint {
  readonly version: string; readonly asOf: CalendarContext; readonly settledThroughDate: string;
  readonly effectiveXpCenti: number; readonly highestLevel: number; readonly sessionCount: number; readonly awardCount: number;
  readonly seedEffectiveXpCenti: number; readonly seedLevel: number; readonly activationAwardCount: number;
}
export interface HabitRewardReceipt {
  readonly beforeCheckpoint: HabitCheckpoint; readonly afterCheckpoint: HabitCheckpoint;
  readonly version: string; readonly baseCentiXp: number; readonly bonusCentiXp: number; readonly totalCentiXp: number;
  readonly consistencyBefore: number; readonly consistencyAfter: number;
  readonly baseProgress: JourneyProgressTransition; readonly bonusProgress: JourneyProgressTransition;
  readonly explanation: 'short' | 'too_close' | 'daily_cap' | null;
}
export function createHabitCheckpoint(state: ProgressionState, highestLevel = getJourneyFromState(state).level.number): HabitCheckpoint {
  const seed = Math.max(state.lifetimeXpCenti, highestLevel === 0 ? 0 : HABIT_LEVELS[highestLevel - 1]!.xpCenti);
  const candidate = { version: HABIT_RULES.version, asOf: state.asOf, settledThroughDate: state.settledThroughDate,
    // Preserve a legitimately migrated level under the new curve without awarding historical Ripples.
    effectiveXpCenti: seed, seedEffectiveXpCenti: seed, seedLevel: highestLevel, activationAwardCount: state.awards.length,
    highestLevel, sessionCount: state.sessions.length, awardCount: state.awards.length };
  return freeze({ ...candidate, highestLevel: Math.max(highestLevel, habitJourney(candidate,state).level.number) });
}
export function validateHabit(checkpoint: HabitCheckpoint) {
  if (checkpoint.version !== HABIT_RULES.version) throw new RangeError('Unsupported habit version');
  validateContext(checkpoint.asOf); dayNumber(checkpoint.settledThroughDate);
  if (dayNumber(checkpoint.settledThroughDate) < dayNumber(checkpoint.asOf.localDate) - 1) throw new RangeError('Habit checkpoint has unsettled days');
  for (const name of ['effectiveXpCenti', 'highestLevel', 'sessionCount', 'awardCount', 'seedEffectiveXpCenti', 'seedLevel', 'activationAwardCount'] as const) assertNonnegativeInteger(checkpoint[name], name);
  if (checkpoint.highestLevel > 125 || checkpoint.seedLevel > checkpoint.highestLevel || checkpoint.activationAwardCount > checkpoint.awardCount) throw new RangeError('Invalid habit level');
}
export function protectedHabitLevel(highest: number) { return Math.ceil(highest / HABIT_RULES.floorDivisor); }
export function habitJourney(checkpoint: HabitCheckpoint, state: ProgressionState) {
  validateHabit(checkpoint);
  const metrics = practiceCredits(state.sessions.map((entry) => entry.session));
  const floor = protectedHabitLevel(checkpoint.highestLevel);
  return getLifetimeJourney({ ...metrics, lifetimeXpCenti: state.lifetimeXpCenti, effectiveXpCenti: checkpoint.effectiveXpCenti, asOf: checkpoint.asOf.timestamp },
    { version: HABIT_JOURNEY_VERSION, level: floor, achievedAt: checkpoint.asOf.timestamp }, { version: HABIT_JOURNEY_VERSION });
}
export function advanceHabit(checkpoint: HabitCheckpoint, state: ProgressionState, asOf: CalendarContext): HabitCheckpoint {
  validateHabit(checkpoint); validateContext(asOf);
  if (asOf.timestamp < checkpoint.asOf.timestamp) throw new RangeError('Cannot rewind habit time');
  const dates = practiceCredits(state.sessions.map((entry) => entry.session)).dates.map((date) => dayNumber(date.localDate));
  const sessions = new Map(state.sessions.map((entry) => [entry.session.id, entry.session]));
  for (const award of state.awards) {
    const session = sessions.get(award.sessionId)!;
    if (award.breakdown.continuousConsistencyDate && session.status === 'completed' && session.activeDurationSeconds >= 180)
      dates.push(dayNumber(award.breakdown.continuousConsistencyDate));
  }
  dates.sort((a,b) => a-b);
  const through = Math.max(dayNumber(checkpoint.settledThroughDate), dayNumber(asOf.localDate) - 1);
  const protectedLevel = protectedHabitLevel(checkpoint.highestLevel);
  const floor = protectedLevel === 0 ? 0 : HABIT_LEVELS[protectedLevel - 1]!.xpCenti;
  let effective = Math.max(checkpoint.effectiveXpCenti, floor);
  for (let day = dayNumber(checkpoint.settledThroughDate) + 1; day <= through; day++) {
    // Before any qualifying practice, the first saved practice starts the inactivity clock.
    // Later short sessions cannot move it or protect an otherwise inactive date.
    const last = dates.filter((date) => date <= day).at(-1) ??
      (state.sessions.length ? dayNumber(state.sessions[0]!.session.localDate) : undefined);
    if (last !== undefined && day - last > HABIT_RULES.graceDays) effective = floor +
      multiplyRatio(effective - floor, HABIT_RULES.dailyExcessRetentionMillionths, HABIT_RULES.scale);
  }
  return freeze({ ...checkpoint, asOf: { ...asOf }, effectiveXpCenti: effective, settledThroughDate: dateFromDay(through) });
}
export function recordHabitReward(checkpoint: HabitCheckpoint, before: ProgressionState, after: ProgressionState) {
  const session = after.sessions.at(-1)!.session;
  const at = { timestamp: session.endedAt, localDate: session.localDate, timeZone: session.timeZone };
  const settled = advanceHabit(checkpoint, before, at);
  const award = after.awards.find((entry) => entry.sessionId === session.id);
  const totalCentiXp = award?.xpCenti ?? 0;
  const baseCentiXp = award?.breakdown.incrementalBaseCentiXp ?? totalCentiXp;
  const bonusCentiXp = totalCentiXp - baseCentiXp;
  const beforeJourney = habitJourney(settled, before);
  const baseState = { ...settled, effectiveXpCenti: settled.effectiveXpCenti + baseCentiXp };
  const baseJourney = habitJourney(baseState, after);
  const earned = { ...baseState, effectiveXpCenti: baseState.effectiveXpCenti + bonusCentiXp };
  const finalJourney = habitJourney(earned, after);
  const updated = freeze({ ...earned, highestLevel: Math.max(checkpoint.highestLevel, finalJourney.level.number),
    sessionCount: after.sessions.length, awardCount: after.awards.length });
  // A historical completion retains the rules that produced its immutable award, even after activation.
  const rewardRulesVersion = award?.rulesVersion ?? after.activeRulesVersion;
  const config = after.ruleSets.find((rule) => rule.version === rewardRulesVersion)?.continuousConsistency ?? CONTINUOUS_CONSISTENCY;
  const oldConsistency = progressionConsistency({ ...before, activeRulesVersion: rewardRulesVersion,
    asOf: settled.asOf, settledThroughDate: settled.settledThroughDate }, config).fraction;
  const newConsistency = award?.breakdown.continuousConsistencyScore !== undefined ? award.breakdown.continuousConsistencyScore / config.scale : oldConsistency;
  const oldCredit = practiceCredits(before.sessions.map((entry) => entry.session)), newCredit = practiceCredits(after.sessions.map((entry) => entry.session));
  const daily = newCredit.dates.find((date) => date.localDate === session.localDate)?.credits ?? 0;
  const explanation = session.activeDurationSeconds < 180 ? 'short' : session.status !== 'completed' ? null
    : newCredit.credits === oldCredit.credits ? daily >= 2 ? 'daily_cap' : 'too_close' : null;
  const receipt: HabitRewardReceipt = { version: HABIT_RULES.version, baseCentiXp, bonusCentiXp, totalCentiXp,
    beforeCheckpoint: settled, afterCheckpoint: updated,
    consistencyBefore: oldConsistency, consistencyAfter: newConsistency,
    baseProgress: getJourneyProgressTransition(beforeJourney, baseJourney), bonusProgress: getJourneyProgressTransition(baseJourney, finalJourney), explanation };
  return freeze({ checkpoint: updated, receipt, journey: habitJourney(updated, after) });
}
