import artwork from './forest-artwork.json';
import entryArtwork from './forest-entry-artwork.json';

export function forestEntryMetadata(id: string) {
  if (!Object.hasOwn(entryArtwork.stages, id)) throw new RangeError(`Unknown forest entry artwork: ${id}`);
  return entryArtwork.stages[id as keyof typeof entryArtwork.stages];
}
/** Full-bleed entry, centered horizontally with its clear upper title space preserved. */
export function forestEntryStageComposition(id: string, width: number, height: number) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Forest entry dimensions must be positive finite numbers');
  }
  const source = forestEntryMetadata(id);
  const scale = Math.max(width / source.width, height / source.height);
  return { width: source.width * scale, height: source.height * scale,
    left: (width - source.width * scale) / 2, top: 0 };
}

export function forestMetadata(id: string) {
  if (!Object.hasOwn(artwork, id) || id === 'entry') throw new RangeError(`Unknown forest artwork: ${id}`);
  return artwork[id as Exclude<keyof typeof artwork, 'entry'>];
}
/** Each PNG keeps its original aspect ratio; its captured halo aligns with the shared sun. */
export function alignedForestArtwork(id: string, width: number, haloX: number, haloY: number) {
  const source = forestMetadata(id), scale = width / source.width;
  return { width, height: source.height * scale, left: haloX - source.haloX * scale,
    top: haloY - source.haloY * scale };
}
export const FOREST_SWIPE = { activation: 22, verticalTolerance: 18, distance: 64, velocity: 500 } as const;
/** Release threshold: reject short drags, wrong direction, vertical scrolls and multi-touch. */
export function shouldNavigateForest(direction: 'left' | 'right', x: number, y: number, velocity: number) {
  'worklet';
  const sign = direction === 'left' ? -1 : 1;
  return [x, y, velocity].every(Number.isFinite) && x * sign >= FOREST_SWIPE.activation
    && Math.abs(y) < Math.abs(x) * .5
    && (x * sign >= FOREST_SWIPE.distance || velocity * sign >= FOREST_SWIPE.velocity);
}

/** Bounded finger displacement, including reversals and overlong drags; UI-thread safe. */
export function forestDragProgress(direction: 'left' | 'right', translation: number, width: number) {
  'worklet';
  if (!Number.isFinite(translation) || !Number.isFinite(width) || width <= 0) return 0;
  return Math.max(0, Math.min(1, translation * (direction === 'left' ? -1 : 1) / width));
}
/** Nearer destinations take less time, with no spring overshoot. */
export function forestSettleDuration(progress: number, destination: 0 | 1) {
  'worklet';
  return 180 + 180 * Math.abs(destination - Math.max(0, Math.min(1, progress)));
}
