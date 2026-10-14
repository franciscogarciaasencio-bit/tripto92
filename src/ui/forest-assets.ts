/** Static requires are intentional: Metro bundles every offline growth stage. */
export const FOREST_SOURCES: Readonly<Record<string, number>> = Object.freeze({
  coast_0: require('../../assets/ona/forest/stage-0.png'),
  coast_1: require('../../assets/ona/design3/coastal-background.png'),
  coast_2: require('../../assets/ona/forest/stage-2.png'),
  coast_3: require('../../assets/ona/forest/stage-3.png'),
  coast_4: require('../../assets/ona/forest/stage-4.png'),
  coast_5: require('../../assets/ona/forest/stage-5.png'),
});
/** Dedicated stream-entry scenes; coastal stages above remain shared by Home/session. */
const FOREST_ENTRY_SOURCES: Readonly<Record<string, number>> = Object.freeze({
  coast_0: require('../../assets/ona/forest/entry-0.png'),
  coast_1: require('../../assets/ona/forest/entry-1.png'),
  coast_2: require('../../assets/ona/forest/entry-2.png'),
  coast_3: require('../../assets/ona/forest/entry-3.png'),
  coast_4: require('../../assets/ona/forest/entry-4.png'),
  coast_5: require('../../assets/ona/forest/entry-5.png'),
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
