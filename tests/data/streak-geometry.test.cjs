const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { streakRuns, runGeometry, settleMilliseconds, STREAK_DISC } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'streak-geometry.js'));

test('Counting days in a week row become runs, each drawn as one capsule', () => {
  assert.deepEqual(streakRuns([true, true, false, true, false, true, true]), [[0, 1], [3, 3], [5, 6]]);
  assert.deepEqual(streakRuns([false, false, false, false, false, false, false]), []);
  assert.deepEqual(streakRuns([true, true, true, true, true, true, true]), [[0, 6]]);
});

test('A capsule spans from the first disc to the last, centred in its cells', () => {
  const single = runGeometry(2, 2, 50, 0);
  assert.equal(single.length, STREAK_DISC);
  assert.equal(single.left, 2 * 50 + 8);
  const week = runGeometry(0, 6, 50, 0);
  assert.equal(week.left + week.length, 6 * 50 + 8 + STREAK_DISC, 'ends at the last disc edge');
  assert.ok(week.extendDuration > single.extendDuration, 'longer runs extend a little longer');
});

test('A month of streaks settles in about a second', () => {
  assert.ok(settleMilliseconds() <= 1100, String(settleMilliseconds()));
});
