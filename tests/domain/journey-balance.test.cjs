const {test}=require('node:test');
const {assert,api,context,session}=require('./helpers.cjs');
const targets=[5,25,50,75,100,125];
for(const scenario of [
  {name:'3 minutes daily',minutes:3,days:[3,37,100,193,321,475]},
  {name:'10 minutes daily',minutes:10,days:[3,37,100,178,267,366]},
  {name:'20 minutes daily',minutes:20,days:[3,37,100,178,267,366]},
  {name:'30 minutes daily',minutes:30,days:[3,37,100,178,267,366]},
  {name:'two 10-minute sessions',minutes:10,hours:[7,15],days:[2,19,69,145,244,366]},
  {name:'five dates per week',minutes:10,skip:d=>(d-1)%7>=5,days:[3,51,138,248,373,509]},
  {name:'fourteen-date break',minutes:10,skip:d=>d>=15&&d<=28,days:[3,51,114,192,281,379]},
]) test(`Frozen V2 engine pacing: ${scenario.name}`,()=>{
  let state=api.createProgressionState(context(1),api.PROGRESSION_V2), reached={};
  for(let day=1;day<=scenario.days.at(-1);day++) {
    if(scenario.skip?.(day)) continue;
    for(const hour of scenario.hours??[9]) state=api.recordSession(state,session({day,hour,minutes:scenario.minutes}));
    const journey=api.getJourneyFromState(state, null, { version: api.LEGACY_JOURNEY_VERSION });
    for(const level of targets) if(!reached[level]&&journey.level.number>=level) reached[level]=day;
  }
  assert.deepEqual(targets.map(level=>reached[level]),scenario.days);
  assert.equal(api.getJourneyFromState(state, null, { version: api.LEGACY_JOURNEY_VERSION }).level.number,125);
});
