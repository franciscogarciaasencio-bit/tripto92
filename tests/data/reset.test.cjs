const { test } = require('node:test');
const { assert, api, data, domain, connection, disk, openStore, context, session, at, writeLegacyFixture } = require('./helpers.cjs');
const { startOpenEndedTimer, pauseTimer, finishTimer } = domain('meditation/timer.js');
const release = (conn, asOf, rules) => openStore(conn, asOf, rules, 'progression_v3');
async function fixture(t) {
  const conn = connection(); const store = await release(conn, context(1));
  t.after(() => store.close()); return { conn, store, repo: store.meditations };
}
async function practice(store, s) {
  const result = await store.meditations.completePractice(s, s.endedAt);
  await store.meditations.acknowledgeCompletion(s.id, s.endedAt);
  return result;
}
function immutableRows(conn) {
  return Object.fromEntries(['meditation_sessions', 'progression_awards', 'progression_rules', 'practice_completions', 'journey_completions']
    .map(table => [table, conn.raw.prepare(`SELECT * FROM ${table} ORDER BY ${table.endsWith('completions') ? 'session_id' : 'sequence'}`).all()]));
}

test('V3 short, early-ended and zero-active records round-trip without adding qualifying days or credits', async t => {
  const { store, repo } = await fixture(t);
  assert.equal(store.initialJourney.level.number, 0);
  const a = await practice(store, session({ activeSeconds: 20 }));
  assert.equal(a.completion.awardedXpCenti, 503);
  assert.equal(a.journey.level.number, 0);
  assert.equal(a.journey.metrics.credits, 0);
  assert.equal(a.snapshot.totalQualifyingPracticeDays, 0);
  assert.equal(a.snapshot.consistency.multiplier, 1);
  const b = await practice(store, session({ hour: 12, activeSeconds: 600, status: 'ended_early' }));
  assert.equal(b.completion.awardedXpCenti, 6000); // Second separate occasion, 75% of 80 Ripples.
  const zero = await practice(store, session({ hour: 16, activeSeconds: 0 }));
  assert.equal(zero.completion.awardedXpCenti, 0);
  const state = await repo.loadProgressionState();
  assert.equal(state.sessions.length, 3); assert.equal(state.awards.length, 2);
  assert.ok(state.sessions.every(entry => !entry.qualified));
  const later = await repo.getCurrentPracticeProgress(context(2));
  assert.equal(later.snapshot.consistency.precedingActiveDays, 0);
  assert.equal(later.journey.metrics.credits, 0); assert.equal(later.journey.metrics.realDays, 0);
});

test('Nearby short sessions share one capped occasion and never aggregate into qualification', async t => {
  const { store, repo } = await fixture(t);
  for (let i = 0; i < 100; i++) await practice(store, session({ id: `tiny-${i}`, startedAt: at(1, 9) + i * 21000, activeSeconds: 20 }));
  const state = await repo.loadProgressionState();
  assert.equal(state.occasions.length, 1); assert.equal(state.awards.length, 100);
  assert.equal(state.lifetimeXpCenti, 11474); // One logarithmic occasion with 2,000 active seconds.
  assert.equal(api.getJourneyFromState(state).level.number, 0);
  assert.equal(api.getJourneyFromState(state).metrics.credits, 0);
  assert.equal((await repo.getCurrentPracticeProgress(context(2))).snapshot.consistency.precedingActiveDays, 0);
});

