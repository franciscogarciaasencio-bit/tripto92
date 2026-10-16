import { useMemo } from 'react';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { shouldTurnPage, verticalShift, VERTICAL_PAGE } from './vertical-page-geometry';
import { useReducedMotion } from './reduced-motion';

/**
 * A vertical page turn at the edge of a scroll view: `atEdge` says the content is scrolled to the end
 * the drag goes toward (bottom for 'up', top for 'down'). The page follows the finger, fades a little,
 * then the route change (native stack, slide from/to bottom) completes the move.
 */
export function useVerticalPage({ direction, enabled, atEdge, onTurn, simultaneous }: {
  direction: 'up' | 'down'; enabled: boolean; atEdge: SharedValue<boolean>; onTurn: () => void;
  simultaneous?: GestureType;
}) {
  const reduced = useReducedMotion();
  const shift = useSharedValue(0), tracking = useSharedValue(false);
  const gesture = useMemo(() => {
    const pan = Gesture.Pan().enabled(enabled).maxPointers(1)
      .activeOffsetY(direction === 'up' ? -VERTICAL_PAGE.activation : VERTICAL_PAGE.activation)
      .failOffsetX([-VERTICAL_PAGE.horizontalTolerance, VERTICAL_PAGE.horizontalTolerance])
      .onStart(() => { tracking.set(atEdge.get()); })
      .onUpdate((event) => {
        if (!tracking.get()) return;
        cancelAnimation(shift);
        shift.set(reduced ? 0 : verticalShift(direction, event.translationY));
      })
      .onEnd((event) => {
        const turn = tracking.get() && shouldTurnPage(direction, event.translationX, event.translationY, event.velocityY);
        tracking.set(false);
        if (turn) scheduleOnRN(onTurn);
        // Settle back softly; after a turn the route transition carries the page away meanwhile.
        shift.set(withTiming(0, { duration: reduced ? 0 : turn ? 420 : 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
      })
      .onFinalize(() => { if (tracking.get()) { tracking.set(false); shift.set(withTiming(0, { duration: reduced ? 0 : 260 })); } });
    if (simultaneous) pan.simultaneousWithExternalGesture(simultaneous);
    return pan;
  }, [enabled, direction, atEdge, onTurn, simultaneous, reduced, shift, tracking]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.get() }],
    opacity: 1 - Math.min(.25, Math.abs(shift.get()) / VERTICAL_PAGE.maximumShift * .25),
  }));
  return { gesture, style };
}
