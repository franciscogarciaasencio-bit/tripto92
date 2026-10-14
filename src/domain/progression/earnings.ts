import { validateSession, type MeditationSession } from '../meditation/session';
import { BASIS_POINTS, assertNonnegativeInteger, multiplyRatio } from './numeric';
import type { AwardBreakdown, PracticeOccasion, ProgressionRules } from './types';

export function durationRewardCentiXp(activeSeconds: number, rules: ProgressionRules): number {
  assertNonnegativeInteger(activeSeconds, 'activeSeconds');
  if (activeSeconds === 0) return 0;
  if (activeSeconds < rules.minimumActiveSeconds) {
    if (rules.earningsAlgorithm !== 'linear_short_logarithmic_v1') return 0;
    // Round the existing threshold reward once, then scale with exact integer arithmetic.
    // At the threshold this is exactly the released logarithmic reward, without a jump or a new currency.
    return multiplyRatio(durationRewardCentiXp(rules.minimumActiveSeconds, rules), activeSeconds, rules.minimumActiveSeconds);
  }
  const duration = rules.duration;
  const result = Math.round(duration.baseCentiXp + duration.doublingCentiXp *
    Math.log2(Math.min(activeSeconds, duration.capSeconds) / duration.referenceSeconds));
  assertNonnegativeInteger(result, 'duration reward');
  return result;
}

/** Earning eligibility is separate from qualification for consistency, credits and inactivity. */
export function isRewardEligible(session: MeditationSession, rules: ProgressionRules): boolean {
  validateSession(session);
  if (rules.earningsAlgorithm === 'linear_short_logarithmic_v1') return session.activeDurationSeconds > 0;
  return session.activeDurationSeconds >= rules.minimumActiveSeconds &&
    (rules.practiceDayEligibility !== 'completed_minimum' || session.status === 'completed');
}

export function consistencyRatio(activeDays: number, rules: ProgressionRules) {
  assertNonnegativeInteger(activeDays, 'activeDays');
  if (activeDays > rules.consistencyWindowDays) throw new RangeError('Too many preceding active days');
  const denominator = BASIS_POINTS * rules.consistencyWindowDays;
  const numerator = denominator + rules.maximumConsistencyBonusBasisPoints * activeDays;
  return { numerator, denominator };
}

/** Round the cumulative target, then subtract previous receipts. Never sum rounded session bases. */
export function occasionEarnings(occasion: PracticeOccasion, rules: ProgressionRules, consistencyScore = 0): AwardBreakdown {
  const baseCentiXp = durationRewardCentiXp(occasion.activeDurationSeconds, rules);
  if (rules.continuousConsistency) {
    const c = rules.continuousConsistency;
    assertNonnegativeInteger(consistencyScore, 'consistency score');
    if (consistencyScore > c.scale) throw new RangeError('Consistency exceeds maximum');
    const cumulativeBase = multiplyRatio(baseCentiXp, occasion.weightBasisPoints, BASIS_POINTS);
    const incrementalBaseCentiXp = cumulativeBase - (occasion.awardedBaseCentiXp ?? 0);
    const bonusCentiXp = multiplyRatio(incrementalBaseCentiXp, consistencyScore * rules.maximumConsistencyBonusBasisPoints,
      c.scale * BASIS_POINTS);
    return { occasionActiveSeconds: occasion.activeDurationSeconds, baseCentiXp, weightBasisPoints: occasion.weightBasisPoints,
      precedingActiveDays: occasion.precedingActiveDays, consistencyNumerator: c.scale * BASIS_POINTS + consistencyScore * rules.maximumConsistencyBonusBasisPoints,
      consistencyDenominator: c.scale * BASIS_POINTS, previousOccasionCentiXp: occasion.awardedCentiXp,
      cumulativeOccasionCentiXp: occasion.awardedCentiXp + incrementalBaseCentiXp + bonusCentiXp,
      incrementalBaseCentiXp, bonusCentiXp, continuousConsistencyScore: consistencyScore };
  }
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
