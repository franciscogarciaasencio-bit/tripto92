import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';

import { BREATH_GUIDE, nextBreath } from './breath-rhythm';

type Phase = 'ready' | 'in' | 'out';

/** A breathing guide for counting out-breaths; not a session, never during practice, saves nothing. */
export function BreathGuide({ size }: { size: number }) {
  const still = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [cycles, setCycles] = useState(0);
  const fill = useSharedValue<number>(BREATH_GUIDE.small);
  const number = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counted = useRef(0);

  useEffect(() => {
    if (phase === 'ready') return;
    const duration = phase === 'in' ? BREATH_GUIDE.inhale : BREATH_GUIDE.exhale;
    const config = { duration: still ? 0 : duration, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never };
    fill.set(withTiming(phase === 'in' ? 1 : BREATH_GUIDE.small, config));
    timer.current = setTimeout(() => {
      if (phase === 'in') {
        const next = nextBreath(counted.current);
        if (next === 1 && counted.current > 0) setCycles((value) => value + 1);
        counted.current = next; setCount(next);
        setPhase('out');
      } else setPhase('in');
    }, duration);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase, still, fill]);

  // Each count settles in softly as its out-breath begins.
  useEffect(() => {
    number.set(0);
    number.set(withTiming(1, { duration: still ? 0 : 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
  }, [count, still, number]);

  useEffect(() => () => { cancelAnimation(fill); cancelAnimation(number); }, [fill, number]);

  const begin = () => { counted.current = 0; setCount(0); setCycles(0); fill.set(BREATH_GUIDE.small); setPhase('in'); };
  const stop = () => { if (timer.current) clearTimeout(timer.current); cancelAnimation(fill); fill.set(withTiming(BREATH_GUIDE.small, { duration: still ? 0 : 600 })); setPhase('ready'); counted.current = 0; setCount(0); };

  const disc = useAnimatedStyle(() => ({ transform: [{ scale: fill.value }], opacity: .32 + .4 * (fill.value - BREATH_GUIDE.small) / (1 - BREATH_GUIDE.small) }));
  const digits = useAnimatedStyle(() => ({ opacity: number.value, transform: [{ translateY: 6 * (1 - number.value) }] }));
  const running = phase !== 'ready';
  const cue = phase === 'in' ? 'Breathe in' : phase === 'out' ? 'Breathe out' : 'Ready when you are';
  const backToOne = running && count === 1 && cycles > 0;
  const label = running ? `${cue}. ${count > 0 ? `Count ${count}.` : ''}` : 'Breathing guide, ready';

  return <View style={{ alignItems: 'center' }}>
    <View accessible accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: size / 2 }]} />
      <Animated.View style={[styles.disc, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }, disc]} />
      {running && count > 0 && <Animated.View style={digits}>
        <Text style={[styles.count, { fontSize: size * .3, lineHeight: size * .36 }]}>{count}</Text>
      </Animated.View>}
    </View>
    <Text style={styles.cue}>{cue}</Text>
    <Text style={styles.hint}>{backToOne ? 'Ten. Now back to one.' : running ? 'Count each out-breath, one to ten.' : 'About ten seconds a breath. Count as you breathe out.'}</Text>
    <QuietPressable accessibilityRole="button" accessibilityLabel={running ? 'Stop the breathing guide' : 'Begin the breathing guide'}
      onPress={running ? stop : begin} style={styles.action}>
      <Text style={styles.actionLabel}>{running ? 'Stop' : 'Begin'}</Text>
    </QuietPressable>
  </View>;
}

const styles = StyleSheet.create({
  ring: { borderWidth: 1, borderColor: 'rgba(28,33,26,0.28)' },
  disc: { position: 'absolute', backgroundColor: '#D9CBB2' },
  count: { fontFamily: coastalSerif, color: coastalInk, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cue: { fontFamily: 'ManropeMedium', fontSize: 13, lineHeight: 20, letterSpacing: 1.4, color: coastalInk, marginTop: 18, textTransform: 'uppercase' },
  hint: { fontFamily: 'ManropeRegular', fontSize: 13, lineHeight: 20, color: coastalQuiet, textAlign: 'center', marginTop: 4, minHeight: 20 },
  action: { minHeight: 44, minWidth: 120, paddingHorizontal: 22, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(28,33,26,0.35)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: 'ManropeMedium', fontSize: 14, lineHeight: 20, color: coastalInk },
});