test('Reset archives balance/peak, clears new journey, and retains exact history, receipts and preferences across disk reopen', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  for (let day = 1; day <= 5; day++) await practice(store, session({ day }));
  const old = await store.meditations.loadProgressionState();
  const raw = immutableRows(conn), history = await store.meditations.getMeditationHistory();
  const prefs = { ...await store.settings.loadPreferences(), gongVolume: 0.24 };
  const audio = { ...await store.settings.loadAudioPreferences(), homeEnabled: false, sessionVolume: 0.09 };
  await store.settings.savePreferences(prefs); await store.settings.saveAudioPreferences(audio);
  await store.application.dismissExplanation(at(5, 10));
  const result = await store.meditations.resetProgression(context(6, 12));
  assert.equal(result.journey.level.number, 0); assert.equal(conn.raw.prepare('SELECT level FROM journey_checkpoint').get().level, 0);
  assert.equal(result.journey.metrics.credits, 0); assert.equal(result.journey.metrics.realDays, 0);
  assert.equal(result.snapshot.lifetimeXpCenti, 0); assert.equal(result.snapshot.currentProgressionCenti, 0);
  assert.equal(result.snapshot.consistency.precedingActiveDays, 0);
  assert.equal(result.snapshot.highestRankAchieved.rank.id, 'monkey_mind');
  assert.deepEqual(immutableRows(conn), raw);
  assert.equal(conn.raw.prepare('SELECT closed_progression_centi FROM progression_generations WHERE id=1').get().closed_progression_centi, old.currentProgressionCenti);
  await store.close(); conn = connection(filename); store = await release(conn, context(8));
  assert.equal(store.initialJourney.level.number, 0); assert.equal(store.initialSnapshot.lifetimeXpCenti, 0);
  assert.deepEqual(await store.meditations.getMeditationHistory(), history);
  assert.deepEqual(await store.settings.loadPreferences(), prefs); assert.deepEqual(await store.settings.loadAudioPreferences(), audio);
  assert.equal(store.initialExplanationDismissed, true); assert.deepEqual(immutableRows(conn), raw);
  assert.equal(store.initialCompletedPractices, 5); await store.close();
});

test('Old global session IDs are harmless exact retries after reset; new sessions contribute only to the new journey', async t => {
  const { conn, store, repo } = await fixture(t); const old = session();
  const original = await practice(store, old); const raw = immutableRows(conn);
  await repo.resetProgression(context(2));
  const retry = await repo.completePractice({ ...old }, at(2, 12));
  assert.equal(retry.snapshot.lifetimeXpCenti, 0); assert.equal(retry.journey.level.number, 0);
  assert.deepEqual(retry.completion.journey, original.completion.journey); assert.deepEqual(immutableRows(conn), raw);
  await assert.rejects(repo.recordCompletedMeditation({ ...old, activeDurationSeconds: 500 }, at(2, 12)), /Conflicting session ID/);
  await assert.rejects(repo.recordCompletedMeditation(session({ id: 'backdated' }), at(2, 12)), /before the current progression reset/);
  const short = await practice(store, session({ day: 2, activeSeconds: 20 }));
  assert.equal(short.snapshot.lifetimeXpCenti, 503); assert.equal(short.journey.level.number, 0);
  const next = await practice(store, session({ day: 3, activeSeconds: 180 }));
  assert.equal(next.journey.level.number, 0); assert.equal(next.journey.fraction, (503+4526)/12000); assert.equal(next.journey.metrics.credits, 1);
  assert.equal(next.snapshot.consistency.precedingActiveDays, 0);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM meditation_sessions WHERE generation_id=1').get().n, 1);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_awards WHERE generation_id=2').get().n, 2);
});

test('The same reset boundary is idempotent under queued duplicate calls and new-generation rows retain global order', async t => {
  const { conn, store, repo } = await fixture(t); await practice(store, session());
  const results = await Promise.all(Array.from({ length: 12 }, () => repo.resetProgression(context(2))));
  results.forEach(result => assert.deepEqual(result, results[0]));
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations').get().n, 2);
  await practice(store, session({ day: 2 })); await repo.resetProgression(context(3)); await practice(store, session({ day: 3 }));
  assert.deepEqual(conn.raw.prepare('SELECT sequence, generation_id FROM meditation_sessions ORDER BY sequence').all().map(r => [...Object.values(r)]), [[1,1],[2,2],[3,3]]);
  assert.equal((await repo.loadProgressionState()).sessions.length, 1);
  assert.equal((await repo.getMeditationHistory()).length, 3);
});

