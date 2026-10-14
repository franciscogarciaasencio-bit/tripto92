import { dateFromDay, dayNumber, precedingActiveDays, type CalendarContext } from './calendar';
import { consistencyRatio } from './earnings';
import { freeze } from './numeric';
import { qualifyingDates } from './occasions';
import { rankForProgress } from './ranks';
import { rulesForVersion } from './rules';
import { advanceProgression } from './state';
import type { ProgressSnapshot, ProgressionState } from './types';
import { isLinearConsistency, progressionConsistency } from './consistency';
import { getConsistencyIndicator } from './consistency-indicator';

/** A projection only. Repeated reads do not mutate balances, receipts, or checkpoints. */
export function getProgressSnapshot(state: ProgressionState, asOf: CalendarContext): ProgressSnapshot {
  const projected = advanceProgression(state, asOf);
  const rules = rulesForVersion(projected);
  const dates = qualifyingDates(projected);
  const preceding = precedingActiveDays(dates, asOf.localDate, rules.consistencyWindowDays);
  const continuous = rules.continuousConsistency ? progressionConsistency(projected, rules.continuousConsistency) : null;
  const ratio = rules.continuousConsistency ? {
    numerator: rules.continuousConsistency.scale * 10_000 + continuous!.score * rules.maximumConsistencyBonusBasisPoints,
    denominator: rules.continuousConsistency.scale * 10_000,
  } : consistencyRatio(preceding, rules);
  const currentRank = rankForProgress(projected.currentProgressionCenti, rules.ranks);
  const nextRank = rules.ranks.find((rank) => rank.thresholdCentiXp > currentRank.thresholdCentiXp) ?? null;
  const lastQualifyingDate = [...dates].sort().at(-1) ?? null;
  const required = nextRank ? nextRank.thresholdCentiXp - currentRank.thresholdCentiXp : 0;
  const earned = nextRank ? projected.currentProgressionCenti - currentRank.thresholdCentiXp : 0;
  return freeze({
    asOf: { ...asOf },
    rulesVersion: rules.version,
    lifetimeXpCenti: projected.lifetimeXpCenti,
    currentProgressionCenti: projected.currentProgressionCenti,
    currentRank, highestRankAchieved: projected.highestRankAchieved,
    progressToNextRank: {
      nextRank, earnedCentiXp: earned, requiredCentiXp: required,
      remainingCentiXp: required - earned, fraction: nextRank ? earned / required : 1,
    },
    totalQualifyingPracticeDays: dates.length,
    totalMeditationSeconds: projected.totalMeditationSeconds,
    totalMeditationMinutes: projected.totalMeditationSeconds / 60,
    consistency: { fraction: continuous?.fraction ?? preceding / rules.consistencyWindowDays,
      indicatorFraction: rules.continuousConsistency && isLinearConsistency(rules.continuousConsistency) ? continuous!.fraction : getConsistencyIndicator(projected.sessions.map(entry => entry.session), {
        ...asOf, localDate: dateFromDay(Math.max(dayNumber(asOf.localDate), dayNumber(projected.settledThroughDate) + 1)),
      }),
      precedingActiveDays: preceding, windowDays: rules.consistencyWindowDays, multiplier: ratio.numerator / ratio.denominator,
      maximumMultiplier: 1 + rules.maximumConsistencyBonusBasisPoints / 10_000 },
    inactivity: {
      lastQualifyingDate,
      completeInactiveDays: lastQualifyingDate === null ? 0 : Math.max(0,
        dayNumber(projected.settledThroughDate) - dayNumber(lastQualifyingDate)),
      graceDays: rules.inactivityGraceDays,
    },
  });
}
