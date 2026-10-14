const { test } = require('node:test');
const { assert, session, context, at } = require('./helpers.cjs');
const { supabase } = require('./supabase-helpers.cjs');
const { phone, engine } = require('./sync-helpers.cjs');
const { startOpenEndedTimer } = require('./helpers.cjs').domain('meditation/timer.js');

test('An unbound (guest) ledger never syncs', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  const guest = { ...a.context(), sync: { ...a.store.sync, loadState: async () => ({ ...(await a.store.sync.loadState()), accountId: null }) } };
  assert.deepEqual(await engine.syncLedger(guest), { status: 'skipped', reason: 'unbound' });
  assert.deepEqual(a.cloud.faults.calls, []);
});

test('First upload, then idle syncs exchange nothing and only confirm', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  await a.practice(session({ day: 1, hour: 8 }));
  const first = await a.sync();
  assert.equal(first.status, 'synced'); assert.equal(first.action, 'pushed'); assert.equal(first.revision, 1);
  const cloud = await s.changes('a', 0);
  assert.equal(cloud.head, 1);
  assert.deepEqual(cloud.adds.map((row) => `${row.table}|${row.key}|${row.hash}`).sort(), await a.rows());
  // Time passing alone (reopen/decay) never creates a revision.
  await a.store.meditations.getCurrentPracticeProgress(context(4));
  a.setTime(at(4));
  assert.deepEqual(await a.sync(), { status: 'synced', action: 'none', revision: 1, documents: [] });
  assert.equal((await s.changes('a', 0)).head, 1);
  assert.equal((await a.store.sync.loadState()).lastSyncedAt, at(4));
});

test('A second phone downloads the account, then follows incremental changes exactly', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  for (let day = 1; day <= 3; day++) await a.practice(session({ day, hour: 7 }));
  await a.sync();
  b.setTime(at(3, 12));
  const pulled = await b.sync();
  assert.equal(pulled.action, 'pulled'); assert.equal(pulled.revision, 1);
  assert.deepEqual(await b.history(), await a.history());
  assert.deepEqual(await b.store.meditations.getCurrentPracticeProgress(context(4)), await a.store.meditations.getCurrentPracticeProgress(context(4)));
  assert.equal(await b.store.meditations.getPendingCompletion(), null);
  await a.practice(session({ day: 5, hour: 7 }));
  assert.equal((await a.sync()).revision, 2);
  b.setTime(at(5, 12));
  assert.equal((await b.sync()).action, 'pulled');
  assert.deepEqual(await b.history(), await a.history());
  // B continues from the shared ledger; its practice reaches A.
  await b.practice(session({ day: 6, hour: 9 }));
  assert.equal((await b.sync()).action, 'pushed');
  a.setTime(at(6, 12));
  assert.equal((await a.sync()).action, 'pulled');
  assert.deepEqual(await a.history(), await b.history());
});

test('A lost push response is resent after restart and applied exactly once', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  await a.practice(session({ day: 1 }));
  a.cloud.faults.loseNextPushResponse = true;
  await assert.rejects(a.sync(), /Response lost/);
  const pending = (await a.store.sync.loadState()).inflight;
  assert.ok(pending, 'push stays durable');
  assert.equal((await s.changes('a', 0)).head, 1, 'the server did apply it');
  const retried = await a.sync();
  assert.equal(retried.action, 'pushed'); assert.equal(retried.revision, 1);
  assert.equal((await a.store.sync.loadState()).inflight, null);
  assert.equal((await s.as('a', 'select count(*)::int n from public.ona_ledger_revisions'))[0].n, 1);
  assert.equal((await a.sync()).action, 'none');
});

test('Offline sync changes nothing locally and succeeds later', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  await a.practice(session({ day: 1 }));
  a.cloud.faults.offline = true;
  await assert.rejects(a.sync(), (error) => error.kind === 'offline');
  assert.equal((await a.store.sync.loadState()).syncedRevision, 0);
  a.cloud.faults.offline = false;
  assert.equal((await a.sync()).action, 'pushed');
});

test('A phone that only re-settled time simply adopts the newer cloud state', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  await a.practice(session({ day: 1 })); await a.sync();
  b.setTime(at(1, 12)); await b.sync();
  await b.store.meditations.getCurrentPracticeProgress(context(3));
  await a.practice(session({ day: 2 })); await a.sync();
  b.setTime(at(3, 1));
  assert.equal((await b.sync()).action, 'pulled');
  assert.deepEqual(await b.history(), await a.history());
});

test('Cloud changes wait while this phone has a practice open, then apply', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  await a.practice(session({ day: 1 })); await a.sync();
  await b.store.timer.save(startOpenEndedTimer('running', at(1, 20), 'UTC'));
  b.setTime(at(1, 20, 5));
  assert.deepEqual(await b.sync(), { status: 'skipped', reason: 'busy' });
  assert.equal((await b.store.sync.loadState()).syncedRevision, 0);
  await b.store.timer.discard('running');
  assert.equal((await b.sync()).action, 'pulled');
});

