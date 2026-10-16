import type { AudioPreferences } from '../data/audio-preferences';
import type { TimerDraft } from '../domain/meditation/timer';
import type { AudioClock, PlaybackStatus, SoundNotice } from './controller';
import { MASTER_PLAYBACK_GAIN, type AmbienceSource } from './policy';
import { BELL_DURATION_MS, BELL_RELEASE_MARGIN_MS } from './bell-timing';
export type Bell = 'start' | 'end' | 'interval';
export type PreviewSound = AmbienceSource | Bell;
export interface ClipPlayer {
  volume: number; readonly currentTime: number;
  play(): void | Promise<void>; pause(): void; seek(seconds: number): Promise<void>;
  background(active: boolean): void; remove(): void;
  subscribe(listener: (status: PlaybackStatus) => void): () => void;
}
export interface SessionAudioBackend {
  clip(sound: PreviewSound, loop: boolean): ClipPlayer;
  /** The interval master then silence, `seconds` long, looping: a bell every `seconds` of playback. */
  timeline(seconds: number): ClipPlayer;
  /** One hour of silence, then the End bell: rings at a fixed practice's end while JavaScript sleeps. */
  ending(): ClipPlayer;
}
export interface SessionSoundInput {
  ready: boolean; foreground: boolean; now: number; draft: TimerDraft | null;
  completionId: string | null; preferences: AudioPreferences | null;
}
/** Where the looped interval track should be after `active` seconds of practice. */
export function intervalPosition(active: number, period: number) {
  return ((active % period) + period) % period;
}
/** Distance between two positions on a loop. */
export function loopDistance(a: number, b: number, period: number) {
  const d = Math.abs(a - b) % period;
  return Math.min(d, period - d);
}
/** The loop starts with a strike; at 0 active seconds it stays silent until that strike is over. */
export const FIRST_STRIKE_SECONDS = BELL_DURATION_MS.interval / 1000;
export const ENDING_LEAD_SECONDS = 3_600;
export function activeAudioSeconds(draft: TimerDraft, now: number): number {
  return (draft.activeMilliseconds + (draft.phase === 'running' ? Math.max(0, now-draft.changedAt) : 0))/1000;
}
/** Audio-only edge tracking and timeline alignment. Never changes timer/save/progression. */
export function createSessionSoundController(backend: SessionAudioBackend, clock: AudioClock,
  notify: (notice: SoundNotice) => void, previewChanged: (sound: PreviewSound | null) => void) {
  let input: SessionSoundInput | null = null, previous: SessionSoundInput | null = null;
  let disposed = false, blocked = false, clipRevision = 0, timelineRevision = 0;
  let clip: ClipPlayer | null = null, preview: PreviewSound | null = null, clipSound: PreviewSound | null = null;
  let timeline: ClipPlayer | null = null, timelineKey: string | null = null, timelineRunning = false, timelinePlayed = false;
  let timelineSeeks = Promise.resolve(), cancelAudible: (() => void) | null = null;
  let removeTimelineListener: (() => void) | null = null, removeClipListener: (() => void) | null = null;
  let cancelPreview: (() => void) | null = null, cancelFade: (() => void) | null = null, cancelLoad: (() => void) | null = null;
  const ended = new Set<string>();
  // Fixed-length practice: the native ending timeline sounds the End bell at the target.
  let ending: ClipPlayer | null = null, endingKey: string | null = null, endingRunning = false, endingRevision = 0;
  let endingSeeks = Promise.resolve(), removeEndingListener: (() => void) | null = null, cancelRingOut: (() => void) | null = null;
  let ringingOut = false;
  const endingPlayed = new Set<string>();
  function releaseEnding() {
    // A timeline stopped before its bell (pause preference, interruption) no longer counts as rung.
    if (endingKey !== null && !ringingOut) endingPlayed.delete(endingKey);
    ++endingRevision; endingRunning = false; endingKey = null; ringingOut = false; endingSeeks = Promise.resolve();
    cancelRingOut?.(); cancelRingOut = null;
    try { removeEndingListener?.(); } catch { /* A released media service can lose its listener. */ } removeEndingListener = null;
    const old = ending; ending = null;
    try { old?.background(false); } catch { /* The media service may already be gone. */ }
    try { old?.pause(); } catch { /* Optional sound cannot block practice. */ }
    try { old?.remove(); } catch { /* The OS may already have released the player. */ }
  }
  function releaseClip() {
    ++clipRevision; cancelPreview?.(); cancelFade?.(); cancelLoad?.(); cancelPreview = cancelFade = cancelLoad = null;
    try { removeClipListener?.(); } catch { /* A released media service can lose its listener. */ } removeClipListener = null;
    const old = clip; clip = null; clipSound = null;
    // Each cleanup must run even if a native media service rejects an earlier call.
    try { old?.background(false); } catch { /* The media service may already be gone. */ }
    try { old?.pause(); } catch { /* Optional sound cannot block practice. */ }
    try { old?.remove(); } catch { /* The OS may already have released the player. */ }
    if (preview !== null) { preview = null; previewChanged(null); }
  }
  function releaseTimeline() {
    cancelAudible?.(); cancelAudible = null;
    ++timelineRevision; timelineRunning = timelinePlayed = false; timelineKey = null; timelineSeeks = Promise.resolve();
    try { removeTimelineListener?.(); } catch { /* A released media service can lose its listener. */ } removeTimelineListener = null;
    const old = timeline; timeline = null;
    try { old?.background(false); } catch { /* The media service may already be gone. */ }
    try { old?.pause(); } catch { /* Optional sound cannot block practice. */ }
    try { old?.remove(); } catch { /* The OS may already have released the player. */ }
  }
  function fade(player: ClipPlayer, to: number, milliseconds: number, done: () => void) {
    cancelFade?.(); const from = player.volume, start = clock.now(), revision = clipRevision;
    const tick = () => {
      if (disposed || revision !== clipRevision || clip !== player) return;
      const x = Math.min(1,(clock.now()-start)/milliseconds), eased = x*x*(3-2*x);
      try { player.volume = from+(to-from)*eased; } catch { releaseClip(); return; }
      if (x === 1) { cancelFade = null; done(); } else cancelFade = clock.schedule(tick,Math.min(40,start+milliseconds-clock.now()));
    }; tick();
  }
  function playClip(sound: PreviewSound, volume: number, isPreview: boolean) {
    releaseClip(); if (disposed || volume <= 0 || !input?.foreground || blocked) return;
    try {
      const player = backend.clip(sound,isPreview && !['start','end','interval'].includes(sound));
      clip = player; clipSound = sound; const token = clipRevision; player.volume = isPreview ? 0 : volume;
      if (!isPreview && sound === 'start' && input.preferences && !input.preferences.intervalSeconds &&
        (input.preferences.sessionSound === 'silence' || input.preferences.sessionVolume === 0)) player.background(true);
      if (isPreview) { preview = sound; previewChanged(sound); }
      let started = false;
      removeClipListener = player.subscribe(status => {
        if (clip !== player || token !== clipRevision) return;
        if (status.error) { releaseClip(); notify('unavailable'); return; }
        if (status.playing && !started) {
          started = true; cancelLoad?.(); cancelLoad = null;
          if (isPreview) fade(player,volume,700,()=>{});
          // Start the fallback at actual playback, so loading cannot shorten the tail.
          const bell = sound === 'start' || sound === 'end' || sound === 'interval' ? sound : null;
          cancelPreview = clock.schedule(() => {
            if (clip !== player || token !== clipRevision) return;
            if (isPreview) fade(player,0,700,releaseClip); else releaseClip();
          }, bell ? BELL_DURATION_MS[bell] + BELL_RELEASE_MARGIN_MS : 12_000);
        } else if (started && !status.playing && status.loaded && !status.buffering) releaseClip();
      });
      // Never permit an old/later load to produce a delayed meditation bell.
      if (!started) cancelLoad = clock.schedule(() => {
        if (clip === player && token === clipRevision && !started) { releaseClip(); notify('unavailable'); }
      }, isPreview ? 10_000 : 2000);
      Promise.resolve(player.play()).catch(() => { if (token === clipRevision) { releaseClip(); notify('unavailable'); } });
    } catch { releaseClip(); notify('unavailable'); }
  }
  function syncTimeline() {
    const prefs = input?.preferences, draft = input?.draft;
    if (!input?.ready || !prefs || !draft || draft.phase === 'finished' || !prefs.intervalSeconds || prefs.bellVolume === 0 || blocked) { releaseTimeline(); return; }
    const key = `${draft.id}/${prefs.intervalSeconds}`, running = draft.phase === 'running';
    const period = prefs.intervalSeconds, seconds = activeAudioSeconds(draft,input.now), position = intervalPosition(seconds, period);
    try {
      if (timelineKey !== key) {
        releaseTimeline(); timeline = backend.timeline(prefs.intervalSeconds); timelineKey = key;
        const owned = timeline;
        removeTimelineListener = owned.subscribe(status => {
          if (owned !== timeline || !timelineRunning) return;
          if (status.playing) timelinePlayed = true;
          if (status.error || timelinePlayed && !status.playing && status.loaded && !status.buffering) {
            blocked = true; releaseTimeline(); releaseClip(); notify(status.error ? 'unavailable' : 'interrupted');
          }
        });
      }
      const owned = timeline!, audible = prefs.bellVolume*MASTER_PLAYBACK_GAIN;
      // The loop begins with a strike: never at the very start of a practice, only after each full interval.
      cancelAudible?.(); cancelAudible = null;
      owned.volume = seconds < FIRST_STRIKE_SECONDS ? 0 : audible;
      if (running && seconds < FIRST_STRIKE_SECONDS) {
        cancelAudible = clock.schedule(() => {
          cancelAudible = null;
          if (timeline === owned && timelineRunning) try { owned.volume = audible; } catch { /* Released meanwhile. */ }
        }, (FIRST_STRIKE_SECONDS - seconds) * 1000 + 50);
      }
      // In Silence, the native interval track owns Android's foreground service.
      owned.background(running && (prefs.sessionSound === 'silence' || prefs.sessionVolume === 0));
      if (!running) { ++timelineRevision; timelineRunning = false; owned.pause(); return; }
      if (!timelineRunning || input.foreground && loopDistance(owned.currentTime, position, period)>1.5) {
        timelineRunning = true; timelinePlayed = false;
        const token = ++timelineRevision;
        timelineSeeks = timelineSeeks.then(async () => {
          if (disposed || timeline !== owned || token !== timelineRevision || !timelineRunning) return;
          await owned.seek(position);
          if (!disposed && timeline === owned && token === timelineRevision && timelineRunning) return owned.play();
        }).catch(() => { if (token === timelineRevision) { blocked = true; releaseTimeline(); notify('unavailable'); } });
      }
    } catch { blocked = true; releaseTimeline(); notify('unavailable'); }
  }
  function syncEnding() {
    if (ringingOut) return; // The End bell is sounding from the timeline; let its tail finish.
    const prefs = input?.preferences, draft = input?.draft;
    if (!input?.ready || !prefs || !draft || draft.phase === 'finished' || draft.mode !== 'fixed' || draft.targetSeconds === null ||
      draft.targetSeconds > ENDING_LEAD_SECONDS || !prefs.closingBellEnabled || prefs.bellVolume === 0 || blocked) { releaseEnding(); return; }
    const key = draft.id, running = draft.phase === 'running';
    const position = ENDING_LEAD_SECONDS - (draft.targetSeconds - activeAudioSeconds(draft, input.now));
    try {
      if (endingKey !== key) {
        releaseEnding(); ending = backend.ending(); endingKey = key;
        const owned = ending, id = draft.id;
        removeEndingListener = owned.subscribe(status => {
          if (owned !== ending) return;
          if (status.playing && endingRunning) endingPlayed.add(id);
          if (status.error) { blocked = true; releaseEnding(); notify('unavailable'); }
        });
      }
      const owned = ending!;
      owned.volume = prefs.bellVolume*MASTER_PLAYBACK_GAIN;
      // With no ambience or interval track, this timeline keeps Android's media service alive.
      owned.background(running && !prefs.intervalSeconds && (prefs.sessionSound === 'silence' || prefs.sessionVolume === 0));
      if (!running) { ++endingRevision; endingRunning = false; owned.pause(); return; }
      // Past the bell's tail (completion not yet processed): never restart the timeline.
      if (position >= ENDING_LEAD_SECONDS + BELL_DURATION_MS.end / 1000) return;
      if (!endingRunning || input.foreground && Math.abs(owned.currentTime-position)>1.5) {
        endingRunning = true;
        const token = ++endingRevision;
        endingSeeks = endingSeeks.then(async () => {
          if (disposed || ending !== owned || token !== endingRevision || !endingRunning) return;
          await owned.seek(Math.max(0, position));
          if (!disposed && ending === owned && token === endingRevision && endingRunning) return owned.play();
        }).catch(() => { if (token === endingRevision) { blocked = true; releaseEnding(); notify('unavailable'); } });
      }
    } catch { blocked = true; releaseEnding(); notify('unavailable'); }
  }
  /** Whether a finished fixed practice already received its End bell from the native timeline. */
  function rangFromTimeline(draft: TimerDraft) {
    return draft.mode === 'fixed' && draft.targetSeconds !== null && draft.activeMilliseconds === draft.targetSeconds * 1000 &&
      endingPlayed.has(draft.id);
  }
  return {
    update(next: SessionSoundInput) {
      if (disposed) return;
      previous = input; input = next;
      const prefs = next.preferences;
      if (!next.foreground && (preview !== null || next.draft?.phase !== 'running')) releaseClip();
      if (next.ready && prefs && previous?.draft) {
        const old = previous.draft, phase = next.draft?.id === old.id ? next.draft.phase : null;
        if (old.phase === 'running' && phase === 'paused') releaseClip();
        if (!ended.has(old.id) && (phase === 'finished' || next.completionId === old.id)) {
          ended.add(old.id); releaseTimeline(); releaseClip();
          const finished = next.draft?.id === old.id && next.draft.phase === 'finished' ? next.draft : null;
          if (finished && rangFromTimeline(finished) && ending && endingKey === old.id) {
            // Already ringing (or rung) at the target: never a second End bell; release after its tail.
            ringingOut = true; const owned = ending;
            cancelRingOut = clock.schedule(() => { if (ending === owned) releaseEnding(); }, BELL_DURATION_MS.end + BELL_RELEASE_MARGIN_MS);
          } else if (finished && rangFromTimeline(finished)) {
            releaseEnding();
          } else {
            releaseEnding();
            if (prefs.closingBellEnabled) playClip('end',prefs.bellVolume*MASTER_PLAYBACK_GAIN,false);
          }
        } else if (phase === null && next.completionId !== old.id) releaseClip();
      }
      // Live changes mute an already sounding bell without changing ambience.
      if (clip && preview === null && prefs) {
        if (clipSound === 'start' && !prefs.openingBellEnabled || clipSound === 'end' && !prefs.closingBellEnabled || prefs.bellVolume === 0) releaseClip();
        else try { clip.volume = prefs.bellVolume*MASTER_PLAYBACK_GAIN; } catch { releaseClip(); notify('unavailable'); }
      }
      syncTimeline();
      syncEnding();
    },
    begin(prefs: AudioPreferences) { blocked = false; notify(null); releaseClip(); if (prefs.openingBellEnabled) playClip('start',prefs.bellVolume*MASTER_PLAYBACK_GAIN,false); },
    preview(sound: PreviewSound, volume: number) {
      if (input?.draft?.phase === 'running') return;
      if (preview === sound) { releaseClip(); return; }
      blocked = false; notify(null);
      playClip(sound,volume*MASTER_PLAYBACK_GAIN,true);
    },
    previewVolume(volume: number) { if (clip && preview !== null) fade(clip,volume*MASTER_PLAYBACK_GAIN,400,()=>{}); },
    stopPreview() {
      if (clip && preview !== null) fade(clip, 0, 180, releaseClip);
    },
    interrupt() { blocked = true; releaseTimeline(); releaseEnding(); releaseClip(); },
    retry() { blocked = false; notify(null); syncTimeline(); syncEnding(); },
    dispose() { disposed = true; releaseTimeline(); releaseEnding(); releaseClip(); },
  };
}
