import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import type { AudioBackend } from './controller';

export const audioBackend: AudioBackend = {
  configure: (background) => setAudioModeAsync({
    playsInSilentMode: true, allowsRecording: false, interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: background, shouldRouteThroughEarpiece: false,
  }),
  create() {
    const player = createAudioPlayer(require('../../assets/audio/meditation-choir.wav'), { updateInterval: 250 });
    try { player.volume = 0; player.loop = true; }
    catch (error) { player.remove(); throw error; }
    return {
      get volume() { return player.volume; },
      set volume(value) { player.volume = value; },
      play: () => player.play(), pause: () => player.pause(), remove: () => player.remove(),
      background(active) {
        // Android needs its media foreground service for playback beyond ~3 minutes.
        // Avoid taking over another app's lock screen for Home or on iOS.
        if (Platform.OS === 'android') player.setActiveForLockScreen(active,
          { title: 'Ona meditation', artist: 'zazz.sound.design' },
          { showSeekBackward: false, showSeekForward: false, isLiveStream: true });
      },
      subscribe(listener) {
        const subscription = player.addListener('playbackStatusUpdate', (status) => listener({
          playing: status.playing, loaded: status.isLoaded, buffering: status.isBuffering, error: status.error,
        }));
        return () => subscription.remove();
      },
    };
  },
};
