import type { ProgressionState } from '../../domain/progression';
import { dayNumber, dateFromDay } from '../../domain/progression/calendar';
import { protectedFloor } from '../../domain/progression/decay';
import { consistencyRatio } from '../../domain/progression/earnings';
import { isRewardEligible, sessionConsistency } from '../../domain/progression';
import { multiplyRatio } from '../../domain/progression/numeric';
import { rulesForVersion } from '../../domain/progression/rules';
import { canonical, integer, requireData } from './validation';

/** Validate ledger relationships without running an earnings formula or rewriting a receipt. */
export function validateIntegrity(state: ProgressionState): void {
  const rules = rulesForVersion(state);
  requireData(state.currentProgressionCenti <= state.lifetimeXpCenti &&
    state.currentProgressionCenti >= protectedFloor(state.lifetimeXpCenti, rules), 'Invalid progression balance');
  requireData(dayNumber(state.settledThroughDate) >= dayNumber(state.asOf.localDate) - 1, 'Checkpoint has unsettled past days');
  const best = state.highestRankAchieved;
  const bestRules = rulesForVersion(state, best.rulesVersion);
  requireData(bestRules.ranks.some((rank) => canonical(rank) === canonical(best.rank)), 'Unknown historical rank achievement');
  const currentRank = rules.ranks.filter((rank) => rank.thresholdCentiXp <= state.currentProgressionCenti).at(-1)!;
  requireData(best.achievedAt <= state.asOf.timestamp && best.rank.thresholdCentiXp <= state.lifetimeXpCenti &&
    best.rank.thresholdCentiXp >= currentRank.thresholdCentiXp, 'Invalid highest rank achievement');

  let previousEnd = 0;
  const ids = new Set<string>();
  for (const entry of state.sessions) {
    const session = entry.session;
    requireData(!ids.has(session.id), 'Duplicate session ID');
    ids.add(session.id);
    requireData(session.startedAt >= previousEnd && session.endedAt <= state.asOf.timestamp, 'Session order conflicts with checkpoint');
    const qualification = rulesForVersion(state, entry.qualificationRulesVersion);
    requireData(entry.qualified === (session.activeDurationSeconds >= qualification.minimumActiveSeconds &&
      (qualification.practiceDayEligibility !== 'completed_minimum' || session.status === 'completed')),
      'Historical qualification conflicts with its rules');
    previousEnd = session.endedAt;
  }
  const rewarded = state.sessions.filter((entry) => isRewardEligible(entry.session, rulesForVersion(state, entry.qualificationRulesVersion)));
  requireData(rewarded.length === state.awards.length, 'A reward-eligible session is missing its receipt');
  for (const [index, entry] of rewarded.entries()) {
    const award = state.awards[index]!;
    requireData(award.sessionId === entry.session.id && award.id === `award:${entry.session.id}` &&
      award.awardedAt === entry.session.endedAt && award.localDate === entry.session.localDate, 'Receipt does not match its session');
    rulesForVersion(state, award.rulesVersion);
  }
  requireData(canonical(state.occasions.flatMap((occasion) => occasion.sessionIds)) ===
    canonical(rewarded.map((entry) => entry.session.id)), 'Occasions do not match reward-eligible history');

  let position = 0;
  const dayCounts = new Map<string, number>();
  const priorDays = new Set<number>();
  let previousOccasion: ProgressionState['occasions'][number] | undefined;
  for (const occasion of state.occasions) {
    requireData(occasion.sessionIds.length > 0, 'Empty practice occasion');
    const originalRules = rulesForVersion(state, occasion.rulesVersion);
    const first = rewarded[position]!;
    const ordinal = (dayCounts.get(occasion.rewardDate) ?? 0) + 1;
    dayCounts.set(occasion.rewardDate, ordinal);
    requireData(occasion.id === `occasion:${first.session.id}` && occasion.startedAt === first.session.startedAt &&
      occasion.rewardDate === first.session.localDate && occasion.rulesVersion === first.qualificationRulesVersion &&
      occasion.ordinalInDay === ordinal && occasion.weightBasisPoints === (originalRules.occasionWeightsBasisPoints[ordinal - 1] ?? 0),
    'Invalid occasion origin or frequency metadata');
    const today = dayNumber(occasion.rewardDate);
    const consistencyDays = originalRules.practiceDayEligibility === 'completed_minimum'
      ? new Set(state.sessions.filter((entry) => entry.session.endedAt <= first.session.startedAt &&
        entry.session.status === 'completed' && entry.session.activeDurationSeconds >= originalRules.minimumActiveSeconds)
        .map((entry) => dayNumber(entry.session.localDate))) : priorDays;
    let preceding = 0;
    for (let day = today - originalRules.consistencyWindowDays; day < today; day++) {
      if (consistencyDays.has(day)) preceding++;
    }
    requireData(occasion.precedingActiveDays === preceding, 'Invalid captured consistency');
    if (previousOccasion) {
      const previousRules = rulesForVersion(state, previousOccasion.rulesVersion);
      // V3 short/early-ended practice cannot extend a frozen older occasion that excluded it.
      const incompatibleBoundary = originalRules.earningsAlgorithm !== 'logarithmic_v1' &&
        (!isRewardEligible(first.session, previousRules) || (!!originalRules.continuousConsistency && !previousRules.continuousConsistency) ||
          state.consistencyActivations?.some(anchor => anchor.rulesVersion === originalRules.version &&
            anchor.asOf.timestamp >= previousOccasion!.endedAt && anchor.asOf.timestamp <= first.session.endedAt &&
            anchor.sessionCount === state.sessions.findIndex(entry => entry.session.id === first.session.id)));
      requireData(incompatibleBoundary || occasion.startedAt - previousOccasion.endedAt >=
        previousRules.occasionSeparationSeconds * 1000, 'Incorrect occasion separation');
    }
    const ratio = consistencyRatio(occasion.precedingActiveDays, originalRules);
    let active = 0;
    let earned = 0;
    let baseEarned = 0;
    let lastEnd = occasion.startedAt;
    for (const id of occasion.sessionIds) {
      const entry = rewarded[position]!;
      const award = state.awards[position++]!;
      active = integer(active + entry.session.activeDurationSeconds);
      requireData(entry.session.startedAt - lastEnd < originalRules.occasionSeparationSeconds * 1000, 'Incorrect occasion extension');
      lastEnd = entry.session.endedAt;
      const b = award.breakdown;
      let capturedRatio = ratio;
      if (originalRules.continuousConsistency) {
        const c = originalRules.continuousConsistency;
        requireData(b.continuousConsistencyDate && dayNumber(b.continuousConsistencyDate) >= dayNumber(award.localDate) &&
          dayNumber(b.continuousConsistencyDate) <= dayNumber(state.settledThroughDate) + 1, 'Invalid settled consistency date');
        const priorSessions = state.sessions.filter((entry) => entry.session.endedAt <= award.awardedAt && entry.session.id !== id);
        const priorIds = new Set(priorSessions.map((entry) => entry.session.id));
        const priorState = { ...state, sessions: priorSessions, awards: state.awards.filter((award) => priorIds.has(award.sessionId)),
          activeRulesVersion: award.rulesVersion,
          consistencyActivations: (state.consistencyActivations ?? []).filter(anchor => anchor.sessionCount <= priorSessions.length && anchor.asOf.timestamp <= award.awardedAt),
          asOf: { timestamp: award.awardedAt, localDate: b.continuousConsistencyDate, timeZone: entry.session.timeZone },
          settledThroughDate: dateFromDay(dayNumber(b.continuousConsistencyDate) - 1) };
        const score = sessionConsistency(priorState, { ...priorState, sessions: [...priorSessions, entry] }, c).score;
        capturedRatio = { numerator: c.scale * 10_000 + score * originalRules.maximumConsistencyBonusBasisPoints, denominator: c.scale * 10_000 };
        const cumulativeBase = multiplyRatio(b.baseCentiXp, occasion.weightBasisPoints, 10_000);
        requireData(b.continuousConsistencyScore === score && b.incrementalBaseCentiXp === cumulativeBase - baseEarned &&
          b.bonusCentiXp === multiplyRatio(b.incrementalBaseCentiXp, score * originalRules.maximumConsistencyBonusBasisPoints, c.scale * 10_000) &&
          award.xpCenti === b.incrementalBaseCentiXp + b.bonusCentiXp, 'Invalid continuous reward breakdown');
        baseEarned = cumulativeBase;
      }
      requireData(award.sessionId === id && award.occasionId === occasion.id && award.rulesVersion === occasion.rulesVersion &&
        award.rewardDate === occasion.rewardDate && b.occasionActiveSeconds === active && b.weightBasisPoints === occasion.weightBasisPoints &&
        b.precedingActiveDays === occasion.precedingActiveDays && b.consistencyNumerator === capturedRatio.numerator && b.consistencyDenominator === capturedRatio.denominator &&
        b.previousOccasionCentiXp === earned && b.cumulativeOccasionCentiXp === integer(earned + award.xpCenti), 'Invalid cumulative award chain');
      earned = b.cumulativeOccasionCentiXp;
      if (entry.qualified) priorDays.add(dayNumber(entry.session.localDate));
    }
    requireData(occasion.endedAt === lastEnd && occasion.activeDurationSeconds === active && occasion.awardedCentiXp === earned,
      'Occasion checkpoint conflicts with receipts');
    if (originalRules.continuousConsistency) requireData(occasion.awardedBaseCentiXp === baseEarned, 'Invalid continuous base checkpoint');
    previousOccasion = occasion;
  }
}
