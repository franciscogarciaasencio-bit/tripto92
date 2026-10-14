// Actual V4 earning and current-habit transitions; deterministic UTC routine, no approximate reward model.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const project=path.resolve(__dirname,'..'),build=path.join(project,'.expo','habit-simulation');
const compiled=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project','tsconfig.domain-tests.json','--outDir',build],{cwd:project,stdio:'inherit'});
if(compiled.status!==0)process.exit(compiled.status??1);
const api=require(path.join(build,'progression/index.js')),DAY=86400000,start=Date.parse('2026-01-05T00:00:00Z');
const context=(day,hour=0)=>({timestamp:start+(day-1)*DAY+hour*3600000,localDate:new Date(start+(day-1)*DAY).toISOString().slice(0,10),timeZone:'UTC'});
let state=api.createProgressionState(context(1),api.PROGRESSION_V4),checkpoint=api.createHabitCheckpoint(state),targets=[1,5,25,50,75,100,125],reached={};
for(let day=1;day<=500;day++){
 const at=context(day,9),session={id:`daily-${day}`,startedAt:at.timestamp,endedAt:at.timestamp+600000,activeDurationSeconds:600,
  pausedDurationSeconds:0,status:'completed',localDate:at.localDate,timeZone:at.timeZone};
 const after=api.recordSession(state,session),result=api.recordHabitReward(checkpoint,state,after);state=after;checkpoint=result.checkpoint;
 for(const level of targets)if(!reached[level]&&result.journey.level.number>=level)reached[level]=day;
 if(reached[125])break;
}
const later=api.advanceHabit(checkpoint,state,{...context(reached[125]+366),timestamp:checkpoint.asOf.timestamp+366*DAY});
console.log(JSON.stringify({tenMinutesDaily:reached,lifetimeRipples:state.lifetimeXpCenti/100,
 highestLevel:checkpoint.highestLevel,afterOneInactiveYear:{currentLevel:api.habitJourney(later,state).level.number,
 protectedLevel:api.protectedHabitLevel(checkpoint.highestLevel),effectiveRipples:later.effectiveXpCenti/100}},null,2));
