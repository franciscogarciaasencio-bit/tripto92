const {test} = require('node:test');
const {assert, api, context, session, at, DAY} = require('./helpers.cjs');
const begin = () => api.createProgressionState(context(1), api.PROGRESSION_V4);
const score = (sessions, asOf = context(1,23.99)) => api.continuousConsistency(sessions, asOf);

test('First 3-minute practice grows Consistency from zero and earns distinct base plus new-consistency bonus', () => {
  const before = begin(), checkpoint = api.createHabitCheckpoint(before), s = session({minutes:3});
  const after = api.recordSession(before,s), result = api.recordHabitReward(checkpoint,before,after);
  assert.equal(after.lifetimeXpCenti,4798);
  assert.equal(result.receipt.baseCentiXp,4526); assert.equal(result.receipt.bonusCentiXp,272);
  assert.equal(result.receipt.consistencyBefore,0); assert.equal(result.receipt.consistencyAfter,.15);
  assert.equal(result.receipt.baseProgress.segments[0].to,4526/12000);
  assert.equal(result.receipt.bonusProgress.segments[0].from,4526/12000);
  assert.equal(result.receipt.bonusProgress.segments[0].to,4798/12000);
  assert.equal(api.getProgressSnapshot(after,after.asOf).consistency.multiplier,1.06);
});
for (const seconds of [0,1,20,179,180]) test(`${seconds} active seconds respects qualification with paused time excluded`, () => {
  const s = session({activeSeconds:seconds,pausedSeconds:6000}), state = api.recordSession(begin(),s);
  assert.equal(score([s]).score,seconds>=180?150000:0);
  assert.equal(state.sessions[0].qualified, seconds>=180);
});

test('Six-hour equality qualifies; one millisecond below does not; third session cannot add a third increase', () => {
  const a=session({hour:7,minutes:3});
  for (const [gap,expected] of [[6*3600000-1,150000],[6*3600000,277500]]) {
    const b=session({id:'second',startedAt:a.endedAt+gap,minutes:3});
    const c=session({id:'third',startedAt:at(1,23),minutes:3});
    assert.equal(score([a,b]).score,expected); assert.equal(score([a,b,c]).score,277500);
  }
});

test('Four complete inactive dates halve Consistency; one incomplete date is not decayed prematurely', () => {
  const s=session({minutes:3});
  assert.equal(score([s],context(2)).score,150000);
  assert.ok(Math.abs(score([s],context(6)).score-75000)<=2);
  assert.equal(score([s],context(6)).score,score([s],context(6)).score);
  const short=session({day:3,activeSeconds:20});
  assert.equal(score([s,short],context(6)).score,score([s],context(6)).score);
});

test('Regular and double practice grow smoothly toward the 40% maximum, retaining one date per double', () => {
  let state=begin();
  for(let day=1;day<=100;day++) for(const hour of [7,15]) state=api.recordSession(state,session({day,hour,minutes:3}));
  const snapshot=api.getProgressSnapshot(state,state.asOf);
  assert.ok(snapshot.consistency.multiplier<=1.4 && snapshot.consistency.multiplier>1.3999);
  assert.equal(api.practiceCredits(state.sessions.map(e=>e.session)).realDays,100);
  assert.equal(api.practiceCredits(state.sessions.map(e=>e.session)).credits,200);
});

test('Nearby extensions award only incremental base plus its bonus; lifetime receipts never drift or duplicate', () => {
  let state=begin(); const a=session(), b=session({id:'nearby',startedAt:a.endedAt+20*60000});
  state=api.recordSession(state,a); assert.equal(state.lifetimeXpCenti,8480);
  state=api.recordSession(state,b); assert.equal(state.occasions.length,1);
  assert.equal(state.awards[1].breakdown.incrementalBaseCentiXp,2000); assert.equal(state.awards[1].breakdown.bonusCentiXp,120);
  assert.equal(state.lifetimeXpCenti,10600); assert.equal(api.recordSession(state,b).lifetimeXpCenti,10600);
});

