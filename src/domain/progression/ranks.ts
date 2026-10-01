import type { RankDefinition } from './types';
import { assertNonnegativeInteger, freeze } from './numeric';

export const V1_RANKS: readonly RankDefinition[] = freeze([
  { id: 'monkey_mind', name: 'Monkey Mind', thresholdCentiXp: 0, theme: 'Beginning amid the chatter.' },
  { id: 'first_pause', name: 'First Pause', thresholdCentiXp: 20_000, theme: 'Discovering a small space to pause.' },
  { id: 'quiet_spark', name: 'Quiet Spark', thresholdCentiXp: 65_000, theme: 'A little quiet worth returning to.' },
  { id: 'steady_breath', name: 'Steady Breath', thresholdCentiXp: 150_000, theme: 'Finding a dependable rhythm of practice.' },
  { id: 'still_pond', name: 'Still Pond', thresholdCentiXp: 300_000, theme: 'A familiar place to settle.' },
  { id: 'clear_sky', name: 'Clear Sky', thresholdCentiXp: 550_000, theme: 'Space around passing thoughts.' },
  { id: 'deep_current', name: 'Deep Current', thresholdCentiXp: 900_000, theme: 'Practice with depth and continuity.' },
  { id: 'quiet_mountain', name: 'Quiet Mountain', thresholdCentiXp: 1_400_000, theme: 'Steadiness across changing days.' },
  { id: 'wide_horizon', name: 'Wide Horizon', thresholdCentiXp: 2_100_000, theme: 'An image of spacious attention.' },
  { id: 'steady_presence', name: 'Steady Presence', thresholdCentiXp: 3_000_000, theme: 'Long experience in returning attention.' },
]);

export function rankForProgress(progress: number, ranks: readonly RankDefinition[]): RankDefinition {
  assertNonnegativeInteger(progress, 'progress');
  const first = ranks[0];
  if (!first || first.thresholdCentiXp !== 0) throw new RangeError('Ranks must begin at zero');
  let result = first;
  for (const rank of ranks) {
    if (rank.thresholdCentiXp > progress) break;
    result = rank;
  }
  return result;
}
