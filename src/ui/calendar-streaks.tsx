import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { MonthStatus, PeriodState, PracticeStreaks, WeekStatus } from '@/domain/progression';
import { colors, serifFont, Type } from './primitives';
import { useMotionPreference } from './reduced-motion';
import { runGeometry, STREAK_DISC as DISC, STREAK_MOTION } from './streak-geometry';
export { streakRuns } from './streak-geometry';

// Solid tones mixed from ink on sand, so overlapping discs, joins and bands never stack into darker seams.
export const STREAK_FILL = '#D9D0C1';
const WEEK_BAND = '#E9E0D1';
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

/**
 * One run of counting days drawn as a single capsule: it appears as a disc on the first day and
 * extends to the last like one brush stroke, so there are never seams between days.
 */
export function StreakRun({ start, end, cell, delay }: { start: number; end: number; cell: number; delay: number }) {
  const { length, extendDelay, extendDuration } = runGeometry(start, end, cell, delay);
  const appear = useReveal(delay, STREAK_MOTION.disc);
  const extend = useReveal(extendDelay, extendDuration);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    width: DISC + (length - DISC) * extend.value,
    transform: [{ scale: 0.6 + 0.4 * appear.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.run, { left: runGeometry(start, end, cell, delay).left }, style]} />;
}

/** The ink circle of the chosen day eases in each time a day is chosen. */
export function SelectionDisc() {
  const progress = useReveal(0, STREAK_MOTION.select);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.8 + 0.2 * progress.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.disc, { backgroundColor: colors.ink }, style]} />;
}

/** A calendar row is one Monday–Sunday week; an active week rests on a soft band that unfolds. */
export function WeekRow({ state, row, runs, cell, children }: {
  state: PeriodState; row: number; runs: readonly (readonly [number, number])[]; cell: number; children: ReactNode;
}) {
  const progress = useReveal(row * STREAK_MOTION.rowStagger, STREAK_MOTION.band);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scaleX: 0.96 + 0.04 * progress.value }] }));
  return <View style={styles.week}>
    {state === 'active' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.activeWeek, style]} />}
    {state === 'open' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.openWeek, style]} />}
    {cell > 0 && runs.map(([start, end]) => <StreakRun key={`${start}-${end}`} start={start} end={end} cell={cell}
      delay={row * STREAK_MOTION.rowStagger + start * STREAK_MOTION.columnStagger} />)}
    {children}
  </View>;
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
      <View style={styles.legendItem}><View style={styles.legendDisc} /><Type role="secondary" style={styles.legendText}>{`${minutes}+ minutes`}</Type></View>
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
  months: { flex: 1, gap: 2, paddingTop: 10 },
  hero: { fontFamily: serifFont, fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] },
  second: { fontFamily: serifFont, fontSize: 34, lineHeight: 44, fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, lineHeight: 17 },
  small: { fontSize: 12, lineHeight: 18 },
  thisWeek: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  pebbles: { flexDirection: 'row', gap: 6 },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  days: { fontSize: 12, lineHeight: 18 },
  pebble: { width: 10, height: 10, borderRadius: 5 },
  capsule: { width: 14, height: 6, borderRadius: 3 },
  moon: { width: 10, height: 10, borderRadius: 5 },
  markOpen: { borderWidth: 1, borderColor: OUTLINE },
  markEmpty: { overflow: 'hidden' },
  disc: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: STREAK_FILL },
  run: { position: 'absolute', top: 7, height: 34, borderRadius: 17, backgroundColor: STREAK_FILL, transformOrigin: '17px 17px' },
  week: { flexDirection: 'row', marginVertical: 1 },
  activeWeek: { borderRadius: 22, backgroundColor: WEEK_BAND },
  openWeek: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(20,20,20,0.12)' },
  monthLine: { gap: 8, paddingTop: 16, paddingHorizontal: 4 },
  monthWeeks: { flexDirection: 'row', gap: 5 },
  legend: { gap: 8, paddingTop: 14, paddingHorizontal: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, lineHeight: 16 },
  legendDisc: { width: 12, height: 12, borderRadius: 6, backgroundColor: STREAK_FILL },
  legendBand: { width: 20, height: 12, borderRadius: 6, backgroundColor: WEEK_BAND, borderWidth: 1, borderColor: 'rgba(20,20,20,0.06)' },
  legendDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink, marginHorizontal: 4 },
});
