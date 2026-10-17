const { test } = require('node:test');
const { assert, api, connection, context, disk, fixture, openStore, save, session, writeLegacyFixture } = require('./helpers.cjs');

test('Practice details preserve captured dates, zones, active/paused duration and original centi-Ripples', async t => {
  const { meditations } = await fixture(t);
  const practice = session({ id: 'travel', startedAt: Date.parse('2026-01-05T23:40:00Z'), minutes: 10,
    pausedSeconds: 80, localDate: '2026-01-06', timeZone: 'Asia/Tokyo' });
  await save(meditations, practice);
  assert.deepEqual(await meditations.getPracticeDetails(practice.id), {
    session: practice, createdAt: practice.endedAt, awardedXpCenti: 8000,
    split: null, // V1 receipts predate a separate Consistency bonus
  });
});

test('Repeated detail reads do not award, acknowledge completion, settle decay or alter a checkpoint', async t => {
  const { meditations, conn } = await fixture(t);
  const practice = session();
  await save(meditations, practice);
  const before = await meditations.loadProgressionState(), pending = await meditations.getPendingCompletion();
  const tables = ['meditation_sessions', 'progression_awards', 'progression_checkpoint', 'practice_completions', 'habit_checkpoints'];
  const capture = () => tables.map(table => conn.raw.prepare(`SELECT * FROM ${table}`).all());
  const original = capture(), details = await meditations.getPracticeDetails(practice.id);
  assert.deepEqual(await meditations.getPracticeDetails(practice.id), details);
  assert.deepEqual(await meditations.loadProgressionState(), before);
  assert.deepEqual(await meditations.getPendingCompletion(), pending);
  assert.deepEqual(capture(), original);
});

test('Nearby extensions display only their saved incremental reward, and an unrewarded short practice remains readable', async t => {
  const { meditations } = await fixture(t);
  const first = session({ id: 'first' }), extension = session({ id: 'extension', hour: 9.5 });
  const short = session({ id: 'short', day: 2, minutes: 2 });
  await save(meditations, first); await save(meditations, extension); await save(meditations, short);
  assert.equal((await meditations.getPracticeDetails('first')).awardedXpCenti, 8000);
  assert.equal((await meditations.getPracticeDetails('extension')).awardedXpCenti, 2000);
  assert.equal((await meditations.getPracticeDetails('short')).awardedXpCenti, 0);
});

test('Detail reads retain V1 earnings after a V4 rule switch, decay and real disk reopening', async t => {
  const filename = disk(t), practice = session({ id: 'historical' });
  let store = await openStore(connection(filename), context(1));
  await save(store.meditations, practice);
  const expected = await store.meditations.getPracticeDetails(practice.id);
  await store.meditations.changeRules('progression_v4', context(2));
  await store.meditations.getCurrentPracticeProgress(context(10));
  await store.close();
  store = await openStore(connection(filename), context(10));
  try {
    assert.deepEqual(await store.meditations.getPracticeDetails(practice.id), expected);
    assert.equal((await store.meditations.loadProgressionState()).awards[0].rulesVersion, 'progression_v1');
  } finally { await store.close(); }
});

test('V4 detail reward matches the original completion, including short-session and Consistency earnings', async t => {
  const store = await openStore(connection(), context(1), undefined, 'progression_v4');
  t.after(() => store.close());
  for (const practice of [session({ id: 'short', minutes: 1 }), session({ id: 'qualifying', day: 2, minutes: 3 })]) {
    const saved = await store.meditations.completePractice(practice, practice.endedAt);
    const details = await store.meditations.getPracticeDetails(practice.id);
    assert.equal(details.awardedXpCenti, saved.completion.habitReward.totalCentiXp);
    assert.ok(details.awardedXpCenti > 0);
    await store.meditations.acknowledgeCompletion(practice.id, practice.endedAt);
  }
});

test('Legacy history without a completion summary remains readable without fabricating a receipt', async t => {
  const conn = connection(), practice = session({ id: 'legacy' });
  const state = api.recordSession(api.createProgressionState(context(1)), practice);
  await writeLegacyFixture(conn, 1, state);
  const store = await openStore(conn, state.asOf); t.after(() => store.close());
  assert.equal((await store.meditations.getPracticeDetails('legacy')).awardedXpCenti, 8000);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) AS n FROM practice_completions').get().n, 0);
});

test('Missing and removed practices return null; IDs are validated and SQL stays parameterized', async t => {
  const { meditations } = await fixture(t);
  const practice = session({ id: 'kept' }); await save(meditations, practice);
  assert.equal(await meditations.getPracticeDetails('unknown'), null);
  assert.equal(await meditations.getPracticeDetails("' OR 1=1 --"), null);
  await assert.rejects(meditations.getPracticeDetails('  '), error => error.code === 'INVALID_DATA');
  await meditations.acknowledgeCompletion('kept', practice.endedAt);
  await meditations.resetAllPracticeData(context(2));
  assert.equal(await meditations.getPracticeDetails('kept'), null);
});

test('Malformed captured session and reward rows fail explicitly, rather than display invented values', async t => {
  const { conn, meditations } = await fixture(t);
  const practice = session({ id: 'bad-row' }); await save(meditations, practice);
  conn.raw.exec("DROP TRIGGER progression_awards_immutable_update; UPDATE progression_awards SET breakdown_json = 'malformed'");
  await assert.rejects(meditations.getPracticeDetails('bad-row'), error => error.code === 'INVALID_DATA');
  conn.raw.exec("DROP TRIGGER meditation_sessions_immutable_update; UPDATE meditation_sessions SET local_date = '2026-02-30'");
  await assert.rejects(meditations.getPracticeDetails('bad-row'), error => error.code === 'INVALID_DATA');
});

test('Unknown historical qualification versions are rejected deliberately', async t => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session({ id: 'unknown-rules' }));
  conn.raw.exec("INSERT INTO progression_rules VALUES ('future_unregistered', (SELECT MAX(sequence) + 1 FROM progression_rules), '{}')");
  conn.raw.exec("DROP TRIGGER meditation_sessions_immutable_update; UPDATE meditation_sessions SET qualification_rules_version = 'future_unregistered'");
  await assert.rejects(meditations.getPracticeDetails('unknown-rules'), error => error.code === 'UNSUPPORTED_RULES');
});
