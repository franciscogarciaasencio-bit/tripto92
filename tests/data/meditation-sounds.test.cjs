const {test}=require('node:test');
const {assert,data,domain,connection,openStore,context,disk,session,save}=require('./helpers.cjs');
const {createSessionSoundController,activeAudioSeconds}=data('../audio/session-controller.js');
const {DEFAULT_AUDIO_PREFERENCES:defaults,decodeAudioPreferences}=data('audio-preferences.js');
const {startOpenEndedTimer,pauseTimer,resumeTimer,finishTimer}=domain('meditation/timer.js');
const {audioIntent}=data('../audio/policy.js');
const {BELL_DURATION_MS,BELL_RELEASE_MARGIN_MS}=data('../audio/bell-timing.js');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
 let now=0,id=0,haptics=0;const jobs=new Map(),players=[],notices=[],previews=[];
 const clock={now:()=>now,schedule(fn,delay){const key=++id;jobs.set(key,{fn,at:now+delay});return()=>jobs.delete(key);},advance(ms){const end=now+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;jobs.delete(next[0]);now=next[1].at;next[1].fn();}now=end;}};
 const create=(sound,loop=false)=>{
  let listener,position=0,last=0;
  const player={sound,loop,volume:0,playing:false,removed:false,plays:0,seeks:[],locked:false,hold:null,
   get currentTime(){return position+(this.playing?(now-last)/1000:0);},
   play(){this.plays++;last=now;this.playing=true;this.emit({playing:true});},
   pause(){position=this.currentTime;this.playing=false;this.emit({playing:false});},
   async seek(seconds){this.seeks.push(seconds);if(this.hold)await this.hold;position=seconds;last=now;},
   background(value){this.locked=value;},remove(){this.removed=true;this.playing=false;},
   subscribe(fn){listener=fn;return()=>{listener=null;};},emit(update){listener?.({playing:this.playing,loaded:true,buffering:false,error:null,...update});}};
  players.push(player);return player;
 };
 const backend={clip:create,timeline:seconds=>create(seconds),feedback:()=>haptics++};
 const controller=createSessionSoundController(backend,clock,n=>notices.push(n),s=>previews.push(s));
 const start=context(1,9).timestamp;
 const input={ready:true,foreground:true,now:start,draft:null,completionId:null,preferences:defaults};
 controller.update(input);
 return{controller,backend,clock,players,notices,previews,jobs,input,start,get haptics(){return haptics;}};
}

for (const channel of ['clip', 'timeline']) for (const failingMethod of ['background', 'pause', 'subscribe']) {
 test(`${channel} cleanup releases its player even when ${failingMethod} fails`,async()=>{
  const f=fixture(),draft=startOpenEndedTimer('cleanup',f.start,'UTC');
  if(failingMethod==='subscribe') {
   const create=f.backend[channel];
   f.backend[channel]=(...args)=>{
    const player=create(...args),subscribe=player.subscribe;
    player.subscribe=listener=>{const unsubscribe=subscribe(listener);return()=>{unsubscribe();throw new Error('listener service unavailable');};};
    return player;
   };
  }
  if(channel==='clip') f.controller.begin(defaults);
  else { f.controller.update({...f.input,draft,preferences:{...defaults,intervalSeconds:300}});await flush(); }
  const player=f.players[0];let pauseAttempted=false,removeAttempts=0;
  const originalPause=player.pause,originalRemove=player.remove;
  player.pause=()=>{pauseAttempted=true;if(failingMethod==='pause')throw new Error('media service unavailable');originalPause.call(player);};
  player.remove=()=>{removeAttempts++;originalRemove.call(player);};
  if(failingMethod==='background')player.background=()=>{throw new Error('background service unavailable');};
  f.controller.dispose();f.controller.dispose();await flush();
  assert.equal(pauseAttempted,true);assert.equal(removeAttempts,1);assert.equal(player.removed,true);
  assert.equal(f.jobs.size,0,'load/fade/preview jobs must not outlive the player');
 });
}

test('New sound defaults are calm; every environment, bell, interval and haptic preference survives restart',async t=>{
 const file=disk(t);let store=await openStore(connection(file),context(1));
 assert.deepEqual(await store.settings.loadAudioPreferences(),defaults);assert.equal(defaults.sessionSound,'ocean');
 assert.ok(defaults.openingBellEnabled&&defaults.closingBellEnabled);assert.equal(defaults.intervalSeconds,null);
 for(const sessionSound of ['ocean','rain','storm','brown_noise','silence','ocean_music']){
  const prefs={...defaults,sessionSound,sessionVolume:.2,bellVolume:.1,intervalSeconds:900,hapticsEnabled:true,closingBellEnabled:false};
  await store.settings.saveAudioPreferences(prefs);await store.close();store=await openStore(connection(file),context(1));
  assert.deepEqual(await store.settings.loadAudioPreferences(),prefs);
 }await store.close();
});

