import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { JOURNEY_LEVELS, HABIT_LEVELS } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { HomeNavigation } from './home-navigation';
import { LevelProgress } from './level-progress';
import { formatRipples } from './format-ripples';
import { Action, Screen, Type, serifFont as serif } from './primitives';
import { LevelPath } from './level-path';
import { HowItWorks } from './progress-explanation';
import { useReducedMotion } from './reduced-motion';
import { QuietPressable } from './quiet-pressable';
import { getLevelCategoryPresentation } from './category-presentation';

const HABIT_MILESTONE_LEVEL = 100;

/** A read-only presentation of the released journey; all requirements come from the domain. */
export function JourneyScreen({ onShowCalendar }: { onShowCalendar: () => void }) {
  const { journey, habit } = useOna();
  const list = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const offsets = useRef<Record<string, number>>({});
  const reduced = useReducedMotion();
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    if (!journey || positioned.current || !listHeight || !contentHeight) return;
    const offset = offsets.current[journey.level.number === 0 ? 'prelude' : journey.level.category.id];
    if (offset === undefined) return;
    list.current?.scrollTo({ y: Math.max(0, offset - 12), animated: !reduced });
    positioned.current = true;
  }, [journey, reduced, listHeight, contentHeight]);
  if (!journey) return <Screen />;
  const highest = habit?.highestLevel ?? journey.level.number;
  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <View style={journeyStyles.header}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="Return to practice calendar" onPress={onShowCalendar}
        style={journeyStyles.headerAction}>
        <Type role="secondary">Calendar</Type>
      </QuietPressable>
    </View>
    <View style={journeyStyles.current}>
      <CategoryIcon category={journey.level.category} level={journey.level.number} size={30} />
      <View style={{ flex: 1, gap: 2 }}>
        <Type role="heading" style={journeyStyles.display}>{`Level ${journey.level.number}`}</Type>
        <Type role="secondary">{journey.level.number === 0 ? `${getLevelCategoryPresentation(journey.level).name} · Starting point`
          : `${getLevelCategoryPresentation(journey.level).name} · ${journey.level.categoryStep} of 5`}</Type>
      </View>
      <QuietPressable accessibilityRole="button" accessibilityLabel="Go to journey overview" onPress={() => list.current?.scrollTo({ y: 0, animated: !reduced })}
        style={journeyStyles.headerAction}>
        <Type role="secondary">Overview</Type>
      </QuietPressable>
    </View>
    <ScrollView ref={list} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 32 }}
      onLayout={(event) => setListHeight(event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => setContentHeight(height)}>
      <View style={journeyStyles.overview}>
        <LevelProgress journey={journey} />
        <Type role="secondary">{`${formatRipples(journey.metrics.lifetimeXpCenti)} Ripples`}</Type>
        <Type role="secondary">{`Highest level ${highest}. Your current level follows your rhythm of practice. Half your highest level remains protected.`}</Type>
        {highest >= HABIT_MILESTONE_LEVEL && <Type>You’ve completed Ona’s habit-building journey. Keep practising to strengthen the habit you’ve built.</Type>}
        <HowItWorks />
        <Action quiet onPress={() => router.push('/history')}>Meditation history</Action>
      </View>
      <LevelPath levels={habit ? HABIT_LEVELS : JOURNEY_LEVELS} current={journey.level.number} highest={highest}
        onCategoryLayout={(id, y) => { offsets.current[id] = y; }} />
    </ScrollView>
  </Screen><HomeNavigation active="journey" /></View>;
}

const journeyStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, gap: 12 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  display: { fontFamily: serif, fontSize: 27, lineHeight: 34, letterSpacing: 0 },
  overview: { gap: 18, paddingTop: 4, paddingBottom: 20 },
});
