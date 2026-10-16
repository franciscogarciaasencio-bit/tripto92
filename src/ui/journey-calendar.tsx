import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useVerticalPage } from './vertical-page';
import Svg, { Path } from 'react-native-svg';

import { currentContext, useOna } from '@/application/ona-provider';
import type { StoredMeditationSession } from '@/data';
import { practiceStreaks, STREAK_RULES } from '@/domain/progression';
import { MonthSlide, StreakOverview } from './calendar-streaks';
import { CALENDAR_VIGNETTE, CalendarLegend, PaintedMonth, VIGNETTE_RATIO } from './painted-month';
import { doubleDays } from './double-days';
import { PaperBackdrop } from './coastal-scene';
import { HomeNavigation } from './home-navigation';
import { Action, colors, Notice, Screen, serifFont, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { UI_MOTION } from './motion';
import { useReducedMotion } from './reduced-motion';
import { groupPracticeHistory, monthPracticeSummary, practiceDateLabel, practiceTimeLabel } from './practice-history';

const HISTORY_PAGE_SIZE = 50;

function monthInstant(month: string, offset = 0) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date;
}

/** A thin chevron drawn to match Ona's line icons, instead of a font glyph that varies by platform. */
function Chevron({ direction }: { direction: -1 | 1 }) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
    <Path d={direction < 0 ? 'M15 4.5 7.5 12l7.5 7.5' : 'M9 4.5 16.5 12 9 19.5'} fill="none" stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function JourneyCalendar({ onShowProgress }: { onShowProgress: () => void }) {
  const { history, ready, completedPractices, practiceRevision } = useOna();
  const [today, setToday] = useState(() => currentContext().localDate);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [records, setRecords] = useState<readonly StoredMeditationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadedCount, setLoadedCount] = useState(-1);
  const openingDetails = useRef(false);
  const reduced = useReducedMotion();
  // Pull down from the top of Journey to settle back into Home (the route slides back down).
  const atTop = useSharedValue(true), scrollNative = useMemo(() => Gesture.Native(), []);
  const leaving = useRef(false);
  const backHome = useCallback(() => { if (!leaving.current) { leaving.current = true; router.dismissTo('/'); } }, []);
  useFocusEffect(useCallback(() => { leaving.current = false; }, []));
  const page = useVerticalPage({ direction: 'down', atEdge: atTop, onTurn: backHome, simultaneous: scrollNative, enabled: true });
  const windowWidth = useWindowDimensions().width, vignetteWidth = Math.min(windowWidth, 540) * 1.12;
  const gutter = windowWidth <= 375 ? 20 : 24; // Screen's horizontal padding
  // "September" must fit beside the year on a 320 pt phone without shrinking or truncating.
  const monthNameSize = Math.round(Math.min(44, Math.max(32, (windowWidth - 48) * 0.13)));
  useFocusEffect(useCallback(() => { openingDetails.current = false; setToday(currentContext().localDate); }, []));

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    async function loadHistory() {
      setLoading(true);
      setRecords([]);
      setError(false);
      try {
        const collected: StoredMeditationSession[] = [];
        // The existing repository exposes paginated history. Read every page so older months remain truthful.
        while (!disposed) {
          const page = await history(collected.length);
          if (disposed) return;
          collected.push(...page);
          if (page.length < HISTORY_PAGE_SIZE) break;
        }
        if (!disposed) { setRecords(collected); setLoadedRevision(practiceRevision); setLoadedCount(completedPractices); }
      } catch {
        if (!disposed) setError(true);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void loadHistory();
    return () => { disposed = true; };
  }, [history, ready, completedPractices, attempt, practiceRevision]);

  const current = loadedRevision === practiceRevision && loadedCount === completedPractices;
  const byDate = useMemo(() => new Map(groupPracticeHistory(current ? records : []).map(day => [day.key, day.data])), [current, records]);
  const summary = useMemo(() => monthPracticeSummary(current ? records : [], month), [current, records, month]);
  const streaks = useMemo(() => practiceStreaks((current ? records : []).map(({ session }) => session), today), [current, records, today]);
  const doubles = useMemo(() => doubleDays((current ? records : []).map(({ session }) => session)), [current, records]);
  const shown = !loading && current && !error;

  // A tap on a day opens its practice (several: the history). Days without practice do nothing.
  const openDay = useCallback((date: string) => {
    const records = byDate.get(date) ?? [];
    if (openingDetails.current || !records.length) return;
    openingDetails.current = true;
    if (records.length === 1) router.push({ pathname: '/practice-detail', params: { id: records[0]!.session.id } });
    else router.push('/history');
  }, [byDate]);

  function changeMonth(offset: number) {
    const destination = monthInstant(month, offset).toISOString().slice(0, 7);
    setDirection(offset > 0 ? 1 : -1);
    setMonth(destination);
  }

  return <PaperBackdrop><Screen scroll={false} style={{ paddingBottom: 0, backgroundColor: 'transparent' }}>
    <View style={calendarStyles.heading}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="View progression details" onPress={onShowProgress}
        style={calendarStyles.details}>
        <Type role="secondary">Progress details</Type>
      </QuietPressable>
    </View>
    {/* Switching from the level view crossfades only the content; the title and tabs stay still. */}
    <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.navigation)} style={{ flex: 1 }}>
    {/* Edge to edge, so the painting can reach past the screen's margins instead of being clipped by them. */}
    <GestureDetector gesture={page.gesture}><Animated.View style={[{ flex: 1 }, page.style]}><GestureDetector gesture={scrollNative}>
    <ScrollView style={{ flex: 1, marginHorizontal: -gutter }} contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: gutter }}
      scrollEventThrottle={32} onScroll={(event) => atTop.set(event.nativeEvent.contentOffset.y <= 1)}>
      {shown && <StreakOverview streaks={streaks} daysPerWeek={STREAK_RULES.activeDaysPerWeek} />}
      <View style={calendarStyles.monthHeading}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" numberOfLines={1} adjustsFontSizeToFit
          style={[calendarStyles.monthName, { fontSize: monthNameSize, lineHeight: monthNameSize * 1.18 }]}>{practiceDateLabel(`${month}-01`, { month: 'long' })}</Text>
        <View style={calendarStyles.yearNav}>
          <QuietPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)}
            disabled={month === '0001-01'} style={calendarStyles.monthArrow}>
            <Chevron direction={-1} />
          </QuietPressable>
          <Text style={calendarStyles.year}>{month.slice(0, 4)}</Text>
          <QuietPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)}
            disabled={month === '9999-12'} style={calendarStyles.monthArrow}>
            <Chevron direction={1} />
          </QuietPressable>
        </View>
      </View>
      {/* A fixed line under the year, so Today appearing never moves the calendar. */}
      <View style={calendarStyles.todayLine}>
        {month !== today.slice(0, 7) && <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.reveal)} exiting={reduced ? undefined : FadeOut.duration(UI_MOTION.reveal)}>
          <QuietPressable accessibilityRole="button" accessibilityLabel="Return to today in the practice calendar"
            onPress={() => {
              const date = currentContext().localDate;
              setDirection(date.slice(0, 7) === month ? 0 : date.slice(0, 7) > month ? 1 : -1);
              setToday(date); setMonth(date.slice(0, 7));
            }} style={calendarStyles.todayAction}>
            <Type role="secondary" style={{ fontSize: 13 }}>Today</Type>
          </QuietPressable>
        </Animated.View>}
      </View>
      <MonthSlide key={month} direction={direction}>
        {/* No line under the month (owner, 2026-10-17): tapping a day opens its practice directly. */}
        <PaintedMonth month={month} streaks={streaks} today={today} selected={null} onSelect={openDay} live={shown} doubles={doubles} />
      </MonthSlide>
      <CalendarLegend />
      {loading || !current ? <Type role="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
        {error ? 'Saved practice is unavailable.' : 'Opening your saved practice…'}
      </Type> : null}
      <Notice>{error ? 'Your practice could not be loaded. Your saved records are unchanged.' : null}</Notice>
      {error && <Action quiet onPress={() => setAttempt((value) => value + 1)}>Try again</Action>}
      {/* The owner's painting rests under the month: its misty sky reaches up into the calendar. */}
      {/* A little wider than the screen: its softly faded sides fall past the edges, only ink on paper remains. */}
      <Image source={CALENDAR_VIGNETTE} accessible={false} style={{ width: vignetteWidth, height: vignetteWidth / VIGNETTE_RATIO,
        marginTop: -vignetteWidth / VIGNETTE_RATIO * 0.16, alignSelf: 'center' }} />
      {shown && <View style={calendarStyles.monthSummary}>
        <View accessible accessibilityLabel={`${summary.practiceDays} practice days`} style={{ flex: 1, gap: 2 }}>
          <Type role="heading" accessibilityRole="text">{summary.practiceDays}</Type><Type role="secondary">Practice days</Type>
        </View>
        <View accessible accessibilityLabel={`${practiceTimeLabel(summary.activeSeconds)} of time for yourself`} style={{ flex: 1, gap: 2 }}>
          <Type role="heading" accessibilityRole="text">{practiceTimeLabel(summary.activeSeconds)}</Type><Type role="secondary">Time for yourself</Type>
        </View>
      </View>}
      <Action quiet onPress={() => router.push('/history')}>Meditation history</Action>
    </ScrollView>
    </GestureDetector></Animated.View></GestureDetector>
    </Animated.View>
  </Screen><HomeNavigation active="journey" /></PaperBackdrop>;
}

const calendarStyles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 12 },
  details: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  monthHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 8 },
  monthName: { flexShrink: 1, fontFamily: serifFont, fontSize: 44, lineHeight: 52, letterSpacing: -0.6, color: colors.ink },
  yearNav: { flexDirection: 'row', alignItems: 'center', marginRight: -12 },
  year: { fontFamily: serifFont, fontSize: 22, lineHeight: 28, color: 'rgba(20,20,20,0.6)', fontVariant: ['tabular-nums'] },
  monthArrow: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  todayLine: { height: 30, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 6 },
  todayAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  // No rule above: the painting's reflection fades into the month's numbers on the same paper.
  monthSummary: { flexDirection: 'row', columnGap: 20, marginTop: -6, paddingTop: 8 },
});
