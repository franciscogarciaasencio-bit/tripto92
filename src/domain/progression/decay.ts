import { BASIS_POINTS, assertNonnegativeInteger, multiplyRatio } from './numeric';
import type { ProgressionRules } from './types';

export function protectedFloor(lifetimeXpCenti: number, rules: ProgressionRules): number {
  // Round UP: a fractional cent must not put the balance below the promised floor.
  return multiplyRatio(lifetimeXpCenti, rules.protectedFloorBasisPoints, BASIS_POINTS, true);
}

export function decayOneDay(currentProgressionCenti: number, lifetimeXpCenti: number, rules: ProgressionRules): number {
  assertNonnegativeInteger(currentProgressionCenti, 'currentProgressionCenti');
  assertNonnegativeInteger(lifetimeXpCenti, 'lifetimeXpCenti');
  if (currentProgressionCenti > lifetimeXpCenti) throw new RangeError('Current progression cannot exceed lifetime XP');
  const loss = Math.min(
    multiplyRatio(currentProgressionCenti, rules.dailyDecayBasisPoints, BASIS_POINTS),
    rules.dailyDecayCapCentiXp,
  );
  return Math.max(protectedFloor(lifetimeXpCenti, rules), currentProgressionCenti - loss);
}
