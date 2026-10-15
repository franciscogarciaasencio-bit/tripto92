const { test } = require('node:test');
const { assert, domain, at } = require('./helpers.cjs');
const { startTimer, pauseTimer, resumeTimer, finishTimer, settleTimer, remainingSeconds, timerSession, validateTimer, practiceContext } = domain('meditation/timer.js');
const begin = () => startTimer('stable-id', 600, at(1, 9), 'UTC');

test('Running countdown uses elapsed time and clamps completion at the background deadline', () => {
  const draft = begin();
  assert.equal(remainingSeconds(draft, draft.startedAt + 1001), 599);
  const finished = settleTimer(draft, draft.startedAt + 900_000);
  assert.equal(finished.changedAt, draft.startedAt + 600_000);
  assert.equal(timerSession(finished).activeDurationSeconds, 600);
  assert.equal(timerSession(finished).status, 'completed');
  assert.deepEqual(finishTimer(finished, draft.startedAt + 1000_000), finished);
});
test('Pauses retain partial seconds and never count as active time', () => {
  let draft = begin();
  const start = draft.startedAt;
  draft = pauseTimer(draft, start + 1500);
  assert.equal(remainingSeconds(draft, start + 900_000), 599);
  draft = resumeTimer(draft, start + 10_500);
  draft = pauseTimer(draft, start + 12_000);
  const session = timerSession(finishTimer(draft, start + 15_000));
  assert.equal(session.activeDurationSeconds, 3);
  assert.equal(session.pausedDurationSeconds, 12);
  assert.equal(session.status, 'ended_early');
});
test('Pause at/after deadline completes normally; paused recovery does not auto-complete', () => {
  const draft = begin();
  assert.equal(pauseTimer(draft, draft.startedAt + 700_000).phase, 'finished');
  const paused = pauseTimer(draft, draft.startedAt + 300_000);
  assert.deepEqual(settleTimer(paused, draft.startedAt + 10_000_000), paused);
});
test('Malformed cursors, zones and incomplete saves fail explicitly; a clock rollback is held, never counted', () => {
  const draft = begin();
  assert.equal(remainingSeconds(draft, draft.startedAt - 60_000), remainingSeconds(draft, draft.startedAt));
  assert.throws(() => timerSession(draft), /finished/);
  assert.throws(() => validateTimer({ ...draft, activeMilliseconds: 1 }), /cursor/);
  assert.throws(() => validateTimer({ ...draft, timeZone: undefined }), /zone/);
  assert.throws(() => validateTimer({ ...draft, completionStatus: 'completed' }), /inconsistent/);
});
test('Explicit practice zone assigns completion day across midnight, independent of device zone', () => {
  const startedAt = Date.parse('2026-01-05T23:58:00Z');
  const finished = settleTimer(startTimer('midnight', 600, startedAt, 'Europe/Madrid'), startedAt + 900_000);
  assert.equal(timerSession(finished).localDate, '2026-01-06');
  assert.equal(timerSession(finished).timeZone, 'Europe/Madrid');
  assert.equal(practiceContext(startedAt, 'America/New_York').localDate, '2026-01-05');
});
