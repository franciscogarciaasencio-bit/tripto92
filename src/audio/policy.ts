import type { AudioPreferences } from '../data/audio-preferences';

/** Quieter playback everywhere without rewriting users' saved volume choices. */
export const MASTER_PLAYBACK_GAIN = 0.5;
export type AudioIntent =
  | { readonly kind: 'silent'; readonly immediate: boolean; readonly background?: true }
  | { readonly kind: 'home'; readonly volume: number }
  | { readonly kind: 'session'; readonly volume: number; readonly background?: true; readonly source?: AmbienceSource };
export type AmbienceSource = Exclude<AudioPreferences['sessionSound'], 'silence'>;

/** Explicit app state; audio never reads or changes a timer, session or XP balance. */
export function audioIntent(input: {
  ready: boolean; foreground: boolean; phase: 'running' | 'paused' | 'finished' | null;
  completionPending: boolean; starting: boolean; preferences: AudioPreferences | null;
}): AudioIntent {
  const prefs = input.preferences;
  if (!input.ready || !prefs || input.starting || input.completionPending) return { kind: 'silent', immediate: !input.foreground };
  if (input.phase === 'running') return prefs.sessionSound !== 'silence' && prefs.sessionVolume > 0
    ? { kind: 'session', volume: prefs.sessionVolume * MASTER_PLAYBACK_GAIN,
      ...(prefs.sessionSound === 'ocean_music' ? {} : { source: prefs.sessionSound }), ...(!input.foreground ? { background: true as const } : {}) }
    : { kind: 'silent', immediate: !input.foreground,
      ...((prefs.intervalSeconds || prefs.openingBellEnabled) && prefs.bellVolume > 0 ? { background: true as const } : {}) };
  if (input.phase !== null || !input.foreground || !prefs.homeEnabled || prefs.homeVolume === 0) {
    return { kind: 'silent', immediate: !input.foreground };
  }
  return { kind: 'home', volume: prefs.homeVolume * MASTER_PLAYBACK_GAIN };
}
