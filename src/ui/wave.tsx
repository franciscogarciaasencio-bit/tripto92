import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import specification from '../../assets/ona/wave-spec.json';
import { colors } from './primitives';
import { useReducedMotion } from './reduced-motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Curve updates run on the UI thread. Neither the timer nor React receives animation-frame updates. */
export const Wave = memo(function Wave({ rankId, moving }: { rankId: string; moving?: boolean }) {
  const points = specification.ranks.find((rank) => rank.id === rankId)?.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(0);
  const practiceMotion = moving !== undefined;
  useEffect(() => {
    if (reduced || !practiceMotion) { cancelAnimation(phase); phase.set(0); amplitude.set(0); return; }
    phase.set(withRepeat(withTiming(Math.PI * 2, { duration: 14_000, easing: Easing.linear }), -1));
    return () => cancelAnimation(phase);
  }, [reduced, practiceMotion, phase, amplitude]);
  useEffect(() => {
    amplitude.set(reduced ? 0 : withTiming(moving ? 2.4 : 0, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
  }, [moving, reduced, amplitude]);
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