test('Daily weights and capped sessions stay unchanged while consistency remains independently eligible', () => {
  let state=begin(); for(const hour of [1,4,7,14,22]) state=api.recordSession(state,session({hour,minutes:3}));
  assert.deepEqual(state.awards.map(a=>a.breakdown.incrementalBaseCentiXp),[4526,3395,1132,0,0]);
  assert.equal(state.awards[3].xpCenti,0); assert.equal(score(state.sessions.map(e=>e.session)).score,277500);
});

test('V4 release cannot rewrite a V3 receipt or top up its old consistency; the new version consumes the next frequency slot', () => {
  const old=session(); let state=api.recordSession(api.createProgressionState(context(1),api.PROGRESSION_V3),old);
  const receipt=state.awards[0]; state=api.changeProgressionRules(state,api.PROGRESSION_V4,state.asOf);
  state=api.recordSession(state,session({id:'v4',startedAt:old.endedAt+1000,minutes:3}));
  assert.deepEqual(state.awards[0],receipt); assert.equal(state.occasions.length,2);
  assert.equal(state.awards[1].rulesVersion,'progression_v4'); assert.equal(state.awards[1].breakdown.weightBasisPoints,7500);
});

test('Three complete inactive days protect level progress, fourth complete date applies the first loss', () => {
  let state=begin(); for(let day=1;day<=35;day++) state=api.recordSession(state,session({day}));
  const checkpoint=api.createHabitCheckpoint(state), end=checkpoint.effectiveXpCenti;
  for(const day of [36,37,38,39]) assert.equal(api.advanceHabit(checkpoint,state,context(day)).effectiveXpCenti,end);
  assert.ok(api.advanceHabit(checkpoint,state,context(40)).effectiveXpCenti<end);
});

for(const level of [1,2,20,21,100,125]) test(`Level ${level} protects its rounded-up half and approaches it after a year`, () => {
  let state=begin(); for(let day=1;day<=366;day++) state=api.recordSession(state,session({day}));
  const effective=api.HABIT_LEVELS[level-1].xpCenti+1000;
  const checkpoint={...api.createHabitCheckpoint(state,level),effectiveXpCenti:effective,highestLevel:level};
  const after=api.advanceHabit(checkpoint,state,context(732));
  const floorLevel=Math.ceil(level/2), floor=api.HABIT_LEVELS[floorLevel-1].xpCenti;
  assert.equal(after.highestLevel,level); assert.ok(after.effectiveXpCenti>=floor);
  assert.ok(after.effectiveXpCenti-floor<Math.max(50,(effective-floor)*.002));
  assert.equal(api.habitJourney(after,state).level.number,floorLevel);
  const again=api.advanceHabit(after,state,context(732)); assert.deepEqual(again,after);
});

test('Travel and midnight keep captured dates and exact elapsed double-session separation', () => {
  const a=session({startedAt:at(1,23.98),minutes:3,timeZone:'Asia/Tokyo'});
  const b=session({id:'midnight',startedAt:a.endedAt+1000,minutes:3,timeZone:'Europe/Madrid'});
  assert.equal(a.localDate,b.localDate); assert.equal(score([a,b],context(2,23)).score,150000);
  assert.equal(score([a],{...context(2,23),timeZone:'America/New_York'}).score,score([a],context(2,23)).score);
  assert.throws(()=>api.continuousConsistency([a],context(1)),/future/);
});

test('Backward travel cannot restore settled Consistency; a returning practice anchors its increase at the logical current date', () => {
  let state=api.recordSession(begin(),session({minutes:3}));state=api.advanceProgression(state,context(6));
  const before=api.getProgressSnapshot(state,state.asOf).consistency.multiplier;
  const travel={timestamp:state.asOf.timestamp+1,localDate:context(5).localDate,timeZone:'Pacific/Honolulu'};
  state=api.advanceProgression(state,travel);assert.equal(api.getProgressSnapshot(state,travel).consistency.multiplier,before);
  const returning=session({id:'travel-return',startedAt:travel.timestamp+1000,minutes:3,localDate:travel.localDate,timeZone:travel.timeZone});
  state=api.recordSession(state,returning);const after=api.getProgressSnapshot(state,state.asOf).consistency.multiplier;
  assert.ok(after>before);assert.equal(state.awards.at(-1).breakdown.continuousConsistencyDate,context(6).localDate);
  assert.equal(state.sessions.at(-1).session.localDate,context(5).localDate);
  assert.equal(api.getProgressSnapshot(state,context(7)).consistency.multiplier,after);
});

