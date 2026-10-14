const { test } = require('node:test');
const { assert, data, domain, session, context } = require('./helpers.cjs');
const api = domain('progression/index.js');
const { rewardSteps, canAnimateReward, playRewardSteps, REWARD_MOTION } = data('../ui/reward-sequence.js');

function award(before, checkpoint, practice) {
  const after = api.recordSession(before, practice);
  return { after, ...api.recordHabitReward(checkpoint, before, after) };
}
function first(minutes = 3) {
  const before = api.createProgressionState(context(1), api.PROGRESSION_V5);
  return award(before, api.createHabitCheckpoint(before), session({ minutes }));
}
test('V5 animation uses immutable base, Consistency and bonus endpoints from the real reward', () => {
  const { receipt, journey } = first(), original = JSON.stringify(receipt), steps = rewardSteps(receipt);
  assert.deepEqual(steps.map(step => step.stage), ['base','consistency','bonus']);
  assert.equal(steps[1].from, 0); assert.equal(steps[1].to, 1/60);
  assert.equal(steps[2].to, journey.fraction);
  assert.equal(receipt.totalCentiXp, 4556);
  assert.equal(canAnimateReward(receipt, journey, receipt.consistencyAfter, 1/60, 1/60), true);
  assert.equal(JSON.stringify(receipt), original);
});
test('Decayed, migrated or mismatched final projections settle instead of replaying an incompatible reward', () => {
  const { receipt, journey } = first(), c = receipt.consistencyAfter;
  const valid = (r=receipt,j=journey,consistency=c,indicator=c,after=c) => canAnimateReward(r,j,consistency,indicator,after);
  assert.equal(valid(null),false);
  assert.equal(valid(receipt,{...journey,version:'future_journey'}),false);
  assert.equal(valid(receipt,{...journey,fraction:journey.fraction+.01}),false);
  assert.equal(valid(receipt,{...journey,level:{...journey.level,number:1}}),false);
  assert.equal(valid(receipt,journey,c/2),false);
  assert.equal(valid(receipt,journey,c,c/2),false);
  assert.equal(valid({...receipt,bonusProgress:{...receipt.bonusProgress,segments:[]}}),false);
  assert.equal(valid({...receipt,bonusProgress:{...receipt.bonusProgress,segments:[{...receipt.bonusProgress.segments.at(-1),level:1}]}}),false);
});
test('A legitimate accumulated-short-practice crossing keeps every level within a restrained stage budget', () => {
  let state = api.createProgressionState(context(1),api.PROGRESSION_V5), checkpoint = api.createHabitCheckpoint(state);
  for(let day=1;day<=100;day++) {
    const result = award(state,checkpoint,session({day,minutes:1}));
    state=result.after;checkpoint=result.checkpoint;
  }
  const {receipt,journey} = award(state,checkpoint,session({day:101,minutes:3})), original = JSON.stringify(receipt);
  assert.ok(receipt.baseProgress.segments.length>2);
  const steps=rewardSteps(receipt);
  for(const stage of ['base','bonus']) {
    const group=steps.filter(step=>step.stage===stage), source=stage==='base'?receipt.baseProgress:receipt.bonusProgress;
    assert.deepEqual(group.map(({level,from,to})=>({level,from,to})),source.segments);
    assert.ok(group.reduce((sum,step)=>sum+step.duration+2*step.crossingDuration,0)<=REWARD_MOTION.stageBudgetMilliseconds);
    assert.ok(group.every(step=>Number.isInteger(step.duration)&&step.duration>=0&&Number.isInteger(step.crossingDuration)&&step.crossingDuration>=0));
  }
  assert.equal(steps.at(-1).to,journey.fraction);assert.equal(JSON.stringify(receipt),original);
});
test('Zero-reward callbacks finish once and duplicate delivery cannot create another stage or reward', () => {
  const {receipt}=first(0), original=JSON.stringify(receipt),seen=[];let done=0;
  playRewardSteps(rewardSteps(receipt),(step,complete)=>{
    assert.equal(step.duration,0);seen.push(step.stage);complete();complete();
  },()=>done++);
  assert.deepEqual(seen,['base','consistency','bonus']);assert.equal(done,1);
  assert.equal(JSON.stringify(receipt),original);
});
for(const stage of ['base','consistency','bonus']) test(`Cancellation in ${stage} rejects delayed and repeated completions`,()=>{
  const {receipt}=first(), steps=rewardSteps(receipt), seen=[], callbacks=[];let done=0;
  const cancel=playRewardSteps(steps,(step,next)=>{seen.push(step.stage);callbacks.push(next);},()=>done++);
  const position=steps.findIndex(step=>step.stage===stage);
  for(let i=0;i<position;i++)callbacks[i]();
  const stale=callbacks[position];cancel();stale();stale();
  assert.equal(seen.length,position+1);assert.equal(done,0);assert.equal(receipt.totalCentiXp,4556);
});
