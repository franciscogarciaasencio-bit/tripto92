import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LINEAR_CONSISTENCY_V1 } from '@/domain/progression';
import { CoastalTexture, coastalArtwork, coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { COASTAL_ARTWORK } from './coastal-composition';
import { OceanWave } from './ocean-wave';
import { QuietPressable } from './quiet-pressable';
import { Type } from './primitives';
import { useReducedMotion } from './reduced-motion';
import { ConsistencyBar } from './consistency-bar';

const CHAPTERS = ['Welcome to Ona', 'How to meditate', 'Every moment matters', 'Your journey'] as const;
const timing = { out: 100, in: 240, illustration: 800 };
const EXAMPLE_DAYS = LINEAR_CONSISTENCY_V1.targetContributions;

/** A deliberately illustrative teaching aid: no domain calculations, awards or persistence. */
function ConsistencyIllustration() {
  const reduced = useReducedMotion(), [returns, setReturns] = useState(0);
  const consistency = useSharedValue(0);
  useEffect(() => {
    const config = { duration: reduced ? 0 : timing.illustration, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never };
    consistency.set(withTiming(returns / EXAMPLE_DAYS, config));
    return () => cancelAnimation(consistency);
  }, [returns, reduced, consistency]);
  return <View style={{ width: '100%', maxWidth: 286, alignSelf: 'center', marginVertical: 18 }}>
    <Type role="secondary">Consistency</Type>
    <View style={{ marginTop: 10 }}><ConsistencyBar fraction={returns / EXAMPLE_DAYS} progress={consistency} label="Illustrative Consistency" /></View>
    <QuietPressable accessibilityRole="button" accessibilityLabel={returns === EXAMPLE_DAYS ? 'Replay the Consistency illustration' : 'Illustrate the next Consistency milestone'}
      onPress={() => setReturns(value => value === EXAMPLE_DAYS ? 0 : Math.min(EXAMPLE_DAYS, value + 12))} style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center', marginTop: 8 }}>
      <Text style={styles.demoAction}>{returns === EXAMPLE_DAYS ? 'Begin again ↺' : 'A little further →'}</Text>
    </QuietPressable>
    <Text style={styles.demoCaption}>Each step illustrates a milestone over many practices.</Text>
  </View>;
}

function IntroductionScenery({ width, welcome, available, headingRef }: {
  width: number; welcome: boolean; available: number; headingRef: RefObject<View | null>;
}) {
  const scale = width / 390;
  const compact = !welcome && available < 600;
  const heroScale = welcome ? Math.min(scale, Math.max(250, available * .72) / 460) : scale;
  const heroHeight = welcome ? 460 * heroScale : (compact ? 112 : 184) * scale;
  const artWidth = 420 * heroScale, artHeight = artWidth * COASTAL_ARTWORK.height / COASTAL_ARTWORK.width;
  const artTop = (welcome ? -190 : -490) * heroScale;
  const halo = artTop + artHeight * COASTAL_ARTWORK.haloCenterY / COASTAL_ARTWORK.height;
  return <View pointerEvents="none" style={{ height: heroHeight }}>
    {!compact && <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width, height: welcome ? heroHeight - 80 * heroScale : 116 * scale, overflow: 'hidden' }}>
      <Image source={coastalArtwork} contentFit="contain" style={{ position: 'absolute', width: artWidth, height: artHeight, left: (width - artWidth) / 2, top: artTop }} />
    </View>}
    {welcome && <View ref={headingRef} accessible accessibilityRole="header" style={{ position: 'absolute', top: halo - 78 * heroScale, left: 18, right: 18, alignItems: 'center' }}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 74 * heroScale, lineHeight: 86 * heroScale, letterSpacing: -2 }}>Ona</Text>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: coastalSerif, color: coastalInk, textAlign: 'center', fontSize: 26 * heroScale, lineHeight: 32 * heroScale }}>Build your{`\n`}meditation habit.</Text>
    </View>}
    <View style={{ position: 'absolute', top: welcome ? 380 * heroScale : (compact ? 32 : 122) * scale, left: 0 }}>
      <OceanWave width={width} height={welcome ? 72 * heroScale : 60 * scale} />
    </View>
  </View>;
}

