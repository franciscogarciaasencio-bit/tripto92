import type { ProgressionState } from '../../domain/progression';
import { dayNumber } from '../../domain/progression/calendar';
import { protectedFloor } from '../../domain/progression/decay';
import { consistencyRatio } from '../../domain/progression/earnings';
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
    requireData(entry.qualified === (session.activeDurationSeconds >= rulesForVersion(state, entry.qualificationRulesVersion).minimumActiveSeconds),
      'Historical qualification conflicts with its rules');
    previousEnd = session.endedAt;
  }
  const qualifying = state.sessions.filter((entry) => entry.qualified);
  requireData(qualifying.length === state.awards.length, 'A qualifying session is missing its receipt');
  for (const [index, entry] of qualifying.entries()) {
    const award = state.awards[index]!;
    requireData(award.sessionId === entry.session.id && award.id === `award:${entry.session.id}` &&
      award.awardedAt === entry.session.endedAt && award.localDate === entry.session.localDate, 'Receipt does not match its session');
    rulesForVersion(state, award.rulesVersion);
  }
  requireData(canonical(state.occasions.flatMap((occasion) => occasion.sessionIds)) ===
    canonical(qualifying.map((entry) => entry.session.id)), 'Occasions do not match qualifying history');

  let position = 0;
  const dayCounts = new Map<string, number>();
  const priorDays = new Set<number>();
  let previousOccasion: ProgressionState['occasions'][number] | undefined;
  for (const occasion of state.occasions) {
    requireData(occasion.sessionIds.length > 0, 'Empty practice occasion');
    const originalRules = rulesForVersion(state, occasion.rulesVersion);
    const first = qualifying[position]!;
    const ordinal = (dayCounts.get(occasion.rewardDate) ?? 0) + 1;
    dayCounts.set(occasion.rewardDate, ordinal);
    requireData(occasion.id === `occasion:${first.session.id}` && occasion.startedAt === first.session.startedAt &&
      occasion.rewardDate === first.session.localDate && occasion.rulesVersion === first.qualificationRulesVersion &&
      occasion.ordinalInDay === ordinal && occasion.weightBasisPoints === (originalRules.occasionWeightsBasisPoints[ordinal - 1] ?? 0),
    'Invalid occasion origin or frequency metadata');
    const today = dayNumber(occasion.rewardDate);
    let preceding = 0;
    for (let day = today - originalRules.consistencyWindowDays; day < today; day++) {
      if (priorDays.has(day)) preceding++;
    }
    requireData(occasion.precedingActiveDays === preceding, 'Invalid captured consistency');
    if (previousOccasion) requireData(occasion.startedAt - previousOccasion.endedAt >=
      rulesForVersion(state, previousOccasion.rulesVersion).occasionSeparationSeconds * 1000, 'Incorrect occasion separation');
    const ratio = consistencyRatio(occasion.precedingActiveDays, originalRules);
    let active = 0;
    let earned = 0;
    let lastEnd = occasion.startedAt;
    for (const id of occasion.sessionIds) {
      const entry = qualifying[position]!;
      const award = state.awards[position++]!;
      active = integer(active + entry.session.activeDurationSeconds);
      requireData(entry.session.startedAt - lastEnd < originalRules.occasionSeparationSeconds * 1000, 'Incorrect occasion extension');
      lastEnd = entry.session.endedAt;
      const b = award.breakdown;
      requireData(award.sessionId === id && award.occasionId === occasion.id && award.rulesVersion === occasion.rulesVersion &&
        award.rewardDate === occasion.rewardDate && b.occasionActiveSeconds === active && b.weightBasisPoints === occasion.weightBasisPoints &&
        b.precedingActiveDays === occasion.precedingActiveDays && b.consistencyNumerator === ratio.numerator && b.consistencyDenominator === ratio.denominator &&
        b.previousOccasionCentiXp === earned && b.cumulativeOccasionCentiXp === integer(earned + award.xpCenti), 'Invalid cumulative award chain');
      earned = b.cumulativeOccasionCentiXp;
      priorDays.add(dayNumber(entry.session.localDate));
    }
    requireData(occasion.endedAt === lastEnd && occasion.activeDurationSeconds === active && occasion.awardedCentiXp === earned,
      'Occasion checkpoint conflicts with receipts');
    previousOccasion = occasion;
  }
}
