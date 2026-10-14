import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OceanWave } from './ocean-wave';
import { COASTAL_ARTWORK, coastalComposition } from './coastal-composition';
import { forestSource } from './forest-assets';
import { alignedForestArtwork } from './forest-geometry';
import { useReducedMotion } from './reduced-motion';

export const coastalInk = '#20231F';
export const coastalQuiet = '#898579';
export { serifFont as coastalSerif } from './primitives';

export { coastalComposition } from './coastal-composition';
export type CoastalComposition = ReturnType<typeof coastalComposition>;
export const coastalArtwork = require('../../assets/ona/design3/coastal-background.png');

/** Texture uses only the source's empty lower portion. The halo/shoreline appear once. */
export const CoastalTexture = memo(function CoastalTexture({ width, height }: { width: number; height: number }) {
  // One continuous empty-paper crop, not repeated strips (which create visible seams).
  const paperTop = COASTAL_ARTWORK.paperTop;
  const imageScale = Math.max(width / COASTAL_ARTWORK.width, height / (COASTAL_ARTWORK.height - paperTop));
  const imageWidth = COASTAL_ARTWORK.width * imageScale, imageHeight = COASTAL_ARTWORK.height * imageScale;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Image source={coastalArtwork} contentFit="contain" style={{ position: 'absolute', width: imageWidth, height: imageHeight,
      left: (width - imageWidth) / 2, top: height - imageHeight }} />
  </View>;
});

export const CoastalScene = memo(function CoastalScene({ composition: c, completion = false, stageId = 'coast_1', animateWave = true }: {
  composition: CoastalComposition; completion?: boolean; stageId?: string; animateWave?: boolean;
}) {
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const aligned = alignedForestArtwork(stageId, c.artWidth, c.haloCenterX, c.haloCenterY);
  // Completion crops a header from the same, uniformly scaled layer; no alternate landscape or baked wave.
  const headerEnd = 155 * c.scale;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <CoastalTexture width={c.canvasWidth} height={c.contentHeight} />
    <View style={completion ? { position: 'absolute', top: 0, width: c.canvasWidth, height: headerEnd, overflow: 'hidden' } : StyleSheet.absoluteFill}>
      <Image source={forestSource(stageId)} contentFit="contain" onLoad={() => setLoaded(true)}
        transition={reduced || !loaded || stageId === 'coast_0' ? 0 : 900}
        style={{ position: 'absolute', ...aligned,
          top: completion ? 12 * c.scale - aligned.height * 1050 / COASTAL_ARTWORK.height : aligned.top }} />
    </View>
    {animateWave && <View style={{ position: 'absolute', left: 0, top: completion ? headerEnd : c.waveTop }}>
      <OceanWave width={c.canvasWidth} height={completion ? 64 * c.scale : c.waveHeight} />
    </View>}
  </View>;
});
