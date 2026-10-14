const { test } = require('node:test');
const { assert, api, data, domain, connection, disk, openStore, context, session, at, DROP_SYNC_MIGRATION } = require('./helpers.cjs');
const { startTimer, settleTimer, timerSession } = domain('meditation/timer.js');
const release = (conn, asOf, supported) => openStore(conn, asOf, supported, 'progression_v5');
const legacy = (conn, asOf) => openStore(conn, asOf, undefined, 'progression_v4');
async function practice(store, record, acknowledge = false) {
  const result = await store.meditations.completePractice(record, record.endedAt);
  if (acknowledge) await store.meditations.acknowledgeCompletion(record.id, record.endedAt);
  return result;
}
function awards(conn) {
  return conn.raw.prepare('SELECT * FROM progression_awards ORDER BY sequence').all();
}
function anchorRows(conn) {
  return conn.raw.prepare('SELECT * FROM progression_consistency_activations ORDER BY generation_id, rules_version').all();
}

/** V10 only adds its empty table/triggers. Removing those reproduces the exact released V9 schema. */
async function releasedNineFixture(t, days = 3) {
  const file = disk(t); let conn = connection(file), store = await legacy(conn, context(1));
  for (let day = 1; day <= days; ++day) await practice(store, session({ day }), true);
  const state = await store.meditations.loadProgressionState(), receipts = awards(conn);
  await store.close(); conn = connection(file);
  assert.equal(anchorRows(conn).length, 0);
  conn.raw.exec(DROP_SYNC_MIGRATION + `DROP TRIGGER consistency_activations_immutable_update;
    DROP TRIGGER consistency_activations_immutable_delete;
    DROP TABLE progression_consistency_activations;
    DELETE FROM schema_migrations WHERE version = 10;`);
  const checkpoint = conn.raw.prepare('SELECT metadata_json FROM progression_checkpoint').get();
  const metadata = JSON.parse(checkpoint.metadata_json); delete metadata.consistencyActivationCount;
  conn.raw.prepare('UPDATE progression_checkpoint SET metadata_json=?').run(JSON.stringify(metadata));
  assert.equal(conn.raw.prepare('SELECT MAX(version) version FROM schema_migrations').get().version, 9);
  await conn.close(); return { file, state, receipts };
}

test('Real V9 history migrates transactionally to V10, preserving exact V4 awards and carrying its settled score', async t => {
  const { file, state: previous, receipts } = await releasedNineFixture(t, 7);
  let conn = connection(file), store = await release(conn, context(12));
  const expected = api.progressionConsistency(api.advanceProgression(previous, context(12))).score * 60;
  const state = await store.meditations.loadProgressionState();
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v5');
  assert.equal(state.consistencyActivations[0].score, expected);
  assert.equal(state.consistencyActivations[0].previousRulesVersion, 'progression_v4');
  assert.equal(state.consistencyActivations[0].awardCount, 7);
  assert.deepEqual(awards(conn), receipts);
  assert.equal(state.lifetimeXpCenti, previous.lifetimeXpCenti);
  assert.equal(conn.raw.prepare('SELECT MAX(version) version FROM schema_migrations').get().version, 11);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM schema_migrations WHERE version=10').get().n, 1);
  const stored = anchorRows(conn); await store.close();
  conn = connection(file); store = await release(conn, context(12));
  assert.deepEqual(anchorRows(conn), stored); assert.deepEqual(awards(conn), receipts);
  assert.equal(store.initialSnapshot.consistency.fraction, expected / 60_000_000);
  await store.close();
});

test('V5 awards, receipt endpoints and checkpoint are atomic and duplicate saves cannot mint extra Ripples', async t => {
  const file = disk(t); let conn = connection(file), store = await release(conn, context(1));
  const record = session({ minutes: 3 }), result = await practice(store, record);
  assert.equal(result.completion.awardedXpCenti, 4556);
  assert.equal(result.completion.consistencyIndicator.before, 0);
  assert.equal(result.completion.consistencyIndicator.after, 1 / 60);
  assert.equal(result.completion.habitReward.consistencyAfter, 1 / 60);
  const original = awards(conn), stored = anchorRows(conn);
  for (let retry = 0; retry < 3; ++retry) assert.deepEqual((await practice(store, { ...record })).completion, result.completion);
  assert.deepEqual(awards(conn), original); assert.deepEqual(anchorRows(conn), stored);
  await store.close(); conn = connection(file); store = await release(conn, context(2));
  assert.deepEqual(store.initialCompletion.consistencyIndicator, result.completion.consistencyIndicator);
  assert.deepEqual(store.initialCompletion.habitReward, result.completion.habitReward);
  assert.equal(store.initialSnapshot.lifetimeXpCenti, 4556);
  await store.close();
});

