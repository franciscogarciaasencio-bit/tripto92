import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence,
  withTiming, type WithTimingConfig } from 'react-native-reanimated';
import type { MeditationSession, PracticeStreaks, StreakMoment } from '@/domain/progression';
import { practiceStreaks, STREAK_RULES } from '@/domain/progression';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { STREAK_FILL } from './calendar-streaks';
import { practiceDateLabel } from './practice-history';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';
import { streakRuns } from './streak-geometry';

const WEEK_BAND = '#E9E0D1';
const OPEN_WEEK = 'rgba(20,20,20,0.12)';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const settle = Easing.bezier(0.22, 0.61, 0.36, 1);
const spread = Easing.out(Easing.quad), arrive = Easing.out(Easing.back(1.7)), pop = Easing.out(Easing.back(2.2));

/**
 * When each part of the celebration plays (ms after it opens). The practice's day joins its streak,
 * ripples spread from it like water, the week's band unfolds when that day made the week count, and a
 * full month sends one soft wave down its weeks. Nothing loops; Reduced Motion shows the end state.
 */
export const CELEBRATION_MOTION = {
  enter: 320, extendAt: 380, extend: 460, discAt: 560, disc: 420, rippleAt: 700, ripple: 1500, rippleGap: 280,
  headlineAt: 820, number: 420, bandAt: 1020, band: 560, pebbleAt: 1250, pebble: 380, monthAt: 1500, monthWave: 520, monthStagger: 90,
  continueAt: 1100,
} as const;

/** Copy for the moment; weeks lead, days follow (the owner's rhythm: three days a week). */
export function celebrationCopy(moment: StreakMoment) {
  const monthName = practiceDateLabel(`${moment.month}-01`, { month: 'long' });
  const needed = STREAK_RULES.activeDaysPerWeek;
  const remaining = Math.max(0, needed - moment.weekDays);
  const weekLine = moment.weekDays >= needed ? 'This week already counts.'
    : `${remaining === 1 ? 'One more day' : 'Two more days'} for a consistent week.`;
  switch (moment.kind) {
    case 'month': return { kicker: 'Congratulations', headline: 'A full month.',
      lines: [`Every week of ${monthName} was consistent.`, moment.monthsInRow > 1 ? `${moment.monthsInRow} full months in a row.` : 'See you tomorrow.'] };
    case 'week': return { kicker: 'Congratulations', headline: 'A very consistent week.',
      lines: [moment.weeksInRow > 1 ? `${moment.weeksInRow} consistent weeks in a row.` : `${needed} days of practice this week.`,
        moment.daysInRow > 1 ? `And ${moment.daysInRow} days in a row.` : 'See you tomorrow.'] };
    case 'days': return { kicker: 'Congratulations', headline: `${moment.daysInRow} days in a row.`,
      lines: [`Come back tomorrow for ${moment.daysInRow + 1}.`, weekLine] };
    default: return { kicker: 'Your rhythm', headline: 'Today counts.',
      lines: [weekLine, 'Come back tomorrow for two in a row.'] };
  }
}

/** 0 → 1 once after `delay`; immediately 1 with Reduced Motion. */
function useStep(delay: number, duration: number, still: boolean, easing: NonNullable<WithTimingConfig['easing']> = settle) {
  const value = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { value.set(1); return; }
    value.set(withDelay(delay, withTiming(1, { duration, easing, reduceMotion: ReduceMotion.Never })));
    return () => cancelAnimation(value);
  }, [delay, duration, easing, still, value]);
  return value;
}

function Ripple({ size, delay, still }: { size: number; delay: number; still: boolean }) {
  const progress = useStep(delay, CELEBRATION_MOTION.ripple, still, spread);
  const style = useAnimatedStyle(() => ({ opacity: still ? 0 : 0.5 * (1 - progress.value) * Math.min(1, progress.value * 6),
    transform: [{ scale: 1 + 2.1 * progress.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.ripple, { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 }, style]} />;
}

/** The new day: an ink disc that settles into place, then two ripples spreading from it. */
function NewDay({ size, still }: { size: number; still: boolean }) {
  const disc = useStep(CELEBRATION_MOTION.discAt, CELEBRATION_MOTION.disc, still, arrive);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, disc.value * 2), transform: [{ scale: 0.35 + 0.65 * disc.value }] }));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={{ position: 'absolute', left: '50%', top: '50%' }}>
      <Ripple size={size} delay={CELEBRATION_MOTION.rippleAt} still={still} />
      <Ripple size={size} delay={CELEBRATION_MOTION.rippleAt + CELEBRATION_MOTION.rippleGap} still={still} />
    </View>
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: coastalInk }, style]} />
    </View>
  </View>;
}

