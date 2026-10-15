const { test } = require('node:test');
const { assert, data, domain, connection, disk } = require('./helpers.cjs');
const { requiredPracticeRoute, watchTimerDeadline } = data('../application/practice-lifecycle.js');
const { startTimer, startOpenEndedTimer, pauseTimer, resumeTimer, practiceContext } = domain('meditation/timer.js');
const { openStore } = data('database/store.js');
const START = Date.parse('2026-01-05T09:00:00Z');

function clock(at = START) {
  let now = at;
  const tasks = new Set(), completed = [], errors = [];
  return {
    tasks, completed, errors,
    now: () => now, timeZone: () => 'Europe/Madrid', jump: value => { now = value; },
    schedule(callback, milliseconds) {
      const task = { callback, milliseconds }; tasks.add(task); return () => tasks.delete(task);
    },
    watch(draft) { return watchTimerDeadline(draft, this, value => completed.push(value), error => errors.push(error)); },
    fire() { const task = tasks.values().next().value; tasks.delete(task); task.callback(); },
  };
}

test('Durable practice routing takes precedence over any restored destination', () => {
  assert.equal(requiredPracticeRoute(null, false), null);
  assert.equal(requiredPracticeRoute('running', false), '/session');
  assert.equal(requiredPracticeRoute('paused', false), '/session');
  assert.equal(requiredPracticeRoute('finished', false), '/completion');
  for (const phase of [null, 'running', 'paused', 'finished'])
    assert.equal(requiredPracticeRoute(phase, true), '/completion');
});

test('Idle, open-ended and paused practice schedule no deadline or polling', () => {
  const f = clock();
  for (const draft of [null, startOpenEndedTimer('open', START, 'UTC'),
    pauseTimer(startTimer('paused', 180, START, 'UTC'), START)]) f.watch(draft)();
  assert.equal(f.tasks.size, 0); assert.deepEqual(f.completed, []); assert.deepEqual(f.errors, []);
});

test('One legacy deadline uses active time and delivers exactly one completion', () => {
  const f = clock(), draft = startTimer('deadline', 180, START, 'UTC'), original = { ...draft };
  const stop = f.watch(draft), task = [...f.tasks][0];
  assert.equal(task.milliseconds, 180000);
  f.jump(START + 180000); f.fire(); task.callback();
  assert.equal(f.completed.length, 1); assert.equal(f.tasks.size, 0);
  assert.equal(f.completed[0].timeZone, 'Europe/Madrid');
  assert.equal(f.completed[0].changedAt, START + 180000);
  assert.deepEqual(draft, original); stop();
});

test('Pausing cancels an already queued deadline; resume excludes paused time', () => {
  const f = clock(), draft = startTimer('pause', 180, START, 'UTC');
  const stop = f.watch(draft), stale = [...f.tasks][0]; stop();
  const paused = pauseTimer(draft, START + 60125), resumed = resumeTimer(paused, START + 3600000);
  f.jump(resumed.changedAt); f.watch(resumed); stale.callback();
  assert.equal(f.tasks.size, 1); assert.equal([...f.tasks][0].milliseconds, 119875);
  f.jump(resumed.changedAt + 119875); f.fire();
  assert.equal(f.completed.length, 1); assert.equal(f.completed[0].activeMilliseconds, 180000);
  assert.equal(f.completed[0].pausedMilliseconds, 3539875);
});

test('Return after a deadline completes at its exact timestamp in the captured zone', () => {
  const f = clock(START + 86400000), draft = startTimer('away', 180, START, 'Pacific/Honolulu');
  f.watch(draft);
  assert.equal(f.tasks.size, 0); assert.equal(f.completed.length, 1);
  assert.equal(f.completed[0].timeZone, 'Pacific/Honolulu');
  assert.equal(f.completed[0].changedAt, START + 180000);
});

test('Deadline delayed by another operation is recovered once when unlocked', () => {
  const f = clock(), draft = startTimer('busy', 180, START, 'UTC');
  const stop = f.watch(draft), stale = [...f.tasks][0]; stop(); // provider acquires its lock
  f.jump(START + 240000); stale.callback(); assert.equal(f.completed.length, 0);
  f.watch(draft); assert.equal(f.completed.length, 1); assert.equal(f.tasks.size, 0);
  assert.equal(f.completed[0].activeMilliseconds, 180000);
});

test('Early timeout reschedules only the remaining deadline', () => {
  const f = clock(); f.watch(startTimer('early', 180, START, 'UTC'));
  f.jump(START + 100000); f.fire();
  assert.equal([...f.tasks][0].milliseconds, 80000); assert.equal(f.completed.length, 0);
  f.jump(START + 180000); f.fire(); assert.equal(f.completed.length, 1);
});

test('Clock rollback is held: no error, no fabricated time, one pending deadline, completes when time arrives', () => {
  const f = clock(); f.watch(startTimer('rollback', 180, START, 'UTC'));
  const stale = [...f.tasks][0]; f.jump(START - 60_000); f.fire(); stale.callback();
  assert.equal(f.errors.length, 0); assert.equal(f.completed.length, 0);
  assert.equal(f.tasks.size, 1, 'stale callbacks never pile up deadlines');
  f.jump(START + 180_000); f.fire();
  assert.equal(f.completed.length, 1);
  assert.equal(f.completed[0].activeMilliseconds, 180_000, 'exactly the chosen length, nothing fabricated');
});

test('Real SQLite recovery supplies running, paused, saved and acknowledged route states', async t => {
  let store;
  t.after(async () => { await store?.close(); });
  const file = disk(t), context = timestamp => practiceContext(timestamp, 'UTC');
  store = await openStore(connection(file), context(START));
  const draft = startOpenEndedTimer('recovery-route', START, 'UTC');
  await store.timer.save(draft); await store.close();
  store = await openStore(connection(file), context(START + 60000));
  assert.equal(requiredPracticeRoute(store.initialTimer.phase, !!store.initialCompletion), '/session');
  const paused = pauseTimer(store.initialTimer, START + 60000);
  await store.timer.save(paused); await store.close();
  store = await openStore(connection(file), context(START + 3600000));
  assert.equal(store.initialTimer.activeMilliseconds, 60000);
  assert.equal(requiredPracticeRoute(store.initialTimer.phase, !!store.initialCompletion), '/session');
  const { finishTimer } = domain('meditation/timer.js');
  await store.timer.save(finishTimer(store.initialTimer, START + 3600000)); await store.close();
  store = await openStore(connection(file), context(START + 3600001));
  assert.equal(store.initialTimer, null);
  assert.equal(requiredPracticeRoute(null, !!store.initialCompletion), '/completion');
  assert.equal((await store.meditations.getMeditationHistory()).length, 1);
  await store.meditations.acknowledgeCompletion(draft.id, START + 3600002); await store.close();
  store = await openStore(connection(file), context(START + 3600003));
  assert.equal(requiredPracticeRoute(store.initialTimer?.phase ?? null, !!store.initialCompletion), null);
  assert.equal((await store.meditations.getMeditationHistory()).length, 1);
});
