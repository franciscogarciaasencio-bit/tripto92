const { test } = require('node:test');
const { assert, domain } = require('./helpers.cjs');
const { startTimer, settleTimer, finishTimer, timerSession } = domain('meditation/timer.js');
test('Observed completion captures its explicit zone; retries never move that historical date', () => {
  const start = Date.parse('2026-01-05T23:58:00Z');
  const draft = startTimer('travel', 600, start, 'UTC');
  const ended = settleTimer(draft, start + 600_000, 'America/New_York');
  const session = timerSession(ended);
  assert.equal(session.localDate, '2026-01-05');
  assert.equal(session.timeZone, 'America/New_York');
  assert.deepEqual(timerSession(finishTimer(ended, start + 900_000, 'Asia/Tokyo')), session);
  assert.equal(timerSession(settleTimer(draft, start + 900_000)).localDate, '2026-01-06');
});
