// Run the actual versioned engine; no approximate earning model. Output is JSON for docs and regression tests.
const fs=require('node:fs'), path=require('node:path'), {spawnSync}=require('node:child_process');
const project=path.resolve(__dirname,'..'), build=path.join(project,'.expo','journey-simulation');
const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project','tsconfig.domain-tests.json','--outDir',build],{cwd:project,stdio:'inherit'});
if(result.status!==0) process.exit(result.status??1);
const api=require(path.join(build,'progression/index.js'));
const targets=[5,25,50,75,100,125], dayMs=86400000, start=Date.parse('2026-01-05T00:00:00Z');
const scenarios=[
  {name:'3 minutes daily',minutes:3}, {name:'10 minutes daily',minutes:10},
  {name:'20 minutes daily',minutes:20}, {name:'30 minutes daily',minutes:30},
  {name:'Two 10-minute sessions daily (07:00 and 15:00)',minutes:10,hours:[7,15]},
  {name:'10 minutes on five dates per week (Monday–Friday)',minutes:10,skip:day=>(day-1)%7>=5},
  {name:'10 minutes daily, 14-date break after date 14',minutes:10,skip:day=>day>=15&&day<=28},
];
const output=scenarios.map(scenario=>{
  let state=api.createProgressionState({timestamp:start,localDate:'2026-01-05',timeZone:'UTC'},api.PROGRESSION_V2);
  const reached={};
  for(let day=1;day<=1000;day++) {
    if(scenario.skip?.(day)) continue;
    for(const hour of scenario.hours??[9]) {
      const startedAt=start+(day-1)*dayMs+hour*3600000, endedAt=startedAt+scenario.minutes*60000;
      state=api.recordSession(state,{id:`${day}-${hour}`,startedAt,endedAt,activeDurationSeconds:scenario.minutes*60,
        pausedDurationSeconds:0,status:'completed',localDate:new Date(endedAt).toISOString().slice(0,10),timeZone:'UTC'});
    }
    const journey=api.getJourneyFromState(state);
    for(const target of targets) if(!reached[target]&&journey.level.number>=target) reached[target]={calendarDay:day,
      lifetimeXp:(state.lifetimeXpCenti/100).toFixed(2),credits:journey.metrics.credits,realDays:journey.metrics.realDays};
    if(reached[125]) break;
  }
  if(Object.keys(reached).length!==targets.length) throw new Error(`Unfinished simulation: ${scenario.name}`);
  return {name:scenario.name,reached};
});
console.log(JSON.stringify({scenarios:output,thresholds:api.JOURNEY_LEVELS.map(l=>({level:l.number,category:l.category.name,step:l.categoryStep,
  xp:(l.xpCenti/100).toFixed(2),credits:l.credits,realDays:l.realDays,elapsedDays:l.elapsedDays}))},null,2));
