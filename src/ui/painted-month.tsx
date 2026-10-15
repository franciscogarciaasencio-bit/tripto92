import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming,
  type WithTimingConfig } from 'react-native-reanimated';
import type { PracticeStreaks } from '@/domain/progression';
import { colors, serifFont } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { practiceDateLabel } from './practice-history';
import { useMotionPreference } from './reduced-motion';
import { streakRuns } from './streak-geometry';

/**
 * Painted marks (scripts/calendar/build-calendar-art.cjs). Cells are square, so a run of n counted days
 * is the n-cell sprite and k consecutive consistent weeks are the k-row wash, never stretched.
 */
const DAYS = [null, require('../../assets/ona/calendar/days-1.webp'), require('../../assets/ona/calendar/days-2.webp'),
  require('../../assets/ona/calendar/days-3.webp'), require('../../assets/ona/calendar/days-4.webp'),
  require('../../assets/ona/calendar/days-5.webp'), require('../../assets/ona/calendar/days-6.webp'),
  require('../../assets/ona/calendar/days-7.webp')] as const;
const WEEKS = [null, require('../../assets/ona/calendar/weeks-1.webp'), require('../../assets/ona/calendar/weeks-2.webp'),
  require('../../assets/ona/calendar/weeks-3.webp'), require('../../assets/ona/calendar/weeks-4.webp'),
  require('../../assets/ona/calendar/weeks-5.webp'), require('../../assets/ona/calendar/weeks-6.webp')] as const;
export const CALENDAR_VIGNETTE = require('../../assets/ona/calendar/vignette.webp');
export const DAY_SWATCH = DAYS[1];
export const WEEK_WASH = '#DCD3C4';
const PAINTED_TEXT = '#F7F0E3';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const settle = Easing.bezier(0.22, 0.61, 0.36, 1);

