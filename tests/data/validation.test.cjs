const { test } = require('node:test');
const { assert, data, fixture, session, save, corruptCheckpoint, context, connection, openStore, disk, api } = require('./helpers.cjs');
const invalid = (error) => error?.name === 'PersistenceError' && error.code === 'INVALID_DATA';
const { decodeSession, decodeAwardRow } = data('database/decoders.js');

for (const [label, change] of [
  ['missing ID', { id: '' }], ['null ID', { id: null }], ['string timestamp', { startedAt: '2026-01-05' }],
  ['negative duration', { activeDurationSeconds: -1 }], ['fractional duration', { activeDurationSeconds: 1.5 }],
  ['unsafe number', { endedAt: Number.MAX_SAFE_INTEGER + 1 }], ['invalid date', { localDate: '2026-02-30' }],
  ['missing zone', { timeZone: null }], ['offset instead of identifier', { timeZone: '+02:00' }],
  ['unfinished status', { status: 'running' }], ['impossible elapsed time', { pausedDurationSeconds: 3600 }],
]) {
  test(`Session decoder rejects ${label} with a controlled data error`, () => {
    assert.throws(() => decodeSession({ ...session(), ...change }), invalid);
  });
}

test('Malformed persisted session fails both history and state decoding without changing XP', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  conn.raw.exec("DROP TRIGGER meditation_sessions_immutable_update; UPDATE meditation_sessions SET local_date = '2026-02-30'");
  await assert.rejects(meditations.loadProgressionState(), invalid);
  await assert.rejects(meditations.getMeditationHistory(), invalid);
  await assert.rejects(meditations.getCurrentProgressionSnapshot(context(10)), invalid);
  assert.equal(conn.raw.prepare('SELECT xp_centi FROM progression_awards').get().xp_centi, 8000);
});

for (const value of [0.5, -1, null, '80', Number.MAX_SAFE_INTEGER + 1]) {
  test(`Receipt decoder rejects invalid fixed-point XP: ${String(value)}`, async (t) => {
    const { conn, meditations } = await fixture(t);
    await save(meditations, session());
    const row = conn.raw.prepare('SELECT * FROM progression_awards').get();
    assert.throws(() => decodeAwardRow({ ...row, xp_centi: value }), invalid);
  });
}

test('SQL independently refuses fractional centi-XP', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  conn.raw.exec('DROP TRIGGER progression_awards_immutable_update');
  assert.throws(() => conn.raw.exec('UPDATE progression_awards SET xp_centi = 0.5'), /CHECK/);
  assert.throws(() => conn.raw.exec('UPDATE progression_checkpoint SET current_progression_centi = 0.5'), /CHECK/);
});

for (const [name, corrupt] of [
  ['missing required field', (m) => { delete m.asOf; }],
  ['invalid date cursor', (m) => { m.settledThroughDate = 'tomorrow'; }],
  ['unsettled cursor', (m) => { m.settledThroughDate = '2020-01-01'; }],
  ['fractional count', (m) => { m.sessionCount = 1.5; }],
  ['ledger count mismatch', (m) => { m.sessionCount = 2; }],
  ['missing active rules', (m) => { m.activeRulesVersion = 'missing'; }],
  ['invalid highest rank', (m) => { m.highestRankAchieved.rank.name = 'fabricated'; }],
  ['future achievement timestamp', (m) => { m.highestRankAchieved.achievedAt = m.asOf.timestamp + 1; }],
  ['missing occasion', (m) => { m.occasions = []; }],
  ['duplicate occasion session', (m) => { m.occasions[0].sessionIds.push(m.occasions[0].sessionIds[0]); }],
  ['incorrect occasion time', (m) => { m.occasions[0].activeDurationSeconds = 999; }],
  ['incorrect occasion earnings', (m) => { m.occasions[0].awardedCentiXp = 1; }],
  ['incorrect frequency', (m) => { m.occasions[0].ordinalInDay = 2; }],
  ['incorrect consistency', (m) => { m.occasions[0].precedingActiveDays = 7; }],
]) {
  test(`Corrupted checkpoint: ${name} fails explicitly`, async (t) => {
    const { conn, meditations } = await fixture(t);
    await save(meditations, session());
    corruptCheckpoint(conn, corrupt);
    await assert.rejects(meditations.loadProgressionState(), invalid);
    await assert.rejects(save(meditations, session({ day: 2 })), invalid);
    assert.equal(conn.raw.prepare('SELECT COUNT(*) AS n FROM meditation_sessions').get().n, 1);
  });
}

