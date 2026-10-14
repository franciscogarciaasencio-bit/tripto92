import { object, requireData } from './database/validation';

/** Separate from legacy timer/gong preferences; never reinterpret old sound IDs. */
export interface AudioPreferences {
  readonly version: 2;
  readonly homeEnabled: boolean;
  readonly homeVolume: number;
  readonly sessionSound: 'ocean_music' | 'ocean' | 'rain' | 'storm' | 'brown_noise' | 'silence';
  readonly sessionVolume: number;
  readonly openingBellEnabled: boolean;
  readonly closingBellEnabled: boolean;
  readonly bellVolume: number;
  readonly intervalSeconds: 300 | 600 | 900 | null;
  readonly hapticsEnabled: boolean;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = Object.freeze({
  version: 2, homeEnabled: true, homeVolume: 0.15, sessionSound: 'ocean',
  sessionVolume: 0.15, openingBellEnabled: true, closingBellEnabled: true,
  bellVolume: 0.18, intervalSeconds: null, hapticsEnabled: false,
});

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
  requireData(typeof row.sessionSound === 'string' && ['ocean_music','ocean','rain','storm','brown_noise','silence'].includes(row.sessionSound), 'Unsupported meditation sound');
  requireData(row.intervalSeconds === null || row.intervalSeconds === 300 || row.intervalSeconds === 600 || row.intervalSeconds === 900, 'Unsupported bell interval');
  return Object.freeze({
    version: 2, homeEnabled: boolean(row.homeEnabled), homeVolume: volume(row.homeVolume),
    sessionSound: row.sessionSound as AudioPreferences['sessionSound'], sessionVolume: volume(row.sessionVolume),
    openingBellEnabled: boolean(row.openingBellEnabled), closingBellEnabled: boolean(row.closingBellEnabled),
    bellVolume: volume(row.bellVolume), intervalSeconds: row.intervalSeconds as AudioPreferences['intervalSeconds'], hapticsEnabled: boolean(row.hapticsEnabled),
  });
}
