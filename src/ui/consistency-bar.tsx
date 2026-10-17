import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from './reduced-motion';
import { consistencyRounds } from './consistency-rounds';

const MILESTONES = [0.2, 0.4, 0.6, 0.8, 1] as const;
const INK = '#1C231B';
const TRACK = '#DDD1BD';
const RESTING = '#D3C6AF';

/** One segment beneath the bar; it fills once the bar passes its milestone. */
function Segment({ index, progress, flourish, scale }: { index: number; progress: SharedValue<number>; flourish?: SharedValue<number>; scale: number }) {
  const at = MILESTONES[index]!;
  // The newest completed round's small bar swells and glows while `flourish` plays (completion only).
  const lit = () => { 'worklet'; return flourish && consistencyRounds(progress.value).completed - 1 === index ? flourish.value : 0; };
  const style = useAnimatedStyle(() => {
    // Fills in the instant the big bar completes its round.
    const reached = interpolate(progress.value, [at - 0.004, at - 1e-9], [0, 1], 'clamp');
    const glow = lit();
    return { backgroundColor: interpolateColor(reached, [0, 1], [RESTING, INK]), transform: [{ scaleY: 1 + 0.6 * glow }, { scaleX: 1 + 0.06 * glow }] };
  });
  const halo = useAnimatedStyle(() => ({ opacity: 0.85 * lit(), transform: [{ scaleX: 1 + 0.18 * lit() }, { scaleY: 1 + 3 * lit() }] }));
  return <View style={{ flex: 1 }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 3 * scale, backgroundColor: '#CDAE74' }, halo]} />
    <Animated.View style={[style, { height: 4 * scale, borderRadius: 2 * scale }]} />
  </View>;
}

/**
 * Consistency: the big bar shows the current round toward the next milestone; five small segments
 * beneath it count the completed rounds.
 * All animated work stays on the UI thread; the value comes from the domain indicator.
 */
export function ConsistencyBar({ fraction, progress, drain, flourish, scale = 1, label = 'Consistency' }: {
  fraction: number; progress?: SharedValue<number>; scale?: number; label?: string;
  /** Completion only: drain ≥ 0 overrides the big bar while a completed round empties; flourish lights its small bar. */
  drain?: SharedValue<number>; flourish?: SharedValue<number>;
}) {
  const reduced = useReducedMotion(), owned = useSharedValue(fraction), value = progress ?? owned;
  useEffect(() => {
    if (progress) return;
    owned.set(withTiming(fraction, { duration: reduced ? 0 : 750, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(owned);
  }, [fraction, progress, owned, reduced]);
  // While a completed round is held full, a warm glow breathes around the whole bar.
  const barGlow = useAnimatedStyle(() => ({ opacity: flourish ? 0.6 * flourish.value : 0, transform: [{ scaleY: 1 + (flourish ? 1.4 * flourish.value : 0) }] }));
  const fill = useAnimatedStyle(() => ({ width: `${(drain && drain.value >= 0 ? drain.value : consistencyRounds(value.value).current) * 100}%` }));
  const reached = consistencyRounds(fraction).completed;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}, ${reached} of 5 milestones`}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}
    style={{ gap: 5 * scale }}>
    {flourish && <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -4 * scale, right: -4 * scale, top: -2 * scale, height: 10 * scale,
      borderRadius: 5 * scale, backgroundColor: '#DCC594' }, barGlow]} />}
    <View style={{ height: 6 * scale, borderRadius: 3 * scale, backgroundColor: TRACK, overflow: 'hidden' }}>
      <Animated.View style={[fill, { height: '100%', borderRadius: 3 * scale, backgroundColor: INK }]} />
    </View>
    <View style={{ flexDirection: 'row', gap: 4 * scale, paddingLeft: 0 }}>
      {MILESTONES.map((at, index) => <Segment key={at} index={index} progress={value} flourish={flourish} scale={scale} />)}
    </View>
  </View>;
}
