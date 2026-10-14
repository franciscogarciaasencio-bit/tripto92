const { test } = require('node:test');
const { assert, api, domain, fixture, session, context, at, disk, connection, openStore, save } = require('./helpers.cjs');
const { startOpenEndedTimer, startTimer, pauseTimer, resumeTimer, finishTimer, timerSession, activeElapsedSeconds } = domain('meditation/timer.js');
const finish = (id = 'open', seconds = 600) => {
  const d = startOpenEndedTimer(id, at(1, 9), 'UTC');
  return finishTimer(d, d.startedAt + seconds * 1000);
};
test('Atomic open completion returns actual receipts, history count and multi-level before/after', async t => {
  const { store } = await fixture(t);
  const d = finish();
  await store.timer.save(d);
  const result = await store.meditations.completePractice(timerSession(d), d.changedAt);
  assert.equal(await store.timer.load(), null);
  assert.equal(result.completion.awardedXpCenti, 8000);
  assert.equal(result.completion.previousCompletedPractices, 0);
  assert.equal(result.completion.completedPractices, 1);
  assert.equal(api.getLevelProgress(result.completion.beforeProgressionCenti).level.number, 1);
  assert.equal(api.getLevelProgress(result.completion.afterProgressionCenti).level.number, 5);
  const state = await store.meditations.loadProgressionState();
  assert.equal(state.awards[0].rulesVersion, 'progression_v1');
  assert.deepEqual(result, await store.meditations.completePractice(timerSession(d), d.changedAt + 1000));
  assert.equal(await store.meditations.getCompletedPracticeCount(), 1);
});
test('Practice count comes from completed history: short completed counts, legacy early end does not', async t => {
  const { meditations } = await fixture(t);
  await save(meditations, session({ minutes: 2 }));
  await save(meditations, session({ day: 2, status: 'ended_early' }));
  assert.equal(await meditations.getCompletedPracticeCount(), 1);
  const s = session({ day: 3, minutes: 0, status: 'completed' });
  const result = await meditations.completePractice(s, s.endedAt);
  assert.equal(result.completion.awardedXpCenti, 0);
  assert.equal(result.completion.previousCompletedPractices, 1);
  assert.equal(result.completion.completedPractices, 2);
  assert.equal((await meditations.getMeditationHistory()).length, 3);
});
for (const failure of ['INSERT INTO practice_completions', 'DELETE FROM meditation_timer', 'COMMIT']) {
  test(`Failure at ${failure} rolls back the complete save; repeated retry awards once`, async t => {
    const { conn, store } = await fixture(t);
    const d = finish();
    await store.timer.save(d);
    conn.failOnce(sql => sql.startsWith(failure));
    await assert.rejects(store.meditations.completePractice(timerSession(d), d.changedAt), /Simulated/);
    assert.equal(await store.meditations.getCompletedPracticeCount(), 0);
    assert.equal((await store.meditations.loadProgressionState()).lifetimeXpCenti, 0);
    assert.deepEqual(await store.timer.load(), d);
    const saved = await store.meditations.completePractice(timerSession(d), d.changedAt);
    assert.deepEqual(await store.meditations.completePractice(timerSession(d), d.changedAt), saved);
  });
}
test('Finished draft recovery, pending summary reopening and acknowledgement never re-award', async t => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const d = finish();
  await store.timer.save(d);
  await store.close();
  store = await openStore(connection(filename), context(2));
  assert.equal(store.initialCompletion.session.id, d.id);
  assert.equal(store.initialCompletedPractices, 1);
  const completion = store.initialCompletion;
  const receipts = (await store.meditations.loadProgressionState()).awards;
  await store.close();
  store = await openStore(connection(filename), context(2));
  assert.deepEqual(store.initialCompletion, completion);
  assert.deepEqual((await store.meditations.loadProgressionState()).awards, receipts);
  await store.meditations.acknowledgeCompletion(d.id, at(2));
  await store.meditations.acknowledgeCompletion(d.id, at(2, 1));
  await store.close();
  store = await openStore(connection(filename), context(2, 1));
  assert.equal(store.initialCompletion, null);
  assert.equal(store.initialSnapshot.lifetimeXpCenti, 8000);
  assert.equal(store.initialCompletedPractices, 1);
  await store.close();
});
test('Running/paused open cursor survives disk reopening without target expiry or extra activity', async t => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1));
  const start = startOpenEndedTimer('running', at(1, 9), 'UTC');
  await store.timer.save(start);
  await store.close();
  store = await openStore(connection(filename), context(2, 9));
  assert.equal(activeElapsedSeconds(store.initialTimer, at(2, 9)), 86400);
  const paused = pauseTimer(store.initialTimer, at(2, 9));
  await store.timer.save(paused);
  await store.close();
  store = await openStore(connection(filename), context(3, 9));
  assert.equal(activeElapsedSeconds(store.initialTimer, at(3, 9)), 86400);
  const resumed = resumeTimer(store.initialTimer, at(3, 9));
  await store.timer.save(resumed);
  const finished = finishTimer(resumed, at(3, 9) + 1500);
  const result = await store.meditations.completePractice(timerSession(finished), finished.changedAt);
  assert.equal(result.completion.session.activeDurationSeconds, 86401);
  assert.equal(result.completion.session.pausedDurationSeconds, 86400);
  await store.close();
});
test('Discard is deliberate/idempotent and produces neither history, completed count nor awards', async t => {
  const { store } = await fixture(t);
  await store.timer.save(startOpenEndedTimer('discard', at(1, 9), 'UTC'));
  await assert.rejects(store.timer.discard('different'), /different/);
  await store.timer.discard('discard');
  await store.timer.discard('discard');
  assert.equal(await store.timer.load(), null);
  assert.equal(await store.meditations.getCompletedPracticeCount(), 0);
  assert.equal((await store.meditations.loadProgressionState()).awards.length, 0);
  await store.timer.save(finish('finished'));
  await assert.rejects(store.timer.discard('finished'), /finished/);
});
test('Before-level excludes inactivity loss settled before a returning award; old receipts unchanged', async t => {
  const { store } = await fixture(t);
  for (let day = 1; day <= 30; day++) await save(store.meditations, session({ day }));
  const original = (await store.meditations.loadProgressionState()).awards;
  const s = session({ day: 45 });
  const result = await store.meditations.completePractice(s, s.endedAt);
  assert.equal(result.completion.beforeProgressionCenti, 304000);
  assert.equal(result.completion.awardedXpCenti, 8000);
  assert.equal(result.completion.afterProgressionCenti, 312000);
  assert.deepEqual((await store.meditations.loadProgressionState()).awards.slice(0, 30), original);
});
test('Committed transaction followed by lost acknowledgement can retry without duplicate receipt', async t => {
  const filename = disk(t);
  const conn = connection(filename);
  let store = await openStore(conn, context(1));
  const originalExec = conn.exec;
  let lose = true;
  conn.exec = async sql => { await originalExec(sql); if (sql === 'COMMIT' && lose) { lose = false; throw new Error('Lost acknowledgement'); } };
  const d = finish();
  await assert.rejects(store.meditations.completePractice(timerSession(d), d.changedAt), error =>
    error instanceof AggregateError && error.errors.some(cause => /Lost acknowledgement/.test(String(cause))));
  // A failed rollback makes the connection unusable. Reopen, then retry the same stable payload.
  await store.close();
  store = await openStore(connection(filename), context(2));
  const result = await store.meditations.completePractice(timerSession(d), d.changedAt);
  assert.equal(result.completion.completedPractices, 1);
  assert.equal(result.snapshot.lifetimeXpCenti, 8000);
  await store.close();
});
test('A failed Home acknowledgement leaves the saved summary pending for retry', async t => {
  const { conn, store } = await fixture(t);
  const s = timerSession(finish());
  await store.meditations.completePractice(s, s.endedAt);
  conn.failOnce(sql => sql.startsWith('UPDATE practice_completions'));
  await assert.rejects(store.meditations.acknowledgeCompletion(s.id, s.endedAt), /Simulated/);
  assert.ok(await store.meditations.getPendingCompletion());
  await store.meditations.acknowledgeCompletion(s.id, s.endedAt);
  assert.equal(await store.meditations.getPendingCompletion(), null);
});
test('V2 pending timed cursor migrates to V3; historical awards and preferences are byte-for-byte unchanged', async t => {
  const filename = disk(t);
  const conn = connection(filename);
  const { createTransactions } = require('./helpers.cjs').data('database/connection.js');
  const { writeLegacyFixture } = require('./helpers.cjs');
  const prefs = require('./helpers.cjs').data('preferences.js').DEFAULT_PREFERENCES;
  let state = api.recordSession(api.createProgressionState(context(1)), session());
  const tx = createTransactions(conn);
  await tx.transaction(async sql => {
    await writeLegacyFixture(sql, 2, state, prefs);
    const timed = startTimer('legacy-running', 600, at(2, 9), 'UTC');
    const { mode, ...oldDraft } = timed;
    await sql.run('INSERT INTO meditation_timer VALUES (1, ?)', [JSON.stringify(oldDraft)]);
  });
  const original = conn.raw.prepare('SELECT * FROM progression_awards').all();
  await tx.close();
  const next = connection(filename);
  const store = await openStore(next, context(2, 9));
  assert.equal(store.initialTimer.mode, 'timed');
  assert.equal(store.initialTimer.targetSeconds, 600);
  assert.equal(store.initialCompletion, null); // No guessed summaries for historical records.
  assert.deepEqual(next.raw.prepare(`SELECT id, sequence, session_id, occasion_id, rules_version, awarded_at,
    local_date, reward_date, xp_centi, breakdown_json FROM progression_awards`).all(), original);
  assert.deepEqual(await store.settings.loadPreferences(), prefs);
  await store.close();
});
test('Malformed summary values fail explicitly; immutable summary XP cannot be edited', async t => {
  const { conn, store } = await fixture(t);
  const s = timerSession(finish());
  await store.meditations.completePractice(s, s.endedAt);
  assert.throws(() => conn.raw.exec('UPDATE practice_completions SET after_progression_centi = 1'), /immutable/);
  conn.raw.exec('DROP TRIGGER practice_completions_immutable');
  conn.raw.exec('UPDATE practice_completions SET after_progression_centi = 1');
  await assert.rejects(store.meditations.getPendingCompletion(), /disagrees/);
});
