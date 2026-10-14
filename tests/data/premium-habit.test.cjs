const {test}=require('node:test');
const {assert,api,data,connection,openStore,context,session,disk,at,domain}=require('./helpers.cjs');
const release=(conn,asOf)=>openStore(conn,asOf,undefined,'progression_v4');
const practice=(store,s)=>store.meditations.completePractice(s,s.endedAt);

test('V4 award, habit checkpoint and exact three-stage receipt save atomically, survive retry and disk reopening',async t=>{
  const file=disk(t); let conn=connection(file),store=await release(conn,context(1));
  const s=session({minutes:3}),saved=await practice(store,s);
  assert.equal(saved.snapshot.lifetimeXpCenti,4798); assert.equal(saved.habit.highestLevel,0);
  assert.equal(saved.completion.habitReward.consistencyAfter,.15);
  assert.equal(saved.completion.habitReward.baseCentiXp,4526);
  const same=await practice(store,s); assert.deepEqual(same.completion,saved.completion);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM progression_awards').get().n,1);
  await store.close();store=await release(connection(file),context(2));
  assert.deepEqual(store.initialCompletion.habitReward,saved.completion.habitReward);
  assert.equal(store.initialHabit.effectiveXpCenti,4798); assert.equal(store.initialSnapshot.consistency.multiplier,1.06);await store.close();
});
for(const failure of ['INSERT INTO habit_reward_receipts','INSERT INTO habit_checkpoints','COMMIT']) test(`Failure at ${failure} rolls back every part of the meditation save`,async t=>{
  const conn=connection(),store=await release(conn,context(1));t.after(()=>store.close());const s=session({minutes:3});
  conn.failOnce(sql=>sql.startsWith(failure));await assert.rejects(practice(store,s),/Simulated/);
  assert.equal((await store.meditations.loadProgressionState()).sessions.length,0);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM habit_reward_receipts').get().n,0);
  const state=JSON.parse(conn.raw.prepare('SELECT checkpoint_json FROM habit_checkpoints').get().checkpoint_json);
  assert.equal(state.effectiveXpCenti,0);assert.equal(state.sessionCount,0);
  assert.equal((await practice(store,s)).completion.habitReward.totalCentiXp,4798);
});

test('Second too-close/short/capped explanations never promise a third increase or pool qualification',async t=>{
  const store=await release(connection(),context(1));t.after(()=>store.close());const a=session({hour:7,minutes:3});await practice(store,a);
  const short=await practice(store,session({id:'short',startedAt:a.endedAt+1000,activeSeconds:20}));
  assert.equal(short.completion.habitReward.explanation,'short');assert.equal(short.completion.habitReward.consistencyAfter,.15);
  const close=await practice(store,session({hour:10,minutes:3}));assert.equal(close.completion.habitReward.explanation,'too_close');
  const b=session({id:'second',startedAt:a.endedAt+6*3600000,minutes:3}),double=await practice(store,b);
  assert.equal(double.completion.habitReward.consistencyAfter,.2775);assert.equal(double.completion.habitReward.explanation,null);
  const capped=await practice(store,session({hour:22,minutes:3}));assert.equal(capped.completion.habitReward.explanation,'daily_cap');
  assert.equal(capped.completion.habitReward.consistencyAfter,.2775);
});

test('Later reopening applies decay once, lowers current level but preserves highest and lifetime; return has no debt',async t=>{
  const file=disk(t);let store=await release(connection(file),context(1));
  for(let day=1;day<=50;day++)await practice(store,session({day}));
  const before=await store.meditations.getCurrentPracticeProgress(context(51));await store.close();
  store=await release(connection(file),context(417));const once=store.initialHabit;
  assert.equal(once.highestLevel,before.habit.highestLevel);assert.equal(store.initialJourney.level.number,Math.ceil(once.highestLevel/2));
  assert.equal(store.initialSnapshot.lifetimeXpCenti,before.snapshot.lifetimeXpCenti);await store.close();
  store=await release(connection(file),context(417));assert.deepEqual(store.initialHabit,once);
  const result=await practice(store,session({day:417}));assert.ok(result.snapshot.lifetimeXpCenti>before.snapshot.lifetimeXpCenti);
  assert.ok(result.habit.effectiveXpCenti>once.effectiveXpCenti);await store.close();
});

test('All-data reset removes new checkpoint/receipts and cannot recover consistency or highest after restart',async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));await practice(store,session());
  await store.meditations.resetAllPracticeData(context(2));
  assert.equal(conn.raw.prepare('SELECT COUNT(*) n FROM habit_reward_receipts').get().n,0);
  await store.close();store=await release(connection(file),context(3));assert.equal(store.initialHabit.highestLevel,0);
  assert.equal(store.initialSnapshot.lifetimeXpCenti,0);assert.equal(store.initialSnapshot.consistency.multiplier,1);await store.close();
});