/** 0 → 1 once after `delay`; already 1 when still (Reduced Motion, or the preference not yet known). */
function useStep(delay: number, duration: number, still: boolean, easing: NonNullable<WithTimingConfig['easing']> = settle) {
  const value = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { value.set(1); return; }
    value.set(withDelay(delay, withTiming(1, { duration, easing, reduceMotion: ReduceMotion.Never })));
    return () => cancelAnimation(value);
  }, [delay, duration, easing, still, value]);
  return value;
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Rows of the month, Monday first, as dates. */
export function monthRows(month: string) {
  const first = new Date(`${month}-01T00:00:00.000Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const end = new Date(first); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
  const rows = Math.ceil((offset + end.getUTCDate()) / 7);
  const start = addDays(`${month}-01`, -offset);
  return Array.from({ length: rows }, (_, row) => Array.from({ length: 7 }, (_, column) => addDays(start, row * 7 + column)));
}

/** Consecutive consistent weeks as [first row, row count]. */
function weekBlocks(active: readonly boolean[]) {
  const blocks: [number, number][] = [];
  active.forEach((on, row) => {
    if (!on) return;
    const last = blocks[blocks.length - 1];
    if (last && last[0] + last[1] === row) last[1]++; else blocks.push([row, 1]);
  });
  return blocks;
}

/** A painted run: drawn in from its left edge like one brush stroke (or from `from` cells when it grows). */
function Run({ length, column, cell, delay, from, still }: { length: number; column: number; cell: number; delay: number; from: number; still: boolean }) {
  const reveal = useStep(delay, 260 + length * 70, still);
  const style = useAnimatedStyle(() => ({ width: cell * (from + (length - from) * reveal.value), opacity: from > 0 ? 1 : Math.min(1, reveal.value * 3) }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: column * cell, top: 0, height: cell, overflow: 'hidden' }, style]}>
    <Image source={DAYS[length]} style={{ width: cell * length, height: cell }} />
  </Animated.View>;
}

/** A painted wash under consistent weeks; `grows` crossfades from the block without the newest week. */
function Wash({ rows, cell, width, delay, still, grows }: { rows: number; cell: number; width: number; delay: number; still: boolean; grows: boolean }) {
  const reveal = useStep(delay, 520, still);
  const next = useAnimatedStyle(() => ({ opacity: reveal.value }));
  const before = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height: rows * cell }}>
    {grows && rows > 1 && <Animated.View style={[StyleSheet.absoluteFill, before]}>
      <Image source={WEEKS[rows - 1]} style={{ width, height: (rows - 1) * cell }} /></Animated.View>}
    <Animated.View style={[StyleSheet.absoluteFill, next]}><Image source={WEEKS[rows]} style={{ width, height: rows * cell }} /></Animated.View>
  </View>;
}

/** Two soft rings spreading from the newest day, like a drop in still water. */
function Ripple({ size, delay, still }: { size: number; delay: number; still: boolean }) {
  const progress = useStep(delay, 1500, still, Easing.out(Easing.quad));
  const style = useAnimatedStyle(() => ({ opacity: still ? 0 : 0.45 * (1 - progress.value) * Math.min(1, progress.value * 6),
    transform: [{ scale: 1 + 2 * progress.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2,
    borderWidth: 1.2, borderColor: '#4F4943', left: -size / 2, top: -size / 2 }, style]} />;
}

function DayNumber({ date, painted, inMonth, cell, turnsAt, still }: { date: string; painted: boolean; inMonth: boolean; cell: number; turnsAt: number | null; still: boolean }) {
  const turn = useStep(turnsAt ?? 0, 220, still || turnsAt === null);
  const light = useAnimatedStyle(() => ({ opacity: turnsAt === null ? (painted ? 1 : 0) : turn.value }));
  const dark = useAnimatedStyle(() => ({ opacity: turnsAt === null ? (painted ? 0 : 1) : 1 - turn.value }));
  const size = Math.min(19, cell * 0.38);
  const text = { fontFamily: serifFont, fontSize: size, lineHeight: size * 1.25, color: inMonth ? colors.ink : 'rgba(20,20,20,0.3)' };
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.center, dark]}><Text style={text}>{Number(date.slice(8))}</Text></Animated.View>
    <Animated.View style={[styles.center, light]}><Text style={[text, { color: PAINTED_TEXT }]}>{Number(date.slice(8))}</Text></Animated.View>
  </View>;
}

/**
 * One month, painted in Ona's watercolour: days in a row are one deep warm grey shape, consecutive
 * consistent weeks one lighter warm grey wash, hairlines between weeks, the week in progress outlined.
 * With `moment`, the newest practice day is painted in (its run grows from yesterday, ripples spread,
 * its week's wash arrives when that day made the week count). Without it, the month draws in gently.
 */
export function PaintedMonth({ month, streaks, practiced, today, selected, onSelect, moment, live = true }: {
  month: string; streaks: PracticeStreaks; practiced: ReadonlySet<string>; today: string;
  selected?: string | null; onSelect?: (date: string) => void;
  moment?: { date: string; weekBecameActive: boolean } | null; live?: boolean;
}) {
  const preference = useMotionPreference();
  const still = preference !== false;
  const [width, setWidth] = useState(0);
  const cell = width / 7;
  const rows = monthRows(month);
  const weeks = rows.map((dates) => streaks.week(dates[0]!));
  const blocks = weekBlocks(weeks.map((week) => live && week.state === 'active'));
  const momentRow = moment ? rows.findIndex((dates) => dates.includes(moment.date)) : -1;
  const momentColumn = momentRow >= 0 ? rows[momentRow]!.indexOf(moment!.date) : -1;
  return <View>
    <View style={styles.weekdays}>
      {WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
    </View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: width ? rows.length * cell : 280 }}>
      {width > 0 && <>
        {rows.slice(0, -1).map((_, row) => <View key={`line-${row}`} style={[styles.line, { top: (row + 1) * cell }]} />)}
        {blocks.map(([start, count]) => {
          const grows = !!moment?.weekBecameActive && momentRow >= start && momentRow < start + count;
          return <View key={`wash-${start}`} style={{ position: 'absolute', left: 0, top: start * cell }}>
            <Wash rows={count} cell={cell} width={width} still={still || (!!moment && !grows)} grows={grows && momentRow === start + count - 1}
              delay={moment ? (grows ? 1000 : 0) : start * 70} />
          </View>;
        })}
        {weeks.map((week, row) => live && week.state === 'open' && rows[row]!.includes(today)
          ? <View key={`open-${row}`} style={[styles.open, { top: row * cell + cell * 0.06, height: cell * 0.88, borderRadius: cell * 0.44 }]} /> : null)}
        {rows.map((dates, row) => <View key={dates[0]} style={{ position: 'absolute', left: 0, top: row * cell, width, height: cell }}>
          {(live ? streakRuns(dates.map((date) => streaks.isActiveDay(date))) : []).map(([start, end]) => {
            const length = end - start + 1;
            const holds = row === momentRow && momentColumn >= start && momentColumn <= end;
            // A run that the newest day extends grows from the cells it already had.
            const from = holds && moment ? Math.max(0, momentColumn - start) : length;
            return <Run key={start} length={length} column={start} cell={cell} from={moment ? from : 0} still={still}
              delay={moment ? (holds ? 420 : 0) : 120 + row * 70 + start * 25} />;
          })}
          {dates.map((date, column) => {
            const inMonth = date.startsWith(`${month}-`);
            const counted = live && streaks.isActiveDay(date);
            const short = live && !counted && practiced.has(date);
            const chosen = selected === date && inMonth;
            const isMoment = row === momentRow && column === momentColumn;
            const label = `${practiceDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}`
              + `${counted ? ', counts toward streaks' : short ? ', a shorter practice' : ''}${date === today ? ', today' : ''}`;
            const content = <>
              {isMoment && <View style={{ position: 'absolute', left: cell / 2, top: cell / 2 }}>
                <Ripple size={cell * 0.78} delay={760} still={still} /><Ripple size={cell * 0.78} delay={1040} still={still} />
              </View>}
              {(chosen || (date === today && inMonth)) && <View style={[styles.ring, { width: cell * 0.86, height: cell * 0.86,
                borderRadius: cell * 0.43, left: cell * 0.07, top: cell * 0.07, opacity: chosen ? 0.75 : 0.28 }]} />}
              <DayNumber date={date} painted={counted} inMonth={inMonth} cell={cell} turnsAt={isMoment ? 640 : null} still={still} />
              {short && <View style={[styles.dot, { top: cell * 0.76, left: cell / 2 - 2 }]} />}
            </>;
            return inMonth && onSelect
              ? <QuietPressable key={date} accessibilityRole="button" accessibilityState={{ selected: chosen }} accessibilityLabel={label}
                onPress={() => onSelect(date)} style={{ position: 'absolute', left: column * cell, top: 0, width: cell, height: cell }}>{content}</QuietPressable>
              : <View key={date} accessible={inMonth} accessibilityLabel={inMonth ? label : undefined}
                style={{ position: 'absolute', left: column * cell, top: 0, width: cell, height: cell }}>{content}</View>;
          })}
        </View>)}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', paddingBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: serifFont, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: 'rgba(20,20,20,0.55)' },
  line: { position: 'absolute', left: 4, right: 4, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,20,20,0.16)' },
  open: { position: 'absolute', left: 0, right: 0, borderWidth: 1, borderColor: 'rgba(20,20,20,0.16)' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: colors.ink },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
