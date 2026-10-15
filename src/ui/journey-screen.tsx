import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useOna } from '@/application/ona-provider';
import { CategoryIcon } from './category-icon';
import { HomeNavigation } from './home-navigation';
import { formatRipples } from './format-ripples';
import { colors, Screen, Type, serifFont as serif } from './primitives';
import { HowItWorks } from './progress-explanation';
import { QuietPressable } from './quiet-pressable';
import { getLevelCategoryPresentation } from './category-presentation';
import { useMotionPreference, useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 176, STROKE = 2, RADIUS = (RING - STROKE * 4) / 2, CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ease = Easing.bezier(0.22, 0.61, 0.36, 1);

/** 0 → 1 once after `delay`; instant with Reduced Motion (or before the preference is known). */
function useEntrance(delay: number, duration: number) {
  const still = useMotionPreference() !== false;
  const value = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { value.set(1); return; }
    value.set(withDelay(delay, withTiming(1, { duration, easing: ease, reduceMotion: ReduceMotion.Never })));
    return () => cancelAnimation(value);
  }, [still, delay, duration, value]);
  return value;
}

/** The current stage's symbol inside a soft halo; a thin ring fills toward the next level. */
function StageMedallion({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  const halo = useEntrance(0, 900), ring = useEntrance(250, 1100), symbol = useEntrance(120, 800);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value, transform: [{ scale: 0.9 + 0.1 * halo.value }] }));
  const symbolStyle = useAnimatedStyle(() => ({ opacity: symbol.value, transform: [{ scale: 0.86 + 0.14 * symbol.value }] }));
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)) * ring.value) }));
  return <View style={styles.medallion}>
    <Animated.View pointerEvents="none" style={[styles.haloOuter, haloStyle]} />
    <Animated.View pointerEvents="none" style={[styles.haloInner, haloStyle]} />
    <Svg width={RING} height={RING} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke="rgba(20,20,20,0.12)" strokeWidth={STROKE} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={colors.ink} strokeWidth={STROKE} fill="none"
        strokeLinecap="round" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} animatedProps={arc} />
    </Svg>
    <Animated.View style={symbolStyle}>{children}</Animated.View>
  </View>;
}

/**
 * Only the stage you are in: its symbol at the centre and progress toward the next level.
 * Stages ahead stay undiscovered; nothing measures the distance to Level 100.
 */
export function JourneyScreen({ onShowCalendar }: { onShowCalendar: () => void }) {
  const { journey, habit } = useOna(), reduced = useReducedMotion();
  const words = useEntrance(380, 700);
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: 8 * (1 - words.value) }] }));
  if (!journey) return <Screen />;
  const highest = habit?.highestLevel ?? journey.level.number;
  const level = journey.level.number;
  const presentation = getLevelCategoryPresentation(journey.level);
  const toward = journey.next ? `Toward Level ${journey.next.number}` : 'Your practice continues';
  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <View style={styles.header}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="Return to practice calendar" onPress={onShowCalendar} style={styles.headerAction}>
        <Type role="secondary">Calendar</Type>
      </QuietPressable>
    </View>
    <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.navigation)} style={{ flex: 1, minHeight: 0 }}>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content}>
      <View accessible accessibilityRole="progressbar"
        accessibilityLabel={`Level ${level}, ${presentation.name}. ${presentation.theme} ${toward}.`}
        accessibilityValue={{ min: 0, max: 100, now: Math.floor(journey.fraction * 100) }}
        style={styles.hero}>
        <StageMedallion fraction={journey.next ? journey.fraction : 1}>
          <CategoryIcon category={journey.level.category} level={level} size={96} />
        </StageMedallion>
        <Animated.View style={[styles.words, wordsStyle]}>
          <Type role="secondary" style={styles.kicker}>{level === 0 ? 'STARTING POINT' : `LEVEL ${level}`}</Type>
          <Type role="heading" style={styles.name}>{presentation.name}</Type>
          <Type role="secondary" style={styles.theme}>{presentation.theme}</Type>
          <Type role="secondary" style={styles.toward}>{toward}</Type>
        </Animated.View>
      </View>
      <Animated.View style={[styles.meaning, wordsStyle]}>
        <View style={styles.rule} />
        <Type style={styles.purpose}>Ona helps meditation become a lasting part of your life. Level 100 completes the habit.</Type>
        <Type role="secondary" style={styles.facts}>{`${formatRipples(journey.metrics.lifetimeXpCenti)} Ripples${highest > level ? ` · Highest level ${highest}` : ''}`}</Type>
      </Animated.View>
      <View style={styles.links}>
        <HowItWorks />
        <QuietPressable accessibilityRole="button" onPress={() => router.push('/history')} style={styles.link}>
          <Type role="secondary">Meditation history</Type>
        </QuietPressable>
      </View>
    </ScrollView>
    </Animated.View>
  </Screen><HomeNavigation active="journey" /></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, gap: 12 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  content: { paddingBottom: 40, alignItems: 'center' },
  hero: { alignItems: 'center', paddingTop: 28, width: '100%' },
  medallion: { width: 260, height: 240, alignItems: 'center', justifyContent: 'center' },
  haloOuter: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(232,214,184,0.28)' },
  haloInner: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(232,214,184,0.45)' },
  words: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  kicker: { fontSize: 12, lineHeight: 18, letterSpacing: 2.6, marginTop: 4 },
  name: { fontFamily: serif, fontSize: 34, lineHeight: 42, letterSpacing: 0, textAlign: 'center' },
  theme: { textAlign: 'center' },
  toward: { fontSize: 13, marginTop: 10, letterSpacing: 0.3 },
  meaning: { alignItems: 'center', gap: 14, paddingTop: 36, paddingHorizontal: 20, maxWidth: 340 },
  rule: { width: 28, height: 1, backgroundColor: colors.border, marginBottom: 6 },
  purpose: { fontFamily: serif, fontSize: 19, lineHeight: 28, textAlign: 'center' },
  facts: { fontSize: 13, textAlign: 'center' },
  links: { alignItems: 'center', gap: 4, paddingTop: 36, width: '100%' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
});
