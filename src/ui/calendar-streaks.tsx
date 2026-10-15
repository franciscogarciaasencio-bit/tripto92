import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MonthStatus, PeriodState, PracticeStreaks } from '@/domain/progression';
import { colors, serifFont, Type } from './primitives';

// Solid tones mixed from ink on sand, so overlapping discs, joins and bands never stack into darker seams.
export const STREAK_FILL = '#D9D0C1';
const WEEK_BAND = '#E9E0D1';

/** Current and best streaks for days, weeks and full months. Calm numbers, no flames or warnings. */
export function CalendarStreaks({ streaks }: { streaks: PracticeStreaks }) {
  const items = [
    { key: 'days', count: streaks.days, label: streaks.days.current === 1 ? 'day in a row' : 'days in a row' },
    { key: 'weeks', count: streaks.weeks, label: streaks.weeks.current === 1 ? 'active week' : 'active weeks' },
    { key: 'months', count: streaks.months, label: streaks.months.current === 1 ? 'full month' : 'full months' },
  ] as const;
  return <View style={styles.strip}>
    {items.map(({ key, count, label }) => <View key={key} accessible
      accessibilityLabel={`${count.current} ${label}${count.best > count.current ? `, best ${count.best}` : ''}`} style={styles.item}>
      <Type style={styles.number}>{count.current}</Type>
      <Type role="secondary" style={styles.label}>{label}</Type>
      <Type role="secondary" style={[styles.best, { opacity: count.best > count.current ? 1 : 0 }]}>{`Best ${count.best}`}</Type>
    </View>)}
  </View>;
}

/** A calendar row is one Monday–Sunday week; an active week rests on a soft band. */
export function WeekRow({ state, children }: { state: PeriodState; children: ReactNode }) {
  return <View style={[styles.week, state === 'active' && styles.activeWeek, state === 'open' && styles.openWeek]}>{children}</View>;
}

/** Whether this month counts: all of its weeks active. */
export function MonthStreakLine({ status }: { status: MonthStatus }) {
  if (status.state === 'future') return null;
  const active = status.weeks.filter((week) => week.state === 'active').length, total = status.weeks.length;
  const text = status.state === 'active' ? `All ${total} weeks active · this month counts`
    : status.state === 'open' ? `${active} of ${total} weeks active so far` : `${active} of ${total} weeks active`;
  return <View accessible accessibilityLabel={text} style={styles.monthLine}>
    <View style={[styles.monthMark, status.state === 'active' && styles.monthMarkFull]} />
    <Type role={status.state === 'active' ? 'label' : 'secondary'} style={{ fontSize: 13, lineHeight: 20 }}>{text}</Type>
  </View>;
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
  strip: { flexDirection: 'row', paddingTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderColor: colors.line },
  item: { flex: 1, gap: 0 },
  number: { fontFamily: serifFont, fontSize: 30, lineHeight: 38, fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, lineHeight: 17 },
  best: { fontSize: 11, lineHeight: 16 },
  week: { flexDirection: 'row', borderRadius: 22, borderWidth: 1, borderColor: 'transparent', marginVertical: 1 },
  activeWeek: { backgroundColor: WEEK_BAND },
  openWeek: { borderColor: 'rgba(20,20,20,0.12)' },
  monthLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingHorizontal: 4 },
  monthMark: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.ink },
  monthMarkFull: { backgroundColor: colors.ink },
  legend: { gap: 8, paddingTop: 14, paddingHorizontal: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, lineHeight: 16 },
  legendDisc: { width: 12, height: 12, borderRadius: 6, backgroundColor: STREAK_FILL },
  legendBand: { width: 20, height: 12, borderRadius: 6, backgroundColor: WEEK_BAND, borderWidth: 1, borderColor: 'rgba(20,20,20,0.06)' },
  legendDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink, marginHorizontal: 4 },
});