/** A capsule of consecutive days; the one holding the new day grows into it from yesterday. */
function Run({ left, from, to, top, disc, grows, still }: { left: number; from: number; to: number; top: number; disc: number; grows: boolean; still: boolean }) {
  const extend = useStep(CELEBRATION_MOTION.extendAt, CELEBRATION_MOTION.extend, still || !grows);
  const style = useAnimatedStyle(() => ({ width: from + (to - from) * extend.value }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, height: disc, borderRadius: disc / 2, backgroundColor: STREAK_FILL }, style]} />;
}

function WeekBand({ unfolds, wave, still, row }: { unfolds: boolean; wave: boolean; still: boolean; row: number }) {
  const band = useStep(CELEBRATION_MOTION.bandAt, CELEBRATION_MOTION.band, still || !unfolds);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (still || !wave) return;
    pulse.set(withDelay(CELEBRATION_MOTION.monthAt + row * CELEBRATION_MOTION.monthStagger, withSequence(
      withTiming(1, { duration: CELEBRATION_MOTION.monthWave / 2, easing: settle, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: CELEBRATION_MOTION.monthWave / 2, easing: settle, reduceMotion: ReduceMotion.Never }))));
    return () => cancelAnimation(pulse);
  }, [pulse, row, still, wave]);
  const style = useAnimatedStyle(() => ({ width: `${band.value * 100}%`, transform: [{ scaleY: 1 + 0.12 * pulse.value }],
    backgroundColor: interpolateColor(pulse.value, [0, 1], [WEEK_BAND, '#DACDB6']) }));
  return <Animated.View pointerEvents="none" style={[styles.band, style]} />;
}

function Pebble({ full, pops, still }: { full: boolean; pops: boolean; still: boolean }) {
  const grow = useStep(CELEBRATION_MOTION.pebbleAt, CELEBRATION_MOTION.pebble, still || !pops, pop);
  const style = useAnimatedStyle(() => ({ opacity: pops ? Math.min(1, grow.value * 1.5) : 1, transform: [{ scale: pops ? 0.3 + 0.7 * grow.value : 1 }] }));
  // The pebble this practice fills starts as an outline, then fills with a small pop.
  return <View style={[styles.pebble, (!full || pops) && styles.pebbleOpen]}>
    {full && <Animated.View style={[StyleSheet.absoluteFill, styles.pebbleFill, style]} />}
  </View>;
}

/** The headline's number rolls up from yesterday's count to today's. */
function RollingNumber({ from, to, style, still }: { from: number; to: number; style: object; still: boolean }) {
  const roll = useStep(CELEBRATION_MOTION.headlineAt, CELEBRATION_MOTION.number, still);
  const old = useAnimatedStyle(() => ({ opacity: 1 - roll.value, transform: [{ translateY: -14 * roll.value }] }));
  const next = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateY: 14 * (1 - roll.value) }] }));
  return <View>
    <Animated.Text style={[style, { position: 'absolute', right: 0 }, old]}>{from}</Animated.Text>
    <Animated.Text style={[style, next]}>{to}</Animated.Text>
  </View>;
}

/**
 * The calendar moment after "Well done": the month of the practice, with this practice's day joining
 * its streak, and words that celebrate days in a row, a consistent week or a full month.
 */
