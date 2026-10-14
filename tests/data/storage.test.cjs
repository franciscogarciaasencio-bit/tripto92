const { test } = require('node:test');
const { assert, api, context, session, fixture, disk, connection, openStore, save, data } = require('./helpers.cjs');

test('V1 initializes all tables, defaults, schema marker and empty domain state', async (t) => {
  const { conn, meditations, settings } = await fixture(t);
  const tables = conn.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, ['application_preferences', 'audio_preferences', 'habit_checkpoints', 'habit_reward_receipts', 'journey_animation_receipts', 'journey_checkpoint', 'journey_completions', 'journey_legacy_peaks', 'legacy_journey_checkpoint', 'meditation_preferences', 'meditation_sessions', 'meditation_timer', 'practice_completions', 'progression_awards', 'progression_checkpoint', 'progression_consistency_activations', 'progression_generations', 'progression_rules', 'schema_migrations', 'sync_document_clocks', 'sync_manifest', 'sync_set_aside_sessions', 'sync_state']);
  assert.equal(conn.raw.prepare('SELECT version FROM schema_migrations').get().version, 1);
  assert.equal(conn.raw.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.deepEqual(await meditations.loadProgressionState(), api.createProgressionState(context(1)));
  assert.deepEqual(await settings.loadPreferences(), data('preferences.js').DEFAULT_PREFERENCES);
});

test('A file-backed database survives actual close/reopen without recreating history', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const s = session({ pausedSeconds: 40, status: 'ended_early', localDate: '2026-01-06', timeZone: 'Asia/Tokyo' });
  await save(store.meditations, s);
  const expected = await store.meditations.loadProgressionState();
  await store.close();
  store = await openStore(connection(filename), expected.asOf);
  try {
    assert.deepEqual(await store.meditations.loadProgressionState(), expected);
    assert.deepEqual(await store.meditations.getMeditationHistory(), [{ session: s, createdAt: s.endedAt }]);
  } finally { await store.close(); }
});

test('History is deterministically ordered and paginated, including equal timestamps', async (t) => {
  const { meditations } = await fixture(t);
  const sessions = ['a', 'b', 'c'].map((id) => session({ id, minutes: 0 }));
  for (const s of sessions) await save(meditations, s);
  assert.deepEqual((await meditations.getMeditationHistory()).map((r) => r.session.id), ['c', 'b', 'a']);
  assert.deepEqual((await meditations.getMeditationHistory({ limit: 1, offset: 1 })).map((r) => r.session.id), ['b']);
  await assert.rejects(meditations.getMeditationHistory({ limit: 1001 }), /limit/);
  await assert.rejects(meditations.getMeditationHistory({ offset: -1 }), /integer/);
});

test('Submitting a session twice preserves the original creation timestamp, history and XP', async (t) => {
  const { meditations } = await fixture(t);
  const s = session();
  await save(meditations, s);
  const before = await meditations.loadProgressionState();
  await meditations.recordCompletedMeditation({ ...s }, s.endedAt + 1000);
  assert.deepEqual(await meditations.loadProgressionState(), before);
  assert.deepEqual(await meditations.getMeditationHistory(), [{ session: s, createdAt: s.endedAt }]);
  await assert.rejects(save(meditations, { ...s, activeDurationSeconds: 500 }), /Conflicting session ID/);
  assert.deepEqual(await meditations.loadProgressionState(), before);
});

test('Concurrent duplicate calls serialize and cannot double award', async (t) => {
  const { meditations } = await fixture(t);
  await Promise.all(Array.from({ length: 20 }, () => save(meditations, session())));
  const state = await meditations.loadProgressionState();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.awards.length, 1);
  assert.equal(state.lifetimeXpCenti, 8000);
});

for (const target of ['INSERT INTO meditation_sessions', 'INSERT INTO progression_awards', 'INSERT INTO progression_checkpoint', 'COMMIT']) {
  test(`Failure at ${target} rolls back every completion record and permits retry`, async (t) => {
    const { conn, meditations } = await fixture(t);
    const before = await meditations.loadProgressionState();
    conn.failOnce((sql) => sql.startsWith(target));
    await assert.rejects(save(meditations, session()), /Simulated SQLite failure/);
    assert.deepEqual(await meditations.loadProgressionState(), before);
    assert.deepEqual(await meditations.getMeditationHistory(), []);
    await save(meditations, session());
    assert.equal((await meditations.loadProgressionState()).lifetimeXpCenti, 8000);
  });
}

test('SQL uniqueness and foreign keys independently reject duplicate/orphan receipts', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  assert.throws(() => conn.raw.exec('INSERT INTO progression_awards SELECT * FROM progression_awards'), /UNIQUE/);
  const copy = `INSERT INTO progression_awards SELECT 'other', 2, ?, occasion_id, rules_version,
    awarded_at, local_date, reward_date, xp_centi, breakdown_json, generation_id FROM progression_awards`;
  assert.throws(() => conn.raw.prepare(copy).run(session().id), /UNIQUE/);
  assert.throws(() => conn.raw.prepare(copy).run('missing-session'), /FOREIGN KEY/);
});

