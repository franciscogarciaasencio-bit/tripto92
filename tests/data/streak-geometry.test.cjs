const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { streakRuns, STREAK_MOTION } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'streak-geometry.js'));

test('Counting days in a week row become runs, each drawn as one capsule', () => {
  assert.deepEqual(streakRuns([true, true, false, true, false, true, true]), [[0, 1], [3, 3], [5, 6]]);
  assert.deepEqual(streakRuns([false, false, false, false, false, false, false]), []);
  assert.deepEqual(streakRuns([true, true, true, true, true, true, true]), [[0, 6]]);
});

test('Streak timings stay brief; nothing in the calendar takes more than about a second', () => {
  for (const [name, value] of Object.entries(STREAK_MOTION)) assert.ok(value > 0 && value <= 400, name);
});
