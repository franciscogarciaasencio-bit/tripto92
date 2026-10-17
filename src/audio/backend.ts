import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import type { AudioBackend } from './controller';
import { ambienceAsset } from './assets';

export const audioBackend: AudioBackend = {
  configure: (background) => setAudioModeAsync({
    playsInSilentMode: true, allowsRecording: false, interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: background, shouldRouteThroughEarpiece: false,
  }),
  create(source = 'ocean_music') {
    const player = createAudioPlayer(ambienceAsset(source), { updateInterval: 250 });
    // The volume is remembered here and never read back from the player: on Android that read waits
    // for the main thread, which can be busy with a screen transition (Settings → Save → Home) and
    // stall or crash the app. Setting it is asynchronous and safe.
    let volume = 0;
    try { player.volume = 0; player.loop = true; }
    catch (error) { player.remove(); throw error; }
    return {
      get volume() { return volume; },
      set volume(value) { player.volume = value; volume = value; },
      play: () => player.play(), pause: () => player.pause(), remove: () => player.remove(),
      background(active) {
        // Android needs its media foreground service for playback beyond ~3 minutes.
        // Avoid taking over another app's lock screen for Home or on iOS.
        if (Platform.OS === 'android') player.setActiveForLockScreen(active,
          { title: 'Ona meditation', artist: 'Ona' },
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
