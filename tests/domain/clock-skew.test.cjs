const { test } = require('node:test');
const { assert, api, session, context, at } = require('./helpers.cjs');

const v5 = () => api.createProgressionState(context(1), api.PROGRESSION_V5);
const ahead = (state, milliseconds) => api.advanceProgression(state, { ...state.asOf, timestamp: state.asOf.timestamp + milliseconds });

test('A practice ending a few minutes before the settled moment is recorded exactly as without that read', () => {
  const base = api.recordSession(v5(), session({ id: 'a', day: 2, hour: 8 }));
  const late = session({ id: 'b', day: 3, hour: 9 });
  const direct = api.recordSession(base, late);
  // Another phone (clock 5 minutes ahead) settled after the practice ended on this phone's clock.
  const settledAhead = api.advanceProgression(base, { timestamp: late.endedAt + 300_000, localDate: late.localDate, timeZone: 'UTC' });
  const skewed = api.recordSession(settledAhead, late);
  assert.deepEqual(skewed.awards.at(-1), direct.awards.at(-1));
  assert.equal(skewed.lifetimeXpCenti, direct.lifetimeXpCenti);
  assert.equal(skewed.currentProgressionCenti, direct.currentProgressionCenti);
  assert.ok(skewed.asOf.timestamp >= settledAhead.asOf.timestamp, 'the settlement cursor never moves back');
  assert.deepEqual(skewed.sessions.at(-1).session, late, 'history keeps the true times');
});

test('Late endings stay rejected when older than a day before the settled calendar or before a later anchor', () => {
  const base = api.recordSession(v5(), session({ id: 'a', day: 2 }));
  assert.throws(() => api.recordSession(api.advanceProgression(base, context(5)), session({ id: 'b', day: 3 })), /rewind/);
  // A rules upgrade dated after the practice's end: replaying history to that practice could not
  // reproduce an award computed after the upgrade, so the late ending stays a rewind.
  const base4 = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V4), session({ id: 'a', day: 2 }));
  const late = session({ id: 'c', day: 3, hour: 9 });
  const upgraded = api.changeProgressionRules(base4, api.PROGRESSION_V5, { timestamp: late.endedAt + 60_000, localDate: late.localDate, timeZone: 'UTC' });
  assert.ok((upgraded.consistencyActivations ?? []).some((anchor) => anchor.asOf.timestamp > late.endedAt));
  assert.throws(() => api.recordSession(upgraded, late), /rewind/);
});

test('Reads with a clock behind the settlement return the settled view and never rewind decay', () => {
  const state = api.advanceProgression(api.recordSession(v5(), session({ day: 2 })), context(9));
  const behind = api.getProgressSnapshot(state, context(4));
  assert.deepEqual(behind, api.getProgressSnapshot(state, state.asOf));
  const moved = api.advanceProgression(state, context(4));
  assert.equal(moved.settledThroughDate, state.settledThroughDate);
  assert.equal(moved.currentProgressionCenti, state.currentProgressionCenti);
  assert.equal(moved.asOf.timestamp, state.asOf.timestamp);
});

test('The habit checkpoint never rewinds and replays deterministically', () => {
  const state = api.recordSession(v5(), session({ day: 2 }));
  const checkpoint = api.createHabitCheckpoint(state);
  const later = api.advanceHabit(checkpoint, state, context(6));
  const behind = api.advanceHabit(later, state, context(3));
  assert.equal(behind.asOf.timestamp, later.asOf.timestamp);
  assert.equal(behind.effectiveXpCenti, later.effectiveXpCenti);
  assert.equal(behind.settledThroughDate, later.settledThroughDate);
  assert.deepEqual(api.advanceHabit(later, state, behind.asOf), behind);
});