for (const phase of ['running', 'paused', 'finished']) test(`Reset refuses durable ${phase} practice without changing progression`, async t => {
  const { conn, store, repo } = await fixture(t); let draft = startOpenEndedTimer(`busy-${phase}`, at(1, 9), 'UTC');
  if (phase === 'paused') draft = pauseTimer(draft, at(1, 9) + 20000);
  if (phase === 'finished') draft = finishTimer(draft, at(1, 9) + 20000, 'UTC');
  await store.timer.save(draft);
  await assert.rejects(repo.resetProgression(context(2)), /Finish or discard/);
  assert.deepEqual(await store.timer.load(), draft);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations').get().n, 1);
});

test('Reset refuses an unacknowledged completion, then succeeds after returning Home', async t => {
  const { store, repo } = await fixture(t); const s = session();
  await repo.completePractice(s, s.endedAt);
  await assert.rejects(repo.resetProgression(context(2)), /pending completion/);
  await repo.acknowledgeCompletion(s.id, at(1, 12));
  assert.equal((await repo.resetProgression(context(2))).journey.level.number, 0);
});

for (const target of ['UPDATE progression_generations', 'INSERT INTO progression_generations', 'INSERT INTO progression_checkpoint', 'UPDATE journey_checkpoint', 'COMMIT']) {
  test(`Failure at ${target} rolls back the entire reset and a retry succeeds`, async t => {
    const { conn, store, repo } = await fixture(t); await practice(store, session());
    const before = await repo.loadProgressionState(), raw = immutableRows(conn);
    conn.failOnce(sql => sql.startsWith(target));
    await assert.rejects(repo.resetProgression(context(2)), /Simulated/);
    assert.deepEqual(await repo.loadProgressionState(), before); assert.deepEqual(immutableRows(conn), raw);
    assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations').get().n, 1);
    assert.equal((await repo.resetProgression(context(2))).journey.level.number, 0);
  });
}

test('A lost reset commit acknowledgement reopens with the committed boundary and cannot resurrect old awards', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  const old = session(); await practice(store, old); const exec = conn.exec;
  conn.exec = async sql => { await exec(sql); if (sql === 'COMMIT') throw new Error('Reset commit acknowledgement lost'); };
  await assert.rejects(store.meditations.resetProgression(context(2)), AggregateError); await store.close();
  conn = connection(filename); store = await release(conn, context(2));
  assert.equal(store.initialJourney.level.number, 0);
  await store.meditations.resetProgression(context(2)); await store.meditations.recordCompletedMeditation(old, at(2, 12));
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations').get().n, 2);
  assert.equal((await store.meditations.loadProgressionState()).lifetimeXpCenti, 0); await store.close();
});

test('Separate connections observe a committed reset boundary before awarding or retrying old sessions', async t => {
  const filename = disk(t); const one = await release(connection(filename), context(1)), two = await release(connection(filename), context(1));
  try {
    const old = session(); await practice(one, old); await two.meditations.resetProgression(context(2));
    await one.meditations.recordCompletedMeditation(old, at(2, 12));
    await practice(one, session({ day: 2, activeSeconds: 20 }));
    assert.deepEqual(await one.meditations.loadProgressionState(), await two.meditations.loadProgressionState());
    assert.equal((await two.meditations.loadProgressionState()).lifetimeXpCenti, 503);
  } finally { await one.close(); await two.close(); }
});

