import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { currentContext, useOna } from '@/application/ona-provider';
import type { StoredMeditationSession } from '@/data';
import { practiceStreaks, STREAK_RULES } from '@/domain/progression';
import { MonthSlide, MonthStreakLine, SelectionDisc, StreakLegend, StreakOverview, streakRuns, WeekRow } from './calendar-streaks';
import { HomeNavigation } from './home-navigation';
import { Action, colors, formatDuration, Notice, Screen, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { PracticeRow } from './practice-row';
import { UI_MOTION } from './motion';
import { useReducedMotion } from './reduced-motion';
import { groupPracticeHistory, monthPracticeSummary, practiceDateLabel, practiceTimeLabel } from './practice-history';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HISTORY_PAGE_SIZE = 50;

/** UTC is only used to lay out Gregorian calendar cells, never to reassign saved practice dates. */
function calendarDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Calendar arithmetic on UTC midnights; only lays out cells. */
function shiftDate(start: Date, days: number) {
  return new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10);
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
  const [gridWidth, setGridWidth] = useState(0);
  const [records, setRecords] = useState<readonly StoredMeditationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadedCount, setLoadedCount] = useState(-1);
  const openingDetails = useRef(false);
  const reduced = useReducedMotion();
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

  const first = monthInstant(month);
  const dayOffset = (first.getUTCDay() + 6) % 7;
  const nextMonth = monthInstant(month, 1);
  nextMonth.setUTCDate(0);
  const dayCount = nextMonth.getUTCDate();
  const cellCount = Math.ceil((dayOffset + dayCount) / 7) * 7;
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
        <Type role="heading" accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {practiceDateLabel(`${month}-01`, { month: 'long', year: 'numeric' })}
        </Type>
        {(month !== today.slice(0, 7) || selected !== today) && <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.reveal)} exiting={reduced ? undefined : FadeOut.duration(UI_MOTION.reveal)}>
          <QuietPressable accessibilityRole="button" accessibilityLabel="Return to today in the practice calendar"
            onPress={() => {
              const date = currentContext().localDate;
              setDirection(date.slice(0, 7) === month ? 0 : date.slice(0, 7) > month ? 1 : -1);
              setToday(date); setMonth(date.slice(0, 7)); setSelected(date);
            }} style={calendarStyles.todayAction}>
            <Type role="secondary">Today</Type>
          </QuietPressable>
        </Animated.View>}
        <QuietPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)}
          disabled={month === '0001-01'} style={calendarStyles.monthArrow}>
          <Chevron direction={-1} />
        </QuietPressable>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)}
          disabled={month === '9999-12'} style={[calendarStyles.monthArrow, { marginRight: -12 }]}>
          <Chevron direction={1} />
        </QuietPressable>
      </View>
      <View style={calendarStyles.weekdays}>
        {WEEKDAYS.map((day) => <View key={day} style={calendarStyles.weekday}><Type role="secondary" style={calendarStyles.weekdayText}>{day}</Type></View>)}
      </View>
      <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
      <MonthSlide key={month} direction={direction}>
      {Array.from({ length: cellCount / 7 }, (_, row) => {
        const dates = Array.from({ length: 7 }, (_, column) => shiftDate(first, row * 7 + column - dayOffset));
        const week = streaks.week(dates[0]!);
        const runs = shown ? streakRuns(dates.map((date) => streaks.isActiveDay(date))) : [];
        return <WeekRow key={`${month}:${dates[0]}`} row={row} state={shown ? week.state : 'future'} runs={runs} cell={gridWidth / 7}>
          {dates.map((date, column) => {
            const inMonth = date.startsWith(`${month}-`);
            const count = byDate.get(date)?.length ?? 0;
            const counts = shown && streaks.isActiveDay(date);
            const chosen = date === selected && inMonth;
            const label = `${practiceDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} ${count === 1 ? 'practice' : 'practices'}`
              + `${counts ? ', counts toward streaks' : ''}${column === 0 && shown && week.state === 'active' ? ', active week' : ''}${date === today ? ', today' : ''}`;
            const content = <>
              <View style={calendarStyles.dayTrack}>
                {chosen && <SelectionDisc key={selected} />}
                <View style={[calendarStyles.day, !chosen && date === today && calendarStyles.today]}>
                  <Type style={{ fontSize: 15, color: chosen ? colors.background : inMonth ? colors.ink : 'rgba(20,20,20,0.35)' }}>{Number(date.slice(8))}</Type>
                </View>
              </View>
              <View style={[calendarStyles.dot, { opacity: count && !counts ? 1 : 0 }]} />
            </>;
            return inMonth ? <QuietPressable key={date} accessibilityRole="button" accessibilityState={{ selected: chosen }}
              accessibilityLabel={label} onPress={() => setSelected(date)} style={calendarStyles.cell}>{content}</QuietPressable>
              : <View key={date} style={calendarStyles.cell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{content}</View>;
          })}
        </WeekRow>;
      })}
      </MonthSlide>
      </View>
      {shown && <MonthStreakLine status={streaks.month(month)} />}
      {shown && <StreakLegend minutes={STREAK_RULES.minimumActiveSeconds / 60} days={STREAK_RULES.activeDaysPerWeek}
        sharedWeeks={Array.from({ length: cellCount / 7 }, (_, row) => streaks.week(shiftDate(first, row * 7 - dayOffset)).month).some((owner) => owner !== month)} />}
      {loading || !current ? <Type role="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
        {error ? 'Saved practice is unavailable.' : 'Opening your saved practice…'}
      </Type> : !error && <View style={calendarStyles.monthSummary}>
        <View accessible accessibilityLabel={`${summary.practiceDays} practice days`} style={{ flex: 1, gap: 4 }}>
          <Type role="heading" accessibilityRole="text">{summary.practiceDays}</Type><Type role="secondary">Practice days</Type>
        </View>
        <View accessible accessibilityLabel={`${practiceTimeLabel(summary.activeSeconds)} of time for yourself`} style={{ flex: 1, gap: 4 }}>
          <Type role="heading" accessibilityRole="text">{practiceTimeLabel(summary.activeSeconds)}</Type><Type role="secondary">Time for yourself</Type>
        </View>
        <Type role="secondary" style={{ width: '100%', fontSize: 12, marginTop: 8 }}>
          {`${summary.practices} ${summary.practices === 1 ? 'practice' : 'practices'} this month · Short practices included`}
        </Type>
      </View>}
      <Notice>{error ? 'Your practice could not be loaded. Your saved records are unchanged.' : null}</Notice>
      {error && <Action quiet onPress={() => setAttempt((value) => value + 1)}>Try again</Action>}
      <View style={calendarStyles.dayDetails}>
        <Type role="heading">{practiceDateLabel(selected, { month: 'long', day: 'numeric' })}</Type>
        {!loading && current && !error && (selectedRecords.length ? <Type role="secondary">
          {`${selectedRecords.length} ${selectedRecords.length === 1 ? 'practice' : 'practices'} · ${formatDuration(activeSeconds)}`}
        </Type> : <Type role="secondary">No recorded practice on this date.</Type>)}
        {!loading && current && !error && <View>
          {selectedRecords.map(({ session }) => <PracticeRow key={session.id} session={session} onPress={() => {
            if (openingDetails.current) return;
            openingDetails.current = true;
            router.push({ pathname: '/practice-detail', params: { id: session.id } });
          }} />)}
        </View>}
      </View>
      <Action quiet onPress={() => router.push('/history')}>Meditation history</Action>
    </ScrollView>
    </Animated.View>
  </Screen><HomeNavigation active="journey" /></View>;
}

const calendarStyles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 12 },
  details: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  monthHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4 },
  monthArrow: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  todayAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  weekdays: { flexDirection: 'row' },
  weekday: { width: '14.285714%', alignItems: 'center', paddingVertical: 12 },
  weekdayText: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  // Fixed vertical rhythm: the day track always starts 7 pt down, where streak capsules are drawn.
  cell: { width: '14.285714%', minHeight: 52, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, gap: 5 },
  dayTrack: { alignSelf: 'stretch', height: 34, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  today: { borderWidth: 1, borderColor: colors.line },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  monthSummary: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderColor: colors.line },
  dayDetails: { borderTopWidth: 1, borderColor: colors.line, marginTop: 28, paddingTop: 24, gap: 10 },
  record: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 14, gap: 4 },
});
