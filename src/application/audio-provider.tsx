import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { audioBackend } from '@/audio/backend';
import { createAudioController, type AudioController, type SoundNotice } from '@/audio/controller';
import { audioIntent } from '@/audio/policy';
import { useForeground } from '@/ui/use-foreground';
import { useOna } from './ona-provider';

function useAudioService() {
  const app = useOna();
  const foreground = useForeground();
  const controller = useRef<AudioController | null>(null);
  const beginning = useRef(false);
  const [notice, setNotice] = useState<SoundNotice>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const owned = createAudioController(audioBackend, {
      now: () => performance.now(),
      schedule(callback, milliseconds) { const timeout = setTimeout(callback, milliseconds); return () => clearTimeout(timeout); },
    }, setNotice);
    controller.current = owned;
    return () => { controller.current = null; owned.dispose(); };
  }, []);
  useEffect(() => {
    controller.current?.setIntent(audioIntent({
      ready: app.ready, foreground, phase: app.draft?.phase ?? null,
      completionPending: app.completion !== null, starting, preferences: app.audioPreferences,
    }));
  }, [app.ready, app.draft?.phase, app.completion, starting, app.audioPreferences, foreground]);
  useEffect(() => {
    // Stop Home inside the lifecycle callback, before JS/render work can be suspended.
    const subscription = AppState.addEventListener('change', (state) => {
      controller.current?.setIntent(audioIntent({
        ready: app.ready, foreground: state === 'active', phase: app.draft?.phase ?? null,
        completionPending: app.completion !== null, starting, preferences: app.audioPreferences,
      }));
    });
    return () => subscription.remove();
  }, [app.ready, app.draft?.phase, app.completion, starting, app.audioPreferences]);
  return {
    notice,
    retry: () => controller.current?.retry(),
    async begin() {
      if (beginning.current || app.busy) return false;
      beginning.current = true;
      setStarting(true);
      // Start the Home fade at the tap, independently of SQLite transaction latency.
      controller.current?.setIntent({ kind: 'silent', immediate: false });
      try { return await app.begin(); } finally { beginning.current = false; setStarting(false); }
    },
  };
}
const AudioContext = createContext<ReturnType<typeof useAudioService> | null>(null);
export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useAudioService();
  return <AudioContext.Provider value={audio}>{children}</AudioContext.Provider>;
}
export function useOnaAudio() {
  const audio = useContext(AudioContext);
  if (!audio) throw new Error('AudioProvider is required');
  return audio;
}
