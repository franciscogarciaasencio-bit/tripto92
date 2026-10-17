import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useOna } from '@/application/ona-provider';
import { CoastalTexture, coastalArtwork, coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { COASTAL_ARTWORK } from './coastal-composition';
import { OceanWave } from './ocean-wave';
import { QuietPressable } from './quiet-pressable';
import { Type } from './primitives';
import { useReducedMotion } from './reduced-motion';
import { BreathGuide } from './breath-guide';
import { REFLECTION_MAX_LENGTH, useBeginningReflection } from '@/application/beginning-reflection';

/**
 * A short first guide (owner, 2026-10-16): what Ona is for, how to sit, counting breaths, a minute
 * to try it with a breathing guide, coming back, and (2026-10-17) noticing how today feels, to compare
 * at Level 100. Shown once on first launch, then from Guide.
 */
export const CHAPTERS = ['Welcome to Ona', 'Settle in', 'Count your breaths', 'Try it', 'Come back', 'Remember today'] as const;
const timing = { out: 100, in: 240 };
const LAST = CHAPTERS.length - 1;

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
  const app = useOna();
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  // Seen once is enough: the first-launch guide never opens by itself again (Guide replays it).
  const { explanationDismissed, dismissExplanation } = app;
  useEffect(() => { if (!explanationDismissed) void dismissExplanation(); }, [explanationDismissed, dismissExplanation]);
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
  // The optional words about today, kept on this phone and shown again at Level 100.
  const { reflection, save: saveReflection } = useBeginningReflection();
  const [written, setWritten] = useState<string | null>(null);
  const keepWords = () => { if (written !== null && written.trim() !== (reflection?.text ?? '')) void saveReflection(written); };
  const goHome = () => { keepWords(); closed.current = true; cancelAnimation(opacity); router.dismissTo('/'); };
  const meditate = () => { keepWords(); closed.current = true; cancelAnimation(opacity); router.dismissTo('/'); router.push('/prepare'); };
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
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Introduction progress" accessibilityValue={{ min: 1, max: CHAPTERS.length, now: chapter + 1, text: `${chapter + 1} of ${CHAPTERS.length}` }}
          aria-valuemin={1} aria-valuemax={CHAPTERS.length} aria-valuenow={chapter + 1} aria-valuetext={`${chapter + 1} of ${CHAPTERS.length}`} style={{ flexDirection: 'row', gap: 7 }}>
          {CHAPTERS.map((name, index) => <View key={name} style={{ width: 15, height: 2, borderRadius: 2, backgroundColor: index <= chapter ? coastalInk : '#D5C7B1' }} />)}
        </View>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={goHome} style={[styles.headerAction, { alignItems: 'flex-end' }]}>
          <Type role="secondary">Skip</Type>
        </QuietPressable>
      </View>
    </View>
    <ScrollView ref={scroll} style={{ flex: 1 }} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ minHeight: Math.max(0, available), paddingBottom: 24 }}>
      <Animated.View style={[content, { width: canvasWidth, alignSelf: 'center' }]}>
        <IntroductionScenery width={canvasWidth} welcome={chapter === 0} available={available} headingRef={headingRef} />
        <View style={{ paddingHorizontal: 28, paddingTop: chapter === 0 ? 6 : 20, alignItems: 'center' }}>
          {chapter === 0 ? <>
            <Text style={styles.eyebrow}>A FEW MINUTES, MOST DAYS</Text>
            <Text style={styles.copy}>Meditation is simple: sit, breathe, and come back when the mind wanders. Ona helps you return, day after day.</Text>
            <Text style={[styles.note, { marginTop: 18 }]}>A short guide, about two minutes.</Text>
          </> : chapter === 1 ? <>
            <Text style={styles.eyebrow}>BEFORE YOU BEGIN</Text>
            {heading('Find a quiet\nplace to sit.')}
            <View style={{ gap: 14, alignItems: 'center', marginTop: 24 }}>
              {['On a chair or a cushion,\nyour back upright but not stiff.', 'Shoulders soft, hands resting.', 'Close your eyes,\nor let your gaze rest low.', 'Take three slow breaths. Then let\nyour breathing find its own pace.']
                .map(line => <Text key={line} style={styles.practice}>{line}</Text>)}
            </View>
            <Text style={[styles.note, { marginTop: 24 }]}>Three minutes is a good beginning.</Text>
          </> : chapter === 2 ? <>
            <Text style={styles.eyebrow}>THE PRACTICE</Text>
            {heading('Count your\nbreaths.')}
            <View style={{ gap: 10, alignItems: 'center', marginTop: 24 }}>
              <Text style={styles.practice}>Breathe in, breathe out: <Text style={styles.counted}>one</Text>.</Text>
              <Text style={styles.practice}>In, out: <Text style={styles.counted}>two</Text>.</Text>
              <Text style={styles.practice}>Up to <Text style={styles.counted}>ten</Text>, then begin again at one.</Text>
            </View>
            <Text style={[styles.note, { marginTop: 14 }]}>Don’t change the breath. Only count it.</Text>
            <View style={styles.lost}>
              <Text style={[styles.copy, { fontFamily: coastalSerif, fontSize: 20, lineHeight: 28 }]}>Lost count?</Text>
              <Text style={[styles.copy, { marginTop: 6 }]}>Your mind wandered. That is normal, and noticing it is the practice. Gently begin again at one.</Text>
            </View>
          </> : chapter === 3 ? <>
            <Text style={styles.eyebrow}>TRY IT FOR A MINUTE</Text>
            {heading('Breathe with\nthe circle.')}
            <View style={{ marginTop: 26 }}><BreathGuide size={Math.round(176 * scale)} /></View>
            <Text style={[styles.note, { marginTop: 18 }]}>The circle only suggests a pace.{`\n`}Your own breath is always fine.</Text>
          </> : chapter === 4 ? <>
            <Text style={styles.eyebrow}>YOUR HABIT</Text>
            {heading('Come back,\na little at a time.')}
            <Text style={[styles.copy, { marginTop: 22 }]}>A practice of three minutes or more counts. Three days in a week make a consistent week.</Text>
            <Text style={[styles.copy, { marginTop: 14 }]}>Your calendar remembers every return. Levels and your forest grow with regular practice.</Text>
            <Text style={[styles.note, { marginTop: 18 }]}>Missed a day? Nothing is lost.{`\n`}Just come back.</Text>
          </> : <>
            <Text style={styles.eyebrow}>YOUR STARTING POINT</Text>
            {heading('Remember how\ntoday feels.')}
            <Text style={[styles.copy, { marginTop: 22 }]}>How do your days feel right now? Your mind, your mood, your sleep, how you react when things get busy. Take a moment to notice it.</Text>
            <Text style={[styles.copy, { marginTop: 14 }]}>If you like, write a few words. It is optional: you can also keep a mental note, or write it somewhere of your own. What matters is that you remember.</Text>
            <TextInput value={written ?? reflection?.text ?? ''} onChangeText={setWritten} onBlur={keepWords} multiline maxLength={REFLECTION_MAX_LENGTH}
              placeholder="These days, my mind feels…" placeholderTextColor="rgba(20,20,20,0.4)" accessibilityLabel="How today feels, optional"
              textAlignVertical="top" style={styles.reflection} />
            <Text style={[styles.note, { marginTop: 16 }]}>When you reach Level 100, Ona will show you this again.{`\n`}Keep coming back: we believe you will feel the difference.</Text>
          </>}
        </View>
      </Animated.View>
    </ScrollView>
    <View style={{ width: canvasWidth, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
      <QuietPressable accessibilityRole="button" accessibilityLabel={chapter === LAST ? 'Meditate now' : 'Next'} disabled={transitioning}
        pressedOpacity={.82} disabledOpacity={.8} onPress={() => chapter === LAST ? meditate() : change(chapter + 1)} style={styles.next}>
        <Text style={styles.nextLabel}>{chapter === LAST ? 'Meditate now' : 'Next'}</Text>
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
  counted: { fontFamily: coastalSerif, fontSize: 18 },
  lost: { marginTop: 26, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#BDB19C', alignItems: 'center', maxWidth: 320 },
  reflection: { marginTop: 20, alignSelf: 'stretch', minHeight: 112, maxHeight: 220, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,250,240,0.6)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#BDB19C', fontFamily: 'ManropeRegular', fontSize: 15, lineHeight: 22, color: coastalInk },
  next: { minHeight: 56, backgroundColor: '#1C211A', borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  nextLabel: { fontFamily: 'ManropeMedium', fontSize: 16, lineHeight: 24, color: '#F7F0E3' },
});
