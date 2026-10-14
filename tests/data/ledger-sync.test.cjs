const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { assert, data, connection, disk, openStore, context, session, at, DROP_SYNC_MIGRATION } = require('./helpers.cjs');
const { sha256Hex } = data('database/sha256.js');
const ledger = data('database/ledger.js');
const { startOpenEndedTimer } = require('./helpers.cjs').domain('meditation/timer.js');

// Same released rule activation as the native adapter (initializeDatabase).
const release = (conn, asOf) => openStore(conn, asOf, undefined, 'progression_v5');
async function open(t, conn = connection(), asOf = context(1)) {
  const store = await release(conn, asOf);
  t.after(() => store.close());
  return { conn, store };
}
async function practice(store, s) {
  await store.meditations.completePractice(s, s.endedAt);
  await store.meditations.acknowledgeCompletion(s.id, s.endedAt);
}
async function history(t, days = 5) {
  const source = await open(t);
  for (let day = 1; day <= days; day++) {
    await practice(source.store, session({ day, hour: 8 }));
    if (day % 2) await practice(source.store, session({ day, hour: 16, minutes: 20 }));
  }
  await source.store.meditations.getCurrentPracticeProgress(context(days + 3));
  return source;
}
const rowSet = (snapshot) => snapshot.rows.map((row) => `${row.table}|${row.key}|${row.hash}`).sort();

test('Pure SHA-256 matches Node crypto for ASCII, multibyte, surrogate pairs and block boundaries', () => {
  const inputs = ['', 'abc', 'Ona — calm ☀️ 🌊', 'ñ'.repeat(31), 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000),
    JSON.stringify({ table: 'meditation_sessions', row: { id: 'é', n: 1.5 } })];
  for (const input of inputs) assert.equal(sha256Hex(input), createHash('sha256').update(input, 'utf8').digest('hex'), input.slice(0, 20));
});

test('Migration 11 gives every ledger file its own device identity and an unbound guest state', async (t) => {
  const a = await open(t), b = await open(t);
  const first = await a.store.sync.loadState(), second = await b.store.sync.loadState();
  assert.match(first.deviceId, /^[0-9a-f]{32}$/);
  assert.notEqual(first.deviceId, second.deviceId);
  assert.deepEqual({ ...first, deviceId: null }, { deviceId: null, accountId: null, syncedRevision: 0, inflight: null, lastSyncedAt: null });
  assert.deepEqual(a.store.initialSync, first);
});

test('A released V10 file upgrades through the sync migrations without touching practice', async (t) => {
  const file = disk(t);
  let conn = connection(file), store = await release(conn, context(1));
  await practice(store, session({ day: 1 }));
  const before = await store.meditations.loadProgressionState();
  await store.close();
  conn = connection(file); conn.raw.exec(DROP_SYNC_MIGRATION); await conn.close();
  conn = connection(file); store = await release(conn, context(1, 12));
  t.after(() => store.close());
  assert.equal(conn.raw.prepare('SELECT MAX(version) v FROM schema_migrations').get().v, 12);
  const after = await store.meditations.loadProgressionState();
  assert.deepEqual(after.sessions, before.sessions); assert.deepEqual(after.awards, before.awards);
  assert.equal(after.lifetimeXpCenti, before.lifetimeXpCenti);
  assert.match((await store.sync.loadState()).deviceId, /^[0-9a-f]{32}$/);
});

test('A ledger file binds to exactly one account; SQL rejects rebinding even outside the repository', async (t) => {
  const { conn, store } = await open(t);
  await store.sync.bindAccount('user-a');
  assert.equal((await store.sync.bindAccount('user-a')).accountId, 'user-a');
  await assert.rejects(store.sync.bindAccount('user-b'), /another account/);
  assert.throws(() => conn.raw.exec("UPDATE sync_state SET account_id = 'user-b'"), /bound to one account/);
  assert.throws(() => conn.raw.exec("UPDATE sync_state SET account_id = NULL"), /bound to one account/);
  assert.throws(() => conn.raw.exec("UPDATE sync_state SET device_id = '00000000000000000000000000000000'"), /bound to one account/);
});