test('Archived generation and old completion metadata remain validated on every reopen', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); await store.meditations.resetProgression(context(2)); await store.close();
  conn = connection(filename); conn.raw.exec('DROP TRIGGER progression_generations_close_once');
  const row = conn.raw.prepare('SELECT closed_checkpoint_json FROM progression_generations WHERE id=1').get();
  const meta = JSON.parse(row.closed_checkpoint_json); meta.awardCount = 0;
  conn.raw.prepare('UPDATE progression_generations SET closed_checkpoint_json=? WHERE id=1').run(JSON.stringify(meta)); await conn.close();
  await assert.rejects(release(connection(filename), context(3)), /counts do not match/);
});

for (const change of [meta => { meta.asOf.timeZone = 'Asia/Tokyo'; }, meta => { meta.asOf.localDate = '2026-01-05'; }]) {
  test('Archived reset context must match the exact stored date and zone boundary, not only its timestamp', async t => {
    const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
    await practice(store, session()); await store.meditations.resetProgression(context(2)); await store.close();
    conn = connection(filename); conn.raw.exec('DROP TRIGGER progression_generations_close_once');
    const meta = JSON.parse(conn.raw.prepare('SELECT closed_checkpoint_json FROM progression_generations WHERE id=1').get().closed_checkpoint_json);
    change(meta); conn.raw.prepare('UPDATE progression_generations SET closed_checkpoint_json=? WHERE id=1').run(JSON.stringify(meta)); await conn.close();
    await assert.rejects(release(connection(filename), context(3)), /reset boundary/);
  });
}

test('A new-generation peak cannot predate its reset even at Level 0', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await store.meditations.resetProgression(context(2)); await store.close(); conn = connection(filename);
  conn.raw.exec('DROP TRIGGER journey_checkpoint_monotonic'); conn.raw.prepare('UPDATE journey_checkpoint SET achieved_at=?').run(at(1)); await conn.close();
  await assert.rejects(release(connection(filename), context(3)), /outside its progression generation/);
});

test('Closed generations cannot be edited/deleted and mismatched session-award generations are rejected by SQLite', async t => {
  const { conn, store, repo } = await fixture(t); await practice(store, session()); await repo.resetProgression(context(2));
  assert.throws(() => conn.raw.exec('UPDATE progression_generations SET closed_progression_centi=0 WHERE id=1'), /immutable/);
  assert.throws(() => conn.raw.exec('DELETE FROM progression_generations WHERE id=1'), /cannot be deleted/);
  const s = session({ day: 2 }); await practice(store, s);
  assert.throws(() => conn.raw.prepare(`INSERT INTO progression_awards SELECT 'bad', 3, session_id, occasion_id, rules_version,
    awarded_at, local_date, reward_date, xp_centi, breakdown_json, 1 FROM progression_awards WHERE session_id=?`).run(s.id), /Invalid award progression generation/);
});

test('Travel reset keeps old historical dates fixed and starts new consistency/credits at its explicit context', async t => {
  const { store, repo } = await fixture(t);
  const old = session({ localDate: '2026-01-06', timeZone: 'Asia/Tokyo' }); await practice(store, old);
  const reset = { timestamp: at(2, 12), localDate: '2026-01-06', timeZone: 'Europe/Madrid' };
  await repo.resetProgression(reset);
  const next = session({ day: 2, hour: 14, activeSeconds: 180, timeZone: 'Europe/Madrid' });
  const result = await practice(store, next);
  assert.equal(result.journey.metrics.credits, 1); assert.equal(result.snapshot.consistency.precedingActiveDays, 0);
  assert.deepEqual((await repo.getMeditationHistory()).find(e => e.session.id === old.id).session, old);
});

