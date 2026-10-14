// Runs the shipped pure domain, not an approximate copy of its reward equations.
const path = require('node:path'), fs = require('node:fs'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), build = path.join(root, '.expo', 'v5-simulation');
const compiled = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.domain-tests.json', '--outDir', build], { cwd: root, stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const api = require(path.join(build, 'progression/index.js'));
const DAY = 86_400_000, origin = Date.parse('2026-01-05T00:00:00Z');
const context = (day,hour=0) => ({ timestamp:origin+(day-1)*DAY+hour*3_600_000,
  localDate:new Date(origin+(day-1)*DAY).toISOString().slice(0,10), timeZone:'UTC' });
function simulate(name, duration, hours, skip=()=>false, days=500) {
  let state=api.createProgressionState(context(1),api.PROGRESSION_V5), habit=api.createHabitCheckpoint(state);
  const reached={}, checkpoints={}; let fullConsistencyDay=null;
  for(let day=1;day<=days;day++) {
    if(!skip(day)) for(const hour of hours) {
      const at=context(day,hour), session={id:`${name}-${day}-${hour}`,startedAt:at.timestamp,
        endedAt:at.timestamp+duration*1000,activeDurationSeconds:duration,pausedDurationSeconds:0,
        status:'completed',localDate:at.localDate,timeZone:'UTC'};
      const after=api.recordSession(state,session), reward=api.recordHabitReward(habit,state,after);
      state=after;habit=reward.checkpoint;
      for(const level of [1,5,25,50,75,100,125]) if(!reached[level]&&reward.journey.level.number>=level) reached[level]=day;
      if(fullConsistencyDay===null&&api.getProgressSnapshot(state,state.asOf).consistency.fraction===1)fullConsistencyDay=day;
    }
    if([1,3,7,30,60,180,365].includes(day)) checkpoints[day]={lifetimeCentiRipples:state.lifetimeXpCenti,
      level:api.habitJourney(habit,state).level.number,consistency:api.getProgressSnapshot(state,context(day,23)).consistency.fraction};
  }
  return {result:{name,days,fullConsistencyDay,reached,checkpoints,lifetimeCentiRipples:state.lifetimeXpCenti,
    qualifyingDates:api.practiceCredits(state.sessions.map(e=>e.session)).realDays}, state, habit};
}
const daily=simulate('ten_minutes_daily',600,[9]);
const scenarios=[daily.result,simulate('ten_minutes_twice_daily',600,[9,16]).result,
  simulate('ten_minutes_skipping_sundays',600,[9],day=>new Date(context(day).timestamp).getUTCDay()===0).result,
  simulate('three_minutes_daily',180,[9]).result,simulate('one_minute_daily',60,[9]).result,
  simulate('nearby_ten_plus_ten',600,[9,9.5]).result,simulate('thirty_minutes_daily',1800,[9]).result];
const trained=simulate('sixty_days_then_break',600,[9],()=>false,60), breaks={};
for(const inactive of [1,3,4,14,365]) {
  const at=context(61+inactive), later=api.advanceProgression(trained.state,at), habit=api.advanceHabit(trained.habit,later,at);
  breaks[inactive]={lifetimeCentiRipples:later.lifetimeXpCenti,effectiveCentiRipples:habit.effectiveXpCenti,
    currentLevel:api.habitJourney(habit,later).level.number,highestLevel:habit.highestLevel,
    protectedLevel:api.protectedHabitLevel(habit.highestLevel),consistency:api.getProgressSnapshot(later,at).consistency.fraction};
}
const result={rulesVersion:api.PROGRESSION_V5.version,context:'Deterministic UTC calendar; completed active time; no legacy migration seed',
  scenarios,afterSixtyDailyPractices:{breaks},precision:'integer centi-Ripples; Consistency 60,000,000 units'};
if(process.argv.includes('--write')) {
  const destination=path.join(root,'docs','evidence','progression-v5');fs.mkdirSync(destination,{recursive:true});
  fs.writeFileSync(path.join(destination,'simulations.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify(result,null,2));
