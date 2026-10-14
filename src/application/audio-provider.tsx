import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { audioBackend } from '@/audio/backend';
import { createAudioController, type AudioController, type SoundNotice } from '@/audio/controller';
import { audioIntent } from '@/audio/policy';
import { useForeground } from '@/ui/use-foreground';
import { useOna, type PracticeSetup } from './ona-provider';
import { sessionAudioBackend } from '@/audio/session-backend';
import { createSessionSoundController, type PreviewSound } from '@/audio/session-controller';

function useAudioService() {
  const app = useOna();
  const foreground = useForeground();
  const controller = useRef<AudioController | null>(null);
  const sessionSounds = useRef<ReturnType<typeof createSessionSoundController> | null>(null);
  const beginning = useRef(false);
  const [notice, setNotice] = useState<SoundNotice>(null);
  const [starting, setStarting] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewSound | null>(null);
  const stopPreview = useCallback(() => sessionSounds.current?.stopPreview(), []);
  useEffect(() => {
    const clock = {
      now: () => performance.now(),
      schedule(callback: () => void, milliseconds: number) { const timeout = setTimeout(callback, milliseconds); return () => clearTimeout(timeout); },
    };
    const clips = createSessionSoundController(sessionAudioBackend,clock,setNotice,setPreviewing);
    sessionSounds.current = clips;
    const owned = createAudioController(audioBackend, clock, value => { setNotice(value); if (value) clips.interrupt(); });
    controller.current = owned;
    return () => { controller.current = null; sessionSounds.current = null; owned.dispose(); clips.dispose(); };
  }, []);
  useEffect(() => {
    controller.current?.setIntent(audioIntent({
      ready: app.ready, foreground, phase: app.draft?.phase ?? null,
      completionPending: app.completion !== null, starting: starting || previewing !== null, preferences: app.audioPreferences,
    }));
  }, [app.ready, app.draft?.phase, app.completion, starting, previewing, app.audioPreferences, foreground]);
  useEffect(() => {
    const update = () => sessionSounds.current?.update({ ready: app.ready, foreground: AppState.currentState === 'active',
      now: Date.now(), draft: app.draft, completionId: app.completion?.session.id ?? null, preferences: app.audioPreferences });
    update();
    const sync = setInterval(update,30_000);
    const lifecycle = AppState.addEventListener('change', state => sessionSounds.current?.update({ ready: app.ready, foreground: state === 'active',
      now: Date.now(), draft: app.draft, completionId: app.completion?.session.id ?? null, preferences: app.audioPreferences }));
    return () => { clearInterval(sync); lifecycle.remove(); };
  }, [app.ready, app.draft, app.completion, app.audioPreferences, foreground]);
  useEffect(() => {
    // Stop Home inside the lifecycle callback, before JS/render work can be suspended.
    const subscription = AppState.addEventListener('change', (state) => {
      controller.current?.setIntent(audioIntent({
        ready: app.ready, foreground: state === 'active', phase: app.draft?.phase ?? null,
        completionPending: app.completion !== null, starting: starting || previewing !== null, preferences: app.audioPreferences,
      }));
    });
    return () => subscription.remove();
  }, [app.ready, app.draft?.phase, app.completion, starting, previewing, app.audioPreferences]);
  return {
    notice,
    starting,
    previewing,
    preview: (sound: PreviewSound, volume: number) => sessionSounds.current?.preview(sound,volume),
    previewVolume: (volume: number) => sessionSounds.current?.previewVolume(volume),
    stopPreview,
    retry: () => { controller.current?.retry(); sessionSounds.current?.retry(); },
    async begin(setup?: PracticeSetup) {
      if (beginning.current || app.busy) return false;
      beginning.current = true;
      setStarting(true);
      // Start the Home fade at the tap, independently of SQLite transaction latency.
      controller.current?.setIntent({ kind: 'silent', immediate: false });
      try {
        const saved = await app.begin(setup);
        if (saved && app.audioPreferences) sessionSounds.current?.begin(app.audioPreferences);
        return saved;
      } finally { beginning.current = false; setStarting(false); }
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