test('Export is deterministic, omits device acknowledgement and round-trips into another device exactly', async (t) => {
  const source = await history(t);
  const exported = await source.store.sync.exportLedger();
  assert.deepEqual(rowSet(exported), rowSet(await source.store.sync.exportLedger()));
  assert.ok(exported.rows.every((row) => !('acknowledged_at' in row.row)));
  const tables = new Set(exported.rows.map((row) => row.table));
  for (const table of ['meditation_sessions', 'progression_awards', 'habit_reward_receipts', 'progression_checkpoint', 'habit_checkpoints']) assert.ok(tables.has(table), table);
  // Serialized through JSON, exactly as it would travel through the cloud.
  const wire = ledger.decodeSnapshot(JSON.parse(JSON.stringify(exported)));

  const target = await open(t, connection(), context(1));
  await target.store.sync.bindAccount('user-a');
  await target.store.sync.applyRemote(wire.rows, 7, at(9));
  assert.deepEqual(rowSet(await target.store.sync.exportLedger()), rowSet(exported));
  assert.deepEqual(await target.store.meditations.loadProgressionState(), await source.store.meditations.loadProgressionState());
  assert.deepEqual(await target.store.meditations.getMeditationHistory(), await source.store.meditations.getMeditationHistory());
  const id = exported.rows.find((row) => row.table === 'meditation_sessions').row.id;
  assert.deepEqual(await target.store.meditations.getPracticeDetails(id), await source.store.meditations.getPracticeDetails(id));
  assert.equal(await target.store.meditations.getPendingCompletion(), null, 'another device practice never reopens a completion screen');
  const state = await target.store.sync.loadState();
  assert.equal(state.syncedRevision, 7); assert.equal(state.lastSyncedAt, at(9));
  assert.deepEqual((await target.store.sync.localChanges()).diff, { removes: [], adds: [] });
  const progress = await target.store.meditations.getCurrentPracticeProgress(context(9));
  assert.deepEqual(progress, await source.store.meditations.getCurrentPracticeProgress(context(9)));
  // Time passing only settles continuation singletons: recomputable everywhere, never pushed alone.
  const settled = await target.store.sync.localChanges();
  assert.ok(settled.diff.adds.length > 0 && settled.diff.adds.every((row) => ledger.CONTINUATION_TABLES.includes(row.table)));
  assert.equal(settled.significant, false);
  // Guards are restored after replacement.
  assert.throws(() => target.conn.raw.exec('DELETE FROM meditation_sessions'), /immutable/);
});

test('Imported practice keeps working: the next local practice earns on the restored continuation', async (t) => {
  const source = await history(t, 3);
  const rows = (await source.store.sync.exportLedger()).rows;
  const target = await open(t);
  await target.store.sync.bindAccount('user-a');
  await target.store.sync.applyRemote(rows, 1, at(7));
  const next = session({ day: 7, hour: 9 });
  const a = await source.store.meditations.completePractice(next, next.endedAt);
  const b = await target.store.meditations.completePractice(next, next.endedAt);
  assert.deepEqual(b.completion, a.completion);
  assert.deepEqual(b.habit, a.habit);
});

for (const [name, change] of [
  ['an award amount', (rows) => { const award = rows.find((row) => row.table === 'progression_awards'); award.row.xp_centi += 100; }],
  ['a missing receipt', (rows) => rows.splice(rows.findIndex((row) => row.table === 'habit_reward_receipts'), 1)],
  ['a missing checkpoint', (rows) => rows.splice(rows.findIndex((row) => row.table === 'progression_checkpoint'), 1)],
  ['an overlapping session', (rows) => { const s = rows.filter((row) => row.table === 'meditation_sessions')[1]; s.row.started_at -= 3_600_000 * 20; }],
]) test(`Tampered cloud ledger with ${name} is rejected and leaves the device unchanged`, async (t) => {
  const source = await history(t, 3);
  const rows = JSON.parse(JSON.stringify((await source.store.sync.exportLedger()).rows));
  change(rows);
  const decoded = rows.map((row) => ledger.ledgerRow(row.table, row.row));
  const target = await open(t);
  await practice(target.store, session({ day: 1, hour: 6 }));
  await target.store.sync.bindAccount('user-a');
  const before = await target.store.sync.exportLedger();
  await assert.rejects(target.store.sync.applyRemote(decoded, 3, at(5)), (error) => error.code === 'INVALID_DATA' || error.code === 'MISSING_CHECKPOINT');
  assert.deepEqual(rowSet(await target.store.sync.exportLedger()), rowSet(before));
  assert.equal((await target.store.sync.loadState()).syncedRevision, 0);
  assert.throws(() => target.conn.raw.exec('DELETE FROM progression_awards'), /immutable/);
});