for (const table of ['meditation_sessions', 'progression_awards', 'progression_rules']) {
  test(`${table} historical rows reject UPDATE and DELETE`, async (t) => {
    const { conn, meditations } = await fixture(t);
    await save(meditations, session());
    assert.throws(() => conn.raw.exec(`DELETE FROM ${table}`), /immutable/);
    assert.throws(() => conn.raw.exec(`UPDATE ${table} SET sequence = sequence`), /immutable/);
  });
}

test('Preferences persist full typed values across a file close/reopen', async (t) => {
  const filename = disk(t);
  const custom = { defaultDurationSeconds: 1800, ambientSoundId: 'rain', gongIntervalSeconds: 300, ambienceVolume: 0.25, gongVolume: 0.75,
    durationMode: 'fixed', intention: 'focus' };
  let store = await openStore(connection(filename), context(1));
  await store.settings.savePreferences(custom);
  await store.close();
  store = await openStore(connection(filename), context(1));
  try { assert.deepEqual(await store.settings.loadPreferences(), custom); }
  finally { await store.close(); }
});

test('Queued inputs are detached from caller objects', async (t) => {
  const { meditations, settings } = await fixture(t);
  const s = session();
  const pending = save(meditations, s);
  s.id = 'mutated';
  await pending;
  assert.equal((await meditations.getMeditationHistory())[0].session.id, session().id);
  const preferences = { ...data('preferences.js').DEFAULT_PREFERENCES };
  const write = settings.savePreferences(preferences);
  preferences.gongVolume = 0;
  await write;
  assert.equal((await settings.loadPreferences()).gongVolume, 0.5);
});

test('Close waits for pending transactions, is idempotent, and rejects later operations', async (t) => {
  const { store, meditations } = await fixture(t);
  const pending = save(meditations, session());
  const close = store.close();
  await pending;
  await close;
  await store.close();
  await assert.rejects(meditations.loadProgressionState(), /closed/);
});

test('Separate connections always load the latest committed checkpoint before a completion', async (t) => {
  const filename = disk(t);
  const one = await openStore(connection(filename), context(1));
  const two = await openStore(connection(filename), context(1));
  try {
    await save(one.meditations, session());
    await save(two.meditations, session({ day: 2 }));
    await save(one.meditations, session({ day: 2 }));
    assert.deepEqual(await one.meditations.loadProgressionState(), await two.meditations.loadProgressionState());
    assert.equal((await two.meditations.loadProgressionState()).awards.length, 2);
  } finally { await one.close(); await two.close(); }
});

test('A failed rollback poisons the connection so further writes cannot join an unknown transaction', async (t) => {
  const { conn, meditations } = await fixture(t);
  const exec = conn.exec;
  conn.exec = async (sql) => { if (sql === 'ROLLBACK') throw new Error('Rollback failed'); return exec(sql); };
  conn.failOnce((sql) => sql.startsWith('INSERT INTO progression_awards'));
  await assert.rejects(save(meditations, session()), (error) => error instanceof AggregateError && error.errors.length === 2);
  await assert.rejects(save(meditations, session({ day: 2 })), /requires reopening/);
});

test('An external writer lock fails safely and a later retry succeeds', async (t) => {
  const filename = disk(t);
  const conn = connection(filename);
  const store = await openStore(conn, context(1));
  const locker = connection(filename);
  try {
    conn.raw.exec('PRAGMA busy_timeout = 1');
    locker.raw.exec('BEGIN IMMEDIATE');
    await assert.rejects(save(store.meditations, session()), /locked/);
    locker.raw.exec('ROLLBACK');
    assert.equal((await store.meditations.loadProgressionState()).sessions.length, 0);
    await save(store.meditations, session());
    assert.equal((await store.meditations.loadProgressionState()).lifetimeXpCenti, 8000);
  } finally { await locker.close(); await store.close(); }
});

test('Lost commit acknowledgement can be retried after reopening without awarding twice', async (t) => {
  const filename = disk(t);
  const conn = connection(filename);
  let store = await openStore(conn, context(1));
  const exec = conn.exec;
  conn.exec = async (sql) => {
    await exec(sql);
    if (sql === 'COMMIT') throw new Error('Commit acknowledgement lost');
  };
  await assert.rejects(save(store.meditations, session()), AggregateError);
  await store.close();
  const s = session();
  store = await openStore(connection(filename), { ...context(1), timestamp: s.endedAt });
  try {
    await save(store.meditations, s);
    const state = await store.meditations.loadProgressionState();
    assert.equal(state.awards.length, 1);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.lifetimeXpCenti, 8000);
  } finally { await store.close(); }
});
