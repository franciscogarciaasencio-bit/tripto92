const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { shouldTurnPage, verticalShift, VERTICAL_PAGE } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'vertical-page-geometry.js'));

test('Home rises into Journey only after a clear upward pull or flick', () => {
  assert.equal(shouldTurnPage('up', 0, -VERTICAL_PAGE.distance, 0), true);
  assert.equal(shouldTurnPage('up', 0, -30, -900), true, 'a quick flick');
  assert.equal(shouldTurnPage('up', 0, -30, -200), false, 'a small slow pull settles back');
  assert.equal(shouldTurnPage('up', 0, 120, 900), false, 'wrong direction');
  assert.equal(shouldTurnPage('up', 140, -100, -900), false, 'mostly sideways belongs to the forest swipe');
  assert.equal(shouldTurnPage('down', 0, 100, 0), true);
  assert.equal(shouldTurnPage('up', NaN, -100, 0), false);
});

test('The page follows the finger with resistance, only toward its turn, and never too far', () => {
  assert.equal(verticalShift('up', -100), -100 * VERTICAL_PAGE.resistance);
  assert.equal(verticalShift('up', 80), -0);
  assert.equal(verticalShift('down', 10_000), VERTICAL_PAGE.maximumShift);
});
