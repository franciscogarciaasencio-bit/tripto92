const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { assert, data, connection, openStore, context, session, at } = require('./helpers.cjs');
const { supabase, USERS } = require('./supabase-helpers.cjs');
const ledger = data('database/ledger.js');

const release = (asOf = context(1)) => openStore(connection(), asOf, undefined, 'progression_v5');
async function device(t, asOf) { const store = await release(asOf); t.after(() => store.close()); return store; }
async function practice(store, s) {
  await store.meditations.completePractice(s, s.endedAt);
  await store.meditations.acknowledgeCompletion(s.id, s.endedAt);
}
const wire = (rows) => rows.map(({ table, key, hash, row }) => ({ table, key, hash, row }));
const fromCloud = (rows) => rows.map((row) => ledger.ledgerRow(row.table, row.row));
const rowSet = (rows) => rows.map((row) => `${row.table}|${row.key}|${row.hash}`).sort();
const row = (key, extra = {}) => ({ table: 'meditation_sessions', key: JSON.stringify([key]), hash: 'f'.repeat(64), row: { id: key, ...extra } });

test('Anonymous clients can neither read tables nor call any sync function', async (t) => {
  const s = await supabase(t);
  for (const table of ['ona_ledger_heads', 'ona_ledger_revisions', 'ona_ledger_rows', 'ona_settings']) {
    await assert.rejects(s.as(null, `select * from public.${table}`), /permission denied/);
  }
  await assert.rejects(s.push(null, { pushId: randomUUID(), expected: 0 }), /permission denied/);
  await assert.rejects(s.changes(null, 0), /permission denied/);
  await assert.rejects(s.call(null, 'ona_delete_my_cloud_data', {}), /permission denied/);
});

test('Authenticated clients cannot write tables directly and need a user identity for functions', async (t) => {
  const s = await supabase(t);
  await assert.rejects(s.as('a', `insert into public.ona_ledger_heads(user_id, revision, schema_version) values ('${USERS.a}', 5, 1)`), /permission denied/);
  await assert.rejects(s.as('a', `update public.ona_ledger_rows set removed_revision = 1`), /permission denied/);
  await assert.rejects(s.as('a', `delete from public.ona_settings`), /permission denied/);
  await assert.rejects(s.push('', { pushId: randomUUID(), expected: 0 }), /Sign in/);
});

test('Two accounts are isolated: rows, heads, revisions, settings and deletion never cross', async (t) => {
  const s = await supabase(t);
  assert.equal((await s.push('a', { pushId: randomUUID(), expected: 0, adds: [row('a1'), row('a2')] })).status, 'applied');
  assert.equal((await s.push('b', { pushId: randomUUID(), expected: 0, adds: [row('b1')] })).revision, 1);
  assert.equal((await s.as('a', 'select * from public.ona_ledger_rows')).length, 2);
  assert.deepEqual((await s.as('b', 'select row_key from public.ona_ledger_rows')).map((r) => r.row_key), ['["b1"]']);
  assert.equal((await s.as('b', 'select * from public.ona_ledger_heads')).length, 1);
  assert.equal((await s.as('b', 'select * from public.ona_ledger_revisions')).length, 1);
  assert.deepEqual((await s.changes('b', 0)).adds.map((r) => r.key), ['["b1"]']);
  // A user cannot remove another user's row even with its exact key.
  await assert.rejects(s.push('b', { pushId: randomUUID(), expected: 1, removes: [{ table: 'meditation_sessions', key: '["a1"]' }] }), /does not match/);
  await s.call('b', 'ona_save_setting', { p_document: 'audio_preferences', p_data: '{"v":1}', p_updated_at: 5, p_device_id: 'b'.repeat(32) });
  assert.equal((await s.as('a', 'select * from public.ona_settings')).length, 0);
  await s.call('b', 'ona_delete_my_cloud_data', {});
  assert.equal((await s.as('b', 'select * from public.ona_ledger_rows')).length, 0);
  assert.equal((await s.as('a', 'select * from public.ona_ledger_rows')).length, 2);
  assert.equal((await s.changes('a', 0)).head, 1);
});