test('Bonus-only threshold crossing has a precise seam between both level animations', () => {
  const before=begin(), checkpoint=api.createHabitCheckpoint(before), one=api.recordSession(before,session({minutes:7}));
  const first=api.recordHabitReward(checkpoint,before,one), two=api.recordSession(one,session({day:2,minutes:3}));
  const result=api.recordHabitReward(first.checkpoint,one,two),receipt=result.receipt;
  assert.equal(receipt.baseProgress.beforeLevel,0);assert.equal(receipt.baseProgress.afterLevel,0);
  assert.equal(receipt.bonusProgress.beforeLevel,0);assert.equal(receipt.bonusProgress.afterLevel,1);
  assert.equal(receipt.baseProgress.segments.at(-1).to,receipt.bonusProgress.segments[0].from);
  assert.equal(receipt.bonusProgress.segments[0].to,1);
  assert.equal(receipt.bonusProgress.segments.at(-1).to,result.journey.fraction);
});

test('Short practice never restarts the effective-progress grace period, even before the first qualifying meditation', () => {
  const before=begin(), initial=api.createHabitCheckpoint(before), first=api.recordSession(before,session({activeSeconds:20}));
  const saved=api.recordHabitReward(initial,before,first);
  const idle=api.advanceHabit(saved.checkpoint,first,context(6));
  assert.ok(idle.effectiveXpCenti<503);assert.equal(idle.highestLevel,0);
  const next=api.recordSession(api.advanceProgression(first,context(6)),session({day:6,activeSeconds:20}));
  const returning=api.recordHabitReward(idle,first,next);
  assert.equal(returning.checkpoint.effectiveXpCenti,idle.effectiveXpCenti+503);
  assert.equal(returning.receipt.consistencyAfter,0);
});

test('Current habit thresholds resolve all 125 boundaries and keep the first qualification and final year gates', () => {
  const metrics={lifetimeXpCenti:0,credits:365,realDays:365,firstPracticeAt:at(1),asOf:at(367)};
  const project=effectiveXpCenti=>api.getLifetimeJourney({...metrics,effectiveXpCenti},null,{version:api.HABIT_JOURNEY_VERSION});
  for(const level of api.HABIT_LEVELS){
    assert.equal(project(level.xpCenti).level.number,level.number);
    assert.equal(project(level.xpCenti-1).level.number,level.number-1);
  }
  const short=api.recordSession(begin(),session({activeSeconds:20}));
  const result=api.recordHabitReward(api.createHabitCheckpoint(begin()),begin(),short);
  assert.equal(result.journey.level.number,0);assert.equal(result.journey.fraction,503/12000);
  assert.ok(result.receipt.baseProgress.segments[0].to>0);
  assert.equal(api.getLifetimeJourney({...metrics,effectiveXpCenti:5_000_000,realDays:364},null,{version:api.HABIT_JOURNEY_VERSION}).level.number,124);
  assert.equal(api.getLifetimeJourney({...metrics,effectiveXpCenti:5_000_000,asOf:at(365)},null,{version:api.HABIT_JOURNEY_VERSION}).level.number,124);
});

test('Daily ten-minute practice reaches the habit milestone at 265 dates and maximum at 368 dates', () => {
  let state=begin(),checkpoint=api.createHabitCheckpoint(state),milestone=0,maximum=0;
  for(let day=1;day<=368;day++){
    const after=api.recordSession(state,session({day})),result=api.recordHabitReward(checkpoint,state,after);
    state=after;checkpoint=result.checkpoint;
    if(!milestone&&result.journey.level.number>=100)milestone=day;
    if(!maximum&&result.journey.level.number===125)maximum=day;
  }
  assert.equal(milestone,265);assert.equal(maximum,368);
  assert.equal(state.lifetimeXpCenti,4103466);
  assert.equal(checkpoint.highestLevel,125);
});
