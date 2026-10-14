const { test } = require('node:test');
const path = require('node:path');
const { assert, data, domain, fixture, session, save, connection, openStore, context, disk } = require('./helpers.cjs');
const { DEFAULT_AUDIO_PREFERENCES: defaults, decodeAudioPreferences } = data('audio-preferences.js');
const { createAudioController } = require(path.join(process.env.DATA_BUILD_DIR, '../audio/controller.js'));
const { audioIntent } = require(path.join(process.env.DATA_BUILD_DIR, '../audio/policy.js'));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function audioFixture() {
  let now = 0, sequence = 0;
  const jobs = new Map();
  const players = [], notices = [], modes = [];
  const clock = {
    now: () => now,
    schedule(callback, delay) { const id = ++sequence; jobs.set(id, { at: now + delay, callback }); return () => jobs.delete(id); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const pending = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!pending) break;
        jobs.delete(pending[0]); now = pending[1].at; pending[1].callback();
      }
      now = end;
    },
  };
  const backend = {
    autoPlay: true, rejectPlay: false, rejectConfigure: false, hold: null,
    async configure(background) { modes.push(background); if (this.rejectConfigure) throw Error('native mode failed'); if (this.hold) await this.hold; },
    create() {
      let listener;
      const p = {
        volume: 0, playing: false, plays: 0, pauses: 0, removed: false, locked: false,
        play() { this.plays++; if (backend.rejectPlay) return Promise.reject(Error('autoplay blocked')); if (backend.autoPlay) this.emit({ playing: true }); },
        pause() { this.pauses++; this.emit({ playing: false }); },
        background(active) { this.locked = active; },
        subscribe(fn) { listener = fn; return () => { listener = null; }; },
        remove() { this.removed = true; this.playing = false; },
        emit(update) { if (update.playing !== undefined) this.playing = update.playing; listener?.({ playing: this.playing, loaded: true, buffering: false, error: null, ...update }); },
        get subscribed() { return !!listener; },
      };
      players.push(p); return p;
    },
  };
  const controller = createAudioController(backend, clock, (notice) => notices.push(notice));
  return { backend, controller, clock, players, notices, modes, jobs };
}
const home = (volume = .15) => ({ kind: 'home', volume });
const meditation = (volume = .2) => ({ kind: 'session', volume });
const silent = (immediate = false) => ({ kind: 'silent', immediate });

 test('Home starts at zero, fades in over 2.5 seconds and rerenders never recreate/restart a player', async () => {
  const f = audioFixture(); f.controller.setIntent(home()); await flush();
  const p = f.players[0]; assert.equal(p.volume, 0); assert.equal(p.plays, 1);
  f.clock.advance(1250); assert.ok(Math.abs(p.volume - .075) < 1e-9);
  f.clock.advance(1250); assert.equal(p.volume, .15);
  for (let i = 0; i < 100; i++) f.controller.setIntent(home());
  assert.equal(p.plays, 1); assert.equal(f.players.length, 1); f.controller.dispose();
});
test('Owner transition fades to silence before session; independent volume and one shared player', async () => {
  const f = audioFixture(); f.controller.setIntent(home()); await flush(); f.clock.advance(2500);
  f.controller.setIntent(meditation(.35)); f.clock.advance(500);
  assert.ok(f.players[0].volume > 0 && f.players[0].volume < .15); assert.equal(f.players[0].plays, 1);
  f.clock.advance(500); await flush(); assert.equal(f.players[0].volume, 0);
  assert.equal(f.players[0].plays, 2); assert.equal(f.players[0].locked, true);
  f.clock.advance(1500); assert.equal(f.players[0].volume, .35); assert.equal(f.players.length, 1); f.controller.dispose();
});
test('Live volume changes fade smoothly without restarting the recording', async () => {
  const f = audioFixture(); f.controller.setIntent(meditation(.2)); await flush(); f.clock.advance(1500);
  f.controller.setIntent(meditation(.6)); assert.equal(f.players[0].volume, .2);
  f.clock.advance(500); assert.ok(Math.abs(f.players[0].volume - .4) < 1e-9);
  f.clock.advance(500); assert.equal(f.players[0].volume, .6); assert.equal(f.players[0].plays, 1); f.controller.dispose();
});
test('Mute, pause, finish and discard all fade out; returning Home respects its own volume', async () => {
  for (const action of ['mute', 'pause', 'finish', 'discard']) {
    const f = audioFixture(); f.controller.setIntent(action === 'mute' ? home() : meditation()); await flush(); f.clock.advance(2500);
    f.controller.setIntent(silent()); assert.equal(f.players[0].playing, true);
    f.clock.advance(1000); await flush(); assert.equal(f.players[0].playing, false); assert.equal(f.players[0].volume, 0); assert.equal(f.players[0].locked, false);
    f.controller.setIntent(home(.1)); await flush(); f.clock.advance(2500); assert.equal(f.players[0].volume, .1); assert.equal(f.players.length, 1); f.controller.dispose();
  }
});
test('Rapid pause/resume and Home/session/Home transitions cancel stale fades', async () => {
  const f = audioFixture(); f.controller.setIntent(home()); await flush(); f.clock.advance(2500);
  f.controller.setIntent(meditation()); f.clock.advance(400); f.controller.setIntent(home(.12));
  f.clock.advance(3000); await flush(); assert.equal(f.players[0].volume, .12); assert.equal(f.players.length, 1);
  f.controller.setIntent(meditation()); f.clock.advance(1000); await flush(); f.clock.advance(1500);
  for (let i = 0; i < 20; i++) { f.controller.setIntent(silent()); f.clock.advance(50); f.controller.setIntent(meditation(.3)); f.clock.advance(50); }
  f.clock.advance(3000); assert.equal(f.players[0].volume, .3); assert.equal(f.players[0].playing, true); assert.equal(f.players.length, 1); f.controller.dispose();
});
test('Background Home stops immediately instead of relying on suspended JavaScript fade timers', async () => {
  const f = audioFixture(); f.controller.setIntent(home()); await flush(); f.clock.advance(2500);
  f.controller.setIntent(silent(true)); assert.equal(f.players[0].volume, 0); assert.equal(f.players[0].playing, false);
  f.clock.advance(100000); await flush(); assert.equal(f.players[0].playing, false); f.controller.dispose();
});
test('Slow mode configuration cannot resurrect obsolete Home audio or create duplicate players', async () => {
  const f = audioFixture(); let release; f.backend.hold = new Promise((resolve) => { release = resolve; });
  f.controller.setIntent(home()); await flush(); f.controller.setIntent(meditation(.4)); f.controller.setIntent(silent(true));
  release(); await flush(); assert.equal(f.players.length, 0);
  f.backend.hold = null; f.controller.setIntent(meditation(.4)); await flush(); f.clock.advance(1500);
  assert.equal(f.players.length, 1); assert.equal(f.players[0].volume, .4); assert.equal(f.modes.at(-1), true); f.controller.dispose();
});
test('Disposal during pending configuration creates no late player', async () => {
  const f = audioFixture(); let release; f.backend.hold = new Promise((resolve) => { release = resolve; });
  f.controller.setIntent(home()); await flush(); f.controller.dispose(); release(); await flush(); assert.equal(f.players.length, 0); assert.equal(f.jobs.size, 0);
});
test('Late source load starts its fade at playback, never at a previously elapsed fade position', async () => {
  const f = audioFixture(); f.backend.autoPlay = false; f.controller.setIntent(home()); await flush(); f.clock.advance(4000);
  assert.equal(f.players[0].volume, 0); f.controller.setIntent(home(.25)); f.players[0].emit({ playing: true });
  assert.equal(f.players[0].volume, 0); f.clock.advance(2500); assert.equal(f.players[0].volume, .25); f.controller.dispose();
});
test('Failed load and native error fail closed, release resources and retry only on request', async () => {
  for (const error of ['timeout', 'status']) {
    const f = audioFixture(); f.backend.autoPlay = false; f.controller.setIntent(home()); await flush();
    if (error === 'timeout') f.clock.advance(15000); else f.players[0].emit({ error: 'failed to load' });
    assert.equal(f.notices.at(-1), 'unavailable'); assert.equal(f.players[0].removed, true); assert.equal(f.players[0].subscribed, false);
    f.controller.setIntent(home(.3)); await flush(); assert.equal(f.players.length, 1);
    f.backend.autoPlay = true; f.controller.retry(); await flush(); f.clock.advance(2500); assert.equal(f.players[1].volume, .3); f.controller.dispose();
  }
});
test('Playback Promise rejection and audio-mode failures are controlled non-blocking errors', async () => {
  for (const field of ['rejectPlay', 'rejectConfigure']) {
    const f = audioFixture(); f.backend[field] = true; f.controller.setIntent(meditation()); await flush();
    assert.equal(f.notices.at(-1), 'unavailable'); assert.ok(f.players.every((p) => !p.playing));
    f.backend[field] = false; f.controller.retry(); await flush(); f.clock.advance(1500); assert.equal(f.players.at(-1).volume, .2); f.controller.dispose();
  }
});
test('Unexpected OS pause fails closed without changing a timer; explicit retry resumes softly', async () => {
  const f = audioFixture(); f.controller.setIntent(meditation()); await flush(); f.clock.advance(1500);
  f.players[0].emit({ playing: false }); assert.equal(f.notices.at(-1), 'interrupted'); assert.equal(f.players[0].volume, 0);
  f.clock.advance(20000); assert.equal(f.players[0].plays, 1);
  f.controller.retry(); await flush(); assert.equal(f.players[0].volume, 0); f.clock.advance(1500); assert.equal(f.players[0].volume, .2); assert.equal(f.players.length, 1); f.controller.dispose();
});
test('Buffering is not mistaken for an interruption and cleanup removes fades/listeners/player', async () => {
  const f = audioFixture(); f.controller.setIntent(meditation()); await flush(); f.clock.advance(500);
  f.players[0].emit({ playing: false, buffering: true }); assert.equal(f.notices.length, 0);
  f.controller.dispose(); f.clock.advance(100000); assert.equal(f.jobs.size, 0); assert.equal(f.players[0].subscribed, false); assert.equal(f.players[0].removed, true);
  f.controller.dispose(); f.controller.setIntent(home()); assert.equal(f.players.length, 1);
});
test('Pure app policy keeps Home out of background/completion/paused sessions and supports real Silence', () => {
  const input = { ready: true, foreground: true, phase: null, completionPending: false, starting: false, preferences: defaults };
  assert.deepEqual(audioIntent(input), home(.075));
  for (const change of [{ ready: false }, { starting: true }, { completionPending: true }, { phase: 'paused' }, { phase: 'finished' }, { preferences: null }]) assert.equal(audioIntent({ ...input, ...change }).kind, 'silent');
  assert.deepEqual(audioIntent({ ...input, foreground: false }), silent(true));
  assert.deepEqual(audioIntent({ ...input, foreground: false, phase: 'running' }), { ...meditation(.075), source: 'ocean', background: true });
  assert.equal(audioIntent({ ...input, preferences: { ...defaults, homeEnabled: false } }).kind, 'silent');
  assert.equal(audioIntent({ ...input, phase: 'running', preferences: { ...defaults, sessionSound: 'silence' } }).kind, 'silent');
  assert.equal(audioIntent({ ...input, phase: 'running', preferences: { ...defaults, sessionVolume: 0 } }).kind, 'silent');
});
test('Playback gain halves Home and session loudness, including background, without changing fades or preferences', async () => {
  const f = audioFixture();
  const preferences = Object.freeze({ ...defaults, sessionSound: 'ocean_music', homeVolume: .8, sessionVolume: .6 });
  const input = { ready: true, foreground: true, phase: null, completionPending: false, starting: false, preferences };
  f.controller.setIntent(audioIntent(input)); await flush(); f.clock.advance(1250);
  assert.ok(Math.abs(f.players[0].volume - .2) < 1e-9);
  f.clock.advance(1250); assert.equal(f.players[0].volume, .4);
  f.controller.setIntent(audioIntent({ ...input, phase: 'running' })); f.clock.advance(1000); await flush();
  f.clock.advance(1500); assert.equal(f.players[0].volume, .3);
  f.controller.setIntent(audioIntent({ ...input, phase: 'running', foreground: false }));
  assert.equal(f.players[0].volume, .3); assert.equal(f.players[0].locked, true); assert.equal(f.players.length, 1);
  assert.equal(preferences.homeVolume, .8); assert.equal(preferences.sessionVolume, .6);
  assert.deepEqual(audioIntent({ ...input, preferences: { ...preferences, homeVolume: 0 } }), silent());
  f.controller.dispose();
});
test('Saved user-selected volumes round-trip unchanged while reopened playback uses the quieter gain', async (t) => {
  const filename = disk(t); let store = await openStore(connection(filename), context(1));
  const preferences = { ...defaults, homeVolume: .6, sessionVolume: .8 };
  await store.settings.saveAudioPreferences(preferences); await store.close();
  store = await openStore(connection(filename), context(1));
  try {
    const loaded = await store.settings.loadAudioPreferences(); assert.deepEqual(loaded, preferences);
    const input = { ready: true, foreground: true, phase: null, completionPending: false, starting: false, preferences: loaded };
    assert.deepEqual(audioIntent(input), home(.3));
    assert.deepEqual(audioIntent({ ...input, phase: 'running' }), { ...meditation(.4), source: 'ocean' });
    assert.deepEqual(audioIntent({ ...input, phase: 'running', foreground: false }), { ...meditation(.4), source: 'ocean', background: true });
  } finally { await store.close(); }
});
test('Audio defaults and independently saved volumes/choices survive close/reopen without changing legacy preferences or XP', async (t) => {
  const filename = disk(t); let conn = connection(filename); let store = await openStore(conn, context(1));
  const oldPrefs = await store.settings.loadPreferences(); await save(store.meditations, session()); const state = await store.meditations.loadProgressionState();
  assert.deepEqual(await store.settings.loadAudioPreferences(), defaults);
  const custom = { ...defaults, homeEnabled: false, homeVolume: .1, sessionSound: 'silence', sessionVolume: .35, openingBellEnabled: true };
  await store.settings.saveAudioPreferences(custom); await store.close();
  conn = connection(filename); store = await openStore(conn, state.asOf);
  try {
    assert.deepEqual(await store.settings.loadAudioPreferences(), custom);
    assert.deepEqual(await store.settings.loadPreferences(), oldPrefs); assert.deepEqual(await store.meditations.loadProgressionState(), state);
  } finally { await store.close(); }
});
test('V5 migration preserves V4 history, timer, dismissal, old settings and immutable XP receipts', async (t) => {
  const { writeLegacyFixture, api, data } = require('./helpers.cjs');
  const filename = disk(t); const conn = connection(filename);
  const before = api.recordSession(api.createProgressionState(context(1)), session());
  const prefs = data('preferences.js').DEFAULT_PREFERENCES;
  await writeLegacyFixture(conn, 4, before, prefs);
  await conn.run('UPDATE application_preferences SET explanation_dismissed_at = ? WHERE id = 1', [context(1).timestamp]);
  const draft = domain('meditation/timer.js').startOpenEndedTimer('migration-timer', before.asOf.timestamp, before.asOf.timeZone);
  await conn.run('INSERT INTO meditation_timer VALUES (1, ?)', [JSON.stringify(draft)]); await conn.close();
  const reopened = await openStore(connection(filename), before.asOf);
  try {
    assert.deepEqual(await reopened.settings.loadAudioPreferences(), defaults);
    assert.deepEqual(await reopened.settings.loadPreferences(), prefs); assert.deepEqual(await reopened.meditations.loadProgressionState(), before);
    assert.deepEqual(await reopened.timer.load(), draft); assert.deepEqual(reopened.initialTimer, draft);
    assert.equal(reopened.initialExplanationDismissed, true); assert.equal((await reopened.meditations.getMeditationHistory()).length, 1);
  } finally { await reopened.close(); }
});
for (const change of [{ homeEnabled: null }, { homeEnabled: 1 }, { homeVolume: NaN }, { homeVolume: -1 }, { sessionVolume: 1.01 }, { sessionVolume: Infinity }, { sessionSound: 'waves' }, { openingBellEnabled: 'true' }, { closingBellEnabled: null }, { version: 3 }]) {
  test(`Invalid audio preferences rejected: ${JSON.stringify(change)}`, async (t) => {
    assert.throws(() => decodeAudioPreferences({ ...defaults, ...change }), (e) => e.code === 'INVALID_DATA');
    const { settings } = await fixture(t); await assert.rejects(settings.saveAudioPreferences({ ...defaults, ...change }), (e) => e.code === 'INVALID_DATA');
    assert.deepEqual(await settings.loadAudioPreferences(), defaults);
  });
}
test('Missing/corrupted audio singleton fails explicitly rather than silently overwriting mute preferences', async (t) => {
  const { conn, settings } = await fixture(t); conn.raw.exec("UPDATE audio_preferences SET preferences_json='{}'");
  await assert.rejects(settings.loadAudioPreferences(), (e) => e.code === 'INVALID_DATA');
  await assert.rejects(settings.saveAudioPreferences(defaults), (e) => e.code === 'INVALID_DATA');
  conn.raw.exec('DELETE FROM audio_preferences'); await assert.rejects(settings.loadAudioPreferences(), (e) => e.code === 'INVALID_DATA');
});
test('A failed audio preference transaction leaves the original saved settings intact', async (t) => {
  const { conn, settings } = await fixture(t); conn.failOnce((sql) => sql.startsWith('UPDATE audio_preferences'));
  await assert.rejects(settings.saveAudioPreferences({ ...defaults, homeEnabled: false }), /Simulated/);
  assert.deepEqual(await settings.loadAudioPreferences(), defaults);
});
test('Approved WAV is bundled byte-for-byte with silent endpoints and its exact offline asset reference', () => {
  const { readFileSync } = require('node:fs'); const { createHash } = require('node:crypto');
  const wav = readFileSync(path.join(__dirname, '../../assets/audio/meditation-choir.wav'));
  assert.equal(createHash('sha256').update(wav).digest('hex'), 'b974de6aa17ae128b89a53dcc1619c7f0debcf17a5f81993c91d76a3a7227a85');
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF'); assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  let offset = 12, frames;
  while (offset < wav.length) {
    const tag = wav.subarray(offset, offset + 4).toString(), size = wav.readUInt32LE(offset + 4);
    if (tag === 'fmt ') { assert.equal(wav.readUInt16LE(offset + 8), 1); assert.equal(wav.readUInt16LE(offset + 10), 2); assert.equal(wav.readUInt32LE(offset + 12), 48000); assert.equal(wav.readUInt16LE(offset + 22), 24); }
    if (tag === 'data') { frames = size / 6; assert.deepEqual([...wav.subarray(offset + 8, offset + 14)], [0, 0, 0, 0, 0, 0]); assert.deepEqual([...wav.subarray(offset + 8 + size - 6, offset + 8 + size)], [0, 0, 0, 0, 0, 0]); }
    offset += 8 + size + (size % 2);
  }
  assert.equal(frames, 3672118);
});

