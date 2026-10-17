import { BASIS_POINTS, assertNonnegativeInteger, freeze } from './numeric';
import { V1_RANKS } from './ranks';
import type { ProgressionRules, ProgressionState } from './types';
import { CONTINUOUS_CONSISTENCY, isLinearConsistency, LINEAR_CONSISTENCY_V1, LINEAR_CONSISTENCY_V2 } from './consistency';

export const PROGRESSION_V1: ProgressionRules = freeze({
  version: 'progression_v1',
  earningsAlgorithm: 'logarithmic_v1',
  decayAlgorithm: 'capped_daily_v1',
  minimumActiveSeconds: 300,
  duration: { baseCentiXp: 6_000, referenceSeconds: 300, doublingCentiXp: 2_000, capSeconds: 3_600 },
  occasionSeparationSeconds: 5_400,
  occasionWeightsBasisPoints: [10_000, 7_500, 2_500],
  consistencyWindowDays: 7,
  maximumConsistencyBonusBasisPoints: 4_000,
  inactivityGraceDays: 2,
  dailyDecayBasisPoints: 100,
  dailyDecayCapCentiXp: 1_600,
  protectedFloorBasisPoints: 2_500,
  ranks: V1_RANKS,
});

/** Prospective eligibility only; the five-minute logarithmic reference and all weights remain unchanged. */
export const PROGRESSION_V2: ProgressionRules = freeze({
  ...PROGRESSION_V1, version: 'progression_v2', minimumActiveSeconds: 180,
  practiceDayEligibility: 'completed_minimum',
});

/** Short finished runs earn prospectively; qualifying practice-day/credit minimums stay at three minutes. */
export const PROGRESSION_V3: ProgressionRules = freeze({
  ...PROGRESSION_V2, version: 'progression_v3', earningsAlgorithm: 'linear_short_logarithmic_v1',
});
export const PROGRESSION_V4: ProgressionRules = freeze({
  ...PROGRESSION_V3, version: 'progression_v4', continuousConsistency: CONTINUOUS_CONSISTENCY,
});

/** Prospective equal contributions; released V1–V4 receipts and configurations remain untouched. */
export const PROGRESSION_V5: ProgressionRules = freeze({
  ...PROGRESSION_V4, version: 'progression_v5', continuousConsistency: LINEAR_CONSISTENCY_V1,
});

/** Owner, 2026-10-16: "below three minutes just doesn't count". Prospective only: V3–V5 short-run
 * receipts stay exactly as earned; from V6 a practice under three active minutes earns no Ripples. */
export const PROGRESSION_V6: ProgressionRules = freeze({
  ...PROGRESSION_V5, version: 'progression_v6', minimumEarningSeconds: 180,
});

/**
 * Owner, 2026-10-17: practice pays in proportion up to 15 minutes (16 Ripples a minute; 3 minutes 50,
 * 5 minutes 80, 10 minutes 160), then +80 per doubling to 400 at 60 minutes, rounded to 5. A third
 * practice in a day counts half (was a quarter). Consistency fills in 42 contributions (six weeks
 * daily, three weeks twice a day) and eases out, up to +700%. Prospective only: V1–V6 receipts stay.
 */
export const PROGRESSION_V7: ProgressionRules = freeze({
  ...PROGRESSION_V6, version: 'progression_v7', earningsAlgorithm: 'linear_logarithmic_v2',
  duration: { baseCentiXp: 24_000, referenceSeconds: 900, doublingCentiXp: 8_000, capSeconds: 3_600, roundingCentiXp: 500 },
  occasionWeightsBasisPoints: [10_000, 7_500, 5_000], maximumConsistencyBonusBasisPoints: 70_000,
  continuousConsistency: LINEAR_CONSISTENCY_V2, consistencyCurve: 'ease_out_v1',
});
/**
 * V8 (owner, 2026-10-17: "if you meditate for 3 minutes, why should it count zero?"): every separate
 * practice in a day earns something. 100%, 75%, 50%, then 25% for the fourth and every later one.
 * Everything else is V7.
 */
