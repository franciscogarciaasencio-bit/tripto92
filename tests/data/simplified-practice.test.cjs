const { test } = require('node:test');
const { assert, api, data, domain, connection, openStore, context, session, disk, at, writeLegacyFixture } = require('./helpers.cjs');
const release = (conn, asOf) => openStore(conn, asOf, undefined, 'progression_v3');
const practice = (store, s) => store.meditations.completePractice(s, s.endedAt);
const tables = ['meditation_sessions','progression_awards','practice_completions','journey_completions','journey_animation_receipts',
  'journey_legacy_peaks','legacy_journey_checkpoint','meditation_timer'];
const count = (conn, table) => conn.raw.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;

test('Confirmed deletion erases every practice record, all generations and pending recovery while retaining preferences across disk reopen', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); await store.meditations.acknowledgeCompletion(session().id, at(1,12));
  await store.meditations.resetProgression(context(2)); await practice(store, session({ day: 2 }));
  const prefs = { ...(await store.settings.loadPreferences()), defaultDurationSeconds: 900 };
  const audio = { ...(await store.settings.loadAudioPreferences()), homeEnabled: false, sessionVolume: .4 };
  await store.settings.savePreferences(prefs); await store.settings.saveAudioPreferences(audio);
  await store.application.dismissExplanation(at(2,12));
  const stale = domain('meditation/timer.js').startOpenEndedTimer('pending-to-delete', at(3,9), 'UTC');
  await store.timer.save(stale);
  const result = await store.meditations.resetAllPracticeData(context(4));
  assert.equal(result.journey.level.number, 0); assert.equal(result.snapshot.lifetimeXpCenti, 0);
  assert.equal(result.snapshot.consistency.precedingActiveDays, 0); assert.equal(result.snapshot.totalMeditationSeconds, 0);
  for (const table of tables) assert.equal(count(conn, table), 0, table);
  assert.equal(count(conn, 'progression_generations'), 1);
  assert.deepEqual(await store.settings.loadPreferences(), prefs); assert.deepEqual(await store.settings.loadAudioPreferences(), audio);
  await assert.rejects(store.timer.save(stale), /predates/);
  await assert.rejects(practice(store, session()), /before the current progression reset/);
  await store.close(); conn = connection(filename); store = await release(conn, context(20));
  assert.equal(store.initialJourney.level.number, 0); assert.equal(store.initialSnapshot.currentProgressionCenti, 0);
  assert.equal(store.initialTimer, null); assert.equal(store.initialCompletion, null); assert.equal(store.initialCompletedPractices, 0);
  assert.equal(store.initialExplanationDismissed, true); assert.deepEqual(await store.meditations.getMeditationHistory(), []);
  assert.deepEqual(await store.settings.loadPreferences(), prefs); assert.deepEqual(await store.settings.loadAudioPreferences(), audio);
  const saved = await practice(store, session({ day: 20, minutes: 3 }));
  assert.equal(saved.snapshot.lifetimeXpCenti, 4526); assert.equal(saved.journey.fraction, 4526/12000);
  assert.throws(() => conn.raw.exec('DELETE FROM meditation_sessions'), /immutable/);
  await store.close();
});

for (const target of ['DROP TRIGGER', 'DELETE FROM progression_awards', 'DELETE FROM progression_generations',
  'INSERT INTO progression_generations', 'INSERT INTO progression_checkpoint', 'CREATE TRIGGER', 'COMMIT']) {
  test(`Delete failure at ${target} rolls back both rows and deletion guards`, async t => {
    const conn = connection(), store = await release(conn, context(1)); t.after(() => store.close());
    await practice(store, session()); const expected = await store.meditations.loadProgressionState();
    const guards = conn.raw.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
    conn.failOnce(sql => sql.startsWith(target)); await assert.rejects(store.meditations.resetAllPracticeData(context(2)), /Simulated/);
    assert.deepEqual(await store.meditations.loadProgressionState(), expected);
    assert.deepEqual(conn.raw.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all(), guards);
    assert.equal(count(conn, 'meditation_sessions'), 1); assert.equal(count(conn, 'journey_animation_receipts'), 1);
    assert.throws(() => conn.raw.exec('DELETE FROM progression_awards'), /immutable/);
  });
}

test('Lost delete COMMIT acknowledgement cannot resurrect practice on reopening', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); const exec = conn.exec;
  conn.exec = async sql => { await exec(sql); if (sql === 'COMMIT') throw new Error('Lost acknowledgement'); };
  await assert.rejects(store.meditations.resetAllPracticeData(context(2)), AggregateError); await store.close();
  conn = connection(filename); store = await release(conn, context(3));
  assert.equal(store.initialJourney.level.number, 0); assert.equal(store.initialCompletion, null);
  assert.deepEqual(await store.meditations.getMeditationHistory(), []);
  await store.meditations.resetAllPracticeData(context(3)); await store.close();
});

test('Another connection cannot restore an old session or running timer after deletion', async t => {
  const file = disk(t), one = await release(connection(file), context(1)), two = await release(connection(file), context(1));
  // Close before disk(t)'s cleanup hook (Windows cannot remove an open SQLite file).
  try {
  const old = session(); await practice(one, old); await two.meditations.resetAllPracticeData(context(2));
  await assert.rejects(practice(one, old), /before the current progression reset/);
  await assert.rejects(one.timer.save(domain('meditation/timer.js').startOpenEndedTimer('old', at(1,10), 'UTC')), /predates/);
  assert.deepEqual(await one.meditations.getMeditationHistory(), []);
  } finally { await one.close(); await two.close(); }
});

