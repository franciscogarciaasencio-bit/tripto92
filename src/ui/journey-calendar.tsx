import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { currentContext, useOna } from '@/application/ona-provider';
import type { StoredMeditationSession } from '@/data';
import { practiceStreaks, STREAK_RULES } from '@/domain/progression';
import { MonthSlide, StreakOverview } from './calendar-streaks';
import { CALENDAR_VIGNETTE, PaintedMonth, VIGNETTE_RATIO } from './painted-month';
import { HomeNavigation } from './home-navigation';
import { Action, colors, formatDuration, Notice, Screen, serifFont, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { UI_MOTION } from './motion';
import { useReducedMotion } from './reduced-motion';
import { groupPracticeHistory, monthPracticeSummary, practiceDateLabel, practiceTimeLabel } from './practice-history';

const HISTORY_PAGE_SIZE = 50;

/** UTC is only used to lay out Gregorian calendar cells, never to reassign saved practice dates. */
function calendarDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

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
  const [selected, setSelected] = useState(today);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const [records, setRecords] = useState<readonly StoredMeditationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadedCount, setLoadedCount] = useState(-1);
  const openingDetails = useRef(false);
  const reduced = useReducedMotion();
  const windowWidth = useWindowDimensions().width, vignetteWidth = Math.min(windowWidth, 540);
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
  const shown = !loading && current && !error;
  const practiceDates = useMemo(() => new Set(byDate.keys()), [byDate]);

  const selectedRecords = byDate.get(selected) ?? [];
  const activeSeconds = selectedRecords.reduce((total, record) => total + record.session.activeDurationSeconds, 0);

  function changeMonth(offset: number) {
    const destination = monthInstant(month, offset).toISOString().slice(0, 7);
    setDirection(offset > 0 ? 1 : -1);
    setMonth(destination);
    setSelected(destination === today.slice(0, 7) ? today : calendarDate(destination, 1));
  }

  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <View style={calendarStyles.heading}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="View progression details" onPress={onShowProgress}
        style={calendarStyles.details}>
        <Type role="secondary">Progress details</Type>
      </QuietPressable>
    </View>
    {/* Switching from the level view crossfades only the content; the title and tabs stay still. */}
    <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.navigation)} style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
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
        {(month !== today.slice(0, 7) || selected !== today) && <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.reveal)} exiting={reduced ? undefined : FadeOut.duration(UI_MOTION.reveal)}>
          <QuietPressable accessibilityRole="button" accessibilityLabel="Return to today in the practice calendar"
            onPress={() => {
              const date = currentContext().localDate;
              setDirection(date.slice(0, 7) === month ? 0 : date.slice(0, 7) > month ? 1 : -1);
              setToday(date); setMonth(date.slice(0, 7)); setSelected(date);
            }} style={calendarStyles.todayAction}>
            <Type role="secondary" style={{ fontSize: 13 }}>Today</Type>
          </QuietPressable>
        </Animated.View>}
      </View>
      <MonthSlide key={month} direction={direction}>
        <PaintedMonth month={month} streaks={streaks} practiced={practiceDates} today={today} selected={selected}
          onSelect={setSelected} live={shown} />
      </MonthSlide>
      {/* The chosen day in one quiet line; its practice opens with a tap. */}
      {shown && <QuietPressable accessibilityRole={selectedRecords.length ? 'button' : 'text'} disabled={!selectedRecords.length}
        accessibilityHint={selectedRecords.length ? 'Opens this practice' : undefined} onPress={() => {
          if (openingDetails.current || !selectedRecords.length) return;
          openingDetails.current = true;
          if (selectedRecords.length === 1) router.push({ pathname: '/practice-detail', params: { id: selectedRecords[0]!.session.id } });
          else router.push('/history');
        }} style={calendarStyles.dayLine}>
        <Type role="secondary" style={calendarStyles.dayLineText}>
          {`${practiceDateLabel(selected, { weekday: 'long', month: 'long', day: 'numeric' })} · ${selectedRecords.length
            ? `${formatDuration(activeSeconds)}${selectedRecords.length > 1 ? ` · ${selectedRecords.length} practices` : ''}  ›` : 'no practice'}`}
        </Type>
      </QuietPressable>}
      {loading || !current ? <Type role="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
        {error ? 'Saved practice is unavailable.' : 'Opening your saved practice…'}
      </Type> : null}
      <Notice>{error ? 'Your practice could not be loaded. Your saved records are unchanged.' : null}</Notice>
      {error && <Action quiet onPress={() => setAttempt((value) => value + 1)}>Try again</Action>}
      {/* The owner's painting rests under the month: its misty sky reaches up into the calendar. */}
      <Image source={CALENDAR_VIGNETTE} accessible={false} style={{ width: vignetteWidth, height: vignetteWidth / VIGNETTE_RATIO,
        marginTop: -vignetteWidth / VIGNETTE_RATIO * 0.2,
        ...(windowWidth <= 540 ? { marginLeft: windowWidth <= 375 ? -20 : -24 } : { alignSelf: 'center' }) }} />
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
    </Animated.View>
  </Screen><HomeNavigation active="journey" /></View>;
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
  // Above the painting's misty sky, which reaches up under it.
  dayLine: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4, zIndex: 2 },
  dayLineText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  monthSummary: { flexDirection: 'row', columnGap: 20, marginTop: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
