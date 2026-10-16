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
 * Painted day marks (scripts/calendar/build-calendar-art.cjs; owner reference docs/evidence/
 * calendar-reference.png): a single counted day is a drop of ink, consecutive counted days one pale
 * wash with soft necks. Sprites are one column tall and n columns wide, never stretched.
 */
const INK = [require('../../assets/ona/calendar/ink-1.webp'), require('../../assets/ona/calendar/ink-2.webp'),
  require('../../assets/ona/calendar/ink-3.webp')] as const;
const WASH: Record<number, number> = {
  2: require('../../assets/ona/calendar/wash-2.webp'), 3: require('../../assets/ona/calendar/wash-3.webp'),
  4: require('../../assets/ona/calendar/wash-4.webp'), 5: require('../../assets/ona/calendar/wash-5.webp'),
  6: require('../../assets/ona/calendar/wash-6.webp'), 7: require('../../assets/ona/calendar/wash-7.webp'),
};
/** A day practised twice (two practices at least six hours apart): indigo ink, or an indigo drop in a run. */
const INDIGO = [require('../../assets/ona/calendar/indigo-1.webp'), require('../../assets/ona/calendar/indigo-2.webp'),
  require('../../assets/ona/calendar/indigo-3.webp')] as const;
const INDIGO_BEAD = require('../../assets/ona/calendar/indigo-bead.webp');
const NO_DOUBLES: ReadonlySet<string> = new Set();
export const CALENDAR_VIGNETTE = require('../../assets/ona/calendar/vignette.webp');
/** Width / height of vignette.webp. */
export const VIGNETTE_RATIO = 1024 / 722;
const ON_INK = '#F6F1E8';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
/** Rows are a little taller than columns are wide, as in the reference. */
export const ROW_RATIO = 1.22;
const settle = Easing.bezier(0.22, 0.61, 0.36, 1);
const arrive = Easing.out(Easing.back(1.4));

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

/** When a month draws in, each row's marks start left to right, one row after another. */
const drawDelay = (row: number, column: number) => 80 + row * 70 + column * 30;

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

/** A stable ink variant per date, so a day keeps its drop. */
function inkFor(date: string, twice = false) {
  let hash = 0;
  for (const char of date) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (twice ? INDIGO : INK)[hash % INK.length]!;
}

type Run = readonly [number, number];
const sameRun = (a: Run, b: Run) => a[0] === b[0] && a[1] === b[1];

/** One mark: an ink drop for a single day, the n-day wash for a run; days practised twice in indigo. */
function Mark({ run, dates, cell, top, doubles = NO_DOUBLES }: { run: Run; dates: readonly string[]; cell: number; top: number; doubles?: ReadonlySet<string> }) {
  const length = run[1] - run[0] + 1;
  if (length === 1) return <Image source={inkFor(dates[run[0]]!, doubles.has(dates[run[0]]!))}
    style={{ position: 'absolute', left: run[0] * cell, top, width: cell, height: cell }} />;
  return <>
    <Image source={WASH[length]!} style={{ position: 'absolute', left: run[0] * cell, top, width: length * cell, height: cell }} />
    {dates.slice(run[0], run[1] + 1).map((date, index) => doubles.has(date) && <Image key={date} source={INDIGO_BEAD}
      style={{ position: 'absolute', left: (run[0] + index) * cell, top, width: cell, height: cell }} />)}
  </>;
}

/** A mark that draws in left to right like one brush stroke (calendar opening, month change). */
function DrawnMark({ run, dates, cell, top, delay, still, doubles }: { run: Run; dates: readonly string[]; cell: number; top: number; delay: number; still: boolean; doubles: ReadonlySet<string> }) {
  const length = run[1] - run[0] + 1;
  const reveal = useStep(delay, 240 + length * 80, still);
  const style = useAnimatedStyle(() => ({ width: cell * length * reveal.value, opacity: Math.min(1, reveal.value * 2.5) }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: run[0] * cell, top, height: cell, overflow: 'hidden' }, style]}>
    <Mark run={[0, length - 1]} dates={dates.slice(run[0], run[1] + 1)} cell={cell} top={0} doubles={doubles} />
  </Animated.View>;
}

