import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import specification from '../../assets/ona/wave-spec.json';
import { colors } from './primitives';
import { useReducedMotion } from './reduced-motion';
import { useForeground } from './use-foreground';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Curve updates run on the UI thread. Neither the timer nor React receives animation-frame updates. */
export const Wave = memo(function Wave({ level = 1, moving }: { level?: number; moving?: boolean }) {
  // The ten approved contours are artwork, sampled along the permanent journey, not a second rank system.
  const contour = Math.min(specification.ranks.length - 1, Math.max(0, Math.floor((level - 1) / 124 * (specification.ranks.length - 1))));
  const points = specification.ranks[contour].path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const reduced = useReducedMotion();
  const foreground = useForeground();
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    if (reduced || !foreground || moving === undefined) { amplitude.set(0); return; }
    if (moving) {
      phase.set(withRepeat(withTiming(phase.get() + Math.PI * 2, { duration: 12_000, easing: Easing.linear }), -1));
    }
    amplitude.set(withTiming(moving ? 6 : 0, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
    return () => { cancelAnimation(phase); cancelAnimation(amplitude); };
  }, [moving, reduced, foreground, phase, amplitude]);
  const animatedProps = useAnimatedProps(() => {
    const p = [...points];
    if (p.length !== 20) return { d: '' };
    // Controls adjacent to each join move together, preserving the original horizontal tangents.
    const crest = Math.sin(phase.value) * amplitude.value;
    const trough = Math.sin(phase.value + 1.2) * amplitude.value;
    for (const index of [5, 7, 9]) p[index] += crest;
    for (const index of [11, 13, 15]) p[index] += trough;
    return { d: 'M ' + p.slice(0, 2).join(' ') + ' C ' + p.slice(2, 8).join(' ') +
      ' C ' + p.slice(8, 14).join(' ') + ' C ' + p.slice(14).join(' ') };
  }, [points]);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: '100%', maxWidth: 300, height: 128 }}>
    <Svg width="100%" height={128} viewBox="0 0 300 128"><AnimatedPath animatedProps={animatedProps}
      stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" /></Svg>
  </View>;
});
