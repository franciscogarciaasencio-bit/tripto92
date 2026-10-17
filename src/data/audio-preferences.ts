import { object, requireData } from './database/validation';

/**
 * Interval bell lengths in minutes (2026-10-16, owner: "configurable at the length the user wants").
 * Each has a looped native track (scripts/build-bell-loops.py). 5, 10 and 15 keep their stored values.
 */
export const INTERVAL_MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60] as const;
const INTERVAL_SECONDS: ReadonlySet<number> = new Set(INTERVAL_MINUTES.map((minutes) => minutes * 60));
export function isIntervalSeconds(value: unknown): value is number {
  return typeof value === 'number' && INTERVAL_SECONDS.has(value);
}

/** Separate from legacy timer/gong preferences; never reinterpret old sound IDs. */
export interface AudioPreferences {
  readonly version: 2;
  readonly homeEnabled: boolean;
  readonly homeVolume: number;
  /** Choir ('ocean_music', its historical ID) or Silence. */
  readonly sessionSound: 'ocean_music' | 'silence';
  readonly sessionVolume: number;
  /** Always true since 2026-10-17 (owner: the starting and ending bells cannot be disabled); kept for stored and synced data. */
  readonly openingBellEnabled: boolean;
  readonly closingBellEnabled: boolean;
  readonly bellVolume: number;
  /** Seconds between interval bells: one of INTERVAL_MINUTES × 60, or null for none. */
  readonly intervalSeconds: number | null;
  readonly hapticsEnabled: boolean;
}

/** Ambience at 20% and bells at 60% for new installs (owner, 2026-10-17); saved choices are kept. */
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = Object.freeze({
  version: 2, homeEnabled: true, homeVolume: 0.2, sessionSound: 'ocean_music',
  sessionVolume: 0.2, openingBellEnabled: true, closingBellEnabled: true,
  bellVolume: 0.6, intervalSeconds: null, hapticsEnabled: false,
});
/** Sounds that were offered once and removed; a stored or synced choice of one plays Choir. */
const RETIRED_SOUNDS: readonly string[] = ['ocean', 'rain', 'storm', 'brown_noise'];

function boolean(value: unknown): boolean {
  requireData(typeof value === 'boolean', 'Audio preference must be a boolean');
  return value;
}
function volume(value: unknown): number {
  requireData(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1,
    'Audio volume must be between zero and one');
  return value;
}
export function decodeAudioPreferences(value: unknown): AudioPreferences {
  const row = object(value);
  requireData(row.version === 2, 'Unsupported audio preferences version');
  requireData(typeof row.sessionSound === 'string' && ['ocean_music', 'silence', ...RETIRED_SOUNDS].includes(row.sessionSound), 'Unsupported meditation sound');
  const sessionSound = row.sessionSound === 'silence' ? 'silence' : 'ocean_music';
  requireData(row.intervalSeconds === null || isIntervalSeconds(row.intervalSeconds), 'Unsupported bell interval');
  // Validated as before, but the bells can no longer be switched off: an old "off" rings again.
  boolean(row.openingBellEnabled); boolean(row.closingBellEnabled);
  return Object.freeze({
    version: 2, homeEnabled: boolean(row.homeEnabled), homeVolume: volume(row.homeVolume),
    sessionSound, sessionVolume: volume(row.sessionVolume),
    openingBellEnabled: true, closingBellEnabled: true,
    bellVolume: volume(row.bellVolume), intervalSeconds: row.intervalSeconds as number | null, hapticsEnabled: boolean(row.hapticsEnabled),
  });
}
