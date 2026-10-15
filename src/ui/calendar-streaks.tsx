import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { MonthStatus, PeriodState, PracticeStreaks, WeekStatus } from '@/domain/progression';
import { colors, serifFont, Type } from './primitives';
import { useMotionPreference } from './reduced-motion';
import { STREAK_MOTION } from './streak-geometry';
import { DAY_SWATCH, WEEK_WASH } from './painted-month';
export { streakRuns } from './streak-geometry';

// Solid tones mixed from ink on sand, so overlapping discs, joins and bands never stack into darker seams.
const FAINT = 'rgba(20,20,20,0.13)';
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

function Mark({ kind, delay, shape }: { kind: 'full' | 'open' | 'faint'; delay: number; shape: 'pebble' | 'capsule' | 'moon' }) {
  const progress = useReveal(delay, STREAK_MOTION.pebble);
  const fill = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.4 + 0.6 * progress.value }] }));
  const size = shape === 'capsule' ? styles.capsule : shape === 'moon' ? styles.moon : styles.pebble;
  return <View style={[size, kind === 'open' ? styles.markOpen : styles.markEmpty]}>
    {kind !== 'open' && <Animated.View style={[StyleSheet.absoluteFill, size, { backgroundColor: kind === 'full' ? colors.ink : FAINT }, fill]} />}
  </View>;
}
const markKind = (state: PeriodState) => state === 'active' ? 'full' : state === 'missed' ? 'faint' : 'open';

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
  const weeks = streaks.recentWeeks(8), months = streaks.recentMonths(6);
  const thisWeek = weeks[weeks.length - 1]!;
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
            {Array.from({ length: daysPerWeek }, (_, index) => <Mark key={`${thisWeek.start}-${index}`} shape="pebble"
              kind={index < thisWeek.activeDays ? 'full' : 'open'} delay={240 + index * STREAK_MOTION.pebbleStagger} />)}
          </View>
          <Type role={thisWeek.state === 'active' ? 'label' : 'secondary'} style={styles.small}>{thisWeekText(thisWeek, daysPerWeek)}</Type>
        </View>
        <View style={styles.marks}>
          {weeks.map((week, index) => <Mark key={week.start} shape="capsule" kind={markKind(week.state)} delay={120 + index * 45} />)}
        </View>
      </View>
      <View accessible accessibilityLabel={`${streaks.months.current} ${monthLabel} in a row${streaks.months.best > streaks.months.current ? `, best ${streaks.months.best}` : ''}`}
        style={styles.months}>
        <RisingNumber key={`m${streaks.months.current}`} value={streaks.months.current} style={styles.second} />
        <Type role="secondary" style={styles.label}>{monthLabel}</Type>
        <View style={[styles.marks, { marginTop: 'auto' }]}>
          {months.map((month, index) => <Mark key={month.month} shape="moon" kind={markKind(month.state)} delay={200 + index * 60} />)}
        </View>
      </View>
    </View>
    <Type role="secondary" style={styles.days} accessibilityLabel={dayLine}>{dayLine}</Type>
  </View>;
}

/** Whether this month counts: all of its weeks active. */
export function MonthStreakLine({ status }: { status: MonthStatus }) {
  const progress = useReveal(380, STREAK_MOTION.pebble);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: 4 * (1 - progress.value) }] }));
  if (status.state === 'future') return null;
  const active = status.weeks.filter((week) => week.state === 'active').length, total = status.weeks.length;
  const text = status.state === 'active' ? `All ${total} weeks active · this month counts`
    : status.state === 'open' ? `${active} of ${total} weeks active so far` : `${active} of ${total} weeks active`;
  return <Animated.View accessible accessibilityLabel={text} style={[styles.monthLine, style]}>
    <View style={styles.monthWeeks}>
      {status.weeks.map((week, index) => <Mark key={week.start} shape="capsule" kind={markKind(week.state)} delay={420 + index * 60} />)}
    </View>
    <Type role={status.state === 'active' ? 'label' : 'secondary'} style={{ fontSize: 13, lineHeight: 20 }}>{text}</Type>
  </Animated.View>;
}

export function StreakLegend({ minutes, days, sharedWeeks }: { minutes: number; days: number; sharedWeeks: boolean }) {
  return <View style={styles.legend} accessible accessibilityLabel={`Filled days: a practice of ${minutes} minutes or more. Banded weeks: at least ${days} such days. Dot: a shorter practice.${sharedWeeks ? ' A week belongs to the month that holds most of its days.' : ''}`}>
    <View style={styles.legendRow}>
      <View style={styles.legendItem}><Image source={DAY_SWATCH} style={styles.legendDisc} /><Type role="secondary" style={styles.legendText}>{`${minutes}+ minutes`}</Type></View>
      <View style={styles.legendItem}><View style={styles.legendBand} /><Type role="secondary" style={styles.legendText}>{`Week with ${days}+ days`}</Type></View>
      <View style={styles.legendItem}><View style={styles.legendDot} /><Type role="secondary" style={styles.legendText}>Shorter practice</Type></View>
    </View>
    {sharedWeeks && <Type role="secondary" style={styles.legendText}>A week belongs to the month that holds most of its days.</Type>}
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
  marks: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  days: { fontSize: 13, lineHeight: 18 },
  pebble: { width: 10, height: 10, borderRadius: 5 },
  capsule: { width: 14, height: 6, borderRadius: 3 },
  moon: { width: 10, height: 10, borderRadius: 5 },
  markOpen: { borderWidth: 1, borderColor: OUTLINE },
  markEmpty: { overflow: 'hidden' },
  monthLine: { gap: 8, paddingTop: 16, paddingHorizontal: 4 },
  monthWeeks: { flexDirection: 'row', gap: 5 },
  legend: { gap: 8, paddingTop: 14, paddingHorizontal: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, lineHeight: 17 },
  legendDisc: { width: 16, height: 16 },
  legendBand: { width: 22, height: 14, borderRadius: 7, backgroundColor: WEEK_WASH },
  legendDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink, marginHorizontal: 4 },
});
