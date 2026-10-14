import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from './reduced-motion';

const MILESTONES = [0.2, 0.4, 0.6, 0.8, 1] as const;
function MilestoneDot({ at, progress, scale }: { at: number; progress: SharedValue<number>; scale: number }) {
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value,
    [at - 0.012, at], ['#D8CBB6', '#1C231B']) }));
  return <Animated.View style={[style, { position: 'absolute', left: `${at * 100}%`, top: 3 * scale,
    width: 7 * scale, height: 7 * scale, borderRadius: 4 * scale, transform: [{ translateX: -3.5 * scale }],
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#B5A88F' }]} />;
}

/** One continuous bar and five quietly earned landmarks; all animated work stays on the UI thread. */
export function ConsistencyBar({ fraction, progress, scale = 1, label = 'Consistency' }: {
  fraction: number; progress?: SharedValue<number>; scale?: number; label?: string;
}) {
  const reduced = useReducedMotion(), owned = useSharedValue(fraction), value = progress ?? owned;
  useEffect(() => {
    if (progress) return;
    owned.set(withTiming(fraction, { duration: reduced ? 0 : 750, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(owned);
  }, [fraction, progress, owned, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}
    style={{ height: 14 * scale, marginHorizontal: 3.5 * scale }}>
    <View style={{ position: 'absolute', left: 0, right: 0, top: 4.5 * scale, height: 4 * scale, borderRadius: 4, backgroundColor: '#D8CBB6', overflow: 'hidden' }}>
      <Animated.View style={[fill, { height: '100%', borderRadius: 4, backgroundColor: '#1C231B' }]} />
    </View>
    {MILESTONES.map(at => <MilestoneDot key={at} at={at} progress={value} scale={scale} />)}
  </View>;
}
