const { test } = require('node:test');
const { assert, session, context, at, disk, domain } = require('./helpers.cjs');
const { supabase } = require('./supabase-helpers.cjs');
const { phone, engine } = require('./sync-helpers.cjs');
const { getForestStage } = domain('forest/growth.js');

const ids = async (device) => (await device.store.meditations.getMeditationHistory({ limit: 1000 })).map((entry) => entry.session.id).sort();

test('Reinstall: a new phone restores history, awards, levels, Consistency, forest and settings exactly', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  for (let day = 1; day <= 40; day++) {
    await a.practice(session({ id: `d${day}`, day, hour: 7, minutes: 15 }));
    if (day % 3 === 0) await a.practice(session({ id: `d${day}-pm`, day, hour: 19, minutes: 10 }));
  }
  const audio = await a.store.settings.loadAudioPreferences();
  await a.store.settings.saveAudioPreferences({ ...audio, sessionVolume: 0.42, homeEnabled: false }, at(40, 20));
  const prefs = await a.store.settings.loadPreferences();
  await a.store.settings.savePreferences(prefs, at(40, 20));
  await a.store.application.dismissExplanation(at(2));
  a.setTime(at(40, 21));
  await a.sync();

  const restored = await phone(t, s, 'a', context(41, 8));
  restored.setTime(at(41, 8));
  const result = await restored.sync();
  assert.equal(result.action, 'pulled');
  assert.deepEqual(result.documents.sort(), ['application_preferences', 'audio_preferences', 'meditation_preferences']);
  assert.deepEqual(await restored.history(), await a.history());
  const original = await a.store.meditations.getCurrentPracticeProgress(context(41, 8));
  const copy = await restored.store.meditations.getCurrentPracticeProgress(context(41, 8));
  assert.deepEqual(copy, original);
  assert.ok(copy.habit.highestLevel >= 20, `level ${copy.habit.highestLevel}`);
  assert.equal(getForestStage({ highestLevel: copy.habit.highestLevel, currentLevel: copy.journey.level.number }).id,
    getForestStage({ highestLevel: original.habit.highestLevel, currentLevel: original.journey.level.number }).id);
  assert.equal((await restored.store.settings.loadAudioPreferences()).sessionVolume, 0.42);
  assert.equal(await restored.store.application.isExplanationDismissed(), true);
  const id = 'd17';
  assert.deepEqual(await restored.store.meditations.getPracticeDetails(id), await a.store.meditations.getPracticeDetails(id));
  // The restored phone keeps earning exactly like the original would.
  const next = session({ id: 'next', day: 41, hour: 9 });
  const fromOriginal = await a.store.meditations.completePractice(next, next.endedAt);
  const fromRestored = await restored.store.meditations.completePractice(next, next.endedAt);
  assert.deepEqual(fromRestored.completion, fromOriginal.completion);
});

test('Process death after a push was recorded but before it was sent: relaunch sends it once', async (t) => {
  const s = await supabase(t);
  let a;
  // Close the current (possibly restarted) store before disk(t)'s Windows file cleanup.
  t.after(() => a?.store.close());
  a = await phone(t, s, 'a', context(1), disk(t));
  await a.practice(session({ id: 'x', day: 1 }));
  a.cloud.faults.offline = true;
  await assert.rejects(a.sync(), /No connection/);
  // The phone recorded nothing about a push it never reached; a later push is planned afresh.
  assert.equal((await a.store.sync.loadState()).inflight, null);
  // Now die between recording a push and hearing back.
  a.cloud.faults.offline = false;
  a.cloud.faults.loseNextPushResponse = true;
  await assert.rejects(a.sync(), /Response lost/);
  await a.restart();
  assert.ok((await a.store.sync.loadState()).inflight, 'the push survived the restart');
  assert.equal((await a.sync()).revision, 1);
  assert.equal((await s.as('a', 'select count(*)::int n from public.ona_ledger_revisions'))[0].n, 1);
});

