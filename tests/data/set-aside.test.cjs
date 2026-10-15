// A finished practice that can never join history is kept aside, never lost and never blocking.
const { test } = require('node:test');
const path = require('node:path');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { assert, api, session, at, context, connection, openStore, domain } = require('./helpers.cjs');
const { supabase } = require('./supabase-helpers.cjs');
const { phone } = require('./sync-helpers.cjs');
const { startOpenEndedTimer, finishTimer } = domain('meditation/timer.js');

const ctx = (timestamp) => ({ timestamp, localDate: new Date(timestamp).toISOString().slice(0, 10), timeZone: 'UTC' });
const asideRows = (conn) => conn.raw.prepare('SELECT session_id, reason FROM sync_set_aside_sessions ORDER BY session_id').all()
  .map((row) => `${row.session_id}:${row.reason}`);

test('Placement is decided once: duplicate, overlap, rewind or ok', () => {
  const state = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V5), session({ id: 'a', day: 2, hour: 8 }));
  assert.equal(api.appendability(state, session({ id: 'a', day: 2, hour: 8 })), 'duplicate');
  assert.equal(api.appendability(state, session({ id: 'b', day: 2, hour: 8.05 })), 'overlap');
  assert.equal(api.appendability(api.advanceProgression(state, ctx(at(6))), session({ id: 'c', day: 3 })), 'rewind');
  assert.equal(api.appendability(state, session({ id: 'd', day: 3 })), 'ok');
});

test('Two phones: an overlapping practice is set aside, synced, and never blocks either phone', async (t) => {
  const s = await supabase(t);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-aside-')), 'b.db');
  const a = await phone(t, s), b = await phone(t, s, 'a', ctx(at(1, 6)), file);
  await a.practice(session({ id: 'a-morning', day: 1, hour: 8, minutes: 20 }));
  a.setTime(at(1, 9)); await a.sync();
  b.setTime(at(1, 9)); assert.equal((await b.sync()).action, 'pulled');
  // On B the person had also meditated, overlapping A's practice (B's clock was behind).
  const overlapping = session({ id: 'b-morning', day: 1, hour: 8.1, minutes: 15 });
  const saved = await b.store.meditations.completePractice(overlapping, at(1, 9, 1));
  assert.equal(saved.setAside, true); assert.equal(saved.completion, null);
  assert.equal(await b.store.timer.load(), null);
  assert.equal(await b.store.meditations.getPendingCompletion(), null);
  assert.deepEqual(asideRows(b.conn), ['b-morning:overlap']);
  assert.deepEqual((await b.store.meditations.getMeditationHistory({ limit: 10, offset: 0 })).map((r) => r.session.id), ['a-morning']);
  b.setTime(at(1, 9, 2)); await b.restart();
  assert.equal((await b.sync()).action, 'pushed');
  a.setTime(at(1, 10)); assert.equal((await a.sync()).action, 'pulled');
  assert.deepEqual(asideRows(a.conn), ['b-morning:overlap'], 'kept on every phone, never silently dropped');
  assert.deepEqual(await a.history(), await b.history());
});

test('A finished practice that cannot be placed no longer blocks startup; it is set aside on recovery', async (t) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-aside-')), 'r.db');
  let store = await openStore(connection(file), ctx(at(1, 6)), undefined, 'progression_v5');
  const first = session({ id: 'first', day: 1, hour: 8, minutes: 20 });
  await store.meditations.completePractice(first, first.endedAt);
  await store.meditations.acknowledgeCompletion(first.id, first.endedAt);
  // A finished timer from before the clock was corrected, overlapping the saved practice.
  const draft = finishTimer(startOpenEndedTimer('stale', at(1, 8.1), 'UTC'), at(1, 8.4));
  await store.timer.save(draft);
  await store.close();
  const conn = connection(file);
  store = await openStore(conn, ctx(at(1, 10)), undefined, 'progression_v5');
  t.after(() => store.close());
  assert.equal(store.recoveredSetAside, true);
  assert.equal(store.initialTimer, null);
  assert.deepEqual(asideRows(conn), ['stale:overlap']);
  assert.equal((await store.meditations.getMeditationHistory({ limit: 10, offset: 0 })).length, 1);
});
