const { test } = require('node:test');
const { assert, api, context, session } = require('./helpers.cjs');
const V8 = api.PROGRESSION_V8;

test('V8: 100%, 75%, 50%, then 25% for every later practice in a day, never nothing (owner, 2026-10-17)', () => {
  let state = api.createProgressionState(context(1), V8);
  for (const hour of [0, 2, 4, 6, 8, 10, 12, 14, 16]) state = api.recordSession(state, session({ day: 1, hour, minutes: 10 }));
  assert.deepEqual(state.awards.map((award) => award.breakdown.incrementalBaseCentiXp),
    [16_000, 12_000, 8_000, 4_000, 4_000, 4_000, 4_000, 4_000, 4_000]);
  assert.ok(state.awards.every((award) => award.xpCenti > 0));
  assert.deepEqual([1, 2, 3, 4, 9, 50].map((n) => api.occasionWeight(V8, n)), [10_000, 7_500, 5_000, 2_500, 2_500, 2_500]);
  assert.equal(api.occasionWeight(api.PROGRESSION_V7, 4), 0, 'V7 receipts keep their own rule');
});

test('V8 changes nothing else: durations and Consistency are V7', () => {
  const { version, laterOccasionWeightBasisPoints, ...rest } = V8;
  const { version: v7, ...seven } = api.PROGRESSION_V7;
  assert.equal(version, 'progression_v8'); assert.equal(v7, 'progression_v7'); assert.equal(laterOccasionWeightBasisPoints, 2_500);
  assert.deepEqual(rest, seven);
});

test('A three-minute fourth practice earns a quarter of its Ripples', () => {
  let state = api.createProgressionState(context(1), V8);
  for (const hour of [7, 12, 17]) state = api.recordSession(state, session({ day: 1, hour, minutes: 10 }));
  state = api.recordSession(state, session({ day: 1, hour: 21, minutes: 3 }));
  assert.equal(state.awards.at(-1).breakdown.incrementalBaseCentiXp, 1_250, 'a quarter of 50 Ripples');
  assert.ok(state.awards.at(-1).xpCenti > 1_250, 'plus its Consistency');
});

test('Invalid later weights are rejected', () => {
  for (const laterOccasionWeightBasisPoints of [-1, 6_000, 1.5])
    assert.throws(() => api.createProgressionState(context(1), { ...V8, version: 'x', laterOccasionWeightBasisPoints }), RangeError);
});