test('Animation receipt preserves exact before/after progress across retry and real disk reopening', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); const s = session({ day: 2 }); const saved = await practice(store, s);
  const transition = saved.completion.progressTransition;
  assert.equal(transition.beforeLevel, 0); assert.equal(transition.afterLevel, 1);
  assert.equal(transition.segments[0].from, 8000/12000); assert.equal(transition.segments[0].to, 1);
  assert.equal(transition.segments[1].from, 0); assert.equal(transition.segments[1].to, saved.journey.fraction);
  assert.deepEqual((await practice(store,s)).completion.progressTransition, transition);
  assert.equal(count(conn, 'progression_awards'), 2); assert.equal(count(conn, 'journey_animation_receipts'), 2);
  assert.throws(() => conn.raw.exec('UPDATE journey_animation_receipts SET projection_json = NULL'), /immutable/);
  await store.close(); store = await release(connection(filename), context(3));
  assert.deepEqual(store.initialCompletion.progressTransition, transition); await store.close();
});

test('V6 → V7 retains exact Ripple history and the legitimate V2 achievement under its original terms', async t => {
  const filename = disk(t); let conn = connection(filename);
  let state = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V3), session({ minutes: 3 }));
  await writeLegacyFixture(conn, 6, state);
  const receipts = conn.raw.prepare('SELECT * FROM progression_awards').all(), summaries = conn.raw.prepare('SELECT * FROM journey_completions').all();
  assert.equal(conn.raw.prepare('SELECT level FROM journey_checkpoint').get().level, 2); await conn.close();
  conn = connection(filename); let store = await release(conn, context(2));
  assert.equal(store.initialJourney.level.number, 2); assert.equal(store.initialJourney.version, api.JOURNEY_VERSION);
  assert.deepEqual(conn.raw.prepare('SELECT * FROM progression_awards').all(), receipts);
  assert.deepEqual(conn.raw.prepare('SELECT * FROM journey_completions').all(), summaries);
  assert.equal(store.initialCompletion.progressTransition, null);
  const s = session({ day: 2, minutes: 3 }); await practice(store, s);
  // The retained peak and a new V3 receipt remain valid even after an archived-generation reset.
  await store.meditations.acknowledgeCompletion(s.id, at(2,12)); await store.meditations.acknowledgeCompletion(session({minutes:3}).id, at(2,12));
  await store.meditations.resetProgression(context(3)); await store.close();
  store = await release(connection(filename), context(4)); assert.equal(store.initialJourney.level.number, 0); await store.close();
});

test('V7 migration DDL failure leaves the actual V6 ledger and schema intact', async t => {
  const filename = disk(t); let conn = connection(filename);
  const state = api.recordSession(api.createProgressionState(context(1)), session()); await writeLegacyFixture(conn, 6, state);
  const awards = conn.raw.prepare('SELECT * FROM progression_awards').all(); await conn.close();
  conn = connection(filename); conn.failOnce(sql => sql.includes('CREATE TABLE journey_animation_receipts'));
  await assert.rejects(release(conn, context(2)), /Simulated/); conn = connection(filename);
  assert.equal(conn.raw.prepare('SELECT MAX(version) v FROM schema_migrations').get().v, 6);
  assert.deepEqual(conn.raw.prepare('SELECT * FROM progression_awards').all(), awards); await conn.close();
});

for (const mutate of [plan => { plan.version = 'unsupported'; }, plan => { plan.segments[0].to = .9; },
  plan => { plan.segments[0].from = -1; }, plan => { plan.segments = []; }]) {
  test('Corrupt reward animation metadata is rejected without awarding or repairing history', async t => {
    const file = disk(t); let conn = connection(file), store = await release(conn, context(1)); await practice(store, session()); await store.close();
    conn = connection(file); const plan = JSON.parse(conn.raw.prepare('SELECT projection_json FROM journey_animation_receipts').get().projection_json);
    mutate(plan); conn.raw.exec('DROP TRIGGER journey_animation_receipts_immutable_update');
    conn.raw.prepare('UPDATE journey_animation_receipts SET projection_json = ?').run(JSON.stringify(plan)); await conn.close();
    await assert.rejects(release(connection(file), context(2)), /animation/);
  });
}

test('Ripples display only whole numbers while stored rewards retain their exact precision', () => {
  const { formatRipples } = data('../ui/format-ripples.js');
  for (const [centi, visible] of [[0,'0'],[25,'0'],[50,'1'],[503,'5'],[4526,'45'],[8000,'80'],[100000,'1,000']])
    assert.equal(formatRipples(centi), visible);
});

test('Deleting at the exact start of an unsaved cursor prevents that cursor from returning', async t => {
  const conn = connection(), store = await release(conn, context(1)); t.after(() => store.close());
  const boundary = context(2), stale = domain('meditation/timer.js').startOpenEndedTimer('same-ms', boundary.timestamp, 'UTC');
  await store.timer.save(stale); await store.meditations.resetAllPracticeData(boundary);
  await assert.rejects(store.timer.save(stale), /boundary/);
  await assert.rejects(practice(store, session({ startedAt: boundary.timestamp })), /boundary/);
  assert.equal(await store.timer.load(), null);
  const next = domain('meditation/timer.js').startOpenEndedTimer('after', boundary.timestamp + 1, 'UTC');
  await store.timer.save(next); assert.deepEqual(await store.timer.load(), next);
});
