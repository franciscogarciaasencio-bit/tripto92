const { test } = require('node:test');
const { assert, api, context, session, at, DAY, domain } = require('./helpers.cjs');
const credit = (sessions) => api.practiceCredits(sessions);
const metrics = (changes = {}) => ({ lifetimeXpCenti: 0, credits: 0, realDays: 0, firstPracticeAt: at(1), asOf: at(500), ...changes });

test('V2 extends eligibility without changing the duration reference or V1 receipts', () => {
  const duration = domain('progression/earnings.js').durationRewardCentiXp;
  for (const [minutes, xp] of [[3,4526],[5,6000],[10,8000],[20,10000],[30,11170]]) assert.equal(duration(minutes*60, api.PROGRESSION_V2), xp);
  let state = api.createProgressionState(context(1));
  state = api.recordSession(state, session({ minutes: 3 }));
  assert.equal(state.awards.length, 0);
  state = api.changeProgressionRules(state, api.PROGRESSION_V2, context(2));
  const next = api.recordSession(state, session({ day: 2, minutes: 3 }));
  assert.equal(next.awards.length, 1);
  assert.equal(next.awards[0].rulesVersion, 'progression_v2');
  assert.equal(next.awards[0].breakdown.precedingActiveDays, 1); // Reliable old 3-minute day now informs future consistency only.
  assert.equal(next.sessions[0].qualified, false);
});
test('2:59 fails, 3:00 qualifies, and six hours paused is still one session', () => {
  const short = session({ activeSeconds: 179, pausedSeconds: 22000 });
  const valid = session({ activeSeconds: 180, pausedSeconds: 22000 });
  assert.equal(credit([short]).credits, 0);
  assert.equal(credit([valid]).credits, 1);
  const state = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V2), short);
  assert.equal(state.awards.length, 0);
  assert.equal(api.getProgressSnapshot(state,state.asOf).totalQualifyingPracticeDays, 0);
});
test('Ten two-minute sessions under V2 cannot pool into XP, credits or consistency',()=>{
  let state=api.createProgressionState(context(1),api.PROGRESSION_V2);
  for(let i=0;i<10;i++) state=api.recordSession(state,session({id:`tiny-${i}`,startedAt:at(1,9)+i*180000,minutes:2}));
  assert.equal(state.sessions.length,10);assert.equal(state.awards.length,0);assert.equal(state.lifetimeXpCenti,0);
  assert.equal(api.getJourneyFromState(state).metrics.credits,0);
  assert.equal(api.getProgressSnapshot(state,context(2)).consistency.multiplier,1);
});
test('End-to-start six hours is inclusive, one second below fails', () => {
  const a = session({ hour: 7, minutes: 3 });
  for (const [gap, expected] of [[6*3600000-1000,1],[6*3600000,2]]) {
    const b = session({ id:'b', startedAt:a.endedAt+gap, minutes:3 });
    assert.equal(credit([a,b]).credits,expected);
  }
  assert.equal(credit([a,session({hour:13,minutes:3})]).credits,1); // Six hours START-to-start is insufficient.
});
test('Valid later pair, capped dates, duplicate IDs and separate dates', () => {
  const a = session({hour:7,minutes:3});
  const b = session({hour:8,minutes:3});
  const c = session({hour:15,minutes:3});
  const d = session({hour:23,minutes:3});
  assert.equal(credit([a,b,c,d,a]).credits,2);
  assert.equal(credit([a,b,c,d,a]).realDays,1);
  assert.equal(credit([a,session({hour:15,activeSeconds:179})]).credits,1);
  assert.equal(credit([a,session({day:2,hour:7,minutes:3})]).credits,2);
  assert.equal(credit([a,session({day:2,hour:7,minutes:3})]).realDays,2);
  assert.throws(()=>credit([a,{...a,activeDurationSeconds:179}]),/Conflicting/);
  assert.equal(credit([session({status:'ended_early'})]).credits,0);
});
test('Completion outcomes distinguish ordinary, double, capped, credited, short and early-ended practice',()=>{
  const s=session({minutes:3});
  assert.equal(api.practiceCreditOutcome(s,1,1),'ordinary');
  assert.equal(api.practiceCreditOutcome(s,1,2),'double_day');
  assert.equal(api.practiceCreditOutcome(s,0,2),'already_capped');
  assert.equal(api.practiceCreditOutcome(s,0,1),'already_credited');
  assert.equal(api.practiceCreditOutcome(session({activeSeconds:179}),0,0),'too_short');
  assert.equal(api.practiceCreditOutcome(session({status:'ended_early'}),0,0),'not_completed');
  assert.throws(()=>api.practiceCreditOutcome(s,0,0),/must have date credit/);
  assert.throws(()=>api.practiceCreditOutcome(s,2,2),/Invalid credit/);
  assert.throws(()=>api.practiceCreditOutcome(session({activeSeconds:179}),1,1),/ineligible/);
});
test('Frozen completion dates, midnight, travel and DST use absolute gaps', () => {
  const a=session({startedAt:Date.parse('2026-03-29T00:00:00Z'),minutes:3,localDate:'2026-03-29',timeZone:'Europe/Madrid'});
  const b=session({id:'dst',startedAt:a.endedAt+5*3600000,minutes:3,localDate:a.localDate,timeZone:a.timeZone});
  assert.equal(credit([a,b]).credits,1); // DST clock labels may show six; elapsed five does not.
  assert.equal(credit([a,{...b,startedAt:b.startedAt+3600000,endedAt:b.endedAt+3600000}]).credits,2);
  const midnight=session({startedAt:at(1,23.99),minutes:3});
  assert.equal(midnight.localDate,context(2).localDate);
  assert.equal(credit([midnight]).dates[0].localDate,midnight.localDate);
  const travel={...b,localDate:'2026-03-30',timeZone:'Asia/Tokyo'};
  assert.equal(credit([a,travel]).realDays,2);
});
test('V2 doubles give two credits but only one active consistency date; XP weights unchanged', () => {
  let state=api.createProgressionState(context(1),api.PROGRESSION_V2);
  state=api.recordSession(state,session({hour:7}));
  state=api.recordSession(state,session({hour:15}));
  assert.equal(state.lifetimeXpCenti,14000);
  const snap=api.getProgressSnapshot(state,context(2));
  assert.equal(snap.consistency.precedingActiveDays,1);
  assert.equal(credit(state.sessions.map(e=>e.session)).credits,2);
});
test('Exactly 25 stable categories and 125 nonlinear monotone level definitions', () => {
  assert.equal(api.JOURNEY_CATEGORIES.length,25);
  assert.equal(api.JOURNEY_LEVELS.length,125);
  assert.equal(new Set(api.JOURNEY_CATEGORIES.map(c=>c.id)).size,25);
  api.JOURNEY_LEVELS.forEach((l,i)=>{
    assert.equal(l.number,i+1); assert.equal(l.categoryStep,i%5+1);
    assert.equal(l.category.firstLevel,Math.floor(i/5)*5+1);
    if(i) { assert.ok(l.xpCenti>api.JOURNEY_LEVELS[i-1].xpCenti); assert.ok(l.credits>=api.JOURNEY_LEVELS[i-1].credits); assert.ok(l.realDays>=api.JOURNEY_LEVELS[i-1].realDays); }
  });
  assert.equal(api.JOURNEY_LEVELS[99].category.name,'Habit Established');
  assert.equal(api.JOURNEY_LEVELS[124].xpCenti,3000000);
});
for (const level of api.JOURNEY_LEVELS) {
  test(`Lifetime level ${level.number}: inclusive boundaries and each missing gate`,()=>{
    const m=metrics({lifetimeXpCenti:level.xpCenti,credits:level.credits,realDays:level.realDays});
    if(level.number===1) {
      // The released table still starts at zero; entering it now additionally needs real qualifying practice.
      assert.equal(api.getLifetimeJourney(m).level.number,0);
      const entered={...m,credits:1,realDays:1};
      assert.equal(api.getLifetimeJourney(entered).level.number,1);
      for(const key of ['credits','realDays']) {
        const below=api.getLifetimeJourney({...entered,[key]:0});
        assert.equal(below.level.number,0); assert.equal(below.fraction,0);
      }
      assert.equal(api.getLifetimeJourney({...entered,firstPracticeAt:null}).level.number,0);
      return;
    }
    assert.equal(api.getLifetimeJourney(m).level.number,level.number);
    for(const key of ['lifetimeXpCenti','credits','realDays']) {
      const below=api.getLifetimeJourney({...m,[key]:m[key]-1});
      assert.ok(below.level.number<level.number); assert.ok(below.fraction<1);
    }
  });
}
test('Maximum requires BOTH 365 real dates and elapsed days even with excessive credits/XP',()=>{
  const m=metrics({lifetimeXpCenti:10000000,credits:730,realDays:365,asOf:at(1)+365*DAY});
  assert.equal(api.getLifetimeJourney(m).level.number,125);
  assert.ok(api.getLifetimeJourney({...m,realDays:364}).level.number<125);
  assert.ok(api.getLifetimeJourney({...m,asOf:m.asOf-1}).level.number<125);
  assert.ok(api.getLifetimeJourney({...m,firstPracticeAt:null}).level.number<125);
});
test('First ten-minute practice advances the prelude; lifetime journey survives decay and a stored legitimate peak',()=>{
  let state=api.recordSession(api.createProgressionState(context(1),api.PROGRESSION_V2),session());
  const before=api.getJourneyFromState(state);
  assert.equal(before.level.number,0); assert.equal(before.fraction,8000/12000);
  state=api.advanceProgression(state,context(100));
  assert.ok(state.currentProgressionCenti<state.lifetimeXpCenti);
  assert.equal(api.getJourneyFromState(state).level.number,before.level.number);
  assert.equal(api.getLifetimeJourney(metrics(),{version:api.JOURNEY_VERSION,level:before.level.number,achievedAt:at(2)}).level.number,before.level.number);
  assert.throws(()=>api.getLifetimeJourney(metrics({credits:1.2})),/integer/);
  const malformed=metrics();delete malformed.realDays;
  assert.throws(()=>api.getLifetimeJourney(malformed),/integer/);
});
