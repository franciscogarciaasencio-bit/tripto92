import type { AudioPreferences } from '../data/audio-preferences';

export type AudioIntent =
  | { readonly kind: 'silent'; readonly immediate: boolean }
  | { readonly kind: 'home'; readonly volume: number }
  | { readonly kind: 'session'; readonly volume: number; readonly background?: true };

/** Explicit app state; audio never reads or changes a timer, session or XP balance. */
export function audioIntent(input: {
  ready: boolean; foreground: boolean; phase: 'running' | 'paused' | 'finished' | null;
  completionPending: boolean; starting: boolean; preferences: AudioPreferences | null;
}): AudioIntent {
  const prefs = input.preferences;
  if (!input.ready || !prefs || input.starting || input.completionPending) return { kind: 'silent', immediate: !input.foreground };
  if (input.phase === 'running') return prefs.sessionSound === 'ocean_music' && prefs.sessionVolume > 0
    ? { kind: 'session', volume: prefs.sessionVolume, ...(!input.foreground ? { background: true as const } : {}) }
    : { kind: 'silent', immediate: !input.foreground };
  if (input.phase !== null || !input.foreground || !prefs.homeEnabled || prefs.homeVolume === 0) {
    return { kind: 'silent', immediate: !input.foreground };
  }
  return { kind: 'home', volume: prefs.homeVolume };
}