test('Stopping a preview fades softly, then releases exactly that player',()=>{
 const f=fixture();f.controller.preview('rain',.2);f.clock.advance(800);
 const player=f.players[0];assert.equal(player.volume,.1);
 f.controller.stopPreview();f.clock.advance(80);
 assert.ok(player.volume>0&&player.volume<.1);assert.equal(player.removed,false);
 f.clock.advance(100);assert.equal(player.removed,true);assert.equal(f.previews.at(-1),null);
 assert.equal(f.jobs.size,0);f.controller.dispose();
});

test('A late preview fade cannot stop a newly started meditation bell',()=>{
 const f=fixture();f.controller.preview('rain',.2);f.clock.advance(800);
 const old=f.players[0];f.controller.stopPreview();f.clock.advance(50);
 f.controller.begin(defaults);const bell=f.players.at(-1);f.clock.advance(300);
 assert.equal(old.removed,true);assert.equal(bell.sound,'start');assert.equal(bell.removed,false);
 f.controller.dispose();assert.equal(f.jobs.size,0);
});

test('Backgrounding cancels a pending preview fade and releases immediately',()=>{
 const f=fixture();f.controller.preview('ocean',.2);f.clock.advance(800);f.controller.stopPreview();
 f.controller.update({...f.input,foreground:false});
 assert.equal(f.players[0].removed,true);assert.equal(f.jobs.size,0);f.controller.dispose();
});

test('V9 migrates legacy choices/mutes/volumes transactionally, preserving sessions and frozen awards',async t=>{
 const file=disk(t);let conn=connection(file),store=await openStore(conn,context(1));await save(store.meditations,session());
 const state=await store.meditations.loadProgressionState();await store.close();conn=connection(file);
 const old={version:1,homeEnabled:false,homeVolume:.21,sessionSound:'silence',sessionVolume:.07,openingBellEnabled:true,closingBellEnabled:false};
 conn.raw.prepare('UPDATE audio_preferences SET preferences_json=?').run(JSON.stringify(old));
 // Reconstruct the released V8 schema, removing only later, empty migration additions.
 conn.raw.exec('DROP TABLE progression_consistency_activations; DELETE FROM schema_migrations WHERE version>=9');await conn.close();
 store=await openStore(connection(file),state.asOf);
 assert.deepEqual(await store.settings.loadAudioPreferences(),{...old,version:2,bellVolume:.18,intervalSeconds:null,hapticsEnabled:false});
 assert.deepEqual(await store.meditations.loadProgressionState(),state);await store.close();
});
for(const invalid of [{bellVolume:-.1},{bellVolume:Infinity},{intervalSeconds:60},{intervalSeconds:'300'},{hapticsEnabled:1},{openingBellEnabled:null},{sessionSound:['ocean']}])
 test(`Malformed sound settings fail explicitly: ${JSON.stringify(invalid)}`,()=>assert.throws(()=>decodeAudioPreferences({...defaults,...invalid}),e=>e.code==='INVALID_DATA'));

test('Silence keeps interval bells/background ownership independent of ambience volume',()=>{
 const intent=audioIntent({ready:true,foreground:false,phase:'running',completionPending:false,starting:false,
  preferences:{...defaults,sessionSound:'silence',intervalSeconds:300,sessionVolume:0}});
 assert.deepEqual(intent,{kind:'silent',immediate:true,background:true});
 const f=fixture(),draft=startOpenEndedTimer('quiet',f.start,'UTC');
 f.controller.update({...f.input,draft,preferences:{...defaults,sessionSound:'silence',intervalSeconds:300}});
 assert.equal(f.players[0].locked,true);assert.equal(f.players[0].volume,.09);f.controller.dispose();
});