test('A native volume getter failure cannot throw into navigation/session actions', async () => {
  const f = audioFixture(); f.controller.setIntent(home()); await flush(); f.clock.advance(2500);
  Object.defineProperty(f.players[0], 'volume', { configurable: true, get() { throw Error('Media services lost'); }, set() {} });
  assert.doesNotThrow(() => f.controller.setIntent(silent()));
  assert.equal(f.notices.at(-1), 'unavailable'); assert.equal(f.players[0].removed, true); assert.doesNotThrow(() => f.controller.dispose());
});

test('A queued event from a released failed player cannot interrupt its replacement', async () => {
  const f = audioFixture(), create = f.backend.create.bind(f.backend); let queued;
  f.backend.create = () => {
    const player = create(), subscribe = player.subscribe.bind(player);
    player.subscribe = (listener) => { queued ??= listener; return subscribe(listener); };
    return player;
  };
  f.controller.setIntent(home()); await flush(); f.players[0].emit({ error: 'Failed source' });
  f.controller.retry(); await flush(); f.clock.advance(2500); assert.equal(f.players[1].volume, .15);
  queued({ playing: false, loaded: true, buffering: false, error: 'Stale callback' });
  assert.equal(f.players[1].playing, true); assert.equal(f.players[1].volume, .15); assert.equal(f.notices.at(-1), null); f.controller.dispose();
});

