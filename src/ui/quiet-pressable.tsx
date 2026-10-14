import { useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
  disabledOpacity?: number;
};

/** Opacity only: native feedback without changing layout, hit targets or scroll gestures. */
export function QuietPressable({ style, disabled, pressedOpacity = .62, disabledOpacity = .4,
  onPressIn, onPressOut, ...props }: Props) {
  const reduced = useReducedMotion(), opacity = useSharedValue(1);
  const feedback = useAnimatedStyle(() => ({ opacity: disabled ? disabledOpacity : opacity.value }));
  useEffect(() => {
    opacity.set(1);
    return () => cancelAnimation(opacity);
  }, [disabled, reduced, opacity]);
  const fade = (to: number, duration: number) => opacity.set(withTiming(to, {
    duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never,
  }));
  return <AnimatedPressable {...props} disabled={disabled} style={[style, feedback]}
    onPressIn={event => { fade(pressedOpacity, UI_MOTION.pressIn); onPressIn?.(event); }}
    onPressOut={event => { fade(1, UI_MOTION.pressOut); onPressOut?.(event); }} />;
}
