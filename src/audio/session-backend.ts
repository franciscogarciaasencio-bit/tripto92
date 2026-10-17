import { createAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { ambienceAsset, bellAsset, endingTimelineAsset, intervalAsset } from './assets';
import type { ClipPlayer, SessionAudioBackend } from './session-controller';

function create(source: number, loop = false): ClipPlayer {
  const player = createAudioPlayer(source, { updateInterval: 250, keepAudioSessionActive: true });
  // Remembered, never read back: reading a native player's volume blocks on Android's main thread (see backend.ts).
  let volume = 0;
  try { player.volume = 0; player.loop = loop; }
  catch (error) { player.remove(); throw error; }
  return {
    get volume() { return volume; }, set volume(value) { player.volume = value; volume = value; },
    get currentTime() { return player.currentTime; },
    play: () => player.play(), pause: () => player.pause(), seek: seconds => player.seekTo(seconds), remove: () => player.remove(),
    background(active) {
      if (Platform.OS === 'android') player.setActiveForLockScreen(active, { title: 'Ona meditation', artist: 'Ona' },
        { showSeekBackward: false, showSeekForward: false, isLiveStream: true });
    },
    subscribe(listener) {
      const subscription = player.addListener('playbackStatusUpdate', s => listener({ playing: s.playing, loaded: s.isLoaded, buffering: s.isBuffering, error: s.error }));
      return () => subscription.remove();
    },
  };
}
export const sessionAudioBackend: SessionAudioBackend = {
  clip(sound, loop) {
    return create(sound === 'start' || sound === 'end' ? bellAsset(sound) : ambienceAsset(sound), loop);
  },
  timeline: seconds => create(intervalAsset(seconds), true),
  ending: () => create(endingTimelineAsset()),
};