test('Compare-and-swap: stale pushes conflict, retried push IDs are idempotent, failures roll back entirely', async (t) => {
  const s = await supabase(t);
  const first = randomUUID();
  assert.deepEqual(await s.push('a', { pushId: first, expected: 0, adds: [row('x')] }), { status: 'applied', revision: 1 });
  assert.deepEqual(await s.push('a', { pushId: randomUUID(), expected: 0, adds: [row('y')] }), { status: 'conflict', revision: 1 });
  assert.deepEqual(await s.push('a', { pushId: first, expected: 0, adds: [row('x')] }), { status: 'duplicate', revision: 1 });
  assert.deepEqual(await s.push('a', { pushId: randomUUID(), expected: 1, removes: [{ table: 'meditation_sessions', key: '["x"]' }], adds: [row('x', { v: 2 })] }),
    { status: 'applied', revision: 2 });
  assert.deepEqual(await s.push('a', { pushId: first, expected: 0 }), { status: 'duplicate', revision: 1 }, 'still answered after the head moved');
  const before = await s.as('a', 'select * from public.ona_ledger_rows order by added_revision');
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, adds: [row('z')], removes: [{ table: 'meditation_sessions', key: '["missing"]' }] }), /does not match/);
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, adds: [row('z'), row('z')] }), /duplicate key/);
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, adds: [{ ...row('q'), table: 'meditation_timer' }] }), /check constraint/);
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, adds: [{ ...row('q'), hash: 'nothex' }] }), /check constraint/);
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, kind: 'reset' }), /Invalid sync push/);
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 2, device: 'not-a-device' }), /Invalid sync push/);
  assert.deepEqual(await s.as('a', 'select * from public.ona_ledger_rows order by added_revision'), before);
  assert.equal((await s.changes('a', 0)).head, 2);
});

test('Oversized pushes are rejected before any write', async (t) => {
  const s = await supabase(t);
  const adds = Array.from({ length: 50001 }, (_, i) => row(`r${i}`));
  await assert.rejects(s.push('a', { pushId: randomUUID(), expected: 0, adds }), /too large/);
  assert.equal((await s.changes('a', 0)).head, 0);
});

test('Real device ledgers travel through Postgres JSONB and replace another device exactly', async (t) => {
  const s = await supabase(t);
  const a = await device(t);
  await a.sync.bindAccount(USERS.a);
  for (let day = 1; day <= 4; day++) await practice(a, session({ day, hour: 7 }));
  const exported = await a.sync.exportLedger();
  const applied = await s.push('a', { pushId: randomUUID(), expected: 0, adds: wire(exported.rows) });
  assert.equal(applied.revision, 1);

  const b = await device(t);
  await b.sync.bindAccount(USERS.a);
  const cloud = await s.changes('a', 0);
  assert.equal(cloud.schemaVersion, 13);
  // JSONB reorders object keys; canonical hashing is key-order independent.
  const rows = fromCloud(cloud.adds);
  assert.deepEqual(rowSet(rows), rowSet(exported.rows));
  await b.sync.applyRemote(rows, cloud.revision, cloud.ledgerId, at(6));
  assert.deepEqual(rowSet((await b.sync.exportLedger()).rows), rowSet(exported.rows));
  assert.deepEqual(await b.meditations.loadProgressionState(), await a.meditations.loadProgressionState());
});