/** Fades out after `delay` (marks this practice replaces). */
function FadeOut({ delay, duration, still, children }: { delay: number; duration: number; still: boolean; children: React.ReactNode }) {
  const step = useStep(delay, duration, still);
  const style = useAnimatedStyle(() => ({ opacity: 1 - step.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/** The newest day's mark arriving: an ink drop settles in, or the run grows from the days it joins. */
function Arriving({ run, from, dates, cell, top, still, doubles }: { run: Run; from: number; dates: readonly string[]; cell: number; top: number; still: boolean; doubles: ReadonlySet<string> }) {
  const length = run[1] - run[0] + 1;
  const grow = useStep(420, 520, still);
  const drop = useStep(420, 460, still, arrive);
  const growStyle = useAnimatedStyle(() => ({ width: cell * (from + (length - from) * grow.value), opacity: from > 0 ? 1 : Math.min(1, grow.value * 2.5) }));
  const dropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, drop.value * 2), transform: [{ scale: 0.4 + 0.6 * drop.value }] }));
  if (length === 1) return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: run[0] * cell, top, width: cell, height: cell }, dropStyle]}>
    <Mark run={[0, 0]} dates={[dates[run[0]]!]} cell={cell} top={0} doubles={doubles} />
  </Animated.View>;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: run[0] * cell, top, height: cell, overflow: 'hidden' }, growStyle]}>
    <Mark run={[0, length - 1]} dates={dates.slice(run[0], run[1] + 1)} cell={cell} top={0} doubles={doubles} />
  </Animated.View>;
}

/** Two soft rings spreading from the newest day, like a drop in still water. */
function Ripple({ size, delay, still }: { size: number; delay: number; still: boolean }) {
  const progress = useStep(delay, 1500, still, Easing.out(Easing.quad));
  const style = useAnimatedStyle(() => ({ opacity: still ? 0 : 0.4 * (1 - progress.value) * Math.min(1, progress.value * 6),
    transform: [{ scale: 1 + 2 * progress.value }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2,
    borderWidth: 1.1, borderColor: colors.ink, left: -size / 2, top: -size / 2 }, style]} />;
}

/** A day number; light on an ink drop. With `turnsAt`, it changes tone as the newest mark arrives. */
function DayNumber({ day, inMonth, onInk, wasOnInk, cell, turnsAt, fade = 260, still }: {
  day: number; inMonth: boolean; onInk: boolean; wasOnInk: boolean; cell: number; turnsAt: number | null; fade?: number; still: boolean;
}) {
  const turn = useStep(turnsAt ?? 0, fade, still || turnsAt === null);
  const start = turnsAt === null ? (onInk ? 1 : 0) : (wasOnInk ? 1 : 0), end = onInk ? 1 : 0;
  const light = useAnimatedStyle(() => ({ opacity: start + (end - start) * turn.value }));
  const dark = useAnimatedStyle(() => ({ opacity: 1 - (start + (end - start) * turn.value) }));
  const size = Math.min(20, cell * 0.34);
  const text = { fontFamily: serifFont, fontSize: size, lineHeight: size * 1.3, color: inMonth ? colors.ink : 'rgba(20,20,20,0.32)' };
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.center, dark]}><Text style={text}>{day}</Text></Animated.View>
    <Animated.View style={[styles.center, light]}><Text style={[text, { color: ON_INK }]}>{day}</Text></Animated.View>
  </View>;
}

