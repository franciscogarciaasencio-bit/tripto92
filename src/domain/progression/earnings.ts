import { validateSession, type MeditationSession } from '../meditation/session';
import { BASIS_POINTS, assertNonnegativeInteger, multiplyRatio } from './numeric';
import type { AwardBreakdown, PracticeOccasion, ProgressionRules } from './types';

export function durationRewardCentiXp(activeSeconds: number, rules: ProgressionRules): number {
  assertNonnegativeInteger(activeSeconds, 'activeSeconds');
  if (activeSeconds === 0 || activeSeconds < (rules.minimumEarningSeconds ?? 0)) return 0;
  if (rules.earningsAlgorithm === 'linear_logarithmic_v2') {
    // V7 (owner, 2026-10-17): in proportion to time up to the reference (16 Ripples a minute to 15
    // minutes), then each doubling adds the same amount up to the cap; rounded to whole steps.
    const { baseCentiXp, referenceSeconds, doublingCentiXp, capSeconds, roundingCentiXp = 1 } = rules.duration;
    const seconds = Math.min(activeSeconds, capSeconds);
    const raw = seconds <= referenceSeconds ? baseCentiXp * seconds / referenceSeconds
      : baseCentiXp + doublingCentiXp * Math.log2(seconds / referenceSeconds);
    const result = Math.round(raw / roundingCentiXp) * roundingCentiXp;
    assertNonnegativeInteger(result, 'duration reward');
    return result;
  }
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
  if (rules.earningsAlgorithm !== 'logarithmic_v1') return session.activeDurationSeconds >= Math.max(1, rules.minimumEarningSeconds ?? 1);
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

/** Millionths: the precision of V7's eased share of the maximum bonus. */
export const CONSISTENCY_SHARE_SCALE = 1_000_000;
/**
 * The share of the maximum bonus a continuous score earns, as an exact ratio. V4–V6: in proportion
 * (score / scale). V7 'ease_out_v1': 1 − (1 − score/scale)² in millionths, so early practice counts most.
 */
export function consistencyShare(rules: ProgressionRules, score: number): { readonly numerator: number; readonly denominator: number } {
  const c = rules.continuousConsistency;
  if (!c) throw new RangeError('Rules have no continuous consistency');
  assertNonnegativeInteger(score, 'consistency score');
  if (score > c.scale) throw new RangeError('Consistency exceeds maximum');
  if (rules.consistencyCurve !== 'ease_out_v1') return { numerator: score, denominator: c.scale };
  const scale = BigInt(c.scale), value = BigInt(score), square = scale * scale;
  const eased = (2n * value * scale - value * value) * BigInt(CONSISTENCY_SHARE_SCALE);
  return { numerator: Number((2n * eased + square) / (2n * square)), denominator: CONSISTENCY_SHARE_SCALE };
}
/** The whole multiplier (1 + bonus) at a score, as the exact ratio receipts record. */
export function consistencyMultiplier(rules: ProgressionRules, score: number) {
  const share = consistencyShare(rules, score);
  return { numerator: share.denominator * BASIS_POINTS + share.numerator * rules.maximumConsistencyBonusBasisPoints,
    denominator: share.denominator * BASIS_POINTS };
}
/** The bar's fill for a continuous fraction (0–1), on the same curve as the bonus. */
export function consistencyDisplayFraction(rules: Pick<ProgressionRules, 'consistencyCurve'>, fraction: number) {
  const value = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return rules.consistencyCurve === 'ease_out_v1' ? 1 - (1 - value) ** 2 : value;
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
    const multiplier = consistencyMultiplier(rules, consistencyScore);
    const bonusCentiXp = multiplyRatio(incrementalBaseCentiXp, multiplier.numerator - multiplier.denominator, multiplier.denominator);
    return { occasionActiveSeconds: occasion.activeDurationSeconds, baseCentiXp, weightBasisPoints: occasion.weightBasisPoints,
      precedingActiveDays: occasion.precedingActiveDays, consistencyNumerator: multiplier.numerator,
      consistencyDenominator: multiplier.denominator, previousOccasionCentiXp: occasion.awardedCentiXp,
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
