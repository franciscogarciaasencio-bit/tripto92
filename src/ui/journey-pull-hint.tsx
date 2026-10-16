import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence,
  withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';

/**
 * Home's hint that Journey lies below: a faint upward chevron that drifts up a little every few
 * seconds (still with Reduced Motion) and fades away for good once the pull has been used.
 */
export function JourneyPullHint({ visible, top, scale, onPress }: { visible: boolean; top: number; scale: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(0), drift = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: reduced ? 0 : visible ? 900 : 600, reduceMotion: ReduceMotion.Never }));
    if (visible && !reduced) {
      drift.set(withDelay(1600, withRepeat(withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 3200, reduceMotion: ReduceMotion.Never })), -1)));
    } else drift.set(0);
    return () => { cancelAnimation(drift); cancelAnimation(shown); };
  }, [visible, reduced, shown, drift]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get() * (0.55 + 0.25 * drift.get()), transform: [{ translateY: -3 * scale * drift.get() }] }));
  const size = 16 * scale;
  return <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[{ position: 'absolute', left: 0, right: 0, top: top - 14 * scale, alignItems: 'center' }, style]}>
    <QuietPressable accessibilityRole="button" accessibilityLabel="Open Journey" accessibilityHint="You can also pull up from the bottom of Home"
      onPress={onPress} hitSlop={10} style={{ width: 56 * scale, height: 24 * scale, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size * .55} viewBox="0 0 16 9" accessible={false}>
        <Path d="M1.5 7.5 L8 1.5 L14.5 7.5" fill="none" stroke="#8D897A" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </QuietPressable>
  </Animated.View>;
}
