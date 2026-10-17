const { test } = require('node:test');
const { assert, api, connection, disk, openStore, context, session } = require('./helpers.cjs');

async function practice(store, record) {
  const result = await store.meditations.completePractice(record, record.endedAt);
  await store.meditations.acknowledgeCompletion(record.id, record.endedAt);
  return result;
}
const awards = (conn) => conn.raw.prepare('SELECT * FROM progression_awards ORDER BY sequence').all();

test('V6: under three active minutes earns nothing; three minutes and more earn as before', () => {
  assert.equal(api.PROGRESSION_V6.minimumEarningSeconds, 180);
  for (const seconds of [1, 60, 179]) {
    assert.equal(api.isRewardEligible(session({ activeSeconds: seconds }), api.PROGRESSION_V6), false);
    assert.equal(api.isRewardEligible(session({ activeSeconds: seconds }), api.PROGRESSION_V5), true, 'V5 receipts stay as released');
  }
  assert.equal(api.isRewardEligible(session({ activeSeconds: 180 }), api.PROGRESSION_V6), true);
});

test('Opening a V5 practice activates V6 once; earlier short-run receipts stay, later short runs add none', async t => {
  const file = disk(t);
  let conn = connection(file), store = await openStore(conn, context(1), undefined, 'progression_v5');
  await practice(store, session({ day: 1, hour: 9, activeSeconds: 90 }));
  const released = awards(conn);
  assert.equal(released.length, 1, 'V5 paid the short run');
  await store.close();
  conn = connection(file); store = await openStore(conn, context(2), undefined, 'progression_v6');
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v6');
  await practice(store, session({ day: 2, hour: 9, activeSeconds: 120 }));
  assert.equal(awards(conn).length, 1, 'the two-minute practice under V6 earns nothing');
  assert.deepEqual(awards(conn), released, 'historical receipts are never recomputed');
  await practice(store, session({ day: 2, hour: 12, activeSeconds: 300 }));
  assert.equal(awards(conn).length, 2);
  await store.close();
  conn = connection(file); store = await openStore(conn, context(3), undefined, 'progression_v6');
  assert.equal(awards(conn).length, 2, 'reopening revalidates the mixed V5/V6 ledger');
  await store.close();
});

test('Opening a V6 practice activates V7 once: V6 receipts stay, Consistency carries over, details split Ripples', async t => {
  const file = disk(t);
  let conn = connection(file), store = await openStore(conn, context(1), undefined, 'progression_v6');
  for (let day = 1; day <= 3; day++) await practice(store, session({ day, hour: 9, minutes: 10 }));
  const released = awards(conn);
  await store.close();
  conn = connection(file); store = await openStore(conn, context(4), undefined, 'progression_v7');
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v7');
  assert.deepEqual(awards(conn), released, 'historical receipts are never recomputed');
  const carried = store.initialSnapshot.consistency;
  assert.ok(carried.fraction > 0 && Math.abs(carried.indicatorFraction - (1 - (1 - carried.fraction) ** 2)) < 1e-9, 'the bar eases out');
  const saved = await practice(store, session({ day: 4, hour: 9, minutes: 10 }));
  const { split, awardedXpCenti } = await store.meditations.getPracticeDetails(session({ day: 4, hour: 9, minutes: 10 }).id);
  assert.equal(split.practiceXpCenti, 16_000);
  assert.ok(split.consistencyXpCenti > 0);
  assert.equal(split.practiceXpCenti + split.consistencyXpCenti, awardedXpCenti);
  const indicator = saved.completion.consistencyIndicator;
  assert.ok(indicator.after > indicator.before);
  assert.ok(Math.abs(indicator.after - saved.snapshot.consistency.indicatorFraction) < 1e-9, 'the completion bar ends where Home shows it');
  await store.close();
  conn = connection(file); store = await openStore(conn, context(5), undefined, 'progression_v7');
  assert.equal(awards(conn).length, 4, 'reopening revalidates the mixed V6/V7 ledger');
  const short = await store.meditations.getPracticeDetails(session({ day: 1, hour: 9, minutes: 10 }).id);
  assert.equal(short.split.practiceXpCenti + short.split.consistencyXpCenti, short.awardedXpCenti, 'V6 receipts split too');
  await store.close();
});

test('Opening a V7 ledger activates V8 once: V7 receipts stay (a fourth practice kept its 0), later fourths earn a quarter', async t => {
  const file = disk(t);
  let conn = connection(file), store = await openStore(conn, context(1), undefined, 'progression_v7');
  for (const hour of [6, 9, 12, 15]) await practice(store, session({ day: 1, hour, minutes: 10 }));
  const released = awards(conn);
  assert.equal(released.length, 4);
  await store.close();
  conn = connection(file); store = await openStore(conn, context(2), undefined, 'progression_v8');
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v8');
  assert.deepEqual(awards(conn).slice(0, 4), released, 'historical receipts are never recomputed');
  assert.ok(store.initialSnapshot.consistency.fraction > 0, 'Consistency carries over');
  for (const hour of [6, 9, 12, 15]) await practice(store, session({ day: 2, hour, minutes: 10 }));
  const fourth = await store.meditations.getPracticeDetails(session({ day: 2, hour: 15, minutes: 10 }).id);
  assert.equal(fourth.split.practiceXpCenti, 4_000, 'a quarter of 160 Ripples');
  assert.ok(fourth.awardedXpCenti > 4_000, 'plus its Consistency');
  await store.close();
  conn = connection(file); store = await openStore(conn, context(3), undefined, 'progression_v8');
  assert.equal(awards(conn).length, 8, 'reopening revalidates the mixed V7/V8 ledger');
  await store.close();
});

test('New installs start on V8 (the app opens its database with V8 as the release)', async t => {
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/data/database/database.ts'), 'utf8'), /activateRulesVersion \?\? 'progression_v8'/);
  const store = await openStore(connection(disk(t)), context(1), undefined, 'progression_v8');
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v8');
  await store.close();
});
