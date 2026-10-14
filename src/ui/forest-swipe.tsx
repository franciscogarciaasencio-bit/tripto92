import { useCallback, useEffect, useMemo, useState, useImperativeHandle, type Ref, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { FOREST_SWIPE, forestDragProgress, forestSettleDuration, shouldNavigateForest } from './forest-geometry';
import { useReducedMotion } from './reduced-motion';

type Props = {
  direction: 'left' | 'right'; enabled: boolean; onNavigate: () => void;
  scrollGesture: NativeGesture; preview: (moving: boolean) => ReactNode;
  children: ReactNode; ref?: Ref<{ navigate: () => void }>;
};
/** Finger-following native pages; only lifecycle/release callbacks cross to JavaScript. */
export function ForestSwipe({ direction, enabled, onNavigate, scrollGesture, preview, children, ref }: Props) {
  const { width, height } = useWindowDimensions(), reduced = useReducedMotion();
  const progress = useSharedValue(0), settling = useSharedValue(false), generation = useSharedValue(0);
  const gestureCancelled = useSharedValue(true);
  const [moving, setMoving] = useState(false), navigated = useSharedValue(false);
  const finish = useCallback((token: number) => {
    if (generation.get() !== token || !enabled || navigated.get()) return;
    navigated.set(true);
    onNavigate();
  }, [generation, enabled, navigated, onNavigate]);
  const cancel = useCallback(() => {
    generation.set(generation.get() + 1);
    cancelAnimation(progress);
    progress.set(0); settling.set(false); gestureCancelled.set(true); scheduleOnRN(setMoving, false); navigated.set(false);
  }, [generation, progress, settling, navigated, gestureCancelled]);
  useEffect(() => {
    cancel();
    return () => { generation.set(generation.get() + 1); cancelAnimation(progress); };
  }, [enabled, width, height, reduced, cancel, generation, progress]);
  const settle = useCallback((destination: 0 | 1) => {
    'worklet';
    if (settling.get()) return;
    if (destination === 0 && progress.get() === 0) { scheduleOnRN(setMoving, false); return; }
    settling.set(true);
    const token = generation.get() + 1; generation.set(token);
    progress.set(withTiming(destination, { duration: reduced ? 0 : forestSettleDuration(progress.get(), destination),
      easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, finished => {
      if (!finished || token !== generation.get()) return;
      if (destination === 1) scheduleOnRN(finish, token);
      else { settling.set(false); scheduleOnRN(setMoving, false); }
    }));
  }, [generation, progress, reduced, settling, finish]);
  const navigate = useCallback(() => {
    if (!enabled || navigated.get() || settling.get()) return;
    setMoving(true);
    settle(1);
  }, [enabled, navigated, settle, settling]);
  useImperativeHandle(ref, () => ({ navigate }), [navigate]);
  useEffect(() => {
    if (direction !== 'right' || !enabled) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { navigate(); return true; });
    return () => back.remove();
  }, [direction, enabled, navigate]);
  const gesture = useMemo(() => {
    const pan = Gesture.Pan().enabled(enabled).maxPointers(1)
    .activeOffsetX(direction === 'left' ? -FOREST_SWIPE.activation : FOREST_SWIPE.activation)
    .failOffsetY([-FOREST_SWIPE.verticalTolerance, FOREST_SWIPE.verticalTolerance])
    .onStart(() => {
      gestureCancelled.set(settling.get());
      if (!settling.get()) scheduleOnRN(setMoving, true);
    })
    .onUpdate(event => {
      if (settling.get() || gestureCancelled.get()) return;
      if (event.numberOfPointers !== 1) { gestureCancelled.set(true); settle(0); return; }
      if (!reduced) progress.set(forestDragProgress(direction, event.translationX, width));
    })
    .onEnd((event, success) => {
      settle(success && !gestureCancelled.get() && event.numberOfPointers <= 1 && shouldNavigateForest(direction, event.translationX, event.translationY, event.velocityX) ? 1 : 0);
    })
    .onFinalize((_event, success) => { if (!success) settle(0); });
    if (direction === 'left') pan.simultaneousWithExternalGesture(scrollGesture);
    return pan;
  },
  [enabled, direction, width, reduced, scrollGesture, progress, settling, settle, gestureCancelled]);
  const sign = direction === 'left' ? -1 : 1;
  const outgoing = useAnimatedStyle(() => ({ transform: [{ translateX: reduced ? 0 : sign * width * progress.get() }] }));
  const incoming = useAnimatedStyle(() => ({ transform: [{ translateX: sign * width * (progress.get() - 1) }] }));
  return <GestureDetector gesture={gesture}><View collapsable={false} style={styles.fill}>
    {!reduced && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      aria-hidden style={[StyleSheet.absoluteFill, incoming]}>{preview(moving)}</Animated.View>}
    <Animated.View pointerEvents={moving ? 'none' : 'auto'} style={[styles.fill, outgoing]}>
      {children}
    </Animated.View>
  </View></GestureDetector>;
}
const styles = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden', backgroundColor: '#F4EBDD' } });

