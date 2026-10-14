const { test } = require('node:test');
const { assert, api, connection, openStore, context, session, disk, save, at, domain } = require('./helpers.cjs');
const release = (conn, asOf) => openStore(conn,asOf,undefined,'progression_v2');
async function fixture(t) { const conn=connection(); const store=await release(conn,context(1)); t.after(()=>store.close()); return {conn,store}; }

test('Release explicitly activates V2; three-minute session persists receipt and permanent journey',async t=>{
  const {store}=await fixture(t);
  assert.equal(store.initialSnapshot.rulesVersion,'progression_v2');
  const s=session({minutes:3}); const result=await store.meditations.completePractice(s,s.endedAt);
  assert.equal(result.snapshot.lifetimeXpCenti,4526);
  assert.equal(result.completion.journey.creditsAdded,1);
  assert.equal(result.journey.metrics.realDays,1);
  assert.equal(result.journey.level.number,0); assert.equal(result.journey.fraction,4526/12000);
  const state=await store.meditations.loadProgressionState();
  assert.equal(state.awards[0].rulesVersion,'progression_v2');
});
test('Ordinary/double/capped feedback is immutable across duplicate saves and navigation',async t=>{
  const {conn,store}=await fixture(t);
  const a=session({hour:7,minutes:3});
  const b=session({id:'b',startedAt:a.endedAt+6*3600000,minutes:3});
  const c=session({hour:22,minutes:3});
  const first=await store.meditations.completePractice(a,a.endedAt);
  const second=await store.meditations.completePractice(b,b.endedAt);
  assert.equal(first.completion.journey.creditsAdded,1);
  assert.equal(second.completion.journey.creditsAdded,1); assert.equal(second.completion.journey.dateCredits,2);
  await store.meditations.completePractice(c,c.endedAt);
  const retry=await store.meditations.completePractice(b,c.endedAt);
  assert.deepEqual(retry.completion.journey,second.completion.journey);
  assert.equal(retry.journey.metrics.credits,2); assert.equal(retry.journey.metrics.realDays,1);
  assert.equal((await store.meditations.getPendingCompletion()).journey.creditsAdded,0);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM journey_completions').get().n,3);
  assert.throws(()=>conn.raw.exec('UPDATE journey_completions SET credits_added=2'),/immutable/);
});
for(const target of ['INSERT INTO journey_completions','INSERT INTO journey_checkpoint','DELETE FROM meditation_timer','COMMIT']) {
  test(`Failure at ${target} rolls back session, receipt, level and credit feedback`,async t=>{
    const {conn,store}=await fixture(t); const s=session({minutes:60});
    conn.failOnce(sql=>sql.startsWith(target));
    await assert.rejects(store.meditations.completePractice(s,s.endedAt),/Simulated/);
    assert.equal((await store.meditations.loadProgressionState()).sessions.length,0);
    assert.equal(conn.raw.prepare('SELECT level FROM journey_checkpoint').get().level,0);
    assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM journey_completions').get().n,0);
    assert.equal((await store.meditations.completePractice(s,s.endedAt)).completion.journey.creditsAdded,1);
  });
}
test('Actual V3 upgrade backfills credits only, retaining old XP/qualification/achievement/preferences/summary',async t=>{
  const {writeLegacyFixture,data}=require('./helpers.cjs');
  const file=disk(t); let conn=connection(file);
  const before=api.recordSession(api.recordSession(api.createProgressionState(context(1)),session({minutes:3})),session({day:2,minutes:10}));
  const prefs=data('preferences.js').DEFAULT_PREFERENCES;
  await writeLegacyFixture(conn,3,before,prefs); await conn.close(); conn=connection(file); let store=await release(conn,context(3));
  const after=await store.meditations.loadProgressionState();
  assert.deepEqual(after.awards,before.awards); assert.deepEqual(after.sessions,before.sessions);
  assert.deepEqual(after.highestRankAchieved,before.highestRankAchieved);
  assert.deepEqual(await store.settings.loadPreferences(),prefs);
  assert.equal(store.initialJourney.metrics.credits,2); assert.equal(store.initialCompletion.journey,null);
  assert.equal(store.initialSnapshot.consistency.precedingActiveDays,2);
  const s=session({day:3,minutes:3}); const result=await store.meditations.completePractice(s,s.endedAt);
  assert.equal(result.snapshot.consistency.precedingActiveDays,2);
  await store.close(); store=await release(connection(file),context(3,12));
  assert.equal(store.initialJourney.metrics.credits,3); await store.close();
});
test('Reopening, decay, dismissal and finished recovery preserve permanent progress exactly',async t=>{
  const { startOpenEndedTimer, finishTimer }=domain('meditation/timer.js');
  const file=disk(t); let store=await release(connection(file),context(1));
  const cursor=finishTimer(startOpenEndedTimer('recovery',at(1,7),'UTC'),at(1,7)+180000,'UTC');
  await store.timer.save(cursor); await store.application.dismissExplanation(at(1,8)); await store.close();
  store=await release(connection(file),context(2));
  assert.equal(store.initialCompletion.journey.creditsAdded,1); assert.equal(store.initialExplanationDismissed,true);
  const peak=store.initialJourney.level.number; await store.close();
  store=await release(connection(file),context(30));
  assert.equal(store.initialJourney.level.number,peak); assert.equal(store.initialJourney.metrics.credits,1);
  assert.ok(store.initialSnapshot.currentProgressionCenti<store.initialSnapshot.lifetimeXpCenti);
  const before=store.initialSnapshot; await store.close(); store=await release(connection(file),context(30));
  assert.deepEqual(store.initialSnapshot,before); assert.equal(store.initialCompletion.journey.creditsAdded,1); await store.close();
});
test('Bogus peak fails closed; cannot grant an unearned new maximum',async t=>{
  const {conn,store}=await fixture(t);
  const s=session({minutes:60}); await store.meditations.completePractice(s,s.endedAt);
  assert.throws(()=>conn.raw.exec('UPDATE journey_checkpoint SET level=0'),/cannot decrease|CHECK/);
  conn.raw.exec('UPDATE journey_checkpoint SET level=125');
  await assert.rejects(store.meditations.getCurrentPracticeProgress(context(2)),/requirements/);
});
test('Corrupt credit feedback is detected on reopen without rewriting history',async t=>{
  const file=disk(t); let conn=connection(file), store=await release(conn,context(1)); const s=session({minutes:3});
  await store.meditations.completePractice(s,s.endedAt); await store.close(); conn=connection(file);
  conn.raw.exec('DROP TRIGGER journey_completions_immutable; UPDATE journey_completions SET credits_added=0'); await conn.close();
  await assert.rejects(release(connection(file),context(2)),/disagrees with history/);
});
test('The V1-to-V2 release upgrade cannot downgrade an explicitly registered future version',async t=>{
  const future={...api.PROGRESSION_V2,version:'test_progression_v3'};
  const file=disk(t); let store=await openStore(connection(file),context(1),[future],'progression_v2');
  const s=session({minutes:3}); await store.meditations.completePractice(s,s.endedAt);
  const old=(await store.meditations.loadProgressionState()).awards;
  await store.meditations.changeRules(future.version,context(2)); await store.close();
  store=await openStore(connection(file),context(3),[future],'progression_v2');
  assert.equal(store.initialSnapshot.rulesVersion,future.version);
  assert.deepEqual((await store.meditations.loadProgressionState()).awards,old); await store.close();
});

