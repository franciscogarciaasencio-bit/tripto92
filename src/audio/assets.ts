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
  ocean_music: require('../../assets/audio/meditation-choir.wav'),
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
export const intervalAsset = (seconds: 300 | 600 | 900): number => ({
  300: require('../../assets/audio/bells-v2/interval-5m.m4a'),
  600: require('../../assets/audio/bells-v2/interval-10m.m4a'),
  900: require('../../assets/audio/bells-v2/interval-15m.m4a'),
})[seconds];
