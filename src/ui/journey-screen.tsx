import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { CategoryIcon } from './category-icon';
import { HomeNavigation } from './home-navigation';
import { LevelProgress } from './level-progress';
import { formatRipples } from './format-ripples';
import { Action, colors, Screen, Type, serifFont as serif } from './primitives';
import { HowItWorks } from './progress-explanation';
import { QuietPressable } from './quiet-pressable';
import { getLevelCategoryPresentation } from './category-presentation';

const HABIT_MILESTONE_LEVEL = 100;

/**
 * Only the level you are on. Levels ahead stay undiscovered until you reach them; this screen
 * explains what the journey is for instead of listing what comes next.
 */
export function JourneyScreen({ onShowCalendar }: { onShowCalendar: () => void }) {
  const { journey, habit } = useOna();
  if (!journey) return <Screen />;
  const highest = habit?.highestLevel ?? journey.level.number;
  const level = journey.level.number;
  const presentation = getLevelCategoryPresentation(journey.level);
  const towardHabit = Math.min(1, highest / HABIT_MILESTONE_LEVEL);
  const complete = highest >= HABIT_MILESTONE_LEVEL;
  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <View style={styles.header}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="Return to practice calendar" onPress={onShowCalendar} style={styles.headerAction}>
        <Type role="secondary">Calendar</Type>
      </QuietPressable>
    </View>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View accessible accessibilityLabel={`Level ${level}, ${presentation.name}${level === 0 ? ', starting point' : `, ${journey.level.categoryStep} of 5`}. ${presentation.theme}`}
        style={styles.current}>
        <View style={styles.iconWell}><CategoryIcon category={journey.level.category} level={level} size={40} /></View>
        <Type role="secondary" style={styles.kicker}>{level === 0 ? 'Starting point' : `Level ${level}`}</Type>
        <Type role="heading" style={styles.name}>{presentation.name}</Type>
        <Type role="secondary" style={{ textAlign: 'center' }}>{presentation.theme}</Type>
        {level > 0 && <Type role="secondary" style={styles.step}>{`${journey.level.categoryStep} of 5`}</Type>}
      </View>
      <View style={styles.section}>
        <LevelProgress journey={journey} />
        <Type role="secondary">{`${formatRipples(journey.metrics.lifetimeXpCenti)} Ripples · Highest level ${highest}`}</Type>
        <Type role="secondary">Your current level follows your rhythm of practice. Half your highest level always remains protected.</Type>
      </View>
      <View style={styles.section}>
        <Type role="heading" style={styles.sectionTitle}>{complete ? 'Your habit is built' : 'Toward Level 100'}</Type>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Habit-building journey"
          accessibilityValue={{ min: 0, max: 100, now: Math.min(100, highest) }} style={styles.track}>
          <View style={[styles.trackFill, { width: `${towardHabit * 100}%` }]} />
        </View>
        <Type role="secondary">{complete ? 'Level 100 reached. Ona’s habit-building journey is complete.' : `Level ${highest} of 100`}</Type>
        <Type>Ona exists for one purpose: to help meditation become a lasting part of your life.</Type>
        <Type>Level 100 marks the end of the habit-building journey. Reaching it takes many months of returning to your practice. By then, meditation is a habit you have built yourself.</Type>
        <Type role="secondary">Levels beyond 100 help you strengthen and sustain the habit. Each new stage is revealed only when you reach it.</Type>
        <Type role="secondary">These milestones mark your returning. They do not measure meditation ability.</Type>
      </View>
      <View style={[styles.section, { gap: 8 }]}>
        <HowItWorks />
        <Action quiet onPress={() => router.push('/history')}>Meditation history</Action>
      </View>
    </ScrollView>
  </Screen><HomeNavigation active="journey" /></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, gap: 12 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  current: { alignItems: 'center', gap: 6, paddingTop: 28, paddingBottom: 32 },
  iconWell: { width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  kicker: { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  name: { fontFamily: serif, fontSize: 32, lineHeight: 40, letterSpacing: 0, textAlign: 'center' },
  step: { fontSize: 12, marginTop: 4 },
  section: { gap: 14, paddingVertical: 24, borderTopWidth: 1, borderColor: colors.line },
  sectionTitle: { fontFamily: serif, fontSize: 24, lineHeight: 30, letterSpacing: 0 },
  track: { height: 2, backgroundColor: colors.line, marginTop: 4 },
  trackFill: { height: 2, backgroundColor: colors.ink },
});