test('V5 reopening applies only complete inactive-date decay and repeated startup cannot decay again', async t => {
  const file = disk(t); let store = await release(connection(file), context(1));
  await practice(store, session(), true); await store.close();
  store = await release(connection(file), context(2, 23));
  assert.equal(store.initialSnapshot.consistency.fraction, 1 / 60); await store.close();
  store = await release(connection(file), context(3));
  const once = store.initialSnapshot.consistency.fraction;
  assert.equal(once, 840896 / 60_000_000);
  const habit = store.initialHabit, lifetime = store.initialSnapshot.lifetimeXpCenti; await store.close();
  store = await release(connection(file), context(3));
  assert.equal(store.initialSnapshot.consistency.fraction, once); assert.deepEqual(store.initialHabit, habit);
  const returned = await practice(store, session({ day: 3 }));
  assert.equal(returned.completion.consistencyIndicator.before, once);
  assert.equal(returned.completion.consistencyIndicator.after, 1840896 / 60_000_000);
  assert.ok(returned.snapshot.lifetimeXpCenti > lifetime); await store.close();
  store = await release(connection(file), context(4));
  assert.equal(store.initialSnapshot.consistency.fraction, returned.snapshot.consistency.fraction);
  await store.close();
});

test('Zero-active V5 completion has no award but retains its actual consistency endpoints through reopen', async t => {
  const file = disk(t); let conn = connection(file), store = await release(conn, context(1));
  await practice(store, session(), true);
  const zero = session({ day: 2, activeSeconds: 0 }), saved = await practice(store, zero);
  assert.equal(saved.completion.awardedXpCenti, 0);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_awards WHERE session_id=?').get(zero.id).n, 0);
  assert.deepEqual(saved.completion.consistencyIndicator, { before: 1 / 60, after: 1 / 60 });
  assert.equal(saved.snapshot.consistency.fraction, 1 / 60);
  await store.close(); store = await release(connection(file), context(2, 23));
  assert.deepEqual(store.initialCompletion.consistencyIndicator, saved.completion.consistencyIndicator);
  assert.equal(store.initialSnapshot.consistency.fraction, 1 / 60); await store.close();
});

test('Already-finished legacy timer is completed under V4 before prospective V5 activation', async t => {
  const file = disk(t); let conn = connection(file), store = await legacy(conn, context(1));
  const draft = settleTimer(startTimer('finished-v4', 180, at(1, 9), 'UTC'), at(1, 10));
  await store.timer.save(draft); await store.close();
  conn = connection(file); store = await release(conn, context(2));
  assert.equal(store.recoveredSession.id, 'finished-v4');
  assert.equal(store.initialCompletion.awardedXpCenti, 4798);
  assert.equal(store.initialCompletion.habitReward.consistencyAfter, .15);
  assert.equal(awards(conn)[0].rules_version, 'progression_v4');
  assert.equal(store.initialSnapshot.consistency.fraction, .15);
  assert.equal((await store.meditations.loadProgressionState()).consistencyActivations[0].score, 9_000_000);
  await store.close(); store = await release(connection(file), context(2));
  assert.equal(store.recoveredSession, null); assert.equal(store.initialSnapshot.lifetimeXpCenti, 4798); await store.close();
});

