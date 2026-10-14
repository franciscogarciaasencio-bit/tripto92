const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { assert, data, domain, context, connection, openStore } = require('./helpers.cjs');
const { createSessionSoundController, ENDING_LEAD_SECONDS } = data('../audio/session-controller.js');
const { DEFAULT_AUDIO_PREFERENCES: defaults } = data('audio-preferences.js');
const { BELL_DURATION_MS, BELL_RELEASE_MARGIN_MS } = data('../audio/bell-timing.js');
const { decodePreferences, DEFAULT_PREFERENCES, FIXED_DURATIONS } = data('preferences.js');
const { sessionLine, intentionLabel } = data('../ui/intentions.js');
const { startFixedTimer, startOpenEndedTimer, pauseTimer, resumeTimer, finishTimer, settleTimer } = domain('meditation/timer.js');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture() {
  let now = context(1, 9).timestamp, id = 0;
  const jobs = new Map(), players = [], notices = [];
  const clock = { now: () => now, schedule(fn, delay) { const key = ++id; jobs.set(key, { fn, at: now + delay }); return () => jobs.delete(key); },
    advance(ms) { const end = now + ms; for (;;) { const next = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; jobs.delete(next[0]); now = next[1].at; next[1].fn(); } now = end; } };
  const create = (sound) => {
    let listener, position = 0, last = 0;
    const player = { sound, volume: 0, playing: false, removed: false, plays: 0, seeks: [], locked: false,
      get currentTime() { return position + (this.playing ? (now - last) / 1000 : 0); },
      play() { this.plays++; last = now; this.playing = true; listener?.({ playing: true, loaded: true, buffering: false, error: null }); },
      pause() { position = this.currentTime; this.playing = false; },
      async seek(seconds) { this.seeks.push(seconds); position = seconds; last = now; },
      background(value) { this.locked = value; }, remove() { this.removed = true; this.playing = false; },
      subscribe(fn) { listener = fn; return () => { listener = null; }; } };
    players.push(player); return player;
  };
  const backend = { clip: create, timeline: (seconds) => create(`interval-${seconds}`), ending: () => create('ending'), feedback: () => {} };
  const controller = createSessionSoundController(backend, clock, (n) => notices.push(n), () => {});
  const input = (draft, extra = {}) => ({ ready: true, foreground: true, now: clock.now(), draft, completionId: null, preferences: defaults, ...extra });
  return { controller, clock, players, notices, jobs, input, now: () => clock.now() };
}
const endings = (f) => f.players.filter((p) => p.sound === 'ending');
const endClips = (f) => f.players.filter((p) => p.sound === 'end');

test('A fixed practice aligns the native ending timeline so the bell lands on the target', async () => {
  const f = fixture();
  const draft = startFixedTimer('fixed', 600, f.now(), 'UTC');
  f.controller.update(f.input(draft)); await flush();
  const [ending] = endings(f);
  assert.deepEqual(ending.seeks, [ENDING_LEAD_SECONDS - 600]);
  assert.equal(ending.playing, true);
  assert.ok(ending.volume > 0);
  assert.equal(ending.locked, false, 'ambience owns the background service when it plays');
  // Open-ended practice never creates an ending timeline.
  const g = fixture();
  g.controller.update(g.input(startOpenEndedTimer('open', g.now(), 'UTC'))); await flush();
  assert.equal(endings(g).length, 0);
});

test('Pauses stop the ending timeline; resuming re-aligns it to the remaining active time', async () => {
  const f = fixture();
  let draft = startFixedTimer('fixed', 300, f.now(), 'UTC');
  f.controller.update(f.input(draft)); await flush();
  f.clock.advance(100_000); draft = pauseTimer(draft, f.now());
  f.controller.update(f.input(draft)); await flush();
  assert.equal(endings(f)[0].playing, false);
  f.clock.advance(3_600_000); draft = resumeTimer(draft, f.now());
  f.controller.update(f.input(draft)); await flush();
  assert.deepEqual(endings(f)[0].seeks, [ENDING_LEAD_SECONDS - 300, ENDING_LEAD_SECONDS - 200]);
  assert.equal(endings(f)[0].playing, true);
});