test('Activation after V3 pending completion preserves its receipt and starts new earnings prospectively',async t=>{
  const file=disk(t);let store=await openStore(connection(file),context(1),undefined,'progression_v3');
  const draft=domain('meditation/timer.js').finishTimer(domain('meditation/timer.js').startOpenEndedTimer('old',at(1,9),'UTC'),at(1,9)+180000,'UTC');
  await store.timer.save(draft);await store.close();store=await release(connection(file),context(2));
  assert.equal(store.initialCompletion.awardedXpCenti,4526);assert.equal(store.initialCompletion.habitReward,null);
  assert.equal(store.initialSnapshot.rulesVersion,'progression_v4');const s=session({day:2,minutes:3});
  const next=await practice(store,s);assert.equal(next.completion.habitReward.baseCentiXp,4526);await store.close();
});

for(const change of [row=>{row.effectiveXpCenti+=1;},row=>{row.highestLevel=125;},row=>{row.sessionCount=0;}]) test('Corrupt habit continuation fails explicitly, rather than resetting or replaying earnings',async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));await practice(store,session());await store.close();conn=connection(file);
  const row=JSON.parse(conn.raw.prepare('SELECT checkpoint_json FROM habit_checkpoints').get().checkpoint_json);change(row);
  conn.raw.prepare('UPDATE habit_checkpoints SET checkpoint_json=?').run(JSON.stringify(row));await conn.close();
  await assert.rejects(release(connection(file),context(2)),/habit|Habit/);
});

test('Controller uses actual completion callbacks in base → consistency → bonus order and ignores duplicate delivery',()=>{
  const {rewardSteps,playRewardSteps}=data('../ui/reward-sequence.js');
  const state=api.createProgressionState(context(1),api.PROGRESSION_V4),after=api.recordSession(state,session({minutes:3}));
  const receipt=api.recordHabitReward(api.createHabitCheckpoint(state),state,after).receipt,steps=rewardSteps(receipt),seen=[],callbacks=[];let done=0;
  playRewardSteps(steps,(step,next)=>{seen.push(step.stage);callbacks.push(next);},()=>done++);
  assert.deepEqual(seen,['base']);callbacks[0]();callbacks[0]();assert.deepEqual(seen,['base','consistency']);
  callbacks[1]();assert.deepEqual(seen,['base','consistency','bonus']);callbacks[2]();assert.equal(done,1);
});
for(const interruptAfter of [0,1,2])test(`Interrupting reward animation in stage ${interruptAfter+1} stops future callbacks without touching rewards`,()=>{
  const {rewardSteps,playRewardSteps}=data('../ui/reward-sequence.js');
  const before=api.createProgressionState(context(1),api.PROGRESSION_V4),after=api.recordSession(before,session());
  const receipt=api.recordHabitReward(api.createHabitCheckpoint(before),before,after).receipt,callbacks=[],seen=[];
  const cancel=playRewardSteps(rewardSteps(receipt),(step,next)=>{seen.push(step.stage);callbacks.push(next);},()=>seen.push('done'));
  for(let i=0;i<interruptAfter;i++)callbacks[i]();cancel();callbacks[interruptAfter]();
  assert.equal(seen.length,interruptAfter+1);assert.equal(after.awards.length,1);assert.equal(after.lifetimeXpCenti,8480);
});

for(const missing of ['habit_checkpoints','habit_reward_receipts'])test(`Missing ${missing} fails safely on reopen`,async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));await practice(store,session());await store.close();conn=connection(file);
  if(missing==='habit_reward_receipts')conn.raw.exec('DROP TRIGGER habit_reward_receipts_immutable_delete');
  conn.raw.exec(`DELETE FROM ${missing}`);await conn.close();await assert.rejects(release(connection(file),context(2)),/habit|Habit/);
});

test('Stored stage metadata is immutable and corrupted breakdowns cannot invent a bonus or change a bar',async t=>{
  const file=disk(t);let conn=connection(file),store=await release(conn,context(1));await practice(store,session());await store.close();conn=connection(file);
  assert.throws(()=>conn.raw.exec("UPDATE habit_reward_receipts SET receipt_json='{}'"),/immutable/);
  conn.raw.exec('DROP TRIGGER habit_reward_receipts_immutable_update');const row=JSON.parse(conn.raw.prepare('SELECT receipt_json FROM habit_reward_receipts').get().receipt_json);
  row.bonusProgress.segments[0].from=.5;conn.raw.prepare('UPDATE habit_reward_receipts SET receipt_json=?').run(JSON.stringify(row));await conn.close();
  await assert.rejects(release(connection(file),context(2)),/Habit|habit/);
});

