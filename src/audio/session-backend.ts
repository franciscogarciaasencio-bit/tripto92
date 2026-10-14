import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { ambienceAsset, bellAsset, intervalAsset } from './assets';
import type { ClipPlayer, SessionAudioBackend } from './session-controller';

function create(source: number, loop = false): ClipPlayer {
  const player = createAudioPlayer(source, { updateInterval: 250, keepAudioSessionActive: true });
  try { player.volume = 0; player.loop = loop; }
  catch (error) { player.remove(); throw error; }
  return {
    get volume() { return player.volume; }, set volume(value) { player.volume = value; },
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
    return create(sound === 'start' || sound === 'end' || sound === 'interval' ? bellAsset(sound) : ambienceAsset(sound), loop);
  },
  timeline: seconds => create(intervalAsset(seconds)),
  feedback() {
    const pending = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    void pending.catch(() => {});
  },
};
