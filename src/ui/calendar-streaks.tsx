import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { PracticeStreaks, WeekStatus } from '@/domain/progression';
import { colors, serifFont, Type } from './primitives';
import { useMotionPreference } from './reduced-motion';
import { STREAK_MOTION } from './streak-geometry';
export { streakRuns } from './streak-geometry';

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
 * Weeks lead, months follow, days stay quiet: a rhythm of three days a week is the habit Ona
 * celebrates, so a missed day never looks like a loss.
 */
export function StreakOverview({ streaks, daysPerWeek }: { streaks: PracticeStreaks; daysPerWeek: number }) {
  const thisWeek = streaks.recentWeeks(1)[0]!;
  const { days } = streaks;
  const weekLabel = streaks.weeks.current === 1 ? 'active week in a row' : 'active weeks in a row';
  const monthLabel = streaks.months.current === 1 ? 'full month' : 'full months';
  const dayLine = `${days.current} ${days.current === 1 ? 'day' : 'days'} in a row${days.best > days.current ? ` · best ${days.best}` : ''}`;
  return <View style={styles.overview}>
    <View style={styles.columns}>
      <View accessible accessibilityLabel={`${streaks.weeks.current} ${weekLabel}${streaks.weeks.best > streaks.weeks.current ? `, best ${streaks.weeks.best}` : ''}. ${thisWeekText(thisWeek, daysPerWeek)}.`}
        style={styles.weeks}>
        <RisingNumber key={`w${streaks.weeks.current}`} value={streaks.weeks.current} style={styles.hero} />
        <Type role="secondary" style={styles.label}>{weekLabel}</Type>
        <View style={styles.thisWeek}>
          <View style={styles.pebbles}>
            {Array.from({ length: daysPerWeek }, (_, index) => <Pebble key={`${thisWeek.start}-${index}`}
              full={index < thisWeek.activeDays} delay={240 + index * STREAK_MOTION.pebbleStagger} />)}
          </View>
          <Type role={thisWeek.state === 'active' ? 'label' : 'secondary'} style={styles.small}>{thisWeekText(thisWeek, daysPerWeek)}</Type>
        </View>
      </View>
      <View accessible accessibilityLabel={`${streaks.months.current} ${monthLabel} in a row${streaks.months.best > streaks.months.current ? `, best ${streaks.months.best}` : ''}`}
        style={styles.months}>
        <RisingNumber key={`m${streaks.months.current}`} value={streaks.months.current} style={styles.second} />
        <Type role="secondary" style={styles.label}>{monthLabel}</Type>
      </View>
    </View>
    <Type role="secondary" style={styles.days} accessibilityLabel={dayLine}>{dayLine}</Type>
  </View>;
}

const styles = StyleSheet.create({
  overview: { paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.line, gap: 14 },
  columns: { flexDirection: 'row', gap: 20 },
  weeks: { flex: 1.5, gap: 2 },
  // Baselines of the two numbers line up (Newsreader: ascent 0.735 em), and so do their labels.
  months: { flex: 1, gap: 2, paddingTop: 9 },
  hero: { fontFamily: serifFont, fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] },
  second: { fontFamily: serifFont, fontSize: 34, lineHeight: 46, fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 13, lineHeight: 18 },
  thisWeek: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  pebbles: { flexDirection: 'row', gap: 6 },
  days: { fontSize: 13, lineHeight: 18 },
  pebble: { width: 10, height: 10, borderRadius: 5 },
  markOpen: { borderWidth: 1, borderColor: OUTLINE },
  markEmpty: { overflow: 'hidden' },
});
