const { test } = require('node:test');
const { assert, api, context, session, fixture, disk, connection, openStore, save, at, date } = require('./helpers.cjs');

test('Mixed domain history round trips exactly after every transition', async (t) => {
  const { meditations } = await fixture(t);
  let expected = api.createProgressionState(context(1));
  for (let day = 1; day <= 60; day++) {
    if (day % 11 < 4) continue;
    for (const [index, hour] of [7, 7.5, 10, 13, 16].entries()) {
      const s = session({ day, hour, minutes: index === 2 ? 2 : 10, pausedSeconds: 10, status: day % 2 ? 'completed' : 'ended_early' });
      expected = api.recordSession(expected, s);
      await save(meditations, s);
      assert.deepEqual(await meditations.loadProgressionState(), expected);
    }
  }
  assert.deepEqual(await meditations.getCurrentProgressionSnapshot(context(90)), api.getProgressSnapshot(expected, context(90)));
});

test('Open occasion survives close/reopen and awards only the incremental difference', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const first = session();
  await save(store.meditations, first);
  await store.close();
  store = await openStore(connection(filename), { ...context(1), timestamp: first.endedAt });
  try {
    await save(store.meditations, session({ hour: 9.5 }));
    const state = await store.meditations.loadProgressionState();
    assert.deepEqual(state.awards.map((a) => a.xpCenti), [8000, 2000]);
    assert.equal(state.occasions.length, 1);
    assert.equal(state.lifetimeXpCenti, 10000);
  } finally { await store.close(); }
});

for (const [hour, occasions, xp] of [[0.2, 1, 10000], [2, 2, 16457]]) {
  test(`Midnight sessions at hour ${hour} preserve grouping and historical reward dates`, async (t) => {
    const { meditations } = await fixture(t);
    await save(meditations, session({ hour: 23.5 }));
    await save(meditations, session({ day: 2, hour }));
    const state = await meditations.loadProgressionState();
    assert.equal(state.occasions.length, occasions);
    assert.equal(state.lifetimeXpCenti, xp);
    assert.equal(state.awards[0].rewardDate, date(1));
    assert.equal(state.sessions[1].session.localDate, date(2));
  });
}

test('Ten tiny sessions keep time/history but never award XP or reset inactivity', async (t) => {
  const { meditations } = await fixture(t);
  await save(meditations, session());
  for (let i = 0; i < 10; i++) await save(meditations, session({ day: 4, startedAt: at(4, 9) + i * 180000, minutes: 2 }));
  const snapshot = await meditations.getCurrentProgressionSnapshot(context(5));
  const state = await meditations.loadProgressionState();
  assert.equal(state.sessions.length, 11);
  assert.equal(state.awards.length, 1);
  assert.equal(snapshot.currentProgressionCenti, 7920);
  assert.equal(snapshot.totalMeditationSeconds, 1800);
});

test('Thirty days and fourteen complete inactive days restore exactly 3232 / 3040 XP', async (t) => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  for (let day = 1; day <= 30; day++) await save(store.meditations, session({ day }));
  const receipts = (await store.meditations.loadProgressionState()).awards;
  await store.close();
  for (let attempt = 0; attempt < 3; attempt++) {
    store = await openStore(connection(filename), context(45));
    assert.equal(store.initialSnapshot.lifetimeXpCenti, 323200);
    assert.equal(store.initialSnapshot.currentProgressionCenti, 304000);
    assert.deepEqual((await store.meditations.loadProgressionState()).awards, receipts);
    await store.close();
  }
  store = await openStore(connection(filename), context(46));
  try { assert.equal(store.initialSnapshot.currentProgressionCenti, 302400); }
  finally { await store.close(); }
});

test('Protected complete days, repeated reads, and return use the existing decay policy', async (t) => {
  const { meditations } = await fixture(t);
  await save(meditations, session());
  for (const day of [2, 3, 4]) assert.equal((await meditations.getCurrentProgressionSnapshot(context(day))).currentProgressionCenti, 8000);
  for (let i = 0; i < 3; i++) assert.equal((await meditations.getCurrentProgressionSnapshot(context(5))).currentProgressionCenti, 7920);
  const beforeReturn = await meditations.loadProgressionState();
  const returning = session({ day: 5 });
  await save(meditations, returning);
  const expected = api.recordSession(beforeReturn, returning);
  assert.deepEqual(await meditations.loadProgressionState(), expected);
  assert.equal((await meditations.getCurrentProgressionSnapshot(context(8))).currentProgressionCenti, expected.currentProgressionCenti);
  assert.equal((await meditations.loadProgressionState()).lifetimeXpCenti, expected.lifetimeXpCenti);
});