test('A failure in the middle of importing cloud practice rolls back completely; the next sync succeeds', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  for (let day = 1; day <= 3; day++) await a.practice(session({ day }));
  await a.sync();
  await b.practice(session({ id: 'b-own', day: 1, hour: 20 }));
  const before = await b.rows();
  b.conn.failOnce((sql) => sql.startsWith('INSERT INTO habit_reward_receipts'));
  b.setTime(at(3, 12));
  await assert.rejects(b.sync(), /Simulated SQLite failure/);
  assert.deepEqual(await b.rows(), before, 'nothing half-imported');
  assert.equal((await b.store.sync.loadState()).syncedRevision, 0);
  assert.throws(() => b.conn.raw.exec('DELETE FROM meditation_sessions'), /immutable/, 'guards restored by rollback');
  assert.equal((await b.sync()).action, 'merged');
  await a.sync();
  assert.deepEqual(await ids(b), await ids(a));
});

test('Weeks offline: every practice is kept, and later uploads in one push', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  a.cloud.faults.offline = true;
  for (let day = 1; day <= 21; day++) {
    await a.practice(session({ day, hour: 7 }));
    await assert.rejects(a.sync());
  }
  a.cloud.faults.offline = false;
  const result = await a.sync();
  assert.equal(result.action, 'pushed'); assert.equal(result.revision, 1);
  assert.equal((await s.changes('a', 0)).adds.filter((row) => row.table === 'meditation_sessions').length, 21);
});

test('A phone opened days later settles decay to the same values as the phone that practiced', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  for (let day = 1; day <= 10; day++) await a.practice(session({ day, hour: 7 }));
  a.setTime(at(10, 8)); await a.sync();
  b.setTime(at(17, 9)); await b.sync();
  const later = context(17, 9);
  assert.deepEqual(await b.store.meditations.getCurrentPracticeProgress(later), await a.store.meditations.getCurrentPracticeProgress(later));
});

test('Travel: practice captured in another time zone keeps its own date on every phone', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  await a.practice(session({ id: 'tokyo', startedAt: at(2, 23), localDate: '2026-01-07', timeZone: 'Asia/Tokyo' }));
  a.setTime(at(3)); await a.sync();
  b.setTime(at(3, 1)); await b.sync();
  const travelled = (await b.store.meditations.getPracticeDetails('tokyo')).session;
  assert.equal(travelled.localDate, '2026-01-07'); assert.equal(travelled.timeZone, 'Asia/Tokyo');
});

test('A year of practice uploads and restores within a practical time and payload', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s);
  for (let day = 1; day <= 365; day++) await a.practice(session({ day, hour: 7 }));
  a.setTime(at(365, 8));
  let started = Date.now();
  await a.sync();
  const uploadMs = Date.now() - started;
  const cloud = await s.changes('a', 0);
  const bytes = JSON.stringify(cloud).length;
  const b = await phone(t, s, 'a', context(365, 9));
  b.setTime(at(365, 9));
  started = Date.now();
  await b.sync();
  const restoreMs = Date.now() - started;
  assert.deepEqual(await b.history(), await a.history());
  // Generous bounds for the in-process test database; documented as evidence, not a device benchmark.
  assert.ok(bytes < 6_000_000, `payload ${bytes} bytes`);
  assert.ok(uploadMs < 60_000 && restoreMs < 60_000, `upload ${uploadMs} ms, restore ${restoreMs} ms`);
  t.diagnostic(`365 practices: ${(bytes / 1024).toFixed(0)} KB, upload ${uploadMs} ms, restore ${restoreMs} ms`);
});

test('Signing out and back in reopens the same account file from disk and keeps syncing', async (t) => {
  const s = await supabase(t);
  let a;
  t.after(() => a?.store.close());
  const file = disk(t);
  a = await phone(t, s, 'a', context(1), file);
  await a.practice(session({ id: 'one', day: 1 })); await a.sync();
  await a.restart();
  await a.practice(session({ id: 'two', day: 2 }));
  assert.equal((await a.sync()).revision, 2);
  assert.deepEqual(await ids(a), ['one', 'two']);
  void engine;
});
