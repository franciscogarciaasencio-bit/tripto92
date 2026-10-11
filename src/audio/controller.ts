import type { AudioIntent } from './policy';

export interface PlaybackStatus { playing: boolean; loaded: boolean; buffering: boolean; error: string | null }
export interface SoundPlayer {
  volume: number;
  play(): void | Promise<void>;
  pause(): void;
  background(active: boolean): void;
  subscribe(listener: (status: PlaybackStatus) => void): () => void;
  remove(): void;
}
export interface AudioBackend {
  create(): SoundPlayer;
  configure(background: boolean): Promise<void>;
}
export interface AudioClock {
  now(): number;
  schedule(callback: () => void, milliseconds: number): () => void;
}
export type SoundNotice = 'unavailable' | 'interrupted' | null;
const FADE = { home: 2500, session: 1500, stop: 1000, volume: 1000, step: 50, loadTimeout: 15000 };

/** One owner, one player. Latest intent wins across fades AND asynchronous native mode changes. */
export function createAudioController(backend: AudioBackend, clock: AudioClock, notify: (notice: SoundNotice) => void) {
  let intent: AudioIntent = { kind: 'silent', immediate: true };
  let player: SoundPlayer | null = null;
  let unsubscribe: (() => void) | null = null;
  let owner: 'home' | 'session' | null = null;
  let revision = 0;
  let disposed = false;
  let blocked = false;
  let requested = false;
  let waitingForPlay = false;
  let cancelFade: (() => void) | null = null;
  let cancelLoad: (() => void) | null = null;
  let configuration = Promise.resolve();

  function cancelPending() {
    cancelFade?.(); cancelFade = null;
    cancelLoad?.(); cancelLoad = null;
  }
  function pause() {
    requested = false; waitingForPlay = false; owner = null;
    if (player) { player.pause(); player.background(false); }
  }
  function failure(notice: Exclude<SoundNotice, null>) {
    if (disposed) return;
    ++revision; blocked = true; cancelPending();
    try { if (player) player.volume = 0; pause(); } catch { /* Best effort release below. */ }
    // A failed source is retried with a fresh player; an interruption retains its position.
    if (notice === 'unavailable') {
      try { unsubscribe?.(); } catch { /* Native media services may already be gone. */ }
      unsubscribe = null;
      try { player?.remove(); } catch { /* Never interfere with practice saving. */ }
      player = null;
    }
    notify(notice);
  }
  function fade(target: number, duration: number, token: number, done = () => {}) {
    cancelFade?.();
    if (!player) { done(); return; }
    const active = player;
    const from = active.volume;
    const start = clock.now();
    let cancelled = false;
    let cancelTick: (() => void) | null = null;
    cancelFade = () => { cancelled = true; cancelTick?.(); };
    function tick() {
      if (cancelled || disposed || token !== revision || active !== player) return;
      try {
        const fraction = Math.min(1, Math.max(0, (clock.now() - start) / duration));
        const eased = fraction * fraction * (3 - 2 * fraction);
        active.volume = from + (target - from) * eased;
        if (fraction === 1) { cancelFade = null; done(); }
        else cancelTick = clock.schedule(tick, FADE.step);
      } catch { failure('unavailable'); }
    }
    tick();
  }
  function configure(background: boolean, token: number, done: () => void) {
    // Serialize the process-global audio mode. An old Promise cannot overwrite newer playback.
    configuration = configuration.then(async () => {
      if (disposed || token !== revision) return;
      await backend.configure(background);
      if (!disposed && token === revision) done();
    }).catch(() => { if (!disposed && token === revision) failure('unavailable'); });
  }
  function status(update: PlaybackStatus) {
    if (disposed || !requested) return;
    if (update.error) { failure('unavailable'); return; }
    if (update.playing && waitingForPlay && intent.kind !== 'silent' && owner === intent.kind) {
      waitingForPlay = false; cancelLoad?.(); cancelLoad = null;
      if (intent.kind === 'session' && intent.background) { if (player) player.volume = intent.volume; }
      else fade(intent.volume, FADE[intent.kind], revision);
    } else if (!update.playing && update.loaded && !update.buffering && !waitingForPlay) {
      // OS/media controls stopped playback: no blind auto-resume over a call or other audio.
      failure('interrupted');
    }
  }
  function start(token: number) {
    if (disposed || blocked || token !== revision || intent.kind === 'silent') return;
    const next = intent;
    configure(next.kind === 'session', token, () => {
      try {
        if (!player) {
          player = backend.create();
          player.volume = 0;
          const owned = player;
          unsubscribe = player.subscribe((update) => {
            if (player !== owned) return;
            try { status(update); } catch { failure('unavailable'); }
          });
        }
        player.volume = next.kind === 'session' && next.background ? next.volume : 0;
        owner = next.kind; requested = true; waitingForPlay = true;
        player.background(next.kind === 'session');
        if (!(next.kind === 'session' && next.background)) {
          cancelLoad = clock.schedule(() => failure('unavailable'), FADE.loadTimeout);
        }
        Promise.resolve(player.play()).catch(() => { if (token === revision && !disposed) failure('unavailable'); });
      } catch { failure('unavailable'); }
    });
  }
  function apply(next: AudioIntent, retry = false) {
    if (disposed) return;
    if (!retry && JSON.stringify(intent) === JSON.stringify(next)) return;
    intent = next;
    const token = ++revision;
    // Do not cancel a pending load watchdog on a mere volume change.
    cancelFade?.(); cancelFade = null;
    if (retry) { blocked = false; notify(null); }
    if (next.kind === 'silent') {
      cancelLoad?.(); cancelLoad = null;
      const stop = () => { pause(); configure(false, token, () => {}); };
      if (next.immediate || !player) {
        try { if (player) player.volume = 0; stop(); } catch { failure('unavailable'); }
      } else fade(0, FADE.stop, token, stop);
    } else if (!blocked) {
      if (next.kind === 'session' && next.background) {
        // JS fades may freeze at lock. Never leave Home's old volume under an active practice.
        cancelLoad?.(); cancelLoad = null;
        if (owner === 'session' && requested && player) player.volume = next.volume;
        else {
          if (player) player.volume = 0;
          pause(); start(token);
        }
        return;
      }
      if (owner === next.kind && requested) {
        if (!waitingForPlay) fade(next.volume, FADE.volume, token);
        else if (!cancelLoad) cancelLoad = clock.schedule(() => failure('unavailable'), FADE.loadTimeout);
      } else if (owner !== null && player) {
        fade(0, FADE.stop, token, () => { pause(); start(token); });
      } else start(token);
    }
  }
  return {
    setIntent(next: AudioIntent) {
      try { apply(next); } catch { failure('unavailable'); }
    },
    retry() {
      try { apply(intent, true); } catch { failure('unavailable'); }
    },
    dispose() {
      if (disposed) return;
      disposed = true; ++revision; cancelPending();
      try { unsubscribe?.(); } catch { /* Native media services may already be gone. */ }
      unsubscribe = null;
      try { if (player) { player.volume = 0; pause(); } } catch { /* Cleanup cannot affect persisted practice. */ }
      try { player?.remove(); } catch { /* The OS may already have released the player. */ }
      player = null;
      // Queued configurations check disposed. No late Promise can create a new player.
    },
  };
}
export type AudioController = ReturnType<typeof createAudioController>;