test('Live starting bell is single; finish resonance survives the completion/Home transition; no rewards are touched',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('session',f.start,'UTC');f.controller.begin(defaults);
 assert.equal(f.players[0].sound,'start');f.controller.update({...f.input,draft});
 f.controller.update({...f.input,draft});assert.equal(f.players.filter(p=>p.sound==='start').length,1);
 const finished=finishTimer(draft,f.start+180000,'UTC');f.controller.update({...f.input,now:finished.changedAt,draft:finished});
 const ending=f.players.at(-1);assert.equal(ending.sound,'end');assert.equal(f.players[0].removed,true);
 f.controller.update({...f.input,now:finished.changedAt,draft:null,completionId:draft.id});
 f.controller.update({...f.input,now:finished.changedAt,draft:null,completionId:null});
 assert.equal(ending.removed,false);assert.equal(f.players.filter(p=>p.sound==='end').length,1);
 f.clock.advance(25000);assert.equal(ending.removed,false,'the acoustic ending must not be cut at the old deadline');
 f.clock.advance(BELL_DURATION_MS.end+BELL_RELEASE_MARGIN_MS-25000);
 assert.equal(ending.removed,true);assert.equal(f.jobs.size,0);f.controller.dispose();
});

test('Restored running sessions and pending completions never replay a starting/ending bell or haptic',()=>{
 const f=fixture(),draft=startOpenEndedTimer('restore',f.start,'UTC');
 f.controller.update({...f.input,draft,preferences:{...defaults,hapticsEnabled:true}});
 assert.equal(f.players.length,0);assert.equal(f.haptics,0);
 const fresh=fixture();fresh.controller.update({...fresh.input,completionId:'old-saved'});assert.equal(fresh.players.length,0);
 f.controller.dispose();fresh.controller.dispose();
});

test('Intervals align to actual active time, exclude pauses, continue without a JS bell scheduler, and resume once',async()=>{
 const f=fixture(),prefs={...defaults,intervalSeconds:300,hapticsEnabled:true},draft=startOpenEndedTimer('session',f.start,'UTC');
 f.controller.update({...f.input,draft,preferences:prefs});await flush();const timeline=f.players[0];
 assert.deepEqual(timeline.seeks,[0]);assert.equal(timeline.plays,1);
 const paused=pauseTimer(draft,f.start+120000,'UTC');f.controller.update({...f.input,draft:paused,now:paused.changedAt,preferences:prefs});
 assert.equal(timeline.playing,false);const resumed=resumeTimer(paused,f.start+720000);
 f.controller.update({...f.input,draft:resumed,now:resumed.changedAt,preferences:prefs});await flush();
 assert.deepEqual(timeline.seeks,[0,120]);assert.equal(timeline.plays,2);assert.equal(f.haptics,2);
 assert.equal(activeAudioSeconds(resumed,resumed.changedAt+180000),300);
 f.controller.update({...f.input,draft:resumed,now:resumed.changedAt,foreground:false,preferences:prefs});await flush();
 assert.equal(timeline.removed,false);assert.equal(timeline.plays,2);
 f.controller.dispose();assert.equal(timeline.removed,true);
});

test('Recovery seeks past missed intervals rather than catching up with a burst of bells',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('session',f.start,'UTC');
 f.controller.update({...f.input,draft,now:f.start+1825000,preferences:{...defaults,intervalSeconds:600}});await flush();
 assert.deepEqual(f.players[0].seeks,[1825]);assert.equal(f.players[0].sound,600);assert.equal(f.players.length,1);f.controller.dispose();
});

test('Changing interval preference releases the old timeline; a late seek cannot revive it',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('session',f.start,'UTC');let resolve;
 const create=f.backend.timeline;f.backend.timeline=seconds=>{const player=create(seconds);player.hold=new Promise(r=>resolve=r);return player;};
 f.controller.update({...f.input,draft,preferences:{...defaults,intervalSeconds:300}});
 f.controller.update({...f.input,draft,preferences:defaults});resolve();await flush();
 assert.equal(f.players[0].removed,true);assert.equal(f.players[0].plays,0);f.controller.dispose();
});

test('Media interruption fails closed, never silently resumes, and explicit retry realigns the timeline',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('session',f.start,'UTC'),input={...f.input,draft,preferences:{...defaults,intervalSeconds:300}};
 f.controller.update(input);await flush();f.players[0].emit({playing:false});
 assert.equal(f.notices.at(-1),'interrupted');assert.equal(f.players[0].removed,true);
 f.controller.update({...input,now:f.start+700000});assert.equal(f.players.length,1);
 f.controller.retry();await flush();assert.deepEqual(f.players[1].seeks,[700]);f.controller.dispose();
});

test('Previews are exclusive, fade in/out, stop on navigation/background, and cannot play over an active practice',()=>{
 const f=fixture();f.controller.preview('ocean',.2);f.clock.advance(700);assert.equal(f.players[0].volume,.1);
 f.controller.preview('rain',.2);assert.equal(f.players[0].removed,true);assert.equal(f.players[1].sound,'rain');
 f.clock.advance(12700);assert.equal(f.players[1].removed,true);assert.equal(f.previews.at(-1),null);
 f.controller.preview('end',.18);f.controller.update({...f.input,foreground:false});assert.equal(f.players.at(-1).removed,true);
 const draft=startOpenEndedTimer('session',f.start,'UTC');f.controller.update({...f.input,draft});
 const count=f.players.length;f.controller.preview('storm',.2);assert.equal(f.players.length,count);f.controller.dispose();
});

