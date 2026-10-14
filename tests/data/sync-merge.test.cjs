const { test } = require('node:test');
const { assert, session, context, at } = require('./helpers.cjs');
const { supabase } = require('./supabase-helpers.cjs');
const { phone } = require('./sync-helpers.cjs');

const ids = async (device) => (await device.store.meditations.getMeditationHistory({ limit: 1000 })).map((entry) => entry.session.id).sort();
const awardRows = (device) => device.conn.raw.prepare('SELECT session_id, xp_centi, breakdown_json FROM progression_awards ORDER BY session_id').all();
const setAside = (device) => device.conn.raw.prepare('SELECT session_id FROM sync_set_aside_sessions ORDER BY session_id').all().map((row) => row.session_id);
async function pair(t) {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  await a.practice(session({ id: 'a-day1', day: 1, hour: 7 }));
  a.setTime(at(1, 8)); await a.sync();
  b.setTime(at(1, 8)); await b.sync();
  return { s, a, b };
}
async function converge(t, s, ...devices) {
  for (let round = 0; round < 2; round++) for (const device of devices) await device.sync();
  const histories = await Promise.all(devices.map(ids));
  for (const history of histories.slice(1)) assert.deepEqual(history, histories[0]);
  const histories2 = await Promise.all(devices.map((device) => device.history()));
  for (const history of histories2.slice(1)) assert.deepEqual(history, histories2[0]);
  return histories[0];
}

test('Fast-forward: practice made after the cloud state follows it without recalculating anything synced', async (t) => {
  const { s, a, b } = await pair(t);
  await a.practice(session({ id: 'a-day2', day: 2, hour: 7 }));
  a.setTime(at(2, 8)); await a.sync();
  const before = awardRows(a);
  await b.practice(session({ id: 'b-day3', day: 3, hour: 9 }));
  b.setTime(at(3, 10));
  const result = await b.sync();
  assert.equal(result.action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['a-day1', 'a-day2', 'b-day3']);
  assert.deepEqual(awardRows(a).filter((row) => row.session_id !== 'b-day3'), before, 'synced awards are untouched');
  const kinds = await s.as('a', 'select kind from public.ona_ledger_revisions order by revision');
  assert.deepEqual(kinds.map((row) => row.kind), ['upload', 'upload', 'merge']);
});

test('Late-arriving offline practice is replayed in time order from an early enough revision', async (t) => {
  const { s, a, b } = await pair(t);
  const synced = awardRows(a);
  await b.practice(session({ id: 'b-08', day: 2, hour: 8 }));          // offline on B
  await a.practice(session({ id: 'a-11', day: 2, hour: 11 }));         // A syncs first
  a.setTime(at(2, 12)); await a.sync();
  b.setTime(at(2, 13));
  assert.equal((await b.sync()).action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['a-11', 'a-day1', 'b-08']);
  // Only the window after the start revision is recalculated: B's earlier practice is now the
  // day's first occasion, so A's later one is weighted second. Day 1 is untouched.
  const after = awardRows(a);
  assert.deepEqual(after.find((row) => row.session_id === 'a-day1'), synced.find((row) => row.session_id === 'a-day1'));
  const weight = (id) => JSON.parse(after.find((row) => row.session_id === id).breakdown_json).weightBasisPoints;
  assert.equal(weight('b-08'), 10000); assert.equal(weight('a-11'), 7500);
  assert.deepEqual(await a.store.meditations.getCurrentPracticeProgress(context(3)), await b.store.meditations.getCurrentPracticeProgress(context(3)));
});