test('A cloud ledger from a newer Ona is never imported or overwritten', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  await a.practice(session({ day: 1 })); await a.sync();
  await s.db.exec("update public.ona_ledger_heads set schema_version = 99");
  await a.practice(session({ day: 2 }));
  await assert.rejects(a.sync(), (error) => error instanceof engine.SyncUpgradeRequired);
  assert.equal((await s.changes('a', 0)).head, 1);
});

test('Preferences: newest edit wins on every phone, and older edits never overwrite newer ones', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  const audio = await a.store.settings.loadAudioPreferences();
  await a.store.settings.saveAudioPreferences({ ...audio, sessionVolume: 0.3 }, 1_000);
  assert.deepEqual((await a.sync()).documents, []);
  const pulled = await b.sync();
  assert.deepEqual(pulled.documents, ['audio_preferences']);
  assert.equal((await b.store.settings.loadAudioPreferences()).sessionVolume, 0.3);
  // B edits later; A's older offline edit arrives afterwards and loses on both phones.
  await b.store.settings.saveAudioPreferences({ ...audio, sessionVolume: 0.5 }, 3_000);
  await a.store.settings.saveAudioPreferences({ ...audio, sessionVolume: 0.1 }, 2_000);
  await b.sync();
  assert.deepEqual((await a.sync()).documents, ['audio_preferences']);
  assert.equal((await a.store.settings.loadAudioPreferences()).sessionVolume, 0.5);
  assert.equal((await b.store.settings.loadAudioPreferences()).sessionVolume, 0.5);
  // Dismissing the Guide on one phone dismisses it on the other; it never reopens.
  await a.store.application.dismissExplanation(at(1, 2));
  await a.sync(); await b.sync();
  assert.equal(await b.store.application.isExplanationDismissed(), true);
});

test('A file without stored base content downloads the synced revision once and continues', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  await a.practice(session({ day: 1 })); await a.sync();
  await a.practice(session({ day: 2 }));
  // As written by a development build from before base content was stored.
  a.conn.raw.exec('UPDATE sync_manifest SET row_json = NULL');
  const before = a.cloud.faults.calls.length;
  assert.equal((await a.sync()).action, 'pushed');
  assert.deepEqual(a.cloud.faults.calls.slice(before, before + 2), ['changes', 'changes']);
  assert.equal((await s.changes('a', 0)).head, 2);
  assert.notEqual(a.conn.raw.prepare('SELECT COUNT(*) n FROM sync_manifest WHERE row_json IS NULL').get().n, undefined);
  assert.equal(a.conn.raw.prepare('SELECT COUNT(*) n FROM sync_manifest WHERE row_json IS NULL').get().n, 0);
});

test('A deleted cloud copy is never resurrected by an old phone; the phone can save its practice again on request', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  await a.practice(session({ id: 'a1', day: 1 })); await a.sync();
  await a.practice(session({ id: 'a2', day: 2 })); await a.sync();
  b.setTime(at(2, 12)); await b.sync();
  await s.call('a', 'ona_delete_my_cloud_data', {});
  await a.practice(session({ id: 'a3', day: 3 }));
  await assert.rejects(a.sync(), (error) => error instanceof engine.SyncCloudReplaced);
  assert.equal((await s.changes('a', 0)).head, 0, 'nothing was re-uploaded');
  // Another phone starts a new cloud ledger that reaches the same revision numbers.
  await b.store.sync.forgetCloud();
  await b.practice(session({ id: 'b3', day: 3, hour: 14 }));
  assert.equal((await b.sync()).action, 'pushed');
  await b.practice(session({ id: 'b4', day: 4 })); await b.sync();
  assert.equal((await s.changes('a', 0)).head, 2);
  await assert.rejects(a.sync(), (error) => error instanceof engine.SyncCloudReplaced, 'same revision number, different ledger');
  // On request, A combines its practice with what the account now holds.
  await a.store.sync.forgetCloud();
  a.setTime(at(4, 12));
  assert.equal((await a.sync()).action, 'merged');
  const ids = async (device) => (await device.store.meditations.getMeditationHistory({ limit: 100 })).map((entry) => entry.session.id).sort();
  b.setTime(at(4, 12)); await b.sync();
  assert.deepEqual(await ids(a), ['a1', 'a2', 'a3', 'b3', 'b4']);
  assert.deepEqual(await ids(b), await ids(a));
});

test('First sign-in can copy this phone’s practice into an empty account file, never over existing practice', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  const guest = await phone(t, s, 'b');
  await guest.practice(session({ id: 'g1', day: 1 }));
  await guest.practice(session({ id: 'g2', day: 2 }));
  const rows = (await guest.store.sync.exportLedger()).rows;
  a.setTime(at(3));
  await a.store.sync.adoptLocalCopy(rows, at(3));
  assert.equal((await a.sync()).action, 'pushed');
  assert.deepEqual((await a.store.meditations.getMeditationHistory()).map((entry) => entry.session.id).sort(), ['g1', 'g2']);
  assert.equal(await a.store.meditations.getPendingCompletion(), null);
  await assert.rejects(a.store.sync.adoptLocalCopy(rows, at(3)), /already has practice/);
});