test('Bell mute, preference changes and disabled haptics never restart or double-play a sound',()=>{
 const f=fixture();f.controller.begin(defaults);assert.equal(f.haptics,0);
 f.controller.update({...f.input,preferences:{...defaults,bellVolume:0}});assert.equal(f.players[0].removed,true);
 f.controller.update(f.input);assert.equal(f.players.length,1);
 f.controller.begin({...defaults,openingBellEnabled:false,hapticsEnabled:true});assert.equal(f.players.length,1);assert.equal(f.haptics,1);f.controller.dispose();
});

test('Pause/resume during a pending native seek serializes alignment and never plays a stale position',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('session',f.start,'UTC'),prefs={...defaults,intervalSeconds:300};
 let resolve;const create=f.backend.timeline;f.backend.timeline=seconds=>{const p=create(seconds);p.hold=new Promise(r=>resolve=r);return p;};
 f.controller.update({...f.input,draft,preferences:prefs});await flush();
 const paused=pauseTimer(draft,f.start+120000,'UTC');f.controller.update({...f.input,draft:paused,now:paused.changedAt,preferences:prefs});
 const resumed=resumeTimer(paused,f.start+300000);f.controller.update({...f.input,draft:resumed,now:resumed.changedAt,preferences:prefs});
 assert.equal(f.players[0].plays,0);resolve();await flush();assert.equal(f.players[0].plays,1);
 assert.deepEqual(f.players[0].seeks,[0,120]);f.controller.dispose();
});

test('Late-loading bells are dropped, and removing preview/session owners cancels all resources',()=>{
 const f=fixture(),create=f.backend.clip;f.backend.clip=(...args)=>{const p=create(...args);p.play=()=>{p.plays++;};return p;};
 f.controller.begin(defaults);f.clock.advance(2000);assert.equal(f.players[0].removed,true);assert.equal(f.notices.at(-1),'unavailable');
 f.controller.dispose();assert.equal(f.jobs.size,0);
});

test('Every retained ambience matches its original output; encoded loops retain headroom and clean boundaries',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const root=path.join(__dirname,'../../assets/audio/meditation'),report=JSON.parse(fs.readFileSync(path.join(root,'analysis.json')));
 assert.equal(Object.keys(report.assets).length,4);let bytes=0;
 for(const [name,entry] of Object.entries(report.assets)){
  const raw=fs.readFileSync(path.join(root,name));bytes+=raw.length;
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);assert.equal(raw.length,entry.bytes);
  if(entry.decoded){assert.equal(entry.decoded.seconds,180);assert.ok(entry.decoded.peak<.5);assert.ok(Math.abs(entry.decoded.dc)<1e-4);
   assert.ok(entry.decoded.seamStep<entry.decoded.ordinaryStep99);assert.ok(entry.decoded.correlationWithMaster>.99);}
 }assert.ok(bytes<20_000_000,'Unchanged ambience bank remains below 20 MB');
 for(const manifest of ['analysis.json','timelines.json']){
  const bells=JSON.parse(fs.readFileSync(path.join(root,'../bells-v2',manifest)));
  for(const name of Object.keys(bells.assets)) bytes+=fs.statSync(path.join(root,'../bells-v2',name)).size;
 }
 assert.ok(bytes<45_000_000,'Complete meditation collection remains below the original 45 MB budget');
});

test('Live PCM durations match cleanup watchdogs; every bell is a new acoustic master',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/audio/bells-v2/analysis.json')));
 const catalogue=fs.readFileSync(path.join(__dirname,'../../src/audio/assets.ts'),'utf8');
 for(const name of ['start','end','interval']){
  const wav=fs.readFileSync(path.join(__dirname,`../../assets/audio/bells-v2/${name}.wav`));
  assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.readUInt32LE(24),24000);
  const samples=[];for(let i=44;i<wav.length;i+=2)samples.push(wav.readInt16LE(i)/32768);
  assert.equal(Math.ceil(samples.length/24),BELL_DURATION_MS[name]);
  assert.equal(samples.length/24000,report.assets[`${name}.wav`].measurements.seconds);
  assert.ok(catalogue.includes(`require('../../assets/audio/bells-v2/${name}.wav')`));
  assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
  assert.ok(samples.every(x=>Math.abs(x)<.35));
  const rms=x=>Math.sqrt(x.reduce((sum,n)=>sum+n*n,0)/x.length);
  assert.ok(rms(samples.slice(0,480))<.015);assert.ok(rms(samples.slice(-24000))<.001);
 }
});

