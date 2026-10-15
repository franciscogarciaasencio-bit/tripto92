import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay,
  withTiming, type WithTimingConfig } from 'react-native-reanimated';
import type { MeditationSession, PracticeStreaks, StreakMoment } from '@/domain/progression';
import { practiceStreaks, STREAK_RULES } from '@/domain/progression';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { PaintedMonth } from './painted-month';
import { practiceDateLabel } from './practice-history';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';

const settle = Easing.bezier(0.22, 0.61, 0.36, 1);
const pop = Easing.out(Easing.back(2.2));

/**
 * When the words and controls arrive (ms after the moment opens). The painted month (painted-month.tsx)
 * paints the day in, spreads its ripples and lays the week's wash on its own clock. Nothing loops.
 */
export const CELEBRATION_MOTION = { enter: 320, headlineAt: 820, number: 420, pebbleAt: 1250, pebble: 380, continueAt: 1100 } as const;

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
    // A return after time away is welcomed, never framed as a loss.
    case 'return': return { kicker: 'Welcome back', headline: 'Good to see you again.',
      lines: [`${moment.daysAway} days away, and you came back.`, 'Every return counts.'] };
    case 'first': return { kicker: 'Your first day', headline: 'The habit begins.',
      lines: ['Come back tomorrow for two in a row.', weekLine] };
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
  const [streaks] = useState<PracticeStreaks>(() => practiceStreaks(sessions, moment.date));
  const copy = celebrationCopy(moment);
  const enter = useStep(0, CELEBRATION_MOTION.enter, still);
  const words = useStep(CELEBRATION_MOTION.headlineAt - 120, 420, still);
  const action = useStep(CELEBRATION_MOTION.continueAt, 360, still);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: 10 * (1 - enter.value) }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: 8 * (1 - words.value) }] }));
  const actionStyle = useAnimatedStyle(() => ({ opacity: action.value }));

  const month = moment.date.slice(0, 7);
  const [practiced] = useState(() => new Set(sessions.map((session) => session.localDate)));
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
      <View accessible accessibilityLabel={`${practiceDateLabel(moment.date, { month: 'long', day: 'numeric' })} joins your calendar`}>
        <PaintedMonth month={month} streaks={streaks} practiced={practiced} today={moment.date}
          moment={{ date: moment.date }} />
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
  continue: { backgroundColor: '#1C211A', alignItems: 'center', justifyContent: 'center' },
});
