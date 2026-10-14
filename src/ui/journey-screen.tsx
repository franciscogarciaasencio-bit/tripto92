import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { JOURNEY_CATEGORIES, JOURNEY_LEVELS, JOURNEY_PRELUDE, HABIT_LEVELS } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { HomeNavigation } from './home-navigation';
import { LevelProgress } from './level-progress';
import { formatRipples } from './format-ripples';
import { Action, colors, Screen, Type, serifFont as serif } from './primitives';
import { HowItWorks } from './progress-explanation';
import { useReducedMotion } from './reduced-motion';
import { QuietPressable } from './quiet-pressable';
import { getCategoryPresentation, getLevelCategoryPresentation } from './category-presentation';

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
      <View onLayout={(event) => { offsets.current.prelude = event.nativeEvent.layout.y; }} style={{ paddingTop: 12, paddingBottom: 12 }}>
        <View accessible accessibilityLabel={`Level ${JOURNEY_PRELUDE.number}, ${JOURNEY_PRELUDE.category.name}, prelude, ${journey.level.number === 0 ? 'Current' : 'Achieved'}`}
          style={[journeyStyles.level, journey.level.number === 0 && journeyStyles.currentLevel]}>
          <View style={journeyStyles.levelHeading}>
            <Type role={journey.level.number === 0 ? 'label' : 'body'} style={{ flex: 1 }}>{`Level ${JOURNEY_PRELUDE.number} · ${JOURNEY_PRELUDE.category.name}`}</Type>
            <Type role="secondary" style={{ fontSize: 12 }}>{journey.level.number === 0 ? 'Current' : 'Achieved'}</Type>
          </View>
          <Type role="secondary" style={journeyStyles.requirements}>Starting point · Each quiet return adds to your journey.</Type>
          <Type role="secondary" style={journeyStyles.requirements}>Build your first Ripples through regular practice.</Type>
        </View>
      </View>
      {JOURNEY_CATEGORIES.map((category) => {
        const state = journey.level.number >= category.firstLevel && journey.level.number <= category.lastLevel ? 'Current'
          : category.firstLevel <= highest ? 'Achieved' : 'Future';
        return <View key={category.id} onLayout={(event) => { offsets.current[category.id] = event.nativeEvent.layout.y; }}>
          {category.firstLevel === 1 && <View style={journeyStyles.phase}>
            <Type role="heading" style={journeyStyles.display}>Building your habit</Type>
            <Type role="secondary">Levels 1–100 · One return at a time.</Type>
          </View>}
          {category.firstLevel === HABIT_MILESTONE_LEVEL + 1 && <View style={journeyStyles.phase}>
            <Type role="heading" style={journeyStyles.display}>Strengthen & sustain</Type>
            <Type role="secondary">Levels 101–125 · Continue nurturing the habit you’ve built.</Type>
          </View>}
          <View style={journeyStyles.category}>
            <View style={journeyStyles.categoryHeading}>
              <CategoryIcon category={category} size={28} />
              <View style={{ flex: 1, gap: 4 }}>
                <Type role="heading" style={journeyStyles.categoryName}>{getCategoryPresentation(category).name}</Type>
                <Type role="secondary" style={{ fontSize: 12 }}>{getCategoryPresentation(category).theme}</Type>
                <Type role="secondary" style={{ fontSize: 12 }}>{`Levels ${category.firstLevel}–${category.lastLevel} · ${state}`}</Type>
              </View>
            </View>
            {(habit ? HABIT_LEVELS : JOURNEY_LEVELS).filter((level) => level.category.id === category.id).map((level) => {
              const levelState = level.number === journey.level.number ? 'Current' : level.number <= highest ? 'Achieved' : 'Future';
              const current = levelState === 'Current';
              return <View key={level.number} accessible accessibilityLabel={`Level ${level.number}, ${getLevelCategoryPresentation(level).name}, ${levelState}, ${formatRipples(level.xpCenti)} Ripples${level.number === HABIT_MILESTONE_LEVEL ? ', habit-building journey completion' : ''}`}
                style={[journeyStyles.level, current && journeyStyles.currentLevel]}>
                <View style={journeyStyles.levelHeading}>
                  <Type role={current ? 'label' : 'body'} style={{ flex: 1 }}>{level.number === HABIT_MILESTONE_LEVEL ? 'Level 100 · Habit Established' : `Level ${level.number}`}</Type>
                  <Type role="secondary" style={{ fontSize: 12, color: current ? colors.ink : colors.secondary }}>{levelState}</Type>
                </View>
                <Type role="secondary" style={journeyStyles.requirements}>{`${formatRipples(level.xpCenti)} Ripples · Regular practice`}</Type>
                {level.number === HABIT_MILESTONE_LEVEL && <Type role="secondary" style={journeyStyles.milestone}>Habit-building journey completion</Type>}
              </View>;
            })}
          </View>
        </View>;
      })}
    </ScrollView>
  </Screen><HomeNavigation active="journey" /></View>;
}

const journeyStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, gap: 12 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  display: { fontFamily: serif, fontSize: 27, lineHeight: 34, letterSpacing: 0 },
  overview: { gap: 18, paddingTop: 4, paddingBottom: 20 },
  phase: { gap: 6, paddingTop: 28, paddingBottom: 24 },
  category: { borderTopWidth: 1, borderColor: colors.line, paddingBottom: 20 },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 22 },
  categoryName: { fontFamily: serif, fontSize: 23, lineHeight: 30, letterSpacing: 0 },
  level: { marginLeft: 44, paddingLeft: 12, paddingVertical: 14, gap: 5, borderLeftWidth: 1, borderLeftColor: colors.line },
  currentLevel: { borderLeftWidth: 2, borderLeftColor: colors.ink },
  levelHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  requirements: { fontSize: 12, lineHeight: 19 },
  milestone: { fontSize: 13, paddingTop: 6, color: colors.ink },
});