test('Native end events release the acoustic tail naturally before its safety watchdog',()=>{
 const f=fixture(),draft=startOpenEndedTimer('natural-end',f.start,'UTC');
 f.controller.update({...f.input,draft});
 f.controller.update({...f.input,draft:null,completionId:draft.id});const bell=f.players.at(-1);
 f.clock.advance(BELL_DURATION_MS.end);bell.emit({playing:false});
 assert.equal(bell.removed,true);assert.equal(f.jobs.size,0);
 f.controller.update({...f.input,draft:null,completionId:draft.id});assert.equal(f.players.length,1);f.controller.dispose();
});

test('Ending watchdog starts at actual playback, preserving a full tail after a permitted loading delay',()=>{
 const f=fixture(),draft=startOpenEndedTimer('loaded-end',f.start,'UTC'),create=f.backend.clip;
 f.backend.clip=(...args)=>{const p=create(...args);p.play=()=>{p.plays++;};return p;};
 f.controller.update({...f.input,draft});f.controller.update({...f.input,draft:null,completionId:draft.id});
 const bell=f.players.at(-1);f.clock.advance(1500);bell.emit({playing:true});
 f.clock.advance(BELL_DURATION_MS.end+BELL_RELEASE_MARGIN_MS-1);assert.equal(bell.removed,false);
 f.clock.advance(1);assert.equal(bell.removed,true);assert.equal(f.jobs.size,0);f.controller.dispose();
});

test('A synchronous initial playing status does not leave a stale load watchdog',()=>{
 const f=fixture(),create=f.backend.clip;
 f.backend.clip=(...args)=>{const p=create(...args),subscribe=p.subscribe;p.subscribe=fn=>{const remove=subscribe(fn);p.emit({playing:true});return remove;};return p;};
 f.controller.begin(defaults);assert.equal(f.jobs.size,1,'only the duration watchdog remains');
 f.controller.dispose();assert.equal(f.jobs.size,0);
});

test('End previews preserve the complete resonance and switching previews cancels the old cleanup',()=>{
 const f=fixture();f.controller.preview('end',.18);f.clock.advance(25000);
 const end=f.players[0];assert.equal(end.removed,false);
 f.controller.preview('interval',.18);assert.equal(end.removed,true);
 const interval=f.players[1];f.clock.advance(BELL_DURATION_MS.interval+BELL_RELEASE_MARGIN_MS+700);
 assert.equal(interval.removed,true);assert.equal(f.jobs.size,0);f.controller.dispose();
});

test('The final six-hour interval tail remains available; beyond the released tail window no track restarts',async()=>{
 const f=fixture(),draft=startOpenEndedTimer('long-practice',f.start,'UTC'),prefs={...defaults,intervalSeconds:300};
 f.controller.update({...f.input,draft,now:f.start+21601000,preferences:prefs});await flush();
 const track=f.players[0];assert.deepEqual(track.seeks,[21601]);assert.equal(track.removed,false);
 track.emit({playing:false});assert.equal(track.removed,true);
 f.controller.update({...f.input,draft,now:f.start+21613000,preferences:prefs});await flush();
 assert.equal(f.players.length,1);f.controller.dispose();
});

test('Ending off means no closing clip; entry-only Silence still configures native background resonance',()=>{
 const f=fixture(),draft=startOpenEndedTimer('quiet',f.start,'UTC'),prefs={...defaults,sessionSound:'silence',closingBellEnabled:false};
 f.controller.update({...f.input,draft,preferences:prefs});f.controller.begin(prefs);assert.equal(f.players[0].locked,true);
 const intent=audioIntent({ready:true,foreground:false,phase:'running',completionPending:false,starting:false,preferences:prefs});
 assert.deepEqual(intent,{kind:'silent',immediate:true,background:true});
 f.controller.update({...f.input,draft,foreground:false,preferences:prefs});assert.equal(f.players[0].removed,false);
 f.controller.update({...f.input,draft:finishTimer(draft,f.start+180000,'UTC'),now:f.start+180000,preferences:prefs});
 assert.equal(f.players.filter(p=>p.sound==='end').length,0);assert.equal(f.players[0].removed,true);f.controller.dispose();assert.equal(f.players[0].locked,false);
});
