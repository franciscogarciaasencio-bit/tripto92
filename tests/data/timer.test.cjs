const { test } = require('node:test');
const { assert, domain, data, fixture, context, at, openStore, connection, disk } = require('./helpers.cjs');
const { startTimer, pauseTimer, settleTimer, timerSession } = domain('meditation/timer.js');

test('Durable running and paused drafts round trip; a different session cannot replace one', async (t) => {
  const { store } = await fixture(t);
  const draft = startTimer('timer', 600, at(1, 9), 'Europe/Madrid');
  await store.timer.save(draft);
  assert.deepEqual(await store.timer.load(), draft);
  const paused = pauseTimer(draft, draft.startedAt + 1500);
  await store.timer.save(paused);
  assert.deepEqual(await store.timer.load(), paused);
  await assert.rejects(store.timer.save({ ...paused, id: 'different' }), /already in progress/);
  await assert.rejects(store.timer.save({ ...paused, activeMilliseconds: 1.1 }), /Invalid timer/);
  await assert.rejects(store.timer.save({ ...paused, targetSeconds: 900 }), /cannot change/);
  await assert.rejects(store.timer.save({ ...paused, timeZone: 'UTC' }), /only change/);
  await assert.rejects(store.timer.save(draft), /backwards/);
});
test('Expired draft recovers before startup advancement, preserves completion time and awards exactly once', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const draft = startTimer('timer', 600, at(1, 9), 'UTC');
  await store.timer.save(draft);
  await store.close();
  store = await openStore(connection(filename), context(5));
  assert.deepEqual(store.recoveredSession, timerSession(settleTimer(draft, at(5))));
  assert.equal(store.initialSnapshot.lifetimeXpCenti, 8000);
  assert.equal((await store.meditations.getMeditationHistory()).length, 1);
  assert.equal(await store.timer.load(), null);
  const snapshot = store.initialSnapshot;
  await store.close();
  store = await openStore(connection(filename), context(5));
  assert.equal(store.recoveredSession, null);
  assert.deepEqual(store.initialSnapshot, snapshot);
  await store.close();
});
test('Paused draft survives a long closure without becoming meditation activity', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const paused = pauseTimer(startTimer('paused', 600, at(1, 9), 'UTC'), at(1, 9) + 120_000);
  await store.timer.save(paused);
  await store.close();
  store = await openStore(connection(filename), context(10));
  assert.deepEqual(store.initialTimer, paused);
  assert.equal(store.initialSnapshot.totalMeditationSeconds, 0);
  await store.close();
});
test('Failed completion rolls back history, awards, checkpoint AND pending draft deletion; retry succeeds once', async (t) => {
  const { conn, store } = await fixture(t);
  const finished = settleTimer(startTimer('save', 600, at(1, 9), 'UTC'), at(1, 10));
  await store.timer.save(finished);
  await store.timer.save(Object.fromEntries(Object.entries(finished).reverse()));
  await assert.rejects(store.timer.save({ ...finished, phase: 'paused', completionStatus: null, targetSeconds: 900 }), /cannot change/);
  conn.failOnce((sql) => sql.startsWith('DELETE FROM meditation_timer'));
  const session = timerSession(finished);
  await assert.rejects(store.meditations.recordCompletedMeditation(session, at(1, 10)), /Simulated/);
  assert.equal((await store.meditations.getMeditationHistory()).length, 0);
  assert.deepEqual(await store.timer.load(), finished);
  await store.meditations.recordCompletedMeditation(session, at(1, 10));
  assert.equal(await store.timer.load(), null);
  await store.meditations.recordCompletedMeditation(session, at(1, 10));
  assert.equal((await store.meditations.loadProgressionState()).lifetimeXpCenti, 8000);
});
test('Corrupt timer fails explicitly instead of erasing or crediting it', async (t) => {
  const { conn, store } = await fixture(t);
  conn.raw.prepare('INSERT INTO meditation_timer VALUES (1, ?)').run('{"id":"bad"}');
  await assert.rejects(store.timer.load(), (error) => error.code === 'INVALID_DATA');
});
test('Actual V1 database migrates to current schema without changing historical XP or preferences', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const { session, save } = require('./helpers.cjs');
  await save(store.meditations, session());
  const before = await store.meditations.loadProgressionState();
  const preferences = await store.settings.loadPreferences();
  await store.close();
  // Produce the exact released V1 shape, retaining its original immutable history.
  const old = connection(filename);
  old.raw.exec('DROP TABLE journey_completions; DROP TABLE journey_checkpoint; DROP TABLE application_preferences; DROP TABLE practice_completions; DROP TABLE meditation_timer; DELETE FROM schema_migrations WHERE version >= 2;');
  await old.close();
  store = await openStore(connection(filename), before.asOf);
  assert.deepEqual(await store.meditations.loadProgressionState(), before);
  assert.deepEqual(await store.settings.loadPreferences(), preferences);
  assert.equal(await store.timer.load(), null);
  await store.close();
});
