import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { JOURNEY_CATEGORIES, JOURNEY_LEVELS, journeyLabel } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { ConsistencyProgress, LevelProgress } from './level-progress';
import { colors, Header, Screen, Type } from './primitives';
import { HowItWorks } from './progress-explanation';
import { useReducedMotion } from './reduced-motion';

export function JourneyScreen() {
  const { journey, snapshot } = useOna();
  const list = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const offsets = useRef<Record<string, number>>({});
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState<string[]>(journey ? [journey.level.category.id] : []);
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    if (!journey || positioned.current || !listHeight || !contentHeight) return;
    const offset = offsets.current[journey.level.category.id];
    if (offset === undefined) return;
    list.current?.scrollTo({ y: Math.max(0, offset - 12), animated: !reduced });
    positioned.current = true;
  }, [journey, reduced, listHeight, contentHeight]);
  if (!journey || !snapshot) return <Screen />;
  return <Screen scroll={false} style={{ paddingBottom: 0 }}><Header title="Journey" back={() => router.dismissTo('/')} />
    <ScrollView ref={list} style={{ flex: 1, minHeight: 0, marginTop: 20 }} contentContainerStyle={{ paddingBottom: 40 }}
      onLayout={(event) => setListHeight(event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => setContentHeight(height)}>
      <View style={{ gap: 20, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><CategoryIcon category={journey.level.category} size={32} />
          <Type role="heading" style={{ flex: 1 }}>{journeyLabel(journey.level)}</Type></View>
        <LevelProgress journey={journey} /><ConsistencyProgress snapshot={snapshot} />
        <Type role="secondary">{`${(journey.metrics.lifetimeXpCenti / 100).toFixed(2)} lifetime XP · ${journey.metrics.credits} practice credits · ${journey.metrics.realDays} real practice dates`}</Type>
        <Type role="secondary">Lifetime practice stays with you.</Type>
        <HowItWorks />
        {journey.level.number >= 100 && <Type>You’ve completed Ona’s habit-building journey. Keep practising to strengthen the habit you’ve built.</Type>}
      </View>
      {JOURNEY_CATEGORIES.map((category) => {
        const open = expanded.includes(category.id);
        const state = category.id === journey.level.category.id ? 'Current' : category.lastLevel < journey.level.number ? 'Achieved' : 'Upcoming';
        return <View key={category.id} onLayout={(event) => { offsets.current[category.id] = event.nativeEvent.layout.y; }}
          style={{ borderTopWidth: 1, borderColor: colors.line, paddingVertical: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${category.name}, levels ${category.firstLevel} to ${category.lastLevel}, ${state}`}
            accessibilityState={{ expanded: open }} onPress={() => setExpanded((previous) => open ? previous.filter((id) => id !== category.id) : [...previous, category.id])}
            style={{ flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 68, paddingVertical: 8 }}>
            <CategoryIcon category={category} /><View style={{ flex: 1, gap: 4 }}><Type role="label">{category.name}</Type>
              <Type role="secondary">{`${category.firstLevel}–${category.lastLevel} · ${state} · ${open ? 'Hide' : 'View'}`}</Type></View>
          </Pressable>
          {open && JOURNEY_LEVELS.filter((level) => level.category.id === category.id).map((level) => <View key={level.number} style={{ paddingVertical: 12, paddingLeft: 44, gap: 4 }}>
            <Type role={level.number === journey.level.number ? 'label' : 'secondary'}>{`Level ${level.number} · ${level.categoryStep} of 5 · ${level.number === journey.level.number ? 'Current' : level.number < journey.level.number ? 'Achieved' : 'Upcoming'}`}</Type>
            <Type role="secondary">{`${(level.xpCenti / 100).toFixed(2)} XP · ${level.credits} credits · ${level.realDays} real dates`}</Type>
            {level.elapsedDays > 0 && <Type role="secondary">365 elapsed days minimum</Type>}
            {level.number === 100 && <Type role="secondary">Habit-building journey complete</Type>}
          </View>)}
        </View>;
      })}
    </ScrollView>
  </Screen>;
}
