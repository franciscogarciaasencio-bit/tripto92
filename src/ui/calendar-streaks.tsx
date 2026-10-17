import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { PracticeStreaks, WeekStatus } from '@/domain/progression';
import { colors, serifFont, Type } from './primitives';
import { useMotionPreference } from './reduced-motion';
import { STREAK_MOTION } from './streak-geometry';

// Solid tones mixed from ink on sand, so overlapping discs, joins and bands never stack into darker seams.
const OUTLINE = 'rgba(20,20,20,0.42)';

const ease = Easing.bezier(0.22, 0.61, 0.36, 1);

/**
 * 0 → 1 once, after `delay`, on the UI thread. Instant when Reduced Motion is on or not yet known,
 * so a cold start never flashes half-drawn streaks.
 */
function useReveal(delay: number, duration: number) {
  const preference = useMotionPreference();
  const still = preference !== false;
  const progress = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { progress.set(1); return; }
    progress.set(withDelay(delay, withTiming(1, { duration, easing: ease, reduceMotion: ReduceMotion.Never })));
    return () => cancelAnimation(progress);
  }, [still, delay, duration, progress]);
  return progress;
}




/** The grid of a month slides in from the side it was reached from. */
export function MonthSlide({ direction, children }: { direction: -1 | 0 | 1; children: ReactNode }) {
  const progress = useReveal(0, STREAK_MOTION.slide);
  const style = useAnimatedStyle(() => ({ opacity: direction === 0 ? 1 : 0.15 + 0.85 * progress.value,
    transform: [{ translateX: direction * 22 * (1 - progress.value) }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** A number that rises softly into place whenever it changes (re-keyed by value). */
function RisingNumber({ value, style }: { value: number; style: object }) {
  const progress = useReveal(0, STREAK_MOTION.number);
  const motion = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: 8 * (1 - progress.value) }] }));
  return <Animated.View style={motion}><Type style={style}>{value}</Type></Animated.View>;
}

/** One of this week's three pebbles, filling in turn. */
function Pebble({ full, delay }: { full: boolean; delay: number }) {
  const progress = useReveal(delay, STREAK_MOTION.pebble);
  const fill = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.4 + 0.6 * progress.value }] }));
  return <View style={[styles.pebble, full ? styles.markEmpty : styles.markOpen]}>
    {full && <Animated.View style={[StyleSheet.absoluteFill, styles.pebble, { backgroundColor: colors.ink }, fill]} />}
  </View>;
}

function thisWeekText(week: WeekStatus, needed: number) {
  if (week.state === 'active') return 'This week counts';
  if (week.state === 'missed') return 'A fresh week begins Monday';
  return `${week.activeDays} of ${needed} days this week`;
}

/**
 * One quiet line above the calendar (owner, 2026-10-17: "reduce as much clutter as you can"): active
 * weeks in a row, and this week's three pebbles. Months and days in a row stay in the calendar's
 * celebrations; screen readers still hear this week's progress.
 */
export function StreakOverview({ streaks, daysPerWeek }: { streaks: PracticeStreaks; daysPerWeek: number }) {
  const thisWeek = streaks.recentWeeks(1)[0]!;
  const weeks = streaks.weeks.current;
  const weekLabel = weeks === 1 ? 'week in a row' : 'weeks in a row';
  return <View accessible accessibilityLabel={`${weeks} active ${weekLabel}. ${thisWeekText(thisWeek, daysPerWeek)}.`} style={styles.overview}>
    <View style={styles.weeks}>
      <RisingNumber key={`w${weeks}`} value={weeks} style={styles.hero} />
      <Type role="secondary" style={styles.label}>{weekLabel}</Type>
    </View>
    <View style={styles.pebbles}>
      {Array.from({ length: daysPerWeek }, (_, index) => <Pebble key={`${thisWeek.start}-${index}`}
        full={index < thisWeek.activeDays} delay={240 + index * STREAK_MOTION.pebbleStagger} />)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 4 },
  weeks: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  hero: { fontFamily: serifFont, fontSize: 34, lineHeight: 42, fontVariant: ['tabular-nums'] },
  label: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  pebbles: { flexDirection: 'row', gap: 7 },
  pebble: { width: 10, height: 10, borderRadius: 5 },
  markOpen: { borderWidth: 1, borderColor: OUTLINE },
  markEmpty: { overflow: 'hidden' },
});