test('Revision ranges reconstruct every historical state, including modifications and mass removals', async (t) => {
  const s = await supabase(t);
  const a = await device(t);
  await a.sync.bindAccount(USERS.a);
  const states = [[]];
  let manifest = new Map();
  async function pushCurrent() {
    const { snapshot } = await a.sync.localChanges();
    const diff = ledger.diffLedger(manifest, snapshot.rows);
    const result = await s.push('a', { pushId: randomUUID(), expected: states.length - 1, removes: diff.removes, adds: wire(diff.adds) });
    assert.equal(result.status, 'applied');
    manifest = ledger.manifestOf(snapshot.rows);
    states.push(snapshot.rows);
  }
  await practice(a, session({ day: 1 })); await pushCurrent();
  await practice(a, session({ day: 2 })); await pushCurrent();
  await a.meditations.resetAllPracticeData(context(3)); await pushCurrent();
  await practice(a, session({ day: 4 })); await pushCurrent();
  for (let to = 0; to < states.length; to++) {
    const full = await s.changes('a', 0, to);
    assert.deepEqual(rowSet(fromCloud(full.adds)), rowSet(states[to]), `state at ${to}`);
    assert.deepEqual(full.removes, []);
    for (let from = 0; from <= to; from++) {
      const diff = await s.changes('a', from, to);
      const rebuilt = ledger.applyLedgerDiff(states[from], { removes: diff.removes, adds: fromCloud(diff.adds) });
      assert.deepEqual(rowSet(rebuilt), rowSet(states[to]), `${from} → ${to}`);
    }
  }
  const reset = await s.changes('a', 2, 3);
  assert.ok(reset.removes.some((ref) => ref.table === 'meditation_sessions'), 'reset travels as removals');
  await assert.rejects(s.changes('a', 3, 2), /Invalid sync revision range/);
  await assert.rejects(s.changes('a', 0, 9), /Invalid sync revision range/);
  await assert.rejects(s.changes('a', -1), /Invalid sync revision range/);
});

test('Settings: newest edit wins on the server; ties resolve deterministically by device', async (t) => {
  const s = await supabase(t);
  const save = (updatedAt, value, device = 'a'.repeat(32)) => s.call('a', 'ona_save_setting',
    { p_document: 'meditation_preferences', p_data: JSON.stringify({ value }), p_updated_at: updatedAt, p_device_id: device });
  assert.deepEqual((await save(10, 'first')).data, { value: 'first' });
  assert.deepEqual((await save(20, 'second')).data, { value: 'second' });
  const stale = await save(15, 'stale');
  assert.deepEqual(stale.data, { value: 'second' }); assert.equal(stale.updatedAt, 20);
  assert.deepEqual((await save(20, 'tie-higher', 'b'.repeat(32))).data, { value: 'tie-higher' });
  assert.deepEqual((await save(20, 'tie-lower', '0'.repeat(32))).data, { value: 'tie-higher' });
  await assert.rejects(s.call('a', 'ona_save_setting', { p_document: 'sync_state', p_data: '{}', p_updated_at: 1, p_device_id: 'a'.repeat(32) }), /check constraint/);
});

test('A deleted and re-created cloud ledger gets a new identity; pushes for the old one are refused', async (t) => {
  const s = await supabase(t);
  const first = await s.pushRaw('a', { pushId: randomUUID(), expected: 0, adds: [row('x')] });
  assert.match(first.ledgerId, /^[0-9a-f-]{36}$/);
  assert.equal((await s.changes('a', 0)).ledgerId, first.ledgerId);
  await s.pushRaw('a', { pushId: randomUUID(), expected: 1, ledger: first.ledgerId, adds: [row('y')] });
  await s.call('a', 'ona_delete_my_cloud_data', {});
  assert.deepEqual(await s.changes('a', 0), { revision: 0, head: 0, ledgerId: null, schemaVersion: null, adds: [], removes: [] });
  const fresh = await s.pushRaw('a', { pushId: randomUUID(), expected: 0, adds: [row('z')] });
  await s.pushRaw('a', { pushId: randomUUID(), expected: 1, ledger: fresh.ledgerId, adds: [row('w')] });
  assert.notEqual(fresh.ledgerId, first.ledgerId);
  // An old phone still at revision 2 of the deleted ledger: same number, different ledger.
  const stale = await s.pushRaw('a', { pushId: randomUUID(), expected: 2, ledger: first.ledgerId, adds: [row('old')] });
  assert.deepEqual({ status: stale.status, revision: stale.revision }, { status: 'replaced', revision: 2 });
  assert.deepEqual((await s.changes('a', 0)).adds.map((r) => r.key).sort(), ['["w"]', '["z"]']);
  await assert.rejects(s.pushRaw('a', { pushId: randomUUID(), expected: 2, ledger: null }), /Invalid sync push/);
});