test('Highest rank persists after decay demotes the current rank', async (t) => {
  const { meditations } = await fixture(t);
  for (let day = 1; day <= 3; day++) await save(meditations, session({ day }));
  const best = (await meditations.loadProgressionState()).highestRankAchieved;
  const snapshot = await meditations.getCurrentProgressionSnapshot(context(200));
  assert.equal(snapshot.currentRank.id, 'monkey_mind');
  assert.equal(snapshot.highestRankAchieved.rank.id, 'first_pause');
  assert.deepEqual(snapshot.highestRankAchieved, best);
});

test('Travel changes current context without moving historical dates or rewinding the decay cursor', async (t) => {
  const { meditations } = await fixture(t);
  const s = session({ localDate: '2026-01-06', timeZone: 'Pacific/Auckland' });
  await save(meditations, s);
  const travel = { timestamp: at(1, 12), localDate: '2026-01-05', timeZone: 'America/Los_Angeles' };
  await meditations.getCurrentProgressionSnapshot(travel);
  const state = await meditations.loadProgressionState();
  assert.equal(state.settledThroughDate, '2026-01-05');
  assert.deepEqual(state.sessions[0].session, s);
  assert.deepEqual(state.asOf, travel);
});

test('Registering V2 does not activate it; explicit change preserves V1 receipts and open occasion terms', async (t) => {
  const filename = disk(t);
  const v2 = { ...api.PROGRESSION_V1, version: 'progression_v2_fixture', duration: { ...api.PROGRESSION_V1.duration, baseCentiXp: 12000 } };
  let store = await openStore(connection(filename), context(1));
  const first = session();
  await save(store.meditations, first);
  const receipt = (await store.meditations.loadProgressionState()).awards[0];
  await store.close();
  store = await openStore(connection(filename), { ...context(1), timestamp: first.endedAt }, [v2]);
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v1');
  await store.meditations.changeRules(v2.version, { ...context(1), timestamp: first.endedAt });
  await save(store.meditations, session({ hour: 9.5 }));
  await save(store.meditations, session({ hour: 12 }));
  const expected = await store.meditations.loadProgressionState();
  assert.deepEqual(expected.awards[0], receipt);
  assert.deepEqual(expected.awards.map((a) => a.rulesVersion), ['progression_v1', 'progression_v1', v2.version]);
  assert.deepEqual(expected.awards.map((a) => a.xpCenti), [8000, 2000, 10500]);
  await store.close();
  // An old app cannot interpret the new rule version; it must not rewrite the database.
  await assert.rejects(openStore(connection(filename), expected.asOf), (error) => error.code === 'UNSUPPORTED_RULES');
  store = await openStore(connection(filename), expected.asOf, [v2]);
  try { assert.deepEqual(await store.meditations.loadProgressionState(), expected); }
  finally { await store.close(); }
});

test('Historical qualification and highest labels survive a future rules change', async (t) => {
  const v2 = { ...api.PROGRESSION_V1, version: 'higher_minimum_fixture', minimumActiveSeconds: 900,
    ranks: api.PROGRESSION_V1.ranks.map((r) => ({ ...r, name: `${r.name} revised` })) };
  const { meditations } = await fixture(t, context(1), [v2]);
  for (let day = 1; day <= 3; day++) await save(meditations, session({ day }));
  const before = await meditations.loadProgressionState();
  await meditations.changeRules(v2.version, context(4));
  await save(meditations, session({ day: 4 }));
  const after = await meditations.loadProgressionState();
  assert.deepEqual(after.highestRankAchieved, before.highestRankAchieved);
  assert.deepEqual(after.awards, before.awards);
  assert.equal(after.sessions[3].qualified, false);
});

test('Backdated completion fails atomically; a duplicate remains a no-op after later decay', async (t) => {
  const { meditations } = await fixture(t);
  await save(meditations, session());
  await meditations.getCurrentProgressionSnapshot(context(20));
  const before = await meditations.loadProgressionState();
  await assert.rejects(save(meditations, session({ day: 2 })), /rewind/);
  await save(meditations, session());
  assert.deepEqual(await meditations.loadProgressionState(), before);
});