export function StreakCelebration({ moment, sessions, scale, busy, onContinue }: {
  moment: StreakMoment; sessions: readonly Pick<MeditationSession, 'status' | 'activeDurationSeconds' | 'localDate'>[];
  scale: number; busy: boolean; onContinue: () => void;
}) {
  const still = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [streaks] = useState<PracticeStreaks>(() => practiceStreaks(sessions, moment.date));
  const copy = celebrationCopy(moment);
  const enter = useStep(0, CELEBRATION_MOTION.enter, still);
  const words = useStep(CELEBRATION_MOTION.headlineAt - 120, 420, still);
  const action = useStep(CELEBRATION_MOTION.continueAt, 360, still);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: 10 * (1 - enter.value) }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: 8 * (1 - words.value) }] }));
  const actionStyle = useAnimatedStyle(() => ({ opacity: action.value }));

  const month = moment.date.slice(0, 7);
  const first = new Date(`${month}-01T00:00:00.000Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const end = new Date(first); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
  const rows = Math.ceil((offset + end.getUTCDate()) / 7);
  const cell = width / 7, disc = Math.max(24, Math.min(32 * scale, cell - 10)), rowHeight = disc + 10;
  const dateAt = (row: number, column: number) => new Date(first.getTime() + (row * 7 + column - offset) * 86_400_000).toISOString().slice(0, 10);
  const headline = { fontFamily: coastalSerif, fontSize: 32 * scale, lineHeight: 40 * scale, color: coastalInk };

  return <Animated.View style={[{ width: '100%' }, enterStyle]}>
    <Text style={[styles.kicker, { fontSize: 12 * scale, letterSpacing: 2.6 * scale }]}>{copy.kicker.toUpperCase()}</Text>
    <View accessible accessibilityRole="header" accessibilityLabel={copy.headline} style={styles.headline}>
      {moment.kind === 'days'
        ? <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <RollingNumber from={moment.daysInRow - 1} to={moment.daysInRow} style={headline} still={still} />
          <Text style={headline}>{copy.headline.slice(String(moment.daysInRow).length)}</Text>
        </View>
        : <Animated.Text style={[headline, { textAlign: 'center' }, wordsStyle]}>{copy.headline}</Animated.Text>}
    </View>
    <Animated.View style={[{ alignItems: 'center', gap: 2, marginTop: 6 * scale }, wordsStyle]}>
      {copy.lines.map((line) => <Text key={line} style={[styles.line, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>{line}</Text>)}
    </Animated.View>

    <View style={[styles.panel, { marginTop: 22 * scale, padding: 14 * scale, borderRadius: 17 * scale }]}>
      <View style={styles.panelHeader}>
        <Text style={{ fontFamily: coastalSerif, fontSize: 20 * scale, lineHeight: 26 * scale, color: coastalInk }}>
          {practiceDateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}
        </Text>
        <View accessible accessibilityLabel={`${moment.weekDays} of ${STREAK_RULES.activeDaysPerWeek} days this week`} style={styles.pebbles}>
          {Array.from({ length: STREAK_RULES.activeDaysPerWeek }, (_, index) => <Pebble key={index}
            full={index < Math.min(moment.weekDays, STREAK_RULES.activeDaysPerWeek)}
            pops={index === moment.weekDaysBefore && moment.weekDays > moment.weekDaysBefore && index < STREAK_RULES.activeDaysPerWeek} still={still} />)}
        </View>
      </View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((day, index) => <Text key={index} style={[styles.weekday, { fontSize: 12 * scale }]}>{day}</Text>)}
      </View>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible
        accessibilityLabel={`${practiceDateLabel(moment.date, { month: 'long', day: 'numeric' })} joins your calendar`}>
        {width > 0 && Array.from({ length: rows }, (_, row) => {
          const dates = Array.from({ length: 7 }, (_, column) => dateAt(row, column));
          const week = streaks.week(dates[0]!);
          const holdsMoment = dates.includes(moment.date);
          const counted = dates.map((date) => streaks.isActiveDay(date));
          const top = (rowHeight - disc) / 2;
          return <View key={dates[0]} style={{ height: rowHeight, marginVertical: 2 }}>
            {week.state === 'active' && <WeekBand unfolds={holdsMoment && moment.weekBecameActive} wave={moment.kind === 'month' && week.month === moment.month} still={still} row={row} />}
            {week.state !== 'active' && holdsMoment && <View pointerEvents="none" style={[styles.band, styles.openBand]} />}
            {streakRuns(counted).map(([start, last]) => {
              const today = dates.indexOf(moment.date);
              const grows = holdsMoment && today > start && today <= last;
              const left = start * cell + (cell - disc) / 2;
              const to = (last - start) * cell + disc;
              const from = grows ? (today - 1 - start) * cell + disc : to;
              const created = holdsMoment && today === start;
              return created ? null : <Run key={start} left={left} from={from} to={to} top={top} disc={disc} grows={grows} still={still} />;
            })}
            {/* Rare: later days already counted (another time zone); they stay as they were. */}
            {streakRuns(counted).filter(([start, last]) => holdsMoment && dates.indexOf(moment.date) === start && last > start)
              .map(([start, last]) => <Run key={`after-${start}`} left={(start + 1) * cell + (cell - disc) / 2}
                from={(last - start - 1) * cell + disc} to={(last - start - 1) * cell + disc} top={top} disc={disc} grows={false} still={still} />)}
            <View style={styles.row}>
              {dates.map((date) => {
                const inMonth = date.startsWith(`${month}-`), isMoment = date === moment.date;
                return <View key={date} style={[styles.cell, { height: rowHeight }]}>
                  {isMoment && <NewDay size={disc} still={still} />}
                  <MomentDay date={date} isMoment={isMoment} inMonth={inMonth} scale={scale} still={still} />
                </View>;
              })}
            </View>
          </View>;
        })}
      </View>
    </View>

    <Animated.View style={actionStyle}>
      <QuietPressable accessibilityRole="button" accessibilityLabel={busy ? 'Returning' : 'Continue'} accessibilityState={{ disabled: busy }} disabled={busy}
        disabledOpacity={.65} pressedOpacity={.8} onPress={onContinue} style={[styles.continue, { minHeight: Math.max(56 * scale, 48), borderRadius: 28 * scale, marginTop: 20 * scale }]}>
        <Text style={{ fontFamily: 'ManropeMedium', fontSize: 17 * scale, lineHeight: 24 * scale, color: '#F7F0E3' }}>{busy ? 'Returning…' : 'Continue'}</Text>
      </QuietPressable>
    </Animated.View>
  </Animated.View>;
}

/** Day numbers; the celebrated day's number turns light as its ink disc arrives. */
function MomentDay({ date, isMoment, inMonth, scale, still }: { date: string; isMoment: boolean; inMonth: boolean; scale: number; still: boolean }) {
  const turn = useStep(CELEBRATION_MOTION.discAt + 80, 200, still || !isMoment);
  const light = useAnimatedStyle(() => ({ opacity: isMoment ? turn.value : 0 }));
  const dark = useAnimatedStyle(() => ({ opacity: isMoment ? 1 - turn.value : 1 }));
  const text = { fontFamily: 'ManropeRegular', fontSize: 14 * scale, lineHeight: 20 * scale, color: inMonth ? coastalInk : 'rgba(20,20,20,0.3)' };
  const day = Number(date.slice(8));
  return <View style={StyleSheet.absoluteFill}>
    <Animated.View style={[styles.center, dark]}><Text style={text}>{day}</Text></Animated.View>
    {isMoment && <Animated.View style={[styles.center, light]}><Text style={[text, { color: '#F7F0E3' }]}>{day}</Text></Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  kicker: { fontFamily: 'ManropeRegular', color: coastalQuiet, textAlign: 'center', lineHeight: 18 },
  headline: { alignItems: 'center', marginTop: 8 },
  line: { fontFamily: 'ManropeRegular', color: coastalQuiet, textAlign: 'center' },
  panel: { backgroundColor: 'rgba(228,210,182,0.22)' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pebbles: { flexDirection: 'row', gap: 6 },
  pebble: { width: 10, height: 10, borderRadius: 5, overflow: 'hidden' },
  pebbleOpen: { borderWidth: 1, borderColor: 'rgba(20,20,20,0.42)' },
  pebbleFill: { borderRadius: 5, backgroundColor: coastalInk },
  weekdays: { flexDirection: 'row', paddingVertical: 6 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: 'ManropeRegular', color: coastalQuiet },
  band: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: WEEK_BAND },
  openBand: { right: 0, backgroundColor: 'transparent', borderWidth: 1, borderColor: OPEN_WEEK },
  row: { flexDirection: 'row' },
  cell: { flex: 1 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', borderWidth: 1.2, borderColor: coastalInk },
  continue: { backgroundColor: '#1C211A', alignItems: 'center', justifyContent: 'center' },
});