test('Missing checkpoint never causes existing history to be re-awarded or silently repaired', async (t) => {
  const filename = disk(t);
  const conn = connection(filename);
  const store = await openStore(conn, context(1));
  await save(store.meditations, session());
  conn.raw.exec('DELETE FROM progression_checkpoint');
  await store.close();
  await assert.rejects(openStore(connection(filename), context(10)), (e) => e.code === 'MISSING_CHECKPOINT');
  const inspect = connection(filename);
  assert.equal(inspect.raw.prepare('SELECT xp_centi FROM progression_awards').get().xp_centi, 8000);
  assert.equal(inspect.raw.prepare('SELECT COUNT(*) AS n FROM progression_checkpoint').get().n, 0);
  await inspect.close();
});

test('Missing checkpoint in an already initialized empty database also fails explicitly', async (t) => {
  const { conn, meditations } = await fixture(t);
  conn.raw.exec('DELETE FROM progression_checkpoint');
  await assert.rejects(meditations.loadProgressionState(), (e) => e.code === 'MISSING_CHECKPOINT');
});

for (const amount of [1, 100000]) {
  test(`Out-of-bounds progression balance ${amount} is rejected`, async (t) => {
    const { conn, meditations } = await fixture(t);
    await save(meditations, session());
    conn.raw.prepare('UPDATE progression_checkpoint SET current_progression_centi = ?').run(amount);
    await assert.rejects(meditations.loadProgressionState(), invalid);
  });
}

test('Malformed JSON and future checkpoint schema produce controlled errors', async (t) => {
  const { conn, meditations } = await fixture(t);
  corruptCheckpoint(conn, (m) => { m.schemaVersion = 999; });
  await assert.rejects(meditations.loadProgressionState(), (e) => e.code === 'UNSUPPORTED_SCHEMA');
  conn.raw.exec("UPDATE progression_checkpoint SET metadata_json = 'not JSON'");
  await assert.rejects(meditations.loadProgressionState(), invalid);
});

test('A stored rules configuration cannot silently reuse a known version', async (t) => {
  const { conn, meditations } = await fixture(t);
  const rules = JSON.parse(conn.raw.prepare('SELECT rules_json FROM progression_rules').get().rules_json);
  rules.duration.baseCentiXp = 999999;
  conn.raw.exec('DROP TRIGGER progression_rules_immutable_update');
  conn.raw.prepare('UPDATE progression_rules SET rules_json = ?').run(JSON.stringify(rules));
  await assert.rejects(meditations.loadProgressionState(), invalid);
});

test('An application cannot register changed V1 balancing under its historical ID', async () => {
  const conn = connection();
  await assert.rejects(openStore(conn, context(1), [{ ...api.PROGRESSION_V1, dailyDecayBasisPoints: 200 }]), /Conflicting registered rules/);
});

test('Unsupported requested rules leave the checkpoint unchanged', async (t) => {
  const { meditations } = await fixture(t);
  const before = await meditations.loadProgressionState();
  await assert.rejects(meditations.changeRules('not_supported', context(2)), (e) => e.code === 'UNSUPPORTED_RULES');
  assert.deepEqual(await meditations.loadProgressionState(), before);
});

test('Corrupt cumulative receipt chain is rejected without recalculating its earnings', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  const b = JSON.parse(conn.raw.prepare('SELECT breakdown_json FROM progression_awards').get().breakdown_json);
  b.previousOccasionCentiXp = 50;
  conn.raw.exec('DROP TRIGGER progression_awards_immutable_update');
  conn.raw.prepare('UPDATE progression_awards SET breakdown_json = ?').run(JSON.stringify(b));
  await assert.rejects(meditations.loadProgressionState(), invalid);
});

for (const change of [
  { defaultDurationSeconds: 0 }, { defaultDurationSeconds: 1.5 }, { gongIntervalSeconds: -1 },
  { ambientSoundId: '' }, { ambienceVolume: 1.1 }, { gongVolume: NaN }, { gongVolume: null },
]) {
  test(`Invalid preferences are rejected atomically: ${JSON.stringify(change)}`, async (t) => {
    const { settings } = await fixture(t);
    const before = await settings.loadPreferences();
    await assert.rejects(settings.savePreferences({ ...before, ...change }), invalid);
    assert.deepEqual(await settings.loadPreferences(), before);
  });
}

test('Corrupt preferences fail explicitly instead of silently applying defaults', async (t) => {
  const { conn, settings } = await fixture(t);
  conn.raw.exec("UPDATE meditation_preferences SET preferences_json = '{}'");
  await assert.rejects(settings.loadPreferences(), invalid);
  conn.raw.exec('DELETE FROM meditation_preferences');
  await assert.rejects(settings.loadPreferences(), invalid);
});

test('Missing receipt is detected even when an external writer adjusts the receipt count', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  conn.raw.exec('DROP TRIGGER progression_awards_immutable_delete; DELETE FROM progression_awards; UPDATE progression_checkpoint SET current_progression_centi = 0');
  corruptCheckpoint(conn, (m) => { m.awardCount = 0; });
  await assert.rejects(meditations.loadProgressionState(), invalid);
});
