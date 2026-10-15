/** Pure streak drawing geometry and timings (no React Native), so they can be tested in Node. */

/** Presentation timings for streaks. Everything settles within about a second; nothing loops. */
export const STREAK_MOTION = {
  disc: 300, join: 280, band: 360, select: 180, number: 380, slide: 300, pebble: 320,
  rowStagger: 80, columnStagger: 30, joinLag: 110, pebbleStagger: 80, perDay: 45,
} as const;
export const STREAK_DISC = 34;

/** Consecutive counting days within one week row, as [first column, last column]. */
export function streakRuns(counts: readonly boolean[]): (readonly [number, number])[] {
  const runs: [number, number][] = [];
  counts.forEach((on, column) => {
    if (!on) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === column - 1) last[1] = column; else runs.push([column, column]);
  });
  return runs;
}

/** Where a run's capsule sits in a row of `cell`-wide columns, and when it extends. */
export function runGeometry(start: number, end: number, cell: number, delay: number) {
  return {
    left: start * cell + (cell - STREAK_DISC) / 2,
    length: (end - start) * cell + STREAK_DISC,
    extendDelay: delay + STREAK_MOTION.joinLag,
    extendDuration: STREAK_MOTION.join + (end - start) * STREAK_MOTION.perDay,
  };
}

/** Worst-case time until a month's streak drawing has settled (six rows, a full-week run). */
export function settleMilliseconds(rows = 6) {
  const last = (rows - 1) * STREAK_MOTION.rowStagger;
  const run = runGeometry(0, 6, 48, last);
  return Math.max(last + STREAK_MOTION.band, run.extendDelay + run.extendDuration);
}
