import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from './reduced-motion';

const MILESTONES = [0.2, 0.4, 0.6, 0.8, 1] as const;
const INK = '#1C231B';
const TRACK = '#DDD1BD';
const RESTING = '#D3C6AF';

/** One segment beneath the bar; it fills once the bar passes its milestone. */
function Segment({ index, progress, scale }: { index: number; progress: SharedValue<number>; scale: number }) {
  const at = MILESTONES[index]!;
  const style = useAnimatedStyle(() => {
    const reached = interpolate(progress.value, [at - 0.015, at], [0, 1], 'clamp');
    return { backgroundColor: interpolateColor(reached, [0, 1], [RESTING, INK]), transform: [{ scaleY: 1 + 0.25 * reached * (1 - reached) * 4 }] };
  });
  return <Animated.View style={[style, { flex: 1, height: 4 * scale, borderRadius: 2 * scale }]} />;
}

/**
 * Consistency: one continuous bar, and five small segments beneath it for the milestones.
 * All animated work stays on the UI thread; the value comes from the domain indicator.
 */
export function ConsistencyBar({ fraction, progress, scale = 1, label = 'Consistency' }: {
  fraction: number; progress?: SharedValue<number>; scale?: number; label?: string;
}) {
  const reduced = useReducedMotion(), owned = useSharedValue(fraction), value = progress ?? owned;
  useEffect(() => {
    if (progress) return;
    owned.set(withTiming(fraction, { duration: reduced ? 0 : 750, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(owned);
  }, [fraction, progress, owned, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, value.value)) * 100}%` }));
  const reached = MILESTONES.filter((at) => fraction >= at).length;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}, ${reached} of 5 milestones`}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}
    style={{ gap: 5 * scale }}>
    <View style={{ height: 6 * scale, borderRadius: 3 * scale, backgroundColor: TRACK, overflow: 'hidden' }}>
      <Animated.View style={[fill, { height: '100%', borderRadius: 3 * scale, backgroundColor: INK }]} />
    </View>
    <View style={{ flexDirection: 'row', gap: 4 * scale, paddingLeft: 0 }}>
      {MILESTONES.map((at, index) => <Segment key={at} index={index} progress={value} scale={scale} />)}
    </View>
  </View>;
}