/**
 * One month, painted like ink and wash on paper (owner reference): a single counted day is an ink drop,
 * consecutive counted days one pale wash; hairlines between weeks; the week in progress outlined; a
 * chosen day other than today ringed; shorter practices a small dot. With `moment`, the newest practice day is painted
 * in (its drop settles, or its run grows from the days it joins, and ripples spread). Otherwise the
 * month draws in gently, row by row.
 */
export function PaintedMonth({ month, streaks, practiced, today, selected, onSelect, moment, live = true, doubles = NO_DOUBLES, doublesBefore }: {
  month: string; streaks: PracticeStreaks; practiced: ReadonlySet<string>; today: string;
  selected?: string | null; onSelect?: (date: string) => void;
  moment?: { date: string } | null; live?: boolean;
  /** Days practised twice (two practices at least six hours apart); before the moment's practice, too. */
  doubles?: ReadonlySet<string>; doublesBefore?: ReadonlySet<string>;
}) {
  const twice = live ? doubles : NO_DOUBLES, twiceBefore = live ? doublesBefore ?? doubles : NO_DOUBLES;
  const still = useMotionPreference() !== false;
  const [width, setWidth] = useState(0);
  const cell = width / 7, rowHeight = cell * ROW_RATIO, markTop = (rowHeight - cell) / 2, dot = Math.max(4, Math.round(cell * 0.115));
  const rows = monthRows(month);
  return <View>
    <View style={styles.weekdays}>
      {WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
    </View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: width ? rows.length * rowHeight : 300 }}>
      {width > 0 && rows.map((dates, row) => {
        const counted = dates.map((date) => live && streaks.isActiveDay(date));
        const after = streakRuns(counted);
        const momentColumn = moment ? dates.indexOf(moment.date) : -1;
        const before = momentColumn >= 0 ? streakRuns(counted.map((on, column) => on && column !== momentColumn)) : after;
        const arriving = momentColumn >= 0 ? after.find(([start, end]) => momentColumn >= start && momentColumn <= end) ?? null : null;
        // Marks this practice changes fade out as the new one arrives; all others stay as they were.
        const replaced = arriving ? before.filter(([start, end]) => end >= arriving[0] && start <= arriving[1]) : [];
        const unchanged = after.filter((run) => run !== arriving && before.some((old) => sameRun(old, run)));
        const showsWeek = live && dates.includes(today);
        return <View key={dates[0]} style={{ position: 'absolute', left: 0, top: row * rowHeight, width, height: rowHeight }}>
          {row > 0 && !showsWeek && !(live && rows[row - 1]!.includes(today)) && <View style={styles.line} />}
          {showsWeek && <View style={[styles.week, { top: rowHeight * 0.06, height: rowHeight * 0.88, borderRadius: rowHeight * 0.44 }]} />}
          {moment
            ? <>
              {unchanged.map((run) => <Mark key={`s${run[0]}`} run={run} dates={dates} cell={cell} top={markTop} doubles={twice} />)}
              {replaced.length > 0 && <FadeOut delay={420} duration={520} still={still}>
                {replaced.map((run) => <Mark key={`b${run[0]}`} run={run} dates={dates} cell={cell} top={markTop} doubles={twiceBefore} />)}
              </FadeOut>}
              {arriving && <Arriving run={arriving} dates={dates} cell={cell} top={markTop} still={still} doubles={twice}
                from={replaced.length ? Math.max(0, momentColumn - arriving[0]) : 0} />}
            </>
            : after.map((run) => <DrawnMark key={`${month}${run[0]}`} run={run} dates={dates} cell={cell} top={markTop}
              delay={drawDelay(row, run[0])} still={still} doubles={twice} />)}
          {dates.map((date, column) => {
            const inMonth = date.startsWith(`${month}-`);
            const isCounted = counted[column]!;
            const single = after.some(([start, end]) => start === column && end === column);
            const wasSingle = before.some(([start, end]) => start === column && end === column);
            const short = live && !isCounted && practiced.has(date);
            const chosen = !!onSelect && selected === date && inMonth;
            const isMoment = column === momentColumn;
            const label = `${practiceDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}`
              + `${isCounted ? ', counts toward streaks' : short ? ', a shorter practice' : ''}${twice.has(date) ? ', practised twice' : ''}${date === today ? ', today' : ''}`;
            const content = <>
              {isMoment && <View style={{ position: 'absolute', left: cell / 2, top: rowHeight / 2 }}>
                <Ripple size={cell * 0.74} delay={780} still={still} /><Ripple size={cell * 0.74} delay={1060} still={still} />
              </View>}
              {/* Today is the default choice and needs no ring (the week outline already holds it), as in the reference. */}
              {chosen && date !== today && <View style={[styles.ring, { width: cell * 0.86, height: cell * 0.86, borderRadius: cell * 0.43,
                left: cell * 0.07, top: (rowHeight - cell * 0.86) / 2 }]} />}
              {/* Light numbers wait for their ink: on the newest day as it arrives, elsewhere as the drop's wipe crosses them. */}
              <DayNumber day={Number(date.slice(8))} inMonth={inMonth} onInk={single} wasOnInk={!!moment && !isMoment && wasSingle} cell={cell} still={still}
                fade={moment ? 260 : 160}
                turnsAt={moment ? (isMoment || wasSingle !== single ? 620 : null) : single ? drawDelay(row, column) + 30 : null} />
              {short && <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, top: rowHeight * 0.76 - dot / 2, left: (cell - dot) / 2 }]} />}
            </>;
            const frame = { position: 'absolute' as const, left: column * cell, top: 0, width: cell, height: rowHeight };
            return inMonth && onSelect
              ? <QuietPressable key={date} accessibilityRole="button" accessibilityState={{ selected: chosen }} accessibilityLabel={label}
                onPress={() => onSelect(date)} style={frame}>{content}</QuietPressable>
              : <View key={date} accessible={inMonth} accessibilityLabel={inMonth ? label : undefined} style={frame}>{content}</View>;
          })}
        </View>;
      })}
    </View>
  </View>;
}