export function IntroductionScreen() {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const canvasWidth = Math.min(width, 480), scale = canvasWidth / 390;
  const reduced = useReducedMotion(), scroll = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const [chapter, setChapter] = useState(0), [transitioning, setTransitioning] = useState(false);
  const closed = useRef(false), changing = useRef(false);
  const generation = useRef(0), pending = useRef<number | null>(null);
  const opacity = useSharedValue(1);
  const footerHeight = Math.max(insets.bottom, 16) + 76;
  const available = height - insets.top - 60 - footerHeight;
  const content = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    ++generation.current; changing.current = false; closed.current = false;
    return () => { closed.current = true; cancelAnimation(opacity); };
  }, [opacity]);
  const goHome = () => { closed.current = true; cancelAnimation(opacity); router.dismissTo('/'); };
  const reveal = useCallback((next: number, token: number) => {
    if (closed.current || generation.current !== token || pending.current !== next) return;
    pending.current = null;
    scroll.current?.scrollTo({ y: 0, animated: false });
    setChapter(next);
    if (Platform.OS === 'web') AccessibilityInfo.announceForAccessibility(`${next + 1} of ${CHAPTERS.length}. ${CHAPTERS[next]}.`);
  }, []);
  useEffect(() => {
    const token = generation.current;
    if (pending.current !== null) {
      // A live Reduced Motion change settles the requested page, never strands an old fade.
      const next = pending.current, task = setTimeout(() => reveal(next, token), 0);
      return () => { clearTimeout(task); cancelAnimation(opacity); };
    }
    const finish = () => {
      if (closed.current || generation.current !== token) return;
      changing.current = false; setTransitioning(false);
      if (Platform.OS !== 'web') void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
        if (enabled && !closed.current && generation.current === token && headingRef.current)
          AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus');
      }).catch(() => {});
    };
    opacity.set(withTiming(1, { duration: reduced ? 0 : timing.in, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never },
      finished => { if (finished) scheduleOnRN(finish); }));
    return () => cancelAnimation(opacity);
  }, [chapter, reduced, opacity, reveal]);
  const change = useCallback((next: number) => {
    if (closed.current || changing.current) return;
    if (next < 0) {
      closed.current = true; cancelAnimation(opacity);
      if (router.canGoBack()) router.back(); else router.replace('/');
      return;
    }
    const token = ++generation.current;
    pending.current = next; changing.current = true; setTransitioning(true);
    if (reduced) { reveal(next, token); return; }
    opacity.set(withTiming(0, { duration: timing.out, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.Never },
      finished => { if (finished) scheduleOnRN(reveal, next, token); }));
  }, [reduced, opacity, reveal]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (chapter === 0) return false;
      change(chapter - 1); return true;
    });
    return () => listener.remove();
  }, [chapter, change]));
  const heading = (children: string) => <View ref={headingRef} accessible accessibilityRole="header">
    <Text style={[styles.heading, { fontSize: 36 * scale, lineHeight: 43 * scale }]}>{children}</Text>
  </View>;
  return <View style={styles.screen}>
    <CoastalTexture width={width} height={height} />
    <View style={{ width: canvasWidth, alignSelf: 'center', paddingTop: insets.top + 8, paddingHorizontal: 24 }}>
      <View style={styles.navigation}>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Back" disabled={transitioning} onPress={() => change(chapter - 1)} style={styles.headerAction}>
          <Type role="secondary">Back</Type>
        </QuietPressable>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Introduction progress" accessibilityValue={{ min: 1, max: 4, now: chapter + 1, text: `${chapter + 1} of 4` }}
          aria-valuemin={1} aria-valuemax={4} aria-valuenow={chapter + 1} aria-valuetext={`${chapter + 1} of 4`} style={{ flexDirection: 'row', gap: 7 }}>
          {CHAPTERS.map((name, index) => <View key={name} style={{ width: 15, height: 2, borderRadius: 2, backgroundColor: index <= chapter ? coastalInk : '#D5C7B1' }} />)}
        </View>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={goHome} style={[styles.headerAction, { alignItems: 'flex-end' }]}>
          <Type role="secondary">Skip</Type>
        </QuietPressable>
      </View>
    </View>
    <ScrollView ref={scroll} style={{ flex: 1 }} bounces={false} contentContainerStyle={{ minHeight: Math.max(0, available), paddingBottom: 24 }}>
      <Animated.View style={[content, { width: canvasWidth, alignSelf: 'center' }]}>
        <IntroductionScenery width={canvasWidth} welcome={chapter === 0} available={available} headingRef={headingRef} />
        <View style={{ paddingHorizontal: 28, paddingTop: chapter === 0 ? 6 : 20, alignItems: 'center' }}>
          {chapter === 0 ? <>
            <Text style={styles.eyebrow}>ONE QUIET RETURN AT A TIME</Text>
            <Text style={styles.copy}>Meditation is simple. A lasting habit grows by coming back, day by day.</Text>
            <Text style={[styles.note, { marginTop: 18 }]}>Your practice, part of everyday life.</Text>
          </> : chapter === 1 ? <>
            <Text style={styles.eyebrow}>THE PRACTICE</Text>
            {heading('Come back\nto your breath.')}
            <View style={{ gap: 12, alignItems: 'center', marginTop: 24 }}>
              {['Sit comfortably.', 'Feel your natural breath.', 'Notice when your mind wanders.', 'Return gently, without judgment.'].map(line => <Text key={line} style={styles.practice}>{line}</Text>)}
            </View>
            <Text style={[styles.note, { marginTop: 24 }]}>Thoughts are normal.{`\n`}You don’t need an empty mind or a perfect practice.</Text>
          </> : chapter === 2 ? <>
            <Text style={styles.eyebrow}>EVERY MOMENT MATTERS</Text>
            {heading('Every moment\nleaves a ripple.')}
            <Text style={[styles.copy, { marginTop: 16 }]}>Every completed meditation matters.{`\n`}Even a short practice can earn Ripples.</Text>
            <ConsistencyIllustration />
            <Text style={styles.note}>At least 3 active minutes build Consistency.{`\n`}Five milestones grow with regular practice.{`\n`}Time away gently softens your rhythm.</Text>
          </> : <>
            <Text style={styles.eyebrow}>YOUR JOURNEY</Text>
            {heading('A habit to\ncome home to.')}
            <Text style={[styles.level, { marginTop: 24 }]}>Level 100</Text>
            <Text style={styles.note}>Completing Ona’s designed{`\n`}habit-building journey.</Text>
            <Text style={[styles.copy, { marginTop: 18 }]}>Levels 101–125 invite you to{`\n`}sustain and deepen your habit.</Text>
            <Text style={[styles.note, { marginTop: 18 }]}>Regular practice, not meditation skill.</Text>
            <Text style={[styles.note, { marginTop: 18 }]}>After a long pause, your level can ease back.{`\n`}Part of your achievements stays protected.</Text>
          </>}
        </View>
      </Animated.View>
    </ScrollView>
    <View style={{ width: canvasWidth, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
      <QuietPressable accessibilityRole="button" accessibilityLabel={chapter === 3 ? 'Begin your practice' : 'Next'} disabled={transitioning}
        pressedOpacity={.82} disabledOpacity={.8} onPress={() => chapter === 3 ? goHome() : change(chapter + 1)} style={styles.next}>
        <Text style={styles.nextLabel}>{chapter === 3 ? 'Begin your practice' : 'Next'}</Text>
      </QuietPressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4EBDD' },
  navigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { minHeight: 44, width: 68, justifyContent: 'center' },
  eyebrow: { fontFamily: 'ManropeMedium', fontSize: 11, lineHeight: 18, letterSpacing: 2.1, color: coastalQuiet, textAlign: 'center', marginBottom: 12 },
  heading: { fontFamily: coastalSerif, color: coastalInk, textAlign: 'center', letterSpacing: -.6 },
  copy: { fontFamily: 'ManropeRegular', fontSize: 15, lineHeight: 24, color: coastalInk, textAlign: 'center', maxWidth: 340 },
  note: { fontFamily: 'ManropeRegular', fontSize: 13, lineHeight: 22, color: '#777264', textAlign: 'center', maxWidth: 320 },
  practice: { fontFamily: 'ManropeRegular', fontSize: 15, lineHeight: 24, textAlign: 'center', color: coastalInk },
  level: { fontFamily: coastalSerif, fontSize: 35, lineHeight: 44, color: coastalInk },
  demoAction: { fontFamily: 'ManropeMedium', fontSize: 12, lineHeight: 20, color: '#565D51' },
  demoCaption: { fontFamily: 'ManropeRegular', fontSize: 12, lineHeight: 18, color: '#777264', textAlign: 'center' },
  next: { minHeight: 56, backgroundColor: '#1C211A', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  nextLabel: { fontFamily: 'ManropeMedium', fontSize: 16, lineHeight: 24, color: '#F7F0E3' },
});
