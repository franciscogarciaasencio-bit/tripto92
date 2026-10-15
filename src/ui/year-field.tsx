import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { PracticeStreaks } from '@/domain/progression';
import { colors, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { useMotionPreference } from './reduced-motion';

const WEEKS = 53;
const WEEK_BAND = '#E9E0D1';
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The past year as one woven field: a column per week (Monday at the top), a dot per day. Counted days
 * are ink, shorter practices faint, quiet days barely there; a consistent week rests on a soft band.
 * Tapping a week opens it in the month calendar below. It draws in once, left to right.
 */
export function YearField({ streaks, shortDays, today, selected, onSelect }: {
  streaks: PracticeStreaks; shortDays: ReadonlySet<string>; today: string; selected: string; onSelect: (date: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const still = useMotionPreference() !== false;
  const reveal = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { reveal.set(1); return; }
    reveal.set(withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 0.61, 0.36, 1), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(reveal);
  }, [reveal, still]);
  const weeks = useMemo(() => streaks.recentWeeks(WEEKS), [streaks]);
  const summary = useMemo(() => {
    let days = 0;
    for (const week of weeks) for (let day = 0; day < 7; day++) {
      const date = addDays(week.start, day);
      if (date <= today && streaks.isActiveDay(date)) days++;
    }
    return { days, weeks: weeks.filter((week) => week.state === 'active').length };
  }, [weeks, streaks, today]);
  const cell = Math.max(0, width - 4) / WEEKS, radius = Math.max(1.4, cell * 0.3), top = 16, height = top + cell * 7;
  const labels: { column: number; text: string }[] = [];
  weeks.forEach((week, column) => {
    const month = Number(week.month.slice(5)) - 1;
    if (column === 0 || week.month !== weeks[column - 1]!.month) {
      // Labels keep at least 30 pt apart; on narrow phones some months go unlabelled rather than overlap.
      if (column < WEEKS - 2 && (!labels.length || (column - labels[labels.length - 1]!.column) * cell >= 30)) labels.push({ column, text: MONTH_SHORT[month]! });
    }
  });
  const selectedColumn = weeks.findIndex((week) => selected >= week.start && selected <= addDays(week.start, 6));
  const cover = useAnimatedStyle(() => ({ transform: [{ translateX: reveal.value * (width + 32) }] }));
  return <View style={styles.wrap}>
    <View style={styles.header}>
      <Type role="secondary" style={styles.title}>The past year</Type>
      <Type role="secondary" style={styles.title}>{`${summary.days} ${summary.days === 1 ? 'day' : 'days'} · ${summary.weeks} consistent ${summary.weeks === 1 ? 'week' : 'weeks'}`}</Type>
    </View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
    <QuietPressable accessibilityRole="button" pressedOpacity={1}
      accessibilityLabel={`The past year: ${summary.days} practice days and ${summary.weeks} consistent weeks. Choose a week to open it below.`}
      onPress={(event) => {
        const column = Math.max(0, Math.min(WEEKS - 1, Math.floor(event.nativeEvent.locationX / (cell || 1))));
        const start = weeks[column]!.start, end = addDays(start, 6);
        onSelect(end <= today ? end : today < start ? start : today);
      }} style={{ width: width || '100%', height: height || 1 }}>
      {width > 0 && <Svg width={width} height={height}>
        {weeks.map((week, column) => week.state === 'active'
          ? <Rect key={`band-${week.start}`} x={column * cell + cell * 0.08} y={top - cell * 0.1} width={cell * 0.84} height={cell * 7.2}
            rx={cell * 0.42} fill={WEEK_BAND} /> : null)}
        {selectedColumn >= 0 && <Rect x={selectedColumn * cell + cell * 0.04} y={top - cell * 0.18} width={cell * 0.92} height={cell * 7.36}
          rx={cell * 0.46} fill="none" stroke={colors.ink} strokeOpacity={0.28} strokeWidth={1} />}
        {weeks.flatMap((week, column) => Array.from({ length: 7 }, (_, day) => {
          const date = addDays(week.start, day);
          if (date > today) return null;
          const counted = streaks.isActiveDay(date), short = !counted && shortDays.has(date);
          return <Circle key={date} cx={column * cell + cell / 2} cy={top + day * cell + cell / 2}
            r={counted ? radius : short ? radius * 0.7 : radius * 0.55}
            fill={colors.ink} fillOpacity={counted ? 0.78 : short ? 0.3 : 0.1} />;
        }))}
        {/* Today: a fine ring around its dot. */}
        {(() => {
          const column = weeks.findIndex((week) => today >= week.start && today <= addDays(week.start, 6));
          if (column < 0) return null;
          const day = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weeks[column]!.start}T00:00:00Z`)) / 86_400_000;
          return <Circle cx={column * cell + cell / 2} cy={top + day * cell + cell / 2} r={radius + 1.8} fill="none" stroke={colors.ink} strokeWidth={0.9} />;
        })()}
      </Svg>}
      {width > 0 && labels.map(({ column, text }) => <Type key={column} role="secondary" style={[styles.month, { left: column * cell }]}>{text}</Type>)}
      {width > 0 && !still && <Animated.View pointerEvents="none" style={[styles.cover, { width: width + 32, height }, cover]}>
        <Svg width={width + 32} height={height}>
          <Defs><LinearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset={String(32 / (width + 32))} stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient></Defs>
          <Rect x={0} y={0} width={width + 32} height={height} fill="url(#edge)" />
        </Svg>
      </Animated.View>}
    </QuietPressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 14, paddingBottom: 6, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 13, lineHeight: 18 },
  cover: { position: 'absolute', left: -32, top: 0 },
  month: { position: 'absolute', top: -2, fontSize: 11, lineHeight: 14 },
});
