import { Asset } from 'expo-asset';
import { ambienceAsset, bellAsset, endingTimelineAsset, intervalAsset } from './assets';
import type { ClipPlayer, SessionAudioBackend } from './session-controller';

function create(source: number, loop = false): ClipPlayer {
  const asset = Asset.fromModule(source), media = new Audio(asset.localUri ?? asset.uri);
  media.volume = 0; media.loop = loop; media.preload = 'auto';
  let unsubscribe = () => {};
  return {
    get volume() { return media.volume; }, set volume(value) { media.volume = value; },
    get currentTime() { return media.currentTime; },
    play: () => media.play(), pause: () => media.pause(),
    async seek(seconds) {
      if (media.readyState < 1) await new Promise<void>((resolve,reject) => {
        const done = () => { cleanup(); resolve(); }, failed = () => { cleanup(); reject(new Error('Sound could not load')); };
        const timeout = setTimeout(failed,10_000);
        const cleanup = () => { clearTimeout(timeout); media.removeEventListener('loadedmetadata',done); media.removeEventListener('error',failed); };
        media.addEventListener('loadedmetadata',done); media.addEventListener('error',failed);
      });
      media.currentTime = seconds;
    },
    background: () => {},
    subscribe(listener) {
      let buffering = false;
      const emit = () => listener({ playing: !media.paused && !media.ended, loaded: media.readyState>=2, buffering, error: media.error ? 'Sound unavailable' : null });
      const playing = () => { buffering = false; emit(); }, waiting = () => { buffering = true; emit(); };
      const events = [['playing',playing],['waiting',waiting],['pause',emit],['ended',emit],['error',emit]] as const;
      events.forEach(([name,callback]) => media.addEventListener(name,callback));
      unsubscribe = () => events.forEach(([name,callback]) => media.removeEventListener(name,callback));
      return unsubscribe;
    },
    remove() { unsubscribe(); media.pause(); media.removeAttribute('src'); media.load(); },
  };
}
export const sessionAudioBackend: SessionAudioBackend = {
  clip(sound,loop) { return create(sound === 'start' || sound === 'end' || sound === 'interval' ? bellAsset(sound) : ambienceAsset(sound),loop); },
  timeline: seconds => create(intervalAsset(seconds), true), ending: () => create(endingTimelineAsset()),
};