export const PROGRESSION_V8: ProgressionRules = freeze({
  ...PROGRESSION_V7, version: 'progression_v8', laterOccasionWeightBasisPoints: 2_500,
});
/** The weight of the nth separate practice occasion of a day under these rules. */
export function occasionWeight(rules: ProgressionRules, ordinalInDay: number): number {
  return rules.occasionWeightsBasisPoints[ordinalInDay - 1] ?? rules.laterOccasionWeightBasisPoints ?? 0;
}

/** Validate and detach caller-owned configuration. A version identifies an entire frozen ruleset. */
export function captureRules(rules: ProgressionRules): ProgressionRules {
  if (!rules.version.trim()) throw new RangeError('rules version is required');
  if (!['logarithmic_v1', 'linear_short_logarithmic_v1', 'linear_logarithmic_v2'].includes(rules.earningsAlgorithm) || rules.decayAlgorithm !== 'capped_daily_v1') {
    throw new RangeError('Unsupported progression algorithm');
  }
  for (const [name, value] of Object.entries({
    minimumActiveSeconds: rules.minimumActiveSeconds,
    occasionSeparationSeconds: rules.occasionSeparationSeconds,
    consistencyWindowDays: rules.consistencyWindowDays,
    referenceSeconds: rules.duration.referenceSeconds,
    capSeconds: rules.duration.capSeconds,
  })) {
    assertNonnegativeInteger(value, name);
    if (value === 0) throw new RangeError(`${name} must be positive`);
  }
  for (const [name, value] of Object.entries({
    baseCentiXp: rules.duration.baseCentiXp,
    doublingCentiXp: rules.duration.doublingCentiXp,
    maximumConsistencyBonusBasisPoints: rules.maximumConsistencyBonusBasisPoints,
    inactivityGraceDays: rules.inactivityGraceDays,
    dailyDecayCapCentiXp: rules.dailyDecayCapCentiXp,
  })) assertNonnegativeInteger(value, name);
  if (rules.duration.capSeconds < rules.minimumActiveSeconds ||
    rules.duration.baseCentiXp + rules.duration.doublingCentiXp * Math.log2(rules.minimumActiveSeconds / rules.duration.referenceSeconds) < 0) {
    throw new RangeError('Duration cap/reward must support qualification minimum');
  }
  if (rules.practiceDayEligibility !== undefined && rules.practiceDayEligibility !== 'completed_minimum') throw new RangeError('Unsupported practice-day policy');
  if (rules.duration.roundingCentiXp !== undefined) {
    assertNonnegativeInteger(rules.duration.roundingCentiXp, 'roundingCentiXp');
    if (rules.duration.roundingCentiXp === 0 || rules.earningsAlgorithm !== 'linear_logarithmic_v2') throw new RangeError('Invalid reward rounding');
  }
  if (rules.consistencyCurve !== undefined && (rules.consistencyCurve !== 'ease_out_v1' || !rules.continuousConsistency)) {
    throw new RangeError('Unsupported consistency curve');
  }
  if (rules.minimumEarningSeconds !== undefined) {
    assertNonnegativeInteger(rules.minimumEarningSeconds, 'minimumEarningSeconds');
    if (rules.minimumEarningSeconds === 0 || rules.minimumEarningSeconds > rules.minimumActiveSeconds) throw new RangeError('Invalid earning minimum');
  }
  if (rules.continuousConsistency) {
    const c = rules.continuousConsistency;
    for (const [key, value] of Object.entries(c)) if (key !== 'algorithm') assertNonnegativeInteger(value, 'continuous consistency');
    if (isLinearConsistency(c)) {
      if (!c.contributionUnits || !c.targetContributions || c.scale !== c.contributionUnits * c.targetContributions ||
          c.inactiveRetentionMillionths > 1_000_000 || !c.halfLifeDays) throw new RangeError('Invalid linear consistency configuration');
    } else if ('algorithm' in c || c.scale !== 1_000_000 || c.growthBasisPoints > BASIS_POINTS ||
      c.inactiveRetentionMillionths > c.scale || c.halfLifeDays === 0) throw new RangeError('Invalid continuous consistency configuration');
    assertNonnegativeInteger(c.scale * (BASIS_POINTS + rules.maximumConsistencyBonusBasisPoints), 'continuous consistency ratio');
  }
  for (const value of [...rules.occasionWeightsBasisPoints, rules.dailyDecayBasisPoints, rules.protectedFloorBasisPoints]) {
    assertNonnegativeInteger(value, 'basis points');
    if (value > BASIS_POINTS) throw new RangeError('Rate/weight exceeds 100%');
  }
  if (rules.occasionWeightsBasisPoints.length === 0) throw new RangeError('At least one occasion weight is required');
  rules.occasionWeightsBasisPoints.forEach((weight, index, weights) => {
    if (index > 0 && weight > weights[index - 1]!) throw new RangeError('Occasion weights must not increase');
  });
  if (rules.laterOccasionWeightBasisPoints !== undefined) {
    assertNonnegativeInteger(rules.laterOccasionWeightBasisPoints, 'basis points');
    if (rules.laterOccasionWeightBasisPoints > rules.occasionWeightsBasisPoints.at(-1)!) throw new RangeError('Occasion weights must not increase');
  }
  // Products used for the exact consistency ratio must themselves be safe integers.
  assertNonnegativeInteger(BASIS_POINTS * (BASIS_POINTS + rules.maximumConsistencyBonusBasisPoints) * rules.consistencyWindowDays, 'consistency ratio');
  if (!rules.ranks.length || rules.ranks[0]!.thresholdCentiXp !== 0) throw new RangeError('Ranks must begin at zero');
  const ids = new Set<string>();
  let previous = -1;
  for (const rank of rules.ranks) {
    assertNonnegativeInteger(rank.thresholdCentiXp, 'rank threshold');
    if (!rank.id.trim() || !rank.name.trim() || ids.has(rank.id) || rank.thresholdCentiXp <= previous) {
      throw new RangeError('Ranks require unique IDs, names, and strictly increasing thresholds');
    }
    ids.add(rank.id);
    previous = rank.thresholdCentiXp;
  }
  return freeze({
    version: rules.version,
    earningsAlgorithm: rules.earningsAlgorithm,
    decayAlgorithm: rules.decayAlgorithm,
    minimumActiveSeconds: rules.minimumActiveSeconds,
    ...(rules.minimumEarningSeconds !== undefined ? { minimumEarningSeconds: rules.minimumEarningSeconds } : {}),
    ...(rules.practiceDayEligibility ? { practiceDayEligibility: rules.practiceDayEligibility } : {}),
    duration: {
      baseCentiXp: rules.duration.baseCentiXp,
      referenceSeconds: rules.duration.referenceSeconds,
      doublingCentiXp: rules.duration.doublingCentiXp,
      capSeconds: rules.duration.capSeconds,
      ...(rules.duration.roundingCentiXp !== undefined ? { roundingCentiXp: rules.duration.roundingCentiXp } : {}),
    },
    occasionSeparationSeconds: rules.occasionSeparationSeconds,
    occasionWeightsBasisPoints: [...rules.occasionWeightsBasisPoints],
    ...(rules.laterOccasionWeightBasisPoints !== undefined ? { laterOccasionWeightBasisPoints: rules.laterOccasionWeightBasisPoints } : {}),
    consistencyWindowDays: rules.consistencyWindowDays,
    maximumConsistencyBonusBasisPoints: rules.maximumConsistencyBonusBasisPoints,
    ...(rules.continuousConsistency ? { continuousConsistency: { ...rules.continuousConsistency } } : {}),
    ...(rules.consistencyCurve ? { consistencyCurve: rules.consistencyCurve } : {}),
    inactivityGraceDays: rules.inactivityGraceDays,
    dailyDecayBasisPoints: rules.dailyDecayBasisPoints,
    dailyDecayCapCentiXp: rules.dailyDecayCapCentiXp,
    protectedFloorBasisPoints: rules.protectedFloorBasisPoints,
    ranks: rules.ranks.map((rank) => ({ id: rank.id, name: rank.name, thresholdCentiXp: rank.thresholdCentiXp, theme: rank.theme })),
  });
}

export function rulesForVersion(state: ProgressionState, version = state.activeRulesVersion): ProgressionRules {
  const rules = state.ruleSets.find((candidate) => candidate.version === version);
  if (!rules) throw new Error(`Missing historical rules: ${version}`);
  return rules;
}
