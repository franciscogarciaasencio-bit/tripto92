import { V1_RANKS } from './ranks';
import { assertNonnegativeInteger, freeze } from './numeric';
import type { RankDefinition } from './types';

/** Display progression, independent of earning-rule versions and immutable award receipts. */
export const LEVELS_VERSION = 'ona_levels_v1';
const INTERVALS_PER_STAGE = 11;
export interface LevelDefinition {
  readonly number: number;
  readonly thresholdCentiXp: number;
  readonly stage: RankDefinition;
}

// Nine existing rank intervals × eleven subdivisions, plus the last anchor = exactly 100.
// Floor each rational subdivision once. Every threshold is an integer, with inclusive lower bounds.
export const ONA_LEVELS: readonly LevelDefinition[] = freeze(V1_RANKS.flatMap((stage, index) => {
  const next = V1_RANKS[index + 1];
  if (!next) return [{ number: 100, thresholdCentiXp: stage.thresholdCentiXp, stage }];
  return Array.from({ length: INTERVALS_PER_STAGE }, (_, step) => ({
    number: index * INTERVALS_PER_STAGE + step + 1,
    thresholdCentiXp: stage.thresholdCentiXp + Math.floor((next.thresholdCentiXp - stage.thresholdCentiXp) * step / INTERVALS_PER_STAGE),
    stage,
  }));
}));

export function getLevelProgress(currentProgressionCenti: number) {
  assertNonnegativeInteger(currentProgressionCenti, 'current progression');
  let level = ONA_LEVELS[0];
  if (!level) throw new Error('Level definitions must begin at Level 1');
  for (const candidate of ONA_LEVELS) {
    if (candidate.thresholdCentiXp > currentProgressionCenti) break;
    level = candidate;
  }
  const nextLevel = ONA_LEVELS[level.number] ?? null;
  const requiredCenti = nextLevel ? nextLevel.thresholdCentiXp - level.thresholdCentiXp : 0;
  const earnedCenti = nextLevel ? currentProgressionCenti - level.thresholdCentiXp : 0;
  return { version: LEVELS_VERSION, level, nextLevel, earnedCenti, requiredCenti,
    remainingCenti: requiredCenti - earnedCenti, fraction: nextLevel ? earnedCenti / requiredCenti : 1 };
}
