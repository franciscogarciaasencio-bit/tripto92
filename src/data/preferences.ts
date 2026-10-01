import { integer, object, requireData, text } from './database/validation';

export interface MeditationPreferences {
  readonly defaultDurationSeconds: number;
  readonly ambientSoundId: string | null;
  readonly gongIntervalSeconds: number | null;
  readonly ambienceVolume: number;
  readonly gongVolume: number;
}

export const DEFAULT_PREFERENCES: MeditationPreferences = Object.freeze({
  defaultDurationSeconds: 600, ambientSoundId: null, gongIntervalSeconds: null,
  ambienceVolume: 0.3, gongVolume: 0.5,
});

function volume(value: unknown): number {
  requireData(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'Volume must be between zero and one');
  return value;
}

export function decodePreferences(value: unknown): MeditationPreferences {
  const row = object(value);
  return Object.freeze({
    defaultDurationSeconds: integer(row.defaultDurationSeconds, 1),
    ambientSoundId: row.ambientSoundId === null ? null : text(row.ambientSoundId),
    gongIntervalSeconds: row.gongIntervalSeconds === null ? null : integer(row.gongIntervalSeconds, 1),
    ambienceVolume: volume(row.ambienceVolume), gongVolume: volume(row.gongVolume),
  });
}