test('An unfinished legacy timer may start before activation and finish prospectively under V5 without poisoning the nearby occasion', async t => {
  const file = disk(t); let conn = connection(file), store = await legacy(conn, context(1));
  const previous = session({ id: 'before-upgrade' }); await practice(store, previous, true);
  const startedAt = previous.endedAt + 60_000, draft = startTimer('running-through-upgrade', 180, startedAt, 'UTC');
  await store.timer.save(draft); await store.close();
  const activation = { timestamp: startedAt + 60_000, localDate: previous.localDate, timeZone: 'UTC' };
  conn = connection(file); store = await release(conn, activation);
  assert.equal(store.initialTimer.phase, 'running'); assert.equal(store.initialSnapshot.rulesVersion, 'progression_v5');
  const record = timerSession(settleTimer(store.initialTimer, startedAt + 180_000));
  const result = await practice(store, record);
  assert.equal(result.completion.session.startedAt, startedAt);
  assert.ok(startedAt < activation.timestamp);
  const state = await store.meditations.loadProgressionState();
  assert.equal(state.occasions.length, 2); assert.equal(state.awards[1].rulesVersion, 'progression_v5');
  assert.equal(state.awards[1].breakdown.weightBasisPoints, 7500);
  assert.equal(state.awards[1].breakdown.continuousConsistencyScore, 9_000_000);
  await store.close(); store = await release(connection(file), { ...activation, timestamp: record.endedAt });
  assert.equal(store.initialCompletion.session.id, record.id); assert.equal(store.initialTimer, null); await store.close();
});

