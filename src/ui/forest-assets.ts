/** Static requires are intentional: Metro bundles every offline growth stage. */
export const FOREST_SOURCES: Readonly<Record<string, number>> = Object.freeze({
  coast_0: require('../../assets/ona/forest/stage-0.webp'),
  coast_1: require('../../assets/ona/design3/coastal-background.webp'),
  coast_2: require('../../assets/ona/forest/stage-2.webp'),
  coast_3: require('../../assets/ona/forest/stage-3.webp'),
  coast_4: require('../../assets/ona/forest/stage-4.webp'),
  coast_5: require('../../assets/ona/forest/stage-5.webp'),
});
/** Dedicated stream-entry scenes; coastal stages above remain shared by Home/session. */
const FOREST_ENTRY_SOURCES: Readonly<Record<string, number>> = Object.freeze({
  coast_0: require('../../assets/ona/forest/entry-0.webp'),
  coast_1: require('../../assets/ona/forest/entry-1.webp'),
  coast_2: require('../../assets/ona/forest/entry-2.webp'),
  coast_3: require('../../assets/ona/forest/entry-3.webp'),
  coast_4: require('../../assets/ona/forest/entry-4.webp'),
  coast_5: require('../../assets/ona/forest/entry-5.webp'),
});
export function forestEntrySource(id: string): number {
  if (!Object.hasOwn(FOREST_ENTRY_SOURCES, id)) throw new RangeError(`Missing forest entry artwork: ${id}`);
  const source = FOREST_ENTRY_SOURCES[id];
  if (source === undefined) throw new RangeError(`Missing forest entry artwork: ${id}`);
  return source;
}
export function forestSource(id: string): number {
  if (!Object.hasOwn(FOREST_SOURCES, id)) throw new RangeError(`Missing forest artwork: ${id}`);
  const source = FOREST_SOURCES[id];
  if (source === undefined) throw new RangeError(`Missing forest artwork: ${id}`);
  return source;
}
