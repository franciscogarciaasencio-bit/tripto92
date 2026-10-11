import { BASIS_POINTS, assertNonnegativeInteger, freeze } from './numeric';
import { V1_RANKS } from './ranks';
import type { ProgressionRules, ProgressionState } from './types';

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

/** Validate and detach caller-owned configuration. A version identifies an entire frozen ruleset. */
export function captureRules(rules: ProgressionRules): ProgressionRules {
  if (!rules.version.trim()) throw new RangeError('rules version is required');
  if (rules.earningsAlgorithm !== 'logarithmic_v1' || rules.decayAlgorithm !== 'capped_daily_v1') {
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
  for (const value of [...rules.occasionWeightsBasisPoints, rules.dailyDecayBasisPoints, rules.protectedFloorBasisPoints]) {
    assertNonnegativeInteger(value, 'basis points');
    if (value > BASIS_POINTS) throw new RangeError('Rate/weight exceeds 100%');
  }
  if (rules.occasionWeightsBasisPoints.length === 0) throw new RangeError('At least one occasion weight is required');
  rules.occasionWeightsBasisPoints.forEach((weight, index, weights) => {
    if (index > 0 && weight > weights[index - 1]!) throw new RangeError('Occasion weights must not increase');
  });
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
    ...(rules.practiceDayEligibility ? { practiceDayEligibility: rules.practiceDayEligibility } : {}),
    duration: {
      baseCentiXp: rules.duration.baseCentiXp,
      referenceSeconds: rules.duration.referenceSeconds,
      doublingCentiXp: rules.duration.doublingCentiXp,
      capSeconds: rules.duration.capSeconds,
    },
    occasionSeparationSeconds: rules.occasionSeparationSeconds,
    occasionWeightsBasisPoints: [...rules.occasionWeightsBasisPoints],
    consistencyWindowDays: rules.consistencyWindowDays,
    maximumConsistencyBonusBasisPoints: rules.maximumConsistencyBonusBasisPoints,
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
