const { test } = require('node:test');
const { assert, domain, at, api, context } = require('./helpers.cjs');
const { startOpenEndedTimer, pauseTimer, resumeTimer, finishTimer, settleTimer, activeElapsedSeconds, timerSession, validateTimer, remainingSeconds } = domain('meditation/timer.js');
const begin = () => startOpenEndedTimer('open', at(1, 9), 'UTC');
test('Open practice counts upward with no target and never expires automatically', () => {
  const d = begin();
  assert.equal(d.targetSeconds, null);
  assert.equal(activeElapsedSeconds(d, d.startedAt), 0);
  assert.equal(activeElapsedSeconds(d, d.startedAt + 3600001), 3600);
  assert.deepEqual(settleTimer(d, at(10)), d);
  assert.throws(() => remainingSeconds(d, d.startedAt), /no remaining/);
});
test('Finish is normal completion even below five minutes; zero eligibility remains intact', () => {
  const d = begin();
  const finished = finishTimer(d, d.startedAt + 299999);
  const s = timerSession(finished);
  assert.equal(s.status, 'completed');
  assert.equal(s.activeDurationSeconds, 299);
  const state = api.recordSession(api.createProgressionState(context(1)), s);
  assert.equal(state.lifetimeXpCenti, 0);
  assert.deepEqual(finishTimer(finished, at(2)), finished);
});
test('Multiple pauses preserve fractions and exclude every paused interval', () => {
  let d = begin();
  const start = d.startedAt;
  d = pauseTimer(d, start + 1500);
  assert.equal(activeElapsedSeconds(d, start + 900000), 1);
  d = resumeTimer(d, start + 10500);
  d = pauseTimer(d, start + 12000);
  d = finishTimer(d, start + 15000);
  assert.equal(d.activeMilliseconds, 3000);
  assert.equal(d.pausedMilliseconds, 12000);
  const s = timerSession(d);
  assert.equal(s.status, 'completed');
  assert.equal(s.activeDurationSeconds, 3);
  assert.equal(s.pausedDurationSeconds, 12);
});
test('Running cursor JSON reconstruction includes closed/background time; paused cursor excludes it', () => {
  let d = JSON.parse(JSON.stringify(begin()));
  assert.equal(activeElapsedSeconds(d, at(2, 9)), 86400);
  d = pauseTimer(d, at(2, 9));
  const restored = JSON.parse(JSON.stringify(d));
  assert.equal(activeElapsedSeconds(restored, at(5)), 86400);
  assert.equal(timerSession(finishTimer(restored, at(5))).activeDurationSeconds, 86400);
});
test('Open completion captures the explicit completion zone and day across midnight/travel', () => {
  const start = Date.parse('2026-01-05T23:58:00Z');
  const d = startOpenEndedTimer('travel', start, 'America/New_York');
  const s = timerSession(finishTimer(d, start + 600000, 'Europe/Madrid'));
  assert.equal(s.timeZone, 'Europe/Madrid');
  assert.equal(s.localDate, '2026-01-06');
});
test('Open cursor rejects changing meaning, unfinished status and rollback', () => {
  const d = begin();
  assert.throws(() => validateTimer({ ...d, targetSeconds: 600 }), /duration/);
  assert.throws(() => validateTimer({ ...d, mode: undefined }), /mode/);
  assert.throws(() => validateTimer({ ...finishTimer(d, at(1, 10)), completionStatus: 'ended_early' }), /status/);
  assert.throws(() => activeElapsedSeconds(d, d.startedAt - 1), /backwards/);
});
