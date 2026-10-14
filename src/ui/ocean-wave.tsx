import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import trace from '../../assets/ona/design3/wave-trace.json';
import { oceanPath, OCEAN_AMPLITUDES, OCEAN_VIEWBOX } from './ocean-geometry';
import { useOceanMotion } from './ocean-motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const nodes = trace.paths.map((path) => path.filter((_, index) => index % 3 === 0 || index === path.length - 1).map(([x, y]) => [x, y] as const));
const darkRest = oceanPath(nodes[0], 0, 0, 0), lightRest = oceanPath(nodes[1], 0, 0, 0);

/** Shared native SVG swell in its own band; only these two paths update, never the screen. */
export const OceanWave = memo(function OceanWave({ width, height }: { width: number; height: number }) {
  const { phase, amplitude } = useOceanMotion();
  const dark = useAnimatedProps(() => ({ d: oceanPath(nodes[0], phase.value, OCEAN_AMPLITUDES.dark, amplitude.value) }));
  const light = useAnimatedProps(() => ({ d: oceanPath(nodes[1], phase.value + .24, OCEAN_AMPLITUDES.light, amplitude.value) }));
  return <Svg width={width} height={height} viewBox={OCEAN_VIEWBOX} preserveAspectRatio="none" accessible={false}>
      <AnimatedPath d={lightRest} animatedProps={light} stroke="#C8B9A4" strokeOpacity={.843} strokeWidth={3.2} fill="none" />
      <AnimatedPath d={darkRest} animatedProps={dark} stroke="#141414" strokeWidth={4.3} fill="none" />
  </Svg>;
});
