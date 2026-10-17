import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useState } from 'react';
import { Header, Screen, styles, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

export function ProgressExplanation() {
  return <Screen><Header title="How progress works" back={() => router.back()} />
    <View style={{ gap: 32, paddingTop: 48, paddingBottom: 32, maxWidth: 380 }}>
      <Type role="heading">Build your meditation habit, one practice at a time.</Type>
      <Type role="secondary">A practice counts from three active minutes.</Type>
      <Type>Return to your breath, whenever you can.</Type>
      <Type role="secondary">Ona rewards consistency.</Type>
      <HowItWorks />
    </View>
  </Screen>;
}

/** Secondary, deliberately opened explanation; never part of first-use onboarding. */
export function HowItWorks() {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion(), accessibility = reduced ? ReduceMotion.Always : ReduceMotion.Never;
  return <Animated.View layout={LinearTransition.duration(UI_MOTION.expand).easing(Easing.inOut(Easing.cubic)).reduceMotion(accessibility)} style={{ gap: 20 }}>
    <QuietPressable accessibilityRole="button" accessibilityLabel="How it works" accessibilityState={{ expanded }}
      onPress={() => setExpanded(!expanded)} style={[styles.action, styles.quiet]}>
      <Type role="label">{expanded ? 'How it works · Hide' : 'How it works'}</Type>
    </QuietPressable>
    {expanded && <Animated.View entering={FadeIn.duration(UI_MOTION.reveal).reduceMotion(accessibility)}
      exiting={FadeOut.duration(120).reduceMotion(accessibility)} style={{ gap: 20 }}>
        {/* Owner, 2026-10-17: explain what matters, not the arithmetic. No multipliers, rates or timelines. */}
        <Type>A practice of at least three active minutes earns Ripples, and longer practices earn more. Shorter ones stay in your history.</Type>
        <Type>Begin at Level 0 · Monkey Mind. Each level is revealed when you reach it, and every new stage brings a short note for that part of your practice.</Type>
        <Type role="secondary">Every practice on the same day counts. After the first, each earns a little less, but never nothing. Practices close together count as one.</Type>
        <Type role="secondary">Consistency rewards coming back, generously: the more regularly you practise, the more Ripples every practice earns. Each practice of three minutes or more fills it, and a second one at least six hours after the first fills it again. Days away let it fade; it returns as soon as you do.</Type>
        <Type role="secondary">The Ripples you earn and your highest level stay in your history. After a few days away, current level progress gradually eases back, and part of your highest level always stays protected. Return at your own pace.</Type>
        <Type role="secondary">Level 100 means meditation has become a habit: the journey Ona was made for. Levels 101–125 invite you to keep it alive. Levels do not measure meditation ability.</Type>
        <Type role="secondary">Reset All Practice Data in Settings permanently deletes your practice, history and journey. Your preferences stay.</Type>
    </Animated.View>}
  </Animated.View>;
}