test('Untrusted rows are validated before any SQL: unknown tables, columns, nested values and bad keys', () => {
  assert.throws(() => ledger.ledgerRow('sqlite_master', { name: 'x' }), /Unknown ledger table/);
  assert.throws(() => ledger.ledgerRow('meditation_timer', { id: 1 }), /Unknown ledger table/);
  assert.throws(() => ledger.ledgerRow('meditation_sessions', { id: 'a', 'x; DROP TABLE y': 1 }), /column/);
  assert.throws(() => ledger.ledgerRow('meditation_sessions', { id: { nested: true } }), /Unsupported/);
  assert.throws(() => ledger.ledgerRow('meditation_sessions', { id: 1.5 }), /key/);
  assert.throws(() => ledger.ledgerRow('practice_completions', { session_id: 'a', acknowledged_at: 1 }), /column/);
  assert.throws(() => ledger.decodeSnapshot({ format: 'ona_ledger_v9', schemaVersion: 1, rows: [] }), /newer version/);
  assert.throws(() => ledger.decodeSnapshot({ format: 'ona_ledger_v1', schemaVersion: 99, rows: [] }), /newer version/);
});

test('Import refuses an account-less file, a running practice and an unacknowledged completion', async (t) => {
  const source = await history(t, 2);
  const rows = (await source.store.sync.exportLedger()).rows;
  const target = await open(t);
  await assert.rejects(target.store.sync.applyRemote(rows, 1, at(4)), /Cannot apply/);
  await target.store.sync.bindAccount('user-a');
  await target.store.timer.save(startOpenEndedTimer('running-1', at(3, 9), 'UTC'));
  await assert.rejects(target.store.sync.applyRemote(rows, 1, at(4)), /current practice/);
  await target.store.timer.discard('running-1');
  const s = session({ day: 3, hour: 10 });
  await target.store.meditations.completePractice(s, s.endedAt);
  await assert.rejects(target.store.sync.applyRemote(rows, 1, at(4)), /saved practice/);
});

test('Local changes are a diff against the last synced manifest; applying it to the base reproduces the device', async (t) => {
  const source = await history(t, 2);
  const base = (await source.store.sync.exportLedger()).rows;
  const device = await open(t);
  await device.store.sync.bindAccount('user-a');
  await device.store.sync.applyRemote(base, 4, at(5));
  await practice(device.store, session({ day: 5, hour: 9 }));
  const { diff, snapshot, significant } = await device.store.sync.localChanges();
  assert.equal(significant, true);
  const added = new Set(diff.adds.map((row) => row.table));
  for (const table of ['meditation_sessions', 'progression_awards', 'practice_completions', 'habit_reward_receipts']) assert.ok(added.has(table), table);
  assert.ok(diff.removes.some((ref) => ref.table === 'progression_checkpoint'), 'changed singleton is replaced');
  assert.ok(!diff.removes.some((ref) => ref.table === 'meditation_sessions'), 'history is never removed by a practice');
  assert.deepEqual(rowSet({ rows: ledger.applyLedgerDiff(base, diff) }), rowSet(snapshot));
  assert.throws(() => ledger.applyLedgerDiff(base, { removes: [{ table: 'meditation_sessions', key: '["missing"]' }], adds: [] }), /does not exist/);
  assert.throws(() => ledger.applyLedgerDiff(base, { removes: [], adds: [base[0]] }), /already exists/);
});

