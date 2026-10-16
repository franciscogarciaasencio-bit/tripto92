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
        <Type>Every saved practice can leave Ripples, even a short pause. Sessions with at least three active minutes count toward consistency.</Type>
        <Type>Begin at Level 0 · Monkey Mind. Your Ripples and regular practice gradually open new levels, each revealed when you reach it. Longer sessions and a steady rhythm gently add to your rewards, automatically.</Type>
        <Type role="secondary">Nearby sessions share their reward, so splitting a practice does not multiply your progress. Returning on different days matters more than rushing.</Type>
        <Type role="secondary">Consistency is one bar with five small milestones beneath it. Daily practices of at least three minutes reach full in about two months. A second practice six hours after the first ends can bring that closer to a month. Missing days gently soften your rhythm; extra Ripples follow automatically.</Type>
        <Type role="secondary">Your earned Ripples and highest level stay in your history. After three complete inactive days, current level progress gradually eases back. Half your highest level always remains protected. Return at your own pace.</Type>
        <Type role="secondary">Level 100 is Ona’s designed habit-building milestone. Levels 101–125 invite continued practice, with the final level requiring at least a year. These milestones do not measure meditation ability.</Type>
        <Type role="secondary">Reset All Practice Data in Settings permanently deletes your practice, history and journey. Your preferences stay.</Type>
    </Animated.View>}
  </Animated.View>;
}
