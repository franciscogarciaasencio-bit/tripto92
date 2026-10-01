import { BASIS_POINTS, assertNonnegativeInteger, multiplyRatio } from './numeric';
import type { AwardBreakdown, PracticeOccasion, ProgressionRules } from './types';

export function durationRewardCentiXp(activeSeconds: number, rules: ProgressionRules): number {
  assertNonnegativeInteger(activeSeconds, 'activeSeconds');
  if (activeSeconds < rules.minimumActiveSeconds) return 0;
  const duration = rules.duration;
  const result = Math.round(duration.baseCentiXp + duration.doublingCentiXp *
    Math.log2(Math.min(activeSeconds, duration.capSeconds) / duration.referenceSeconds));
  assertNonnegativeInteger(result, 'duration reward');
  return result;
}

export function consistencyRatio(activeDays: number, rules: ProgressionRules) {
  assertNonnegativeInteger(activeDays, 'activeDays');
  if (activeDays > rules.consistencyWindowDays) throw new RangeError('Too many preceding active days');
  const denominator = BASIS_POINTS * rules.consistencyWindowDays;
  const numerator = denominator + rules.maximumConsistencyBonusBasisPoints * activeDays;
  return { numerator, denominator };
}

/** Round the cumulative target, then subtract previous receipts. Never sum rounded session bases. */
export function occasionEarnings(occasion: PracticeOccasion, rules: ProgressionRules): AwardBreakdown {
  const baseCentiXp = durationRewardCentiXp(occasion.activeDurationSeconds, rules);
  const ratio = consistencyRatio(occasion.precedingActiveDays, rules);
  const cumulativeOccasionCentiXp = multiplyRatio(
    baseCentiXp,
    occasion.weightBasisPoints * ratio.numerator,
    BASIS_POINTS * ratio.denominator,
  );
  if (cumulativeOccasionCentiXp < occasion.awardedCentiXp) {
    throw new Error('An occasion cannot reduce previously awarded XP');
  }
  return {
    occasionActiveSeconds: occasion.activeDurationSeconds,
    baseCentiXp,
    weightBasisPoints: occasion.weightBasisPoints,
    precedingActiveDays: occasion.precedingActiveDays,
    consistencyNumerator: ratio.numerator,
    consistencyDenominator: ratio.denominator,
    previousOccasionCentiXp: occasion.awardedCentiXp,
    cumulativeOccasionCentiXp,
  };
}
