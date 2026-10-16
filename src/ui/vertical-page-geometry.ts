/**
 * Home ⇅ Journey (owner, 2026-10-16: "scroll down from the main view into the journey view"). A drag
 * past the edge of Home's (or Journey's) scroll content follows the finger with resistance, then
 * either opens the other page or settles back. UI-thread safe; no practice data.
 */
export const VERTICAL_PAGE = { activation: 14, horizontalTolerance: 24, distance: 90, velocity: 700, maximumShift: 120, resistance: .45 } as const;

/** How far the page moves for a drag `translation` (negative = up), bounded and resisted. */
export function verticalShift(direction: 'up' | 'down', translation: number) {
  'worklet';
  const sign = direction === 'up' ? -1 : 1, travel = Math.max(0, translation * sign);
  return sign * Math.min(VERTICAL_PAGE.maximumShift, travel * VERTICAL_PAGE.resistance);
}

/** Release: open the other page after a clear, mostly vertical drag or a quick flick in its direction. */
export function shouldTurnPage(direction: 'up' | 'down', x: number, y: number, velocity: number) {
  'worklet';
  const sign = direction === 'up' ? -1 : 1;
  return [x, y, velocity].every(Number.isFinite) && y * sign >= VERTICAL_PAGE.activation && Math.abs(x) < Math.abs(y) * .6
    && (y * sign >= VERTICAL_PAGE.distance || velocity * sign >= VERTICAL_PAGE.velocity);
}