test('V3 activates after old finished V2 cursor recovery, retaining its zero-reward historical short completion exactly', async t => {
  const filename = disk(t); let store = await openStore(connection(filename), context(1), undefined, 'progression_v2');
  const draft = finishTimer(startOpenEndedTimer('old-short-finish', at(1, 9), 'UTC'), at(1, 9) + 20000, 'UTC');
  await store.timer.save(draft); await store.close(); store = await release(connection(filename), context(2));
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v3');
  assert.equal(store.initialCompletion.awardedXpCenti, 0);
  let state = await store.meditations.loadProgressionState();
  assert.equal(state.sessions[0].qualificationRulesVersion, 'progression_v2'); assert.equal(state.awards.length, 0);
  await store.meditations.acknowledgeCompletion(draft.id, at(2));
  await practice(store, session({ day: 2, activeSeconds: 20 }));
  state = await store.meditations.loadProgressionState(); assert.equal(state.awards[0].rulesVersion, 'progression_v3');
  assert.equal(state.awards[0].xpCenti, 503); await store.close();
});

test('Replayed already-saved finished cursor is cleared atomically rather than remaining pending forever', async t => {
  const filename = disk(t); let store = await release(connection(filename), context(1));
  const draft = finishTimer(startOpenEndedTimer('replayed', at(1, 9), 'UTC'), at(1, 9) + 20000, 'UTC');
  await practice(store, domain('meditation/timer.js').timerSession(draft)); await store.timer.save(draft); await store.close();
  store = await release(connection(filename), context(2));
  assert.equal(await store.timer.load(), null); assert.equal((await store.meditations.loadProgressionState()).awards.length, 1);
  await store.close(); store = await release(connection(filename), context(3));
  assert.equal(store.initialTimer, null); assert.equal(store.initialCompletion, null); await store.close();
});

for (const rules of [api.PROGRESSION_V3, { ...api.PROGRESSION_V3, version: 'future_custom_rules' }]) {
  test(`Native V3 release does not downgrade ${rules.version}`, async t => {
    const filename = disk(t); let store = await release(connection(filename), context(1), [rules]);
    await store.meditations.changeRules(rules.version, context(1)); await practice(store, session({ activeSeconds: 20 }));
    const old = (await store.meditations.loadProgressionState()).awards; await store.close();
    store = await release(connection(filename), context(2), [rules]);
    assert.equal(store.initialSnapshot.rulesVersion, rules.version);
    assert.deepEqual((await store.meditations.loadProgressionState()).awards, old); await store.close();
  });
}

for (const qualifying of [false, true]) test(`Actual V5 migration preserves historical receipts and ${qualifying ? 'earned levels' : 'legacy Level 1 prelude'}`, async t => {
  const filename = disk(t); let conn = connection(filename);
  let state = api.createProgressionState(context(1), api.PROGRESSION_V2);
  state = api.recordSession(state, session({ activeSeconds: qualifying ? 180 : 20 }));
  await writeLegacyFixture(conn, 5, state);
  const oldReceipt = conn.raw.prepare('SELECT * FROM progression_awards ORDER BY sequence').all();
  const oldSummary = conn.raw.prepare('SELECT * FROM journey_completions').all();
  const oldPeak = conn.raw.prepare('SELECT * FROM journey_checkpoint').get(); await conn.close();
  conn = connection(filename); const store = await release(conn, context(2));
  assert.equal(store.initialJourney.level.number, qualifying ? oldPeak.level : 0);
  assert.deepEqual(conn.raw.prepare('SELECT * FROM legacy_journey_checkpoint').get(), oldPeak);
  assert.deepEqual(conn.raw.prepare(`SELECT id, sequence, session_id, occasion_id, rules_version, awarded_at, local_date,
    reward_date, xp_centi, breakdown_json FROM progression_awards ORDER BY sequence`).all(), oldReceipt);
  assert.deepEqual(conn.raw.prepare('SELECT session_id, before_level, after_level, credits_added, date_credits FROM journey_completions').all(), oldSummary);
  assert.equal(store.initialCompletion.journey.beforeLevel, 1);
  assert.equal(store.initialCompletion.awardedXpCenti, qualifying ? 4526 : 0);
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v3'); await store.close();
});