for (const target of ['INSERT INTO progression_consistency_activations', 'INSERT INTO progression_checkpoint']) {
  test(`Activation failure at ${target} rolls back migration, rule registration, anchor and checkpoint together`, async t => {
    const { file, receipts } = await releasedNineFixture(t);
    let conn = connection(file); conn.failOnce(sql => sql.startsWith(target));
    await assert.rejects(release(conn, context(4)), /Simulated/);
    conn = connection(file);
    assert.equal(conn.raw.prepare('SELECT MAX(version) version FROM schema_migrations').get().version, 9);
    assert.equal(conn.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='progression_consistency_activations'").get().n, 0);
    assert.equal(conn.raw.prepare("SELECT COUNT(*) n FROM progression_rules WHERE version='progression_v5'").get().n, 0);
    assert.equal(JSON.parse(conn.raw.prepare('SELECT metadata_json FROM progression_checkpoint').get().metadata_json).activeRulesVersion, 'progression_v4');
    assert.deepEqual(awards(conn), receipts); await conn.close();
    const store = await release(connection(file), context(4));
    assert.equal(store.initialSnapshot.rulesVersion, 'progression_v5'); await store.close();
  });
}

test('Confirmed full reset removes sessions, rewards, timer and old anchors while preserving preferences after restart', async t => {
  const file = disk(t); let conn = connection(file), store = await release(conn, context(1));
  const old = session(); await practice(store, old, true);
  const preferences = { ...await store.settings.loadPreferences(), gongVolume: .23 };
  const audio = { ...await store.settings.loadAudioPreferences(), sessionVolume: .07, homeEnabled: false };
  await store.settings.savePreferences(preferences); await store.settings.saveAudioPreferences(audio);
  await store.timer.save(startTimer('deleted-draft', 600, at(1, 12), 'UTC'));
  const cleared = await store.meditations.resetAllPracticeData(context(2));
  assert.equal(cleared.journey.level.number, 0); assert.equal(cleared.snapshot.lifetimeXpCenti, 0);
  assert.equal(cleared.snapshot.consistency.fraction, 0);
  for (const table of ['meditation_sessions', 'progression_awards', 'habit_reward_receipts', 'practice_completions', 'meditation_timer']) {
    assert.equal(conn.raw.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
  }
  const anchor = JSON.parse(anchorRows(conn)[0].activation_json);
  assert.equal(anchor.previousRulesVersion, null); assert.equal(anchor.score, 0); assert.equal(anchor.sessionCount, 0);
  assert.throws(() => conn.raw.exec('DELETE FROM progression_consistency_activations'), /immutable|cannot/);
  await store.close(); store = await release(connection(file), context(3));
  assert.equal(store.initialJourney.level.number, 0); assert.equal(store.initialHabit.highestLevel, 0);
  assert.equal(store.initialSnapshot.consistency.fraction, 0); assert.equal(store.initialCompletion, null); assert.equal(store.initialTimer, null);
  assert.equal((await store.meditations.getMeditationHistory()).length, 0);
  assert.deepEqual(await store.settings.loadPreferences(), preferences); assert.deepEqual(await store.settings.loadAudioPreferences(), audio);
  await assert.rejects(store.meditations.completePractice(old, at(3, 12)), /reset boundary/);
  assert.equal((await store.meditations.loadProgressionState()).lifetimeXpCenti, 0); await store.close();
});

test('Archiving V5 retains original immutable anchors and awards while the new generation receives a zero anchor', async t => {
  const file = disk(t); let conn = connection(file), store = await release(conn, context(1));
  await practice(store, session(), true); await practice(store, session({ day: 2 }), true);
  const original = awards(conn), first = anchorRows(conn)[0];
  await store.meditations.resetProgression(context(3));
  assert.equal(anchorRows(conn).length, 2); assert.deepEqual(anchorRows(conn)[0], first);
  assert.deepEqual(awards(conn), original);
  assert.equal((await store.meditations.loadProgressionState()).consistencyActivations[0].score, 0);
  await store.close(); conn = connection(file); store = await release(conn, context(4));
  assert.equal(store.initialSnapshot.lifetimeXpCenti, 0); assert.equal(store.initialSnapshot.consistency.fraction, 0);
  assert.deepEqual(awards(conn), original); assert.deepEqual(anchorRows(conn)[0], first);
  assert.equal((await store.meditations.getMeditationHistory()).length, 2); await store.close();
});

for (const corruption of ['bounded-score', 'deleted-anchor']) {
  test(`A ${corruption} consistency anchor fails explicitly instead of replaying or discarding user history`, async t => {
    const file = disk(t); let conn = connection(file), store = await legacy(conn, context(1));
    await practice(store, session(), true); await store.close();
    conn = connection(file); store = await release(conn, context(2)); const original = awards(conn); await store.close();
    conn = connection(file);
    if (corruption === 'bounded-score') {
      conn.raw.exec('DROP TRIGGER consistency_activations_immutable_update');
      const anchor = JSON.parse(anchorRows(conn)[0].activation_json); anchor.score += 1;
      conn.raw.prepare('UPDATE progression_consistency_activations SET activation_json=?').run(JSON.stringify(anchor));
    } else {
      conn.raw.exec('DROP TRIGGER consistency_activations_immutable_delete');
      conn.raw.exec('DELETE FROM progression_consistency_activations');
    }
    await conn.close(); await assert.rejects(release(connection(file), context(2)), error => error.code === 'INVALID_DATA');
    conn = connection(file); assert.deepEqual(awards(conn), original); await conn.close();
  });
}

test('A same-date V4→V5 boundary below ninety minutes keeps old receipt bytes and consumes the next frequency slot', async t => {
  const file = disk(t); let conn = connection(file), store = await legacy(conn, context(1));
  const first = session({ minutes: 3 }); await practice(store, first, true);
  const old = awards(conn); await store.close();
  conn = connection(file); store = await release(conn, { timestamp: first.endedAt, localDate: first.localDate, timeZone: 'UTC' });
  const second = session({ id: 'after-version-boundary', startedAt: first.endedAt + 1000, minutes: 3 });
  await practice(store, second);
  const state = await store.meditations.loadProgressionState();
  assert.equal(state.occasions.length, 2); assert.equal(state.awards[1].breakdown.weightBasisPoints, 7500);
  assert.deepEqual(awards(conn).slice(0, 1), old); await store.close();
  store = await release(connection(file), state.asOf); assert.equal(store.initialCompletion.session.id, second.id); await store.close();
});

test('Future linear V10 activated at the same instant restores anchor source order and actual completion endpoints', async t => {
  const file = disk(t), next = { ...api.PROGRESSION_V5, version: 'progression_v10' };
  let conn = connection(file), store = await release(conn, context(1), [next]);
  await store.meditations.changeRules(next.version, context(1));
  const state = await store.meditations.loadProgressionState();
  assert.deepEqual(state.consistencyActivations.map(anchor => anchor.rulesVersion), ['progression_v5', 'progression_v10']);
  const saved = await practice(store, session({ minutes: 3 }));
  assert.equal(saved.completion.consistencyIndicator.after, 1 / 60);
  await store.close(); conn = connection(file); store = await openStore(conn, saved.snapshot.asOf, [next]);
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v10');
  assert.equal(store.initialSnapshot.consistency.fraction, 1 / 60);
  assert.deepEqual(store.initialCompletion.consistencyIndicator, saved.completion.consistencyIndicator); await store.close();
});
