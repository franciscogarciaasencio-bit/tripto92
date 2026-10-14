const { test } = require('node:test');
const { assert, api, session, context } = require('./helpers.cjs');
const daily = days => Array.from({ length: days }, (_, i) => session({ id: `day-${i}`, day: i + 1, minutes: 3 }));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('The indicator grows in small daily steps and reaches full on the fourteenth qualifying day', () => {
  for (let days = 1; days <= 14; ++days) near(api.getConsistencyIndicator(daily(days), context(days, 23)), days / 14);
  assert.equal(api.getConsistencyIndicator(daily(30), context(30, 23)), 1);
});

test('Two properly separated practices per day cannot fill the fourteen-day indicator in one week', () => {
  const records = daily(7).flatMap((first, i) => [first, session({ id: `second-${i}`, day: i + 1, hour: 17, minutes: 3 })]);
  near(api.getConsistencyIndicator(records, context(7, 23)), .5);
  assert.ok(api.continuousConsistency(records, context(7, 23)).fraction > .89, 'The independent Ripple bonus still grows at its original rate');
});

test('Qualification uses active time: pauses and many short sessions never pool into a qualifying day', () => {
  const tiny = Array.from({ length: 50 }, (_, i) => session({ id: `tiny-${i}`, startedAt: context(1, 9).timestamp + i * 120000, activeSeconds: 30 }));
  const paused = session({ id: 'paused', day: 2, activeSeconds: 179, pausedSeconds: 600 });
  assert.equal(api.getConsistencyIndicator([...tiny, paused], context(2, 23)), 0);
  near(api.getConsistencyIndicator([session({ activeSeconds: 180, pausedSeconds: 600 })], context(1, 23)), 1 / 14);
  assert.equal(api.getConsistencyIndicator([session({ minutes: 10, status: 'ended_early' })], context(1, 23)), 0);
});

test('Partial progress survives a missed day, decays after complete inactive dates and grows normally on return', () => {
  const records = daily(7), fullPartial = .5;
  near(api.getConsistencyIndicator(records, context(8, 23)), fullPartial, 'The current incomplete date has not decayed');
  const afterOne = api.getConsistencyIndicator(records, context(9));
  near(afterOne, fullPartial * .840896);
  const returned = [...records, session({ day: 9, minutes: 3 })];
  near(api.getConsistencyIndicator(returned, context(9, 23)), afterOne + 1 / 14);
  assert.ok(afterOne > 0 && afterOne < fullPartial);
});

test('Indicator reads are deterministic, input-order independent, duplicate safe and do not mutate history', () => {
  const records = daily(4), original = structuredClone(records);
  const expected = api.getConsistencyIndicator(records, context(5));
  assert.equal(api.getConsistencyIndicator([...records].reverse(), context(5)), expected);
  assert.equal(api.getConsistencyIndicator([...records, records[0]], context(5)), expected);
  assert.deepEqual(records, original);
  assert.throws(() => api.getConsistencyIndicator([...records, { ...records[0], pausedDurationSeconds: 1 }], context(5)), /duration|Conflicting/i);
  assert.throws(() => api.getConsistencyIndicator(records, context(1)), /future/i);
});

test('Historical day assignment remains stable across travel and repeated contexts do not reapply decay', () => {
  const captured = session({ startedAt: Date.parse('2026-01-05T23:50:00Z'), activeSeconds: 180, localDate: '2026-01-06', timeZone: 'Asia/Tokyo' });
  const context = { timestamp: Date.parse('2026-01-07T12:00:00Z'), localDate: '2026-01-07', timeZone: 'America/Los_Angeles' };
  near(api.getConsistencyIndicator([captured], context), 1 / 14);
  assert.equal(api.getConsistencyIndicator([captured], context), api.getConsistencyIndicator([captured], context));
});

test('Empty/reset history has no indicator progress and very long inactivity settles efficiently', () => {
  assert.equal(api.getConsistencyIndicator([], context(1)), 0);
  const fraction = api.getConsistencyIndicator(daily(14), { timestamp: Date.parse('9999-01-01T00:00:00Z'), localDate: '9999-01-01', timeZone: 'UTC' });
  assert.ok(fraction >= 0 && fraction < .000001);
});

test('Snapshot keeps the original bonus score, multiplier and immutable V4 earnings independent of the indicator', () => {
  let state = api.createProgressionState(context(1), api.PROGRESSION_V4);
  for (const practice of daily(14)) state = api.recordSession(state, practice);
  const before = structuredClone(state), snapshot = api.getProgressSnapshot(state, context(14, 23));
  assert.equal(snapshot.consistency.indicatorFraction, 1);
  near(snapshot.consistency.fraction, api.continuousConsistency(daily(14), context(14, 23)).fraction);
  near(snapshot.consistency.multiplier, 1 + .4 * snapshot.consistency.fraction);
  assert.equal(state.awards[0].xpCenti, 4798, 'The original three-minute V4 reward remains unchanged');
  assert.deepEqual(state, before);
});
