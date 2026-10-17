import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useOna } from '@/application/ona-provider';
import { useBeginningReflection } from '@/application/beginning-reflection';
import { habitStageIndex, JOURNEY_CATEGORIES } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { PaperBackdrop } from './coastal-scene';
import { HomeNavigation } from './home-navigation';
import { formatRipples } from './format-ripples';
import { colors, Screen, Type, serifFont as serif } from './primitives';
import { HowItWorks } from './progress-explanation';
import { QuietPressable } from './quiet-pressable';
import { getLevelCategoryPresentation } from './category-presentation';
import { useMotionPreference, useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';
import { reachedStages, stageGuides, stageLevels, stageOf } from './milestones';

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

/** The category of a stage (1–25). */
function stageCategory(stage: number) {
  return JOURNEY_CATEGORIES[habitStageIndex(stageLevels(stage).first)]!;
}

/**
 * The stage you are in, with every stage reached before it a swipe to the left (owner, 2026-10-17:
 * "I still want to see [the first stage]… and the tips associated to each"). Each page shows the stage's
 * symbol and the guide that opened it. Stages ahead stay undiscovered; nothing measures the distance to Level 100.
 */
export function JourneyScreen({ onShowCalendar }: { onShowCalendar: () => void }) {
  const { journey, habit } = useOna(), reduced = useReducedMotion();
  const { reflection } = useBeginningReflection();
  const words = useEntrance(380, 700);
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: 8 * (1 - words.value) }] }));
  const pager = useRef<ScrollView>(null);
  // Pages run edge to edge (Screen's gutter is 20 on narrow phones, else 24), so a swipe never clips at the margin.
  const gutter = useWindowDimensions().width <= 375 ? 20 : 24;
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState<number | null>(null);
  const [positioned, setPositioned] = useState(false);
  if (!journey) return <Screen />;
  const level = journey.level.number;
  const highest = Math.max(habit?.highestLevel ?? level, level);
  const stages = reachedStages(highest);
  const currentStage = stageOf(level);
  const shown = page ?? currentStage - 1, shownStage = stages[shown] ?? currentStage;
  const presentation = getLevelCategoryPresentation(journey.level);
  const toward = journey.next ? `Toward Level ${journey.next.number}` : 'Your practice continues';
  const goTo = (index: number, animated = true) => { pager.current?.scrollTo({ x: index * width, animated: animated && !reduced }); setPage(index); };
  const settle = (x: number) => { if (width > 0) { const index = Math.max(0, Math.min(stages.length - 1, Math.round(x / width))); if (index !== shown) setPage(index); } };
  const guides = stageGuides(shownStage, highest);
  return <PaperBackdrop><Screen scroll={false} style={{ paddingBottom: 0, backgroundColor: 'transparent' }}>
    <View style={styles.header}>
      <Type role="title">Journey</Type>
      <QuietPressable accessibilityRole="button" accessibilityLabel="Return to practice calendar" onPress={onShowCalendar} style={styles.headerAction}>
        <Type role="secondary">Calendar</Type>
      </QuietPressable>
    </View>
    <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.navigation)} style={{ flex: 1, minHeight: 0 }}>
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={styles.content}>
      <View style={[styles.pagerFrame, { marginHorizontal: -gutter }]} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
        {width > 0 && <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
          style={{ opacity: positioned || stages.length === 1 ? 1 : 0 }}
          contentOffset={{ x: (currentStage - 1) * width, y: 0 }}
          onContentSizeChange={() => {
            // Open on the stage you are in; earlier stages wait to the left.
            if (positioned) return;
            pager.current?.scrollTo({ x: (currentStage - 1) * width, animated: false });
            setPositioned(true);
          }}
          onScroll={(event) => settle(event.nativeEvent.contentOffset.x)}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}>
          {stages.map((stage) => {
            const current = stage === currentStage;
            const range = stageLevels(stage);
            const category = stageCategory(stage);
            const symbolLevel = current ? level : Math.min(range.last, range.first + 4);
            const name = current ? presentation : getLevelCategoryPresentation({ category, number: Math.max(1, symbolLevel) });
            return <View key={stage} style={{ width }} accessible accessibilityRole={current ? 'progressbar' : undefined}
              accessibilityLabel={current ? `Level ${level}, ${presentation.name}. ${presentation.theme} ${toward}.`
                : `Stage reached earlier, Levels ${range.first} to ${range.last}: ${name.name}. ${name.theme}`}
              accessibilityValue={current ? { min: 0, max: 100, now: Math.floor(journey.fraction * 100) } : undefined}>
              <View style={[styles.hero, { paddingHorizontal: gutter }]}>
                <StageMedallion fraction={current ? journey.next ? journey.fraction : 1 : 1}>
                  <CategoryIcon category={category} level={symbolLevel} size={96} />
                </StageMedallion>
                <Animated.View style={[styles.words, wordsStyle]}>
                  <Type role="secondary" style={styles.kicker}>{current ? level === 0 ? 'STARTING POINT' : `LEVEL ${level}`
                    : `LEVELS ${range.first}–${range.last}`}</Type>
                  <Type role="heading" style={styles.name}>{name.name}</Type>
                  <Type role="secondary" style={styles.theme}>{name.theme}</Type>
                  <Type role="secondary" style={styles.toward}>{current ? toward : 'Completed'}</Type>
                </Animated.View>
              </View>
            </View>;
          })}
        </ScrollView>}
      </View>
      {stages.length > 1 && <View style={styles.dots}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 }}>
          {stages.map((stage, index) => <QuietPressable key={stage} accessibilityRole="button" accessibilityLabel={`Show stage ${stage}`}
            accessibilityState={{ selected: index === shown }} onPress={() => goTo(index)} style={styles.dotTarget}>
            <View style={[styles.dot, index === shown && styles.dotShown, stage === currentStage && index !== shown && styles.dotCurrent]} />
          </QuietPressable>)}
        </View>
        <Type role="secondary" style={styles.hint}>{shownStage === currentStage ? 'Swipe to revisit earlier stages' : 'Swipe back to where you are'}</Type>
      </View>}
      {guides.map((note) => <Animated.View key={note.title} style={[styles.guide, wordsStyle]}>
        <Type role="secondary" style={styles.guideKicker}>{shownStage === currentStage ? 'A GUIDE FOR THIS STAGE' : 'THE GUIDE FOR THIS STAGE'}</Type>
        <Type style={styles.guideTitle}>{note.title}</Type>
        {note.paragraphs.map((paragraph) => <Type key={paragraph.slice(0, 32)} style={styles.guideBody}>{paragraph}</Type>)}
      </Animated.View>)}
      {/* At the stage that begins at Level 100: how the mind usually felt at the beginning, to compare. */}
      {stageLevels(shownStage).first === 100 && reflection && <View style={styles.reflection}>
        <Type role="secondary" style={styles.guideKicker}>WHEN YOU BEGAN</Type>
        <Type style={styles.guideBody}>Before your practice began, you described your mind like this:</Type>
        <Type style={styles.quote}>{`“${reflection.text}”`}</Type>
      </View>}
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
  </Screen><HomeNavigation active="journey" /></PaperBackdrop>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, gap: 12 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  content: { paddingBottom: 40, alignItems: 'center' },
  pagerFrame: { alignSelf: 'stretch' },
  hero: { alignItems: 'center', paddingTop: 28, width: '100%' },
  dots: { alignItems: 'center', gap: 2, paddingTop: 18, paddingHorizontal: 12 },
  dotTarget: { width: 18, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(20,20,20,0.16)' },
  dotShown: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  dotCurrent: { backgroundColor: 'rgba(20,20,20,0.42)' },
  hint: { fontSize: 12, lineHeight: 18, letterSpacing: 0.3 },
  guide: { alignSelf: 'stretch', gap: 12, marginTop: 30, paddingTop: 26, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(20,20,20,0.16)' },
  guideKicker: { fontSize: 11, lineHeight: 16, letterSpacing: 2.2 },
  guideTitle: { fontFamily: serif, fontSize: 24, lineHeight: 31, color: colors.ink },
  guideBody: { fontSize: 15.5, lineHeight: 25 },
  reflection: { alignSelf: 'stretch', gap: 10, marginTop: 22, padding: 20, borderRadius: 18, backgroundColor: 'rgba(226,201,143,0.22)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(164,122,46,0.45)' },
  quote: { fontFamily: serif, fontSize: 19, lineHeight: 28, color: colors.ink },
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
