import { object, requireData } from './database/validation';

/** Separate from legacy timer/gong preferences; never reinterpret old sound IDs. */
export interface AudioPreferences {
  readonly version: 1;
  readonly homeEnabled: boolean;
  readonly homeVolume: number;
  readonly sessionSound: 'ocean_music' | 'silence';
  readonly sessionVolume: number;
  readonly openingBellEnabled: boolean;
  readonly closingBellEnabled: boolean;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = Object.freeze({
  version: 1, homeEnabled: true, homeVolume: 0.15, sessionSound: 'ocean_music',
  sessionVolume: 0.15, openingBellEnabled: false, closingBellEnabled: false,
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
  requireData(row.version === 1, 'Unsupported audio preferences version');
  requireData(row.sessionSound === 'ocean_music' || row.sessionSound === 'silence', 'Unsupported meditation sound');
  return Object.freeze({
    version: 1, homeEnabled: boolean(row.homeEnabled), homeVolume: volume(row.homeVolume),
    sessionSound: row.sessionSound, sessionVolume: volume(row.sessionVolume),
    openingBellEnabled: boolean(row.openingBellEnabled), closingBellEnabled: boolean(row.closingBellEnabled),
  });
}