test('Locking during a partial session fade settles its native volume before JavaScript suspends', async () => {
  const f = audioFixture(); f.controller.setIntent(meditation(.2)); await flush(); f.clock.advance(100);
  assert.ok(f.players[0].volume < .2); f.controller.setIntent({ ...meditation(.2), background: true });
  assert.equal(f.players[0].volume, .2); assert.equal(f.players[0].plays, 1); assert.equal(f.players[0].locked, true);
  f.clock.advance(20000); assert.equal(f.players[0].volume, .2); f.controller.dispose();
});
test('Locking during Home-to-session fade stops Home and starts session at its independent volume', async () => {
  const f = audioFixture(); f.controller.setIntent(home(.6)); await flush(); f.clock.advance(2500);
  f.controller.setIntent(meditation(.1)); f.clock.advance(100);
  f.controller.setIntent({ ...meditation(.1), background: true }); assert.equal(f.players[0].volume, 0); assert.equal(f.players[0].playing, false);
  await flush(); assert.equal(f.players.length, 1); assert.equal(f.players[0].volume, .1); assert.equal(f.players[0].locked, true); assert.equal(f.players[0].playing, true); f.controller.dispose();
});
test('A delayed session source can load in background without depending on a suspended fade timer', async () => {
  const f = audioFixture(); f.backend.autoPlay = false; f.controller.setIntent(meditation(.2)); await flush();
  f.controller.setIntent({ ...meditation(.2), background: true }); assert.equal(f.players[0].volume, .2);
  f.players[0].emit({ playing: true }); assert.equal(f.players[0].volume, .2); f.clock.advance(20000); assert.equal(f.notices.length, 0); f.controller.dispose();
});

