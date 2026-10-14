import { Asset } from 'expo-asset';
import type { AudioBackend, PlaybackStatus } from './controller';
import { ambienceAsset } from './assets';

/** SDK 57's web play() discards HTMLMediaElement.play()'s rejected Promise.
 * Use the browser boundary directly so blocked autoplay is a controlled sound notice.
 * Native builds always resolve backend.ts (expo-audio), never this module.
 */
export const audioBackend: AudioBackend = {
  configure: async () => {},
  create(source = 'ocean_music') {
    const asset = Asset.fromModule(ambienceAsset(source));
    const media = new Audio(asset.localUri ?? asset.uri);
    media.volume = 0; media.loop = true; media.preload = 'auto';
    let removeListener: (() => void) | null = null;
    return {
      get volume() { return media.volume; },
      set volume(value) { media.volume = value; },
      play: () => media.play(), pause: () => media.pause(), background: () => {},
      subscribe(listener) {
        let buffering = false;
        const emit = () => {
          const status: PlaybackStatus = {
            playing: !media.paused && !media.ended, loaded: media.readyState >= 2,
            buffering, error: media.error ? `Playback error ${media.error.code}` : null,
          };
          listener(status);
        };
        const playing = () => { buffering = false; emit(); };
        const waiting = () => { buffering = true; emit(); };
        const events: [string, () => void][] = [
          ['playing', playing], ['waiting', waiting], ['pause', emit], ['loadeddata', emit], ['error', emit],
        ];
        events.forEach(([name, callback]) => media.addEventListener(name, callback));
        removeListener = () => events.forEach(([name, callback]) => media.removeEventListener(name, callback));
        return () => { removeListener?.(); removeListener = null; };
      },
      remove() {
        removeListener?.(); removeListener = null;
        media.pause(); media.removeAttribute('src'); media.load();
      },
    };
  },
};
