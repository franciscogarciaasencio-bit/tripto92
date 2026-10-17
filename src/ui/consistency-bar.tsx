import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';
import { useReducedMotion } from './reduced-motion';
import { consistencyLevel, consistencyRounds, roundColor, ROUND_COLORS } from './consistency-rounds';

const MILESTONES = [0.2, 0.4, 0.6, 0.8, 1] as const;
const TRACK = '#DDD1BD';
const RESTING = '#D3C6AF';

/** 0 → 1 → 0 across [start, peak, end] of a 0–1 timeline; 0 outside it. */
function pulse(value: number, start: number, peak: number, end: number) {
  'worklet';
  return value <= start || value >= end ? 0 : value < peak ? (value - start) / (peak - start) : (end - value) / (end - peak);
}

/** One segment beneath the bar: once its round is complete it keeps that round's colour. */
function Segment({ index, progress, celebrate, scale }: { index: number; progress: SharedValue<number>; celebrate?: SharedValue<number>; scale: number }) {
  const at = MILESTONES[index]!;
  // The segment a round has just completed pops: it swells past its size and settles, with a soft halo.
  const newest = () => { 'worklet'; return celebrate && consistencyRounds(progress.value).completed - 1 === index ? celebrate.value : 0; };
  const style = useAnimatedStyle(() => {
    const reached = interpolate(progress.value, [at - 0.004, at - 1e-9], [0, 1], 'clamp');
    const pop = pulse(newest(), 0.08, 0.22, 0.55);
    return { backgroundColor: interpolateColor(reached, [0, 1], [RESTING, ROUND_COLORS[index]!]),
      transform: [{ scaleY: 1 + 1.1 * pop }, { scaleX: 1 + 0.08 * pop }] };
  });
  const halo = useAnimatedStyle(() => {
    const glow = pulse(newest(), 0.08, 0.3, 0.95);
    return { opacity: 0.55 * glow, transform: [{ scaleX: 1 + 0.35 * glow }, { scaleY: 1 + 4 * glow }] };
  });
  return <View style={{ flex: 1 }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 3 * scale, backgroundColor: ROUND_COLORS[index] }, halo]} />
    <Animated.View style={[style, { height: 4 * scale, borderRadius: 2 * scale }]} />
  </View>;
}

/**
 * Consistency: the big bar shows the current round toward the next milestone, in that round's colour;
 * five small segments beneath it count the completed rounds, each in its own colour.
 * All animated work stays on the UI thread; the value comes from the domain indicator.
 */
export function ConsistencyBar({ fraction, progress, drain, celebrate, scale = 1, label = 'Consistency' }: {
  fraction: number; progress?: SharedValue<number>; scale?: number; label?: string;
  /**
   * Completion only: drain ≥ 0 overrides the big bar while a completed round empties; celebrate runs
   * 0 → 1 once per completed round (light sweeps the full bar, its new segment pops, a glow breathes).
   */
  drain?: SharedValue<number>; celebrate?: SharedValue<number>;
}) {
  const reduced = useReducedMotion(), owned = useSharedValue(fraction), value = progress ?? owned;
  useEffect(() => {
    if (progress) return;
    owned.set(withTiming(fraction, { duration: reduced ? 0 : 750, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(owned);
  }, [fraction, progress, owned, reduced]);
  const draining = () => { 'worklet'; return !!drain && drain.value >= 0; };
  // While a round empties it keeps its colour; the refill arrives in the next round's colour.
  const fill = useAnimatedStyle(() => {
    const rounds = consistencyRounds(value.value);
    return { width: `${(draining() ? drain!.value : rounds.current) * 100}%`,
      backgroundColor: roundColor(draining() ? rounds.completed - 1 : rounds.completed) };
  });
  // A band of light sweeps across the full bar, and a warm glow in the round's colour breathes around it.
  const sweep = useAnimatedStyle(() => {
    const t = celebrate ? celebrate.value : 0, moving = t > 0 && t < 0.42;
    return { opacity: moving ? 0.7 * Math.sin(Math.PI * t / 0.42) : 0, left: `${-30 + 150 * Math.min(1, t / 0.42)}%` };
  });
  const glow = useAnimatedStyle(() => {
    const t = celebrate ? celebrate.value : 0, rounds = consistencyRounds(value.value), breath = pulse(t, 0.02, 0.25, 0.9);
    return { opacity: 0.5 * breath, backgroundColor: roundColor(rounds.completed - 1), transform: [{ scaleY: 1 + 1.6 * breath }, { scaleX: 1 + 0.03 * breath }] };
  });
  const level = consistencyLevel(fraction), full = consistencyRounds(fraction).completed === MILESTONES.length;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}, ${full ? 'full' : `level ${level} of 5`}`}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}
    style={{ gap: 5 * scale }}>
    {celebrate && <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -4 * scale, right: -4 * scale, top: -2 * scale, height: 10 * scale,
      borderRadius: 5 * scale }, glow]} />}
    <View style={{ height: 6 * scale, borderRadius: 3 * scale, backgroundColor: TRACK, overflow: 'hidden' }}>
      <Animated.View style={[fill, { height: '100%', borderRadius: 3 * scale }]} />
      {celebrate && <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: '28%', borderRadius: 3 * scale,
        backgroundColor: '#FFF8E8' }, sweep]} />}
    </View>
    <View style={{ flexDirection: 'row', gap: 4 * scale }}>
      {MILESTONES.map((at, index) => <Segment key={at} index={index} progress={value} celebrate={celebrate} scale={scale} />)}
    </View>
  </View>;
}
