/**
 * The introduction's suggested breath (breath-guide.tsx): in for four seconds, out for six, counting
 * each out-breath from one to ten and then beginning again at one. A teaching aid only.
 */
export const BREATH_GUIDE = { inhale: 4000, exhale: 6000, count: 10, small: .5 } as const;

/** The count for the next out-breath: one to ten, then one again. */
export function nextBreath(count: number) {
  return count >= BREATH_GUIDE.count || count < 0 ? 1 : count + 1;
}
