const { test } = require('node:test');
const { assert, domain, at, api, context } = require('./helpers.cjs');
const { startFixedTimer, startTimer, pauseTimer, resumeTimer, finishTimer, settleTimer, remainingSeconds, activeElapsedSeconds, timerSession, validateTimer } = domain('meditation/timer.js');
const begin = (minutes = 10) => startFixedTimer('fixed', minutes * 60, at(1, 9), 'UTC');

test('A fixed practice ends by itself exactly at its active target, even when noticed later', () => {
  const d = begin();
  assert.equal(d.mode, 'fixed'); assert.equal(remainingSeconds(d, d.startedAt + 1000), 599);
  assert.deepEqual(settleTimer(d, d.startedAt + 599_999), d);
  const finished = settleTimer(d, at(1, 11));
  assert.equal(finished.phase, 'finished'); assert.equal(finished.completionStatus, 'completed');
  assert.equal(finished.changedAt, d.startedAt + 600_000);
  assert.equal(finished.activeMilliseconds, 600_000);
  assert.equal(timerSession(finished).endedAt, d.startedAt + 600_000);
});

test('Finishing a fixed practice early is the person’s completed practice and still qualifies', () => {
  const d = begin(20);
  const finished = finishTimer(d, d.startedAt + 8 * 60_000);
  assert.equal(finished.completionStatus, 'completed');
  const session = timerSession(finished);
  assert.equal(session.status, 'completed'); assert.equal(session.activeDurationSeconds, 480);
  const state = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V5), session);
  assert.equal(state.sessions[0].qualified, true);
  assert.ok(state.lifetimeXpCenti > 0);
});

test('Pauses never count toward a fixed duration; the deadline moves with them', () => {
  let d = begin(5);
  d = pauseTimer(d, d.startedAt + 120_000);
  d = resumeTimer(d, d.startedAt + 3_720_000);
  assert.equal(remainingSeconds(d, d.changedAt), 180);
  assert.equal(activeElapsedSeconds(d, d.changedAt + 60_000), 180);
  const finished = settleTimer(d, d.changedAt + 3_600_000);
  assert.equal(finished.changedAt, d.changedAt + 180_000);
  assert.equal(finished.pausedMilliseconds, 3_600_000);
  assert.equal(timerSession(finished).activeDurationSeconds, 300);
});

test('Fixed cursors validate their target and status; legacy timed cursors keep their meaning', () => {
  assert.throws(() => startFixedTimer('x', 0, at(1), 'UTC'), /1–180 minutes/);
  assert.throws(() => startFixedTimer('x', 10_801, at(1), 'UTC'), /1–180 minutes/);
  assert.throws(() => validateTimer({ ...begin(), targetSeconds: null }), /1–180 minutes/);
  const early = finishTimer(begin(), at(1, 9) + 60_000);
  assert.throws(() => validateTimer({ ...early, completionStatus: 'ended_early' }), /does not match/);
  const legacy = startTimer('legacy', 600, at(1, 9), 'UTC');
  assert.equal(finishTimer(legacy, at(1, 9) + 60_000).completionStatus, 'ended_early');
});
