import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { HABIT_LEVELS, JOURNEY_PRELUDE, type JourneyLevel } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { getLevelCategoryPresentation } from './category-presentation';
import { PaperBackdrop, coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { ROUND_COLORS } from './consistency-rounds';
import type { Milestone } from './milestones';
import { QuietPressable } from './quiet-pressable';
import { useMotionPreference } from './reduced-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** One unhurried timeline, so every part stays in step and a tap can settle it at once. */
export const MILESTONE_MOTION = { total: 6200 } as const;
// Moments on the 0–1 timeline (fractions of the total).
const T = {
  arrive: [0, 0.09], leave: [0.16, 0.3], drop: [0.15, 0.62], bloom: [0.27, 0.42], ring: [0.32, 0.6],
  motes: [0.3, 0.8], kicker: [0.42, 0.52], name: [0.46, 0.62], theme: [0.56, 0.66], note: [0.66, 0.8], action: [0.82, 0.9],
} as const;
const RING = 196, STROKE = 2, RADIUS = (RING - STROKE * 4) / 2, CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GOLD = ROUND_COLORS[4];

/** 0 → 1 across [start, end] of the timeline, eased out; clamped outside. */
function phase(t: number, [start, end]: readonly [number, number]) {
  'worklet';
  const x = Math.max(0, Math.min(1, (t - start) / (end - start)));
  return 1 - (1 - x) ** 3;
}
/** A soft overshoot (out-back) for the new stage's arrival. */
function bloom(t: number, [start, end]: readonly [number, number]) {
  'worklet';
  const x = Math.max(0, Math.min(1, (t - start) / (end - start))), c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}
const levelAt = (number: number): JourneyLevel => number === 0 ? JOURNEY_PRELUDE : HABIT_LEVELS[number - 1]!;

/** A ring spreading from the centre, like a drop on still water. */
function Ripple({ t, delay, size, color }: { t: SharedValue<number>; delay: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const x = Math.max(0, Math.min(1, (t.value - T.drop[0] - delay) / (T.drop[1] - T.drop[0])));
    return { opacity: x > 0 && x < 1 ? 0.5 * (1 - x) ** 1.4 : 0, transform: [{ scale: 0.55 + 1.75 * (1 - (1 - x) ** 2) }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2,
    borderWidth: 1.2, borderColor: color }, style]} />;
}

/** Small specks of light rising around the medallion as the new stage arrives. */
function Mote({ t, index }: { t: SharedValue<number>; index: number }) {
  // Fixed pseudo-random placement: the same on every render and platform.
  const seed = Math.sin(index * 12.9898) * 43758.5453, r = seed - Math.floor(seed);
  const angle = (index / 12) * Math.PI * 2 + r, distance = 70 + 40 * r, start = T.motes[0] + 0.03 * (index % 4);
  const style = useAnimatedStyle(() => {
    const x = Math.max(0, Math.min(1, (t.value - start) / (T.motes[1] - start)));
    return { opacity: x > 0 && x < 1 ? 0.75 * Math.sin(Math.PI * x) : 0,
      transform: [{ translateX: Math.cos(angle) * distance * (0.6 + 0.4 * x) }, { translateY: Math.sin(angle) * distance * 0.7 - 70 * x }, { scale: 0.6 + 0.6 * Math.sin(Math.PI * x) }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E2C98F' }, style]} />;
}

/**
 * The moment a practice reaches a milestone (owner, 2026-10-17: "really, really rewarding and really
 * smoothly animated"). A new stage: the stage left behind settles and fades as a drop spreads rings over
 * still water, the new stage blooms in its halo while a ring draws around it and specks of light rise;
 * then its level, name and theme, and a note for this part of the way. Level 100 and 125 hold the current
 * stage in a golden ring. Tap to settle at once; Reduced Motion shows the final moment.
 */
export function MilestoneMoment({ milestone, busy, onContinue }: { milestone: Milestone; busy: boolean; onContinue: () => void }) {
  const motion = useMotionPreference(), still = motion !== false;
  const { width, height } = useWindowDimensions();
  const scale = Math.min(1.15, Math.max(0.82, Math.min(width / 390, height / 820)));
  const t = useSharedValue(still ? 1 : 0);
  const [finished, setSettled] = useState(false);
  // With Reduced Motion (or before the preference is known) the final moment shows at once.
  const settled = finished || still;
  useEffect(() => {
    if (motion === null) return;
    if (still) { t.set(1); return; }
    t.set(0);
    t.set(withTiming(1, { duration: MILESTONE_MOTION.total, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      (done) => { if (done) scheduleOnRN(setSettled, true); }));
    return () => cancelAnimation(t);
  }, [motion, still, t]);
  const settle = () => { if (settled) return; cancelAnimation(t); t.set(1); setSettled(true); };

  const stage = milestone.kind === 'stage';
  const reached = useMemo(() => levelAt(milestone.level), [milestone.level]);
  const left = useMemo(() => levelAt(milestone.previousLevel), [milestone.previousLevel]);
  const now = getLevelCategoryPresentation(reached), before = getLevelCategoryPresentation(left);
  const accent = stage ? coastalInk : GOLD;
  const kicker = stage ? `LEVEL ${reached.number} · A NEW STAGE` : milestone.kind === 'habit' ? `LEVEL ${reached.number} · HABIT ESTABLISHED` : `LEVEL ${reached.number} · JOURNEY COMPLETE`;

  const oldStyle = useAnimatedStyle(() => {
    const out = phase(t.value, T.leave);
    return { opacity: stage ? (1 - out) * phase(t.value, T.arrive) : 0, transform: [{ scale: 1 - 0.28 * out }, { translateY: 10 * out }] };
  });
  const oldWords = useAnimatedStyle(() => ({ opacity: stage ? (1 - phase(t.value, T.leave)) * phase(t.value, T.arrive) : 0 }));
  const newStyle = useAnimatedStyle(() => {
    const b = bloom(t.value, T.bloom), seen = phase(t.value, [T.bloom[0], T.bloom[0] + 0.06]);
    return { opacity: stage ? seen : phase(t.value, T.arrive), transform: [{ scale: stage ? 0.55 + 0.45 * b : 0.92 + 0.08 * phase(t.value, T.arrive) }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const glow = phase(t.value, T.bloom), pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, (t.value - T.bloom[0]) / 0.3)));
    return { opacity: 0.55 + 0.45 * glow, transform: [{ scale: 0.9 + 0.1 * glow + 0.08 * pulse }] };
  });
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - phase(t.value, T.ring)) }));
  const fade = (range: readonly [number, number], rise = 10) => ({ opacity: phase(t.value, range), transform: [{ translateY: rise * (1 - phase(t.value, range)) }] });
  const kickerStyle = useAnimatedStyle(() => fade(T.kicker, 6));
  // The name settles into place, from a breath wider and lighter (transform only: no layout per frame).
  const nameStyle = useAnimatedStyle(() => { const x = phase(t.value, T.name);
    return { opacity: x, transform: [{ translateY: 8 * (1 - x) }, { scale: 1.08 - 0.08 * x }] }; });
  const themeStyle = useAnimatedStyle(() => fade(T.theme, 6));
  const noteStyle = useAnimatedStyle(() => fade(T.note, 16));
  const actionStyle = useAnimatedStyle(() => ({ opacity: phase(t.value, T.action) }));

  const medallion = RING * scale;
  return <PaperBackdrop>
    <Pressable accessible={false} onPress={settle} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ minHeight: height, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 28 * scale, paddingTop: 56 * scale, paddingBottom: 40 * scale }}>
        <View style={{ width: medallion * 1.6, height: medallion * 1.25, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[styles.halo, { width: medallion * 1.18, height: medallion * 1.18, borderRadius: medallion * 0.59,
            backgroundColor: stage ? 'rgba(232,214,184,0.32)' : 'rgba(226,201,143,0.30)' }, haloStyle]} />
          <Animated.View pointerEvents="none" style={[styles.halo, { width: medallion * 0.78, height: medallion * 0.78, borderRadius: medallion * 0.39,
            backgroundColor: stage ? 'rgba(232,214,184,0.5)' : 'rgba(226,201,143,0.45)' }, haloStyle]} />
          {[0, 0.07, 0.14].map((delay) => <Ripple key={delay} t={t} delay={delay} size={medallion * 0.7} color={stage ? '#A38B63' : GOLD} />)}
          {Array.from({ length: 12 }, (_, index) => <Mote key={index} t={t} index={index} />)}
          <Svg width={medallion} height={medallion} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={medallion / 2} cy={medallion / 2} r={RADIUS * scale} stroke="rgba(20,20,20,0.10)" strokeWidth={STROKE} fill="none" />
            <AnimatedCircle cx={medallion / 2} cy={medallion / 2} r={RADIUS * scale} stroke={accent} strokeWidth={STROKE} fill="none" strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE * scale} ${CIRCUMFERENCE * scale}`} animatedProps={ringProps} />
          </Svg>
          {stage && <Animated.View style={[styles.center, oldStyle]}>
            <CategoryIcon category={left.category} level={left.number} size={104 * scale} />
          </Animated.View>}
          <Animated.View style={[styles.center, newStyle]}>
            <CategoryIcon category={reached.category} level={reached.number} size={112 * scale} />
          </Animated.View>
        </View>
        <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${kicker.toLowerCase()}. ${stage ? `${now.name}. ${now.theme}` : ''} ${milestone.note.title}. ${milestone.note.body}`}
          style={{ alignItems: 'center', width: '100%', maxWidth: 420, marginTop: stage ? -6 * scale : 6 * scale }}>
          <Animated.Text style={[kickerStyle, styles.kicker, { fontSize: 11.5 * scale, lineHeight: 17 * scale, color: stage ? coastalQuiet : GOLD }]}>{kicker}</Animated.Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Animated.Text style={[nameStyle, styles.name, { fontSize: 38 * scale, lineHeight: 46 * scale }]}>{stage ? now.name : milestone.kind === 'habit' ? 'A lasting habit' : 'Every stage walked'}</Animated.Text>
            {/* The stage left behind is named in the same place, and fades as its symbol does. */}
            {stage && <Animated.Text accessible={false} style={[oldWords, styles.name, styles.leaving, { fontSize: 30 * scale, lineHeight: 46 * scale }]}>{before.name}</Animated.Text>}
          </View>
          <Animated.Text style={[themeStyle, styles.theme, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>{stage ? now.theme : now.name}</Animated.Text>
          <Animated.View style={[noteStyle, styles.note, { padding: 20 * scale, marginTop: 26 * scale, borderRadius: 20 * scale }]}>
            <Text style={[styles.noteTitle, { fontSize: 21 * scale, lineHeight: 28 * scale }]}>{milestone.note.title}</Text>
            <Text style={[styles.noteBody, { fontSize: 15.5 * scale, lineHeight: 24 * scale }]}>{milestone.note.body}</Text>
          </Animated.View>
        </View>
        <Animated.View style={[actionStyle, { width: '100%', maxWidth: 420, marginTop: 26 * scale }]} pointerEvents={settled ? 'auto' : 'none'}>
          <QuietPressable accessibilityRole="button" accessibilityLabel={busy ? 'Returning' : 'Continue'} accessibilityState={{ disabled: busy || !settled }}
            disabled={busy || !settled} disabledOpacity={1} pressedOpacity={.8} onPress={onContinue}
            style={{ minHeight: Math.max(56 * scale, 48), backgroundColor: '#1C211A', borderRadius: 28 * scale, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'ManropeMedium', fontSize: 17 * scale, lineHeight: 24 * scale, color: '#F7F0E3' }}>{busy ? 'Returning…' : 'Continue'}</Text>
          </QuietPressable>
        </Animated.View>
      </ScrollView>
    </Pressable>
  </PaperBackdrop>;
}

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  leaving: { position: 'absolute', top: 0, left: 0, right: 0, color: coastalQuiet },
  kicker: { fontFamily: 'ManropeRegular', letterSpacing: 2.4, textAlign: 'center' },
  name: { fontFamily: coastalSerif, color: coastalInk, textAlign: 'center', marginTop: 6 },
  theme: { fontFamily: 'ManropeRegular', color: coastalQuiet, textAlign: 'center', marginTop: 4 },
  note: { width: '100%', backgroundColor: 'rgba(228,210,182,0.30)', gap: 8 },
  noteTitle: { fontFamily: coastalSerif, color: coastalInk },
  noteBody: { fontFamily: 'ManropeRegular', color: 'rgba(20,20,20,0.74)' },
});
