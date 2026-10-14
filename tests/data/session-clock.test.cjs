const { test } = require('node:test');
const { assert, data, domain } = require('./helpers.cjs');
const { startSessionClock } = data('../ui/session-clock.js');
const { startOpenEndedTimer, pauseTimer, resumeTimer } = domain('meditation/timer.js');
const START = Date.parse('2026-01-05T09:00:00Z');

function fixture(at = START) {
  let now = at, nextId = 0;
  const tasks = new Map(), values = [];
  const clock = {
    now: () => now,
    schedule(callback, milliseconds) {
      const id = ++nextId; tasks.set(id, { callback, at: now + milliseconds });
      return () => tasks.delete(id);
    },
  };
  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]); now = next[1].at; next[1].callback();
    }
    now = end;
  }
  return { clock, values, tasks, advance, jump: at => { now = at; }, publish: seconds => values.push(seconds) };
}

test('Display clock publishes once per active second, without modifying the durable cursor', () => {
  const f = fixture(), draft = startOpenEndedTimer('display', START, 'UTC'), original = { ...draft };
  const stop = startSessionClock(draft, f.clock, f.publish);
  f.advance(999); assert.deepEqual(f.values, [0]);
  f.advance(2001); assert.deepEqual(f.values, [0,1,2,3]);
  assert.deepEqual(draft, original); stop(); assert.equal(f.tasks.size, 0);
});

test('Resume aligns to retained fractional active time and excludes a long pause', () => {
  const initial = startOpenEndedTimer('resumed', START, 'UTC');
  const paused = pauseTimer(initial, START + 1375, 'UTC');
  const resumed = resumeTimer(paused, START + 600000);
  const f = fixture(resumed.changedAt), stop = startSessionClock(resumed, f.clock, f.publish);
  assert.deepEqual(f.values, [1]); f.advance(624); assert.deepEqual(f.values, [1]);
  f.advance(1); assert.deepEqual(f.values, [1,2]); stop();
});

test('Paused display publishes a stable value and schedules no ticking work', () => {
  const draft = pauseTimer(startOpenEndedTimer('paused', START, 'UTC'), START + 3250, 'UTC');
  const f = fixture(START + 3600000), stop = startSessionClock(draft, f.clock, f.publish);
  assert.deepEqual(f.values, [3]); assert.equal(f.tasks.size, 0); stop();
});

test('Delayed UI scheduling catches up from wall time without replaying missed ticks', () => {
  const f = fixture(), draft = startOpenEndedTimer('delayed', START, 'UTC');
  const stop = startSessionClock(draft, f.clock, f.publish);
  const pending = [...f.tasks.values()][0]; f.tasks.clear();
  f.jump(START + 65432); pending.callback();
  assert.deepEqual(f.values, [0,65]); assert.equal([...f.tasks.values()][0].at, START + 66000);
  stop();
});

test('Cancellation prevents an already-delivered stale callback from reviving the clock', () => {
  const f = fixture(), stop = startSessionClock(startOpenEndedTimer('cancelled', START, 'UTC'), f.clock, f.publish);
  const pending = [...f.tasks.values()][0]; stop(); f.jump(START + 120000); pending.callback();
  assert.deepEqual(f.values, [0]); assert.equal(f.tasks.size, 0); stop();
});
