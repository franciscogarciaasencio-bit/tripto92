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

/**
 * One colour per round (owner, 2026-10-17): each completed round gives the bar the next colour,
 * muted like watercolour on sand. Olive, sea, dusk, clay, then ochre for the last and full rounds.
 */
export const ROUND_COLORS = ['#76845A', '#4C7471', '#3E4C76', '#A0593B', '#A47A2E'] as const;
export const ROUND_NAMES = ['Olive', 'Sea', 'Dusk', 'Clay', 'Ochre'] as const;
/** The colour of the round in progress (the fifth stays once full). */
export function roundColor(completed: number) {
  'worklet';
  return ROUND_COLORS[Math.max(0, Math.min(CONSISTENCY_STEPS - 1, completed))]!;
}
/** Consistency level shown to people: the round being filled, 1–5 (5 also when full). */
export function consistencyLevel(fraction: number) {
  'worklet';
  return Math.min(CONSISTENCY_STEPS, consistencyRounds(fraction).completed + 1);
}
