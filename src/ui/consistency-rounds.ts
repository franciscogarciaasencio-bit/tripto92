/** Five milestones of the Consistency fraction (0–1). */
export const CONSISTENCY_STEPS = 5;

/**
 * The owner's model (2026-10-17): the big bar fills once per milestone (12 counted practices of the
 * 60; a twice-a-day day counts two); when it is full, one small bar beneath fills and the big bar
 * starts again from empty. At the end all five small bars are full and so is the big bar.
 * Presentation of the same domain fraction; UI-thread safe.
 */
export function consistencyRounds(fraction: number) {
  'worklet';
  const value = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * CONSISTENCY_STEPS;
  const completed = Math.min(CONSISTENCY_STEPS, Math.floor(value + 1e-9));
  return { completed, current: completed === CONSISTENCY_STEPS ? 1 : Math.max(0, value - completed) };
}
