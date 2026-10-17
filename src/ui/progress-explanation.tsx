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
        <Type>A practice of at least three active minutes earns Ripples: 16 for every minute up to fifteen minutes, then a little more for each longer stretch, up to 400 for an hour. Shorter practices stay in your history.</Type>
        <Type>Begin at Level 0 · Monkey Mind. Your Ripples and regular practice gradually open new levels, each revealed when you reach it. Longer sessions and a steady rhythm gently add to your rewards, automatically.</Type>
        <Type role="secondary">A second practice on the same day earns three quarters, a third half, and more earn nothing. Practices less than 90 minutes apart count as one. Returning on different days matters most.</Type>
        <Type role="secondary">Consistency multiplies every practice, up to eight times its Ripples. It fills fastest at the start and reaches full in about six weeks of daily practice, or three weeks practising twice a day, six hours apart. Days without practice let it fade, and it returns as soon as you do.</Type>
        <Type role="secondary">Your earned Ripples and highest level stay in your history. After three complete inactive days, current level progress gradually eases back. Half your highest level always remains protected. Return at your own pace.</Type>
        <Type role="secondary">Level 100 is Ona’s designed habit-building milestone. Levels 101–125 invite continued practice. These milestones do not measure meditation ability.</Type>
        <Type role="secondary">Reset All Practice Data in Settings permanently deletes your practice, history and journey. Your preferences stay.</Type>
    </Animated.View>}
  </Animated.View>;
}