test('Practice older than every cloud revision starts from a fresh ledger without inventing a reset', async (t) => {
  const s = await supabase(t);
  const a = await phone(t, s), b = await phone(t, s);
  b.setTime(at(1, 6)); await b.sync();                                  // B joins while the cloud is empty
  await b.practice(session({ id: 'b-08', day: 1, hour: 8 }));
  await a.practice(session({ id: 'a-09', day: 1, hour: 9 }));
  a.setTime(at(1, 10)); await a.sync();
  b.setTime(at(1, 11));
  assert.equal((await b.sync()).action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['a-09', 'b-08']);
  assert.equal(b.conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations WHERE boundary_json IS NOT NULL').get().n, 0);
  assert.equal(a.conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations WHERE boundary_json IS NOT NULL').get().n, 0);
});

test('Overlapping practice from two phones keeps the earlier one and sets the other aside, never losing it', async (t) => {
  const { s, a, b } = await pair(t);
  await a.practice(session({ id: 'a-0900', startedAt: at(2, 9), minutes: 20 }));
  await b.practice(session({ id: 'b-0910', startedAt: at(2, 9) + 10 * 60_000, minutes: 20 }));
  a.setTime(at(2, 10)); await a.sync();
  b.setTime(at(2, 11));
  assert.equal((await b.sync()).action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['a-0900', 'a-day1']);
  assert.deepEqual(setAside(a), ['b-0910']);
  assert.deepEqual(setAside(b), ['b-0910']);
  const kept = JSON.parse(b.conn.raw.prepare('SELECT session_json FROM sync_set_aside_sessions').get().session_json);
  assert.equal(kept.activeDurationSeconds, 1200);
});

test('A reset on another phone wins: earlier practice is deleted, later practice survives, nothing is resurrected', async (t) => {
  const { s, a, b } = await pair(t);
  await b.practice(session({ id: 'b-before', day: 2, hour: 8 }));
  a.setTime(at(2, 10)); await a.store.meditations.resetAllPracticeData(context(2, 10)); await a.sync();
  await b.practice(session({ id: 'b-after', day: 2, hour: 12 }));
  b.setTime(at(2, 13));
  assert.equal((await b.sync()).action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['b-after']);
  assert.equal(b.conn.raw.prepare('SELECT started_at FROM progression_generations').get().started_at, at(2, 10));
});

test('A reset made offline on this phone propagates and removes practice from before it everywhere', async (t) => {
  const { s, a, b } = await pair(t);
  await a.practice(session({ id: 'a-0800', day: 2, hour: 8 }));
  a.setTime(at(2, 9)); await a.sync();
  b.setTime(at(2, 10)); await b.store.meditations.resetAllPracticeData(context(2, 10));
  await b.practice(session({ id: 'b-1100', day: 2, hour: 11 }));
  b.setTime(at(2, 12));
  assert.equal((await b.sync()).action, 'merged');
  assert.deepEqual(await converge(t, s, a, b), ['b-1100']);
});

test('Three phones practicing offline in any order converge to one identical history', async (t) => {
  const s = await supabase(t);
  const phones = [await phone(t, s), await phone(t, s), await phone(t, s)];
  await phones[0].practice(session({ id: 'p0-d1', day: 1, hour: 7 })); phones[0].setTime(at(1, 8)); await phones[0].sync();
  for (const device of phones.slice(1)) { device.setTime(at(1, 8)); await device.sync(); }
  await phones[2].practice(session({ id: 'p2-d2-06', day: 2, hour: 6 }));
  await phones[1].practice(session({ id: 'p1-d2-09', day: 2, hour: 9 }));
  await phones[0].practice(session({ id: 'p0-d2-15', day: 2, hour: 15 }));
  await phones[1].practice(session({ id: 'p1-d3-07', day: 3, hour: 7 }));
  for (const device of phones) device.setTime(at(3, 12));
  await phones[0].sync(); await phones[1].sync(); await phones[2].sync();
  assert.deepEqual(await converge(t, s, ...phones), ['p0-d1', 'p0-d2-15', 'p1-d2-09', 'p1-d3-07', 'p2-d2-06']);
  const progress = await Promise.all(phones.map((device) => device.store.meditations.getCurrentPracticeProgress(context(4))));
  assert.deepEqual(progress[1], progress[0]); assert.deepEqual(progress[2], progress[0]);
});

test('A merge planned before a new local save changes nothing and is planned again', async (t) => {
  const { a, b } = await pair(t);
  await a.practice(session({ id: 'a-d2', day: 2, hour: 7 })); a.setTime(at(2, 8)); await a.sync();
  await b.practice(session({ id: 'b-d3', day: 3, hour: 7 }));
  const stale = (await b.store.sync.exportLedger()).rows;
  await b.practice(session({ id: 'b-d3-late', day: 3, hour: 12 }));
  const before = await b.rows();
  assert.equal(await b.store.sync.mergeRemote({ start: null, head: stale, revision: 2, localRows: stale, earliest: context(3), reset: null, now: context(3, 13) }), false);
  assert.deepEqual(await b.rows(), before);
});
