import type { AmbienceSource } from './policy';
export type BellSound = 'start' | 'end' | 'interval';
export const AMBIENCES = [
  { id: 'ocean', name: 'Ocean', description: 'A quiet shore, slowly washing waves.' },
  { id: 'rain', name: 'Rain', description: 'Soft rainfall, steady and close.' },
  { id: 'storm', name: 'Storm', description: 'Rain with distant, gentle thunder.' },
  { id: 'brown_noise', name: 'Brown Noise', description: 'Deep, warm, even sound.' },
  { id: 'silence', name: 'Silence', description: 'No ambience. Your bells remain optional.' },
  { id: 'ocean_music', name: 'Choir', description: 'The original Ona soundtrack.' },
] as const;
export const ambienceAsset = (source: AmbienceSource): number => ({
  ocean_music: require('../../assets/audio/meditation-choir.m4a'),
  ocean: require('../../assets/audio/meditation/ocean.m4a'),
  rain: require('../../assets/audio/meditation/rain.m4a'),
  storm: require('../../assets/audio/meditation/storm.m4a'),
  // Metro asset import; Expo's lint asset-extension list does not yet include FLAC.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  brown_noise: require('../../assets/audio/meditation/brown-noise.flac'),
})[source];
export const bellAsset = (sound: BellSound): number => ({
  start: require('../../assets/audio/bells-v2/start.wav'),
  end: require('../../assets/audio/bells-v2/end.wav'),
  interval: require('../../assets/audio/bells-v2/interval.wav'),
})[sound];
/** The interval master then silence, one looped track per offered length (scripts/build-bell-loops.py). */
const INTERVAL_LOOPS: Readonly<Record<number, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  60: require('../../assets/audio/bells-v2/interval-loop-1m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  120: require('../../assets/audio/bells-v2/interval-loop-2m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  180: require('../../assets/audio/bells-v2/interval-loop-3m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  240: require('../../assets/audio/bells-v2/interval-loop-4m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  300: require('../../assets/audio/bells-v2/interval-loop-5m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  360: require('../../assets/audio/bells-v2/interval-loop-6m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  420: require('../../assets/audio/bells-v2/interval-loop-7m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  480: require('../../assets/audio/bells-v2/interval-loop-8m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  540: require('../../assets/audio/bells-v2/interval-loop-9m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  600: require('../../assets/audio/bells-v2/interval-loop-10m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  720: require('../../assets/audio/bells-v2/interval-loop-12m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  900: require('../../assets/audio/bells-v2/interval-loop-15m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1200: require('../../assets/audio/bells-v2/interval-loop-20m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1500: require('../../assets/audio/bells-v2/interval-loop-25m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1800: require('../../assets/audio/bells-v2/interval-loop-30m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  2400: require('../../assets/audio/bells-v2/interval-loop-40m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  2700: require('../../assets/audio/bells-v2/interval-loop-45m.flac'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  3600: require('../../assets/audio/bells-v2/interval-loop-60m.flac'),
};
export const intervalAsset = (seconds: number): number => {
  const asset = INTERVAL_LOOPS[seconds];
  if (asset === undefined) throw new RangeError('Unsupported bell interval');
  return asset;
};
/** Silence, then the End bell after exactly one hour (scripts/build-ending-timeline.py). */
export const endingTimelineAsset = (): number => require('../../assets/audio/bells-v2/ending-timeline.m4a');