test('Reaching the target rings once from the timeline: no second End bell, released after its tail', async () => {
  const f = fixture();
  const draft = startFixedTimer('fixed', 600, f.now(), 'UTC');
  f.controller.update(f.input(draft)); await flush();
  f.clock.advance(600_000);
  const finished = settleTimer(draft, f.now());
  f.controller.update(f.input(finished)); await flush();
  assert.equal(endClips(f).length, 0, 'the timeline is already ringing');
  assert.equal(endings(f)[0].removed, false);
  f.clock.advance(BELL_DURATION_MS.end + BELL_RELEASE_MARGIN_MS);
  assert.equal(endings(f)[0].removed, true);
});

test('The same holds when the phone was locked: completion processed later never repeats the bell', async () => {
  const f = fixture();
  const draft = startFixedTimer('fixed', 300, f.now(), 'UTC');
  f.controller.update(f.input(draft)); await flush();
  f.clock.advance(20 * 60_000); // JavaScript asleep; native playback rang the bell at five minutes.
  f.controller.update(f.input(draft)); await flush(); // Return to foreground before completion settles.
  assert.equal(endings(f)[0].seeks.length, 1, 'never restarted past its tail');
  f.controller.update(f.input(settleTimer(draft, f.now()))); await flush();
  assert.equal(endClips(f).length, 0);
});

test('Finishing early stops the timeline and plays the ordinary End bell', async () => {
  const f = fixture();
  const draft = startFixedTimer('fixed', 1200, f.now(), 'UTC');
  f.controller.update(f.input(draft)); await flush();
  f.clock.advance(300_000);
  f.controller.update(f.input(finishTimer(draft, f.now()))); await flush();
  assert.equal(endings(f)[0].removed, true);
  assert.equal(endClips(f).length, 1);
});

test('With the ending bell off or muted there is no ending timeline at all', async () => {
  for (const preferences of [{ ...defaults, closingBellEnabled: false }, { ...defaults, bellVolume: 0 }]) {
    const f = fixture();
    f.controller.update(f.input(startFixedTimer('fixed', 600, f.now(), 'UTC'), { preferences })); await flush();
    assert.equal(endings(f).length, 0);
  }
});

test('In Silence without intervals, the ending timeline keeps the background media service', async () => {
  const f = fixture();
  f.controller.update(f.input(startFixedTimer('fixed', 600, f.now(), 'UTC'), { preferences: { ...defaults, sessionSound: 'silence' } })); await flush();
  assert.equal(endings(f)[0].locked, true);
});

test('The ending timeline asset matches its verification report and stays small', () => {
  const root = path.resolve(__dirname, '../..');
  const report = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/bells-v2/ending-timeline.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(root, 'assets/audio/bells-v2/ending-timeline.m4a'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sha256);
  assert.equal(report.leadSeconds, ENDING_LEAD_SECONDS);
  assert.ok(report.decoded.correlationWithEndMaster > 0.999);
  const analysis = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/bells-v2/analysis.json'), 'utf8'));
  assert.equal(report.sourceSha256, analysis.assets['end.wav'].sha256);
  assert.ok(bytes.length < 1_500_000);
  assert.ok(Math.max(...FIXED_DURATIONS) * 60 <= ENDING_LEAD_SECONDS, 'every offered length fits the timeline');
});

test('Practice setup preferences: older documents mean open-ended with no intention; invalid values are refused', async () => {
  const legacy = { defaultDurationSeconds: 600, ambientSoundId: null, gongIntervalSeconds: null, ambienceVolume: 0.3, gongVolume: 0.5 };
  assert.deepEqual(decodePreferences(legacy), DEFAULT_PREFERENCES);
  assert.equal(decodePreferences({ ...legacy, durationMode: 'fixed', defaultDurationSeconds: 900, intention: 'calm' }).intention, 'calm');
  assert.throws(() => decodePreferences({ ...legacy, intention: 'enlightenment' }), /intention/);
  assert.throws(() => decodePreferences({ ...legacy, durationMode: 'forever' }), /duration mode/);
  assert.throws(() => decodePreferences({ ...legacy, durationMode: 'fixed', defaultDurationSeconds: 10_801 }), /180 minutes/);
  const store = await openStore(connection(), context(1));
  try {
    const next = { ...(await store.settings.loadPreferences()), durationMode: 'fixed', defaultDurationSeconds: 1200, intention: 'rest' };
    await store.settings.savePreferences(next, 5);
    assert.deepEqual(await store.settings.loadPreferences(), next);
  } finally { await store.close(); }
  assert.equal(sessionLine(null, false), 'Just be here');
  assert.equal(sessionLine('kindness', false), 'Be kind to yourself');
  assert.equal(sessionLine('kindness', true), 'Take your time');
  assert.equal(intentionLabel('gratitude'), 'Gratitude');
});