test('A structurally valid but unearned completion milestone is rejected on reopen',async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));const s=session({minutes:3});
  await store.meditations.completePractice(s,s.endedAt);await store.close();conn=connection(file);
  conn.raw.exec('DROP TRIGGER journey_completions_immutable; UPDATE journey_completions SET after_level=100');await conn.close();
  await assert.rejects(release(connection(file),context(2)),/historical requirements/);
});
test('Already-finished V1 three-minute cursor recovers without retroactive XP when the release activates V2',async t=>{
  const {startOpenEndedTimer,finishTimer}=domain('meditation/timer.js');
  const file=disk(t);let store=await openStore(connection(file),context(1));
  await store.timer.save(finishTimer(startOpenEndedTimer('old-finish',at(1,9),'UTC'),at(1,9)+180000,'UTC'));
  await store.close();store=await release(connection(file),context(2));
  const state=await store.meditations.loadProgressionState();
  assert.equal(state.sessions[0].qualificationRulesVersion,'progression_v1');
  assert.equal(state.awards.length,0); assert.equal(state.lifetimeXpCenti,0);
  assert.equal(store.initialJourney.metrics.credits,1);assert.equal(store.initialSnapshot.consistency.precedingActiveDays,1);
  await store.close();
});
test('Travel retains captured local date/zone; two different zones sharing one date still obey its credit cap',async t=>{
  const file=disk(t);let store=await release(connection(file),context(1));
  const a=session({hour:18,minutes:3,localDate:'2026-01-06',timeZone:'Asia/Tokyo'});
  await store.meditations.completePractice(a,a.endedAt);await store.close();
  store=await release(connection(file),{...context(2,9),timeZone:'Europe/Madrid'});
  assert.equal((await store.meditations.getMeditationHistory())[0].session.timeZone,'Asia/Tokyo');
  assert.equal((await store.meditations.getMeditationHistory())[0].session.localDate,'2026-01-06');
  const b=session({day:2,hour:10,minutes:3,localDate:'2026-01-06',timeZone:'Europe/Madrid'});
  const result=await store.meditations.completePractice(b,b.endedAt);
  assert.equal(result.journey.metrics.realDays,1);assert.equal(result.journey.metrics.credits,2);
  await store.close();
});
test('Missing current-schema journey checkpoint fails closed instead of rebuilding a peak',async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));await store.close();
  conn=connection(file);conn.raw.exec('DROP TRIGGER journey_checkpoint_no_delete; DELETE FROM journey_checkpoint');await conn.close();
  await assert.rejects(release(connection(file),context(2)),/checkpoint is missing/);
});