test('V6 migration failure rolls back released schema, rows and markers together', async t => {
  const filename = disk(t); let conn = connection(filename); const state = api.recordSession(api.createProgressionState(context(1)), session());
  await writeLegacyFixture(conn, 5, state); const old = conn.raw.prepare('SELECT * FROM progression_awards').all(); await conn.close();
  conn = connection(filename); conn.failOnce(sql => sql.includes('CREATE TABLE progression_generations'));
  await assert.rejects(release(conn, context(2)), /Simulated/);
  conn = connection(filename);
  assert.equal(conn.raw.prepare('SELECT MAX(version) v FROM schema_migrations').get().v, 5);
  assert.deepEqual(conn.raw.prepare('SELECT * FROM progression_awards').all(), old);
  assert.equal(conn.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='progression_generations'").get().n, 0);
  await conn.close();
});

test('A stale timer cannot be saved after a reset or restored from malformed persisted state', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  const stale = startOpenEndedTimer('stale', at(1, 9), 'UTC');
  await store.meditations.resetProgression(context(2));
  await assert.rejects(store.timer.save(stale), /predates the current progression reset/);
  assert.equal(await store.timer.load(), null); await store.close();
  conn = connection(filename); await conn.run('INSERT INTO meditation_timer VALUES (1, ?)', [JSON.stringify(stale)]); await conn.close();
  await assert.rejects(release(connection(filename), context(3)), /predates the current progression reset/);
});

test('Old immutable completion credit feedback is validated even after its generation was reset', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); await store.meditations.resetProgression(context(2)); await store.close();
  conn = connection(filename); conn.raw.exec('DROP TRIGGER journey_completions_immutable; UPDATE journey_completions SET credits_added=0'); await conn.close();
  await assert.rejects(release(connection(filename), context(3)), /disagrees with history/);
});

test('Old immutable completion level feedback is validated using its original generation after reset', async t => {
  const filename = disk(t); let conn = connection(filename), store = await release(conn, context(1));
  await practice(store, session()); await store.meditations.resetProgression(context(2)); await store.close();
  conn = connection(filename); conn.raw.exec('DROP TRIGGER journey_completions_immutable; UPDATE journey_completions SET after_level=100'); await conn.close();
  await assert.rejects(release(connection(filename), context(3)), /historical requirements/);
});

test('V2 frozen qualifying occasion and subsequent V3 short occasion retain distinct formulas and daily weighting on reopen', async t => {
  const filename = disk(t); let store = await openStore(connection(filename), context(1), undefined, 'progression_v2');
  const old = session({ activeSeconds: 180 }); await practice(store, old);
  const captured = (await store.meditations.loadProgressionState()).awards;
  await store.meditations.changeRules('progression_v3', { timestamp: old.endedAt, localDate: old.localDate, timeZone: old.timeZone });
  const short = session({ id: 'v3-extension', startedAt: old.endedAt + 10000, activeSeconds: 20 });
  const result = await practice(store, short);
  assert.equal(result.completion.awardedXpCenti, 377); // 503 centi-Ripples, second occasion at 75%.
  let state = await store.meditations.loadProgressionState();
  assert.equal(state.occasions.length, 2); assert.deepEqual(state.awards.slice(0, 1), captured);
  assert.equal(state.awards[0].rulesVersion, 'progression_v2'); assert.equal(state.awards[1].rulesVersion, 'progression_v3');
  await store.close(); store = await release(connection(filename), context(2)); state = await store.meditations.loadProgressionState();
  assert.equal(state.lifetimeXpCenti, 4903); assert.equal(store.initialJourney.metrics.credits, 1);
  assert.deepEqual(state.awards.slice(0, 1), captured); await store.close();
});