test('A durable in-flight push survives restart; acknowledgement adopts its target manifest exactly once', async (t) => {
  const file = disk(t);
  let conn = connection(file), store = await release(conn, context(1));
  await store.sync.bindAccount('user-a');
  await practice(store, session({ day: 1 }));
  const { diff, asOf } = await store.sync.localChanges();
  const push = { pushId: 'push-1', expectedRevision: 0, kind: 'upload', diff, asOf };
  await assert.rejects(store.sync.beginPush({ ...push, expectedRevision: 3 }), /synced revision/);
  await store.sync.beginPush(push);
  await assert.rejects(store.sync.beginPush({ ...push, pushId: 'push-2' }), /still pending/);
  await store.close();
  conn = connection(file); store = await release(conn, context(1, 12));
  t.after(() => store.close());
  const restored = (await store.sync.loadState()).inflight;
  assert.equal(restored.pushId, 'push-1');
  assert.deepEqual(rowSet({ rows: restored.diff.adds }), rowSet({ rows: diff.adds }));
  await assert.rejects(store.sync.completePush('push-x', 1, at(1, 13)), /Unknown/);
  await assert.rejects(store.sync.completePush('push-1', 2, at(1, 13)), /skips a revision/);
  await store.sync.completePush('push-1', 1, at(1, 13));
  const state = await store.sync.loadState();
  assert.equal(state.syncedRevision, 1); assert.equal(state.inflight, null); assert.equal(state.lastSyncedAt, at(1, 13));
  // Reopening later re-settled continuation only; the acknowledged push covered all history.
  const after = await store.sync.localChanges();
  assert.equal(after.significant, false);
  assert.ok(after.diff.adds.every((row) => ledger.CONTINUATION_TABLES.includes(row.table)));
  await assert.rejects(store.sync.completePush('push-1', 1, at(1, 14)), /Unknown/);
});

test('An abandoned (conflicting) push leaves the manifest and revision untouched', async (t) => {
  const { store } = await open(t);
  await store.sync.bindAccount('user-a');
  await practice(store, session({ day: 1 }));
  const { diff, snapshot, asOf } = await store.sync.localChanges();
  await store.sync.beginPush({ pushId: 'p', expectedRevision: 0, kind: 'upload', diff, asOf });
  await store.sync.abandonPush('p');
  const state = await store.sync.loadState();
  assert.equal(state.inflight, null); assert.equal(state.syncedRevision, 0);
  assert.equal((await store.sync.localChanges()).diff.adds.length, snapshot.rows.length);
});

test('Reset removes all synced practice as row removals, including set-aside practice', async (t) => {
  const source = await history(t, 3);
  const device = await open(t);
  await device.store.sync.bindAccount('user-a');
  const rows = (await source.store.sync.exportLedger()).rows;
  const setAside = ledger.ledgerRow('sync_set_aside_sessions', { session_id: 'other', session_json: JSON.stringify(session({ day: 2, hour: 8 })),
    created_at: at(2, 9), set_aside_at: at(4), reason: 'overlap' });
  await device.store.sync.applyRemote([...rows, setAside], 2, at(6));
  assert.throws(() => device.conn.raw.exec('DELETE FROM sync_set_aside_sessions'), /immutable/);
  await device.store.meditations.resetAllPracticeData(context(7));
  const { diff } = await device.store.sync.localChanges();
  const removedSessions = diff.removes.filter((ref) => ref.table === 'meditation_sessions').length;
  assert.equal(removedSessions, rows.filter((row) => row.table === 'meditation_sessions').length);
  assert.ok(diff.removes.some((ref) => ref.table === 'sync_set_aside_sessions'));
  assert.ok(diff.adds.some((row) => row.table === 'progression_generations' && row.row.boundary_json !== null), 'reset boundary is synced');
  assert.equal(device.conn.raw.prepare('SELECT COUNT(*) n FROM sync_set_aside_sessions').get().n, 0);
});

test('Preference saves record monotonic document clocks for newest-edit-wins settings sync', async (t) => {
  const { store } = await open(t);
  assert.deepEqual(await store.sync.documentClocks(), {});
  await store.settings.saveAudioPreferences(await store.settings.loadAudioPreferences(), 5_000);
  await store.settings.savePreferences(await store.settings.loadPreferences(), 6_000);
  await store.settings.saveAudioPreferences(await store.settings.loadAudioPreferences(), 4_000);
  await store.application.dismissExplanation(at(1, 3));
  await store.application.dismissExplanation(at(1, 4));
  assert.deepEqual(await store.sync.documentClocks(), { audio_preferences: 5_000, meditation_preferences: 6_000, application_preferences: at(1, 3) });
});
