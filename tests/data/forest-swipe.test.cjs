const { test } = require('node:test');
const { assert, data } = require('./helpers.cjs');
const { forestDragProgress, forestSettleDuration, shouldNavigateForest } = data('../ui/forest-geometry.js');

test('Forest drags follow the finger on different widths, clamp overscroll and reverse without hysteresis', () => {
  for (const width of [320, 390, 430, 768]) for (const direction of ['left','right']) {
    const sign = direction === 'left' ? -1 : 1;
    for (const fraction of [0,.1,.5,1]) assert.ok(Math.abs(forestDragProgress(direction, sign * width * fraction, width) - fraction) < 1e-12);
    assert.equal(forestDragProgress(direction, sign * width * 2, width), 1);
    assert.equal(forestDragProgress(direction, -sign * width, width), 0);
    assert.equal(forestDragProgress(direction, 0, width), 0);
    assert.equal(shouldNavigateForest(direction, sign * 20, 0, 0), false);
  }
});
test('Invalid drag geometry cannot produce an offscreen or NaN transform', () => {
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(forestDragProgress('left', value, 390), 0);
  for (const width of [0,-1,NaN,Infinity]) assert.equal(forestDragProgress('right', 100, width), 0);
});
test('Settling stays restrained for both commit and cancellation, with quicker short travel', () => {
  assert.ok(forestSettleDuration(.9,1) < forestSettleDuration(.1,1));
  assert.ok(forestSettleDuration(.1,0) < forestSettleDuration(.9,0));
  for (const progress of [-1,0,.1,.5,.9,1,2]) for (const destination of [0,1]) {
    const duration = forestSettleDuration(progress,destination);
    assert.ok(duration >= 180 && duration <= 360);
  }
});