/** What the marks mean, drawn with the same sprites, small and quiet; two balanced lines. */
export function CalendarLegend() {
  const size = 18;
  const item = (mark: React.ReactNode, label: string) => <View key={label} style={styles.legendItem}>{mark}<Text style={styles.legendText}>{label}</Text></View>;
  return <View accessible accessibilityLabel="Legend: a dark drop is a day of practice; a pale wash joins days in a row; indigo is a day practised twice, six hours apart; a small dot is a shorter practice."
    style={styles.legend}>
    <View style={styles.legendLine}>
      {item(<Image source={INK[0]} style={{ width: size, height: size }} />, 'A day of practice')}
      {item(<Image source={WASH[2]!} style={{ width: size * 2, height: size }} />, 'Days in a row')}
    </View>
    <View style={styles.legendLine}>
      {item(<View style={{ flexDirection: 'row' }}><Image source={INDIGO[0]} style={{ width: size, height: size }} />
        <Image source={INDIGO_BEAD} style={{ width: size, height: size, marginLeft: -2 }} /></View>, 'Twice in a day')}
      {item(<View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.ink }} /></View>, 'Shorter practice')}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  legend: { alignItems: 'center', gap: 4, marginTop: 10 },
  legendLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontFamily: 'ManropeRegular', fontSize: 11.5, lineHeight: 16, color: 'rgba(20,20,20,0.58)' },
  weekdays: { flexDirection: 'row', paddingBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: serifFont, fontSize: 10.5, lineHeight: 16, letterSpacing: 0.6, color: 'rgba(20,20,20,0.5)' },
  line: { position: 'absolute', top: 0, left: 2, right: 2, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,20,20,0.16)' },
  week: { position: 'absolute', left: -4, right: -4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(20,20,20,0.3)' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(20,20,20,0.55)' },
  dot: { position: 'absolute', backgroundColor: colors.ink },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