test('An asynchronous status/volume failure remains a controlled sound error', async () => {
  const f = audioFixture(); f.backend.autoPlay = false;
  f.controller.setIntent({ ...meditation(.2), background: true }); await flush();
  Object.defineProperty(f.players[0], 'volume', { configurable: true, get() { return 0; }, set() { throw Error('Player released by OS'); } });
  assert.doesNotThrow(() => f.players[0].emit({ playing: true }));
  assert.equal(f.notices.at(-1), 'unavailable'); assert.equal(f.players[0].removed, true); f.controller.dispose();
});

test('Locking suspends a pending first-play watchdog until native status delivery can resume', async () => {
  const f = audioFixture(); f.backend.autoPlay = false; f.controller.setIntent(meditation(.2)); await flush();
  f.clock.advance(1000); f.controller.setIntent({ ...meditation(.2), background: true }); f.clock.advance(60000);
  assert.equal(f.notices.length, 0); assert.equal(f.players[0].removed, false);
  f.controller.setIntent(meditation(.2)); f.clock.advance(1000); f.players[0].emit({ playing: true }); f.clock.advance(20000);
  assert.equal(f.notices.length, 0); assert.equal(f.players[0].volume, .2); f.controller.dispose();
});
test('A source still unable to play on foreground receives a fresh bounded load window', async () => {
  const f = audioFixture(); f.backend.autoPlay = false; f.controller.setIntent({ ...meditation(.2), background: true }); await flush();
  f.clock.advance(60000); assert.equal(f.notices.length, 0); f.controller.setIntent(meditation(.2));
  f.clock.advance(14999); assert.equal(f.notices.length, 0); f.clock.advance(1); assert.equal(f.notices.at(-1), 'unavailable'); f.controller.dispose();
});