test('A qualifying V3 session may extend a frozen V2 occasion without altering its original receipt', async t => {
  const filename = disk(t); let store = await openStore(connection(filename), context(1), undefined, 'progression_v2');
  const old = session({ activeSeconds: 180 }); await practice(store, old);
  const captured = (await store.meditations.loadProgressionState()).awards[0];
  await store.meditations.changeRules('progression_v3', { timestamp: old.endedAt, localDate: old.localDate, timeZone: old.timeZone });
  await practice(store, session({ id: 'qual-extension', startedAt: old.endedAt + 10000, activeSeconds: 180 }));
  const state = await store.meditations.loadProgressionState();
  assert.equal(state.occasions.length, 1); assert.deepEqual(state.awards[0], captured);
  assert.equal(state.awards[1].rulesVersion, 'progression_v2'); assert.equal(state.lifetimeXpCenti, 6526);
  await store.close(); store = await release(connection(filename), context(2));
  assert.deepEqual((await store.meditations.loadProgressionState()).awards, state.awards); await store.close();
});

test('Reset removes old inactivity influence; later new-journey decay is applied once across repeated reopening', async t => {
  const filename = disk(t); let store = await release(connection(filename), context(1));
  await practice(store, session()); await store.meditations.resetProgression(context(2)); await store.close();
  store = await release(connection(filename), context(30)); assert.equal(store.initialSnapshot.currentProgressionCenti, 0);
  await practice(store, session({ day: 30 })); await store.close();
  store = await release(connection(filename), context(33)); assert.equal(store.initialSnapshot.currentProgressionCenti, 8000); await store.close();
  store = await release(connection(filename), context(34)); assert.equal(store.initialSnapshot.currentProgressionCenti, 7920);
  const expected = store.initialSnapshot; await store.close(); store = await release(connection(filename), context(34));
  assert.deepEqual(store.initialSnapshot, expected); assert.equal(store.initialSnapshot.lifetimeXpCenti, 8000);
  assert.equal((await store.meditations.getMeditationHistory()).length, 2); await store.close();
});

test('Backdated reset fails without archiving state or changing immutable history', async t => {
  const { conn, store, repo } = await fixture(t); await practice(store, session({ day: 2 }));
  const before = await repo.loadProgressionState(), raw = immutableRows(conn);
  await assert.rejects(repo.resetProgression(context(1)), /Cannot rewind/);
  assert.deepEqual(await repo.loadProgressionState(), before); assert.deepEqual(immutableRows(conn), raw);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_generations').get().n, 1);
});

test('Reset and post-boundary completion queued together persist in order without importing past practice credit', async t => {
  const { store, repo } = await fixture(t); await practice(store, session());
  const reset = repo.resetProgression(context(2));
  const s = session({ day: 2, activeSeconds: 180 }); const complete = repo.completePractice(s, s.endedAt);
  const [a, b] = await Promise.all([reset, complete]);
  assert.equal(a.snapshot.lifetimeXpCenti, 0); assert.equal(b.snapshot.lifetimeXpCenti, 4526);
  assert.equal(b.journey.metrics.credits, 1); assert.equal(b.completion.journey.beforeLevel, 0);
});

test('The existing explicit startup option can activate a registered future version from V1', async t => {
  const future = { ...api.PROGRESSION_V3, version: 'explicit_future_release' };
  const conn = connection(); const store = await openStore(conn, context(1), [future], future.version);
  t.after(() => store.close());
  assert.equal(store.initialSnapshot.rulesVersion, future.version);
  await practice(store, session({ activeSeconds: 20 }));
  assert.equal((await store.meditations.loadProgressionState()).awards[0].rulesVersion, future.version);
});

test('An older V2 startup policy cannot downgrade already-active V3 or alter its short-session receipt', async t => {
  const filename = disk(t); let store = await release(connection(filename), context(1));
  await practice(store, session({ activeSeconds: 20 })); const state = await store.meditations.loadProgressionState(); await store.close();
  store = await openStore(connection(filename), context(2), undefined, 'progression_v2');
  assert.equal(store.initialSnapshot.rulesVersion, 'progression_v3');
  assert.deepEqual((await store.meditations.loadProgressionState()).awards, state.awards); await store.close();
});
