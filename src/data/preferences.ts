import { integer, object, requireData, text } from './database/validation';

/** Optional intentions offered before a practice. IDs are stable; wording lives in the UI. */
export const INTENTIONS = ['calm', 'focus', 'rest', 'gratitude', 'kindness'] as const;
export type Intention = (typeof INTENTIONS)[number];
/** Fixed durations offered before a practice, in minutes. Open-ended stays the default. */
export const FIXED_DURATIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export interface MeditationPreferences {
  /** With durationMode 'fixed', the chosen length; also the historical default duration. */
  readonly defaultDurationSeconds: number;
  readonly ambientSoundId: string | null;
  readonly gongIntervalSeconds: number | null;
  readonly ambienceVolume: number;
  readonly gongVolume: number;
  /** How the next practice is set up on the pre-meditation screen. */
  readonly durationMode: 'open' | 'fixed';
  readonly intention: Intention | null;
}

export const DEFAULT_PREFERENCES: MeditationPreferences = Object.freeze({
  defaultDurationSeconds: 600, ambientSoundId: null, gongIntervalSeconds: null,
  ambienceVolume: 0.3, gongVolume: 0.5, durationMode: 'open', intention: null,
});

function volume(value: unknown): number {
  requireData(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'Volume must be between zero and one');
  return value;
}

/** Documents saved before the pre-meditation screen have no mode or intention: they mean open, none. */
export function decodePreferences(value: unknown): MeditationPreferences {
  const row = object(value);
  const durationMode = row.durationMode ?? 'open';
  requireData(durationMode === 'open' || durationMode === 'fixed', 'Unsupported practice duration mode');
  const intention = row.intention ?? null;
  requireData(intention === null || (INTENTIONS as readonly unknown[]).includes(intention), 'Unsupported intention');
  const defaultDurationSeconds = integer(row.defaultDurationSeconds, 1);
  requireData(durationMode === 'open' || defaultDurationSeconds <= 10_800, 'Fixed practice must be at most 180 minutes');
  return Object.freeze({
    defaultDurationSeconds,
    ambientSoundId: row.ambientSoundId === null ? null : text(row.ambientSoundId),
    gongIntervalSeconds: row.gongIntervalSeconds === null ? null : integer(row.gongIntervalSeconds, 1),
    ambienceVolume: volume(row.ambienceVolume), gongVolume: volume(row.gongVolume),
    durationMode, intention: intention as Intention | null,
  });
}