test('Environment changes fade out and release the old source; live volume changes preserve the new loop position',async()=>{
  const f=audioFixture();const create=f.backend.create.bind(f.backend);
  f.backend.create=source=>{const p=create();p.source=source;return p;};
  f.controller.setIntent({...meditation(.15),source:'ocean'});await flush();f.clock.advance(1500);
  f.controller.setIntent({...meditation(.15),source:'rain'});f.clock.advance(500);
  assert.ok(f.players[0].volume>0&&f.players[0].volume<.15);f.clock.advance(500);await flush();
  assert.equal(f.players[0].removed,true);assert.equal(f.players[0].subscribed,false);assert.equal(f.players[1].source,'rain');
  f.clock.advance(1500);f.controller.setIntent({...meditation(.2),source:'rain'});f.clock.advance(1000);
  assert.equal(f.players[1].volume,.2);assert.equal(f.players[1].plays,1);f.controller.dispose();
});

test('Locking during an environment change starts the requested source and cannot retain old Home/session audio',async()=>{
  const f=audioFixture();const create=f.backend.create.bind(f.backend);f.backend.create=source=>{const p=create();p.source=source;return p;};
  f.controller.setIntent({...meditation(.15),source:'ocean'});await flush();f.clock.advance(1500);
  f.controller.setIntent({...meditation(.1),source:'storm',background:true});await flush();
  assert.equal(f.players[0].removed,true);assert.equal(f.players[1].source,'storm');assert.equal(f.players[1].volume,.1);f.controller.dispose();
});
