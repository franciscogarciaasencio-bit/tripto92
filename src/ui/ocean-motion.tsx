import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { OCEAN_CYCLE_MS, OCEAN_REDUCED_AMPLITUDE } from './ocean-geometry';
import { useForeground } from './use-foreground';
import { useReducedMotion } from './reduced-motion';

const Motion = createContext<{ phase: SharedValue<number>; amplitude: SharedValue<number> } | null>(null);

/** One UI-thread phase across Home/session. Screen transitions and timer Pause never restart the swell. */
export function OceanMotionProvider({ children }: { children: ReactNode }) {
  const route = usePathname(), foreground = useForeground(), reduced = useReducedMotion();
  const phase = useSharedValue(0), amplitude = useSharedValue(0);
  const visible = foreground && (route === '/' || route === '/forest' || route === '/session' || route === '/completion' || route === '/introduction');
  useEffect(() => {
    cancelAnimation(phase);
    if (visible) {
      // Explicitly bypass Reanimated's startup-cached System gate. The live setting controls amplitude below.
      // The user requested continued, smaller motion with Reduce Motion on as well as off.
      phase.set(withRepeat(withTiming(phase.get() + Math.PI * 2, {
        duration: OCEAN_CYCLE_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never,
      }), -1, false, undefined, ReduceMotion.Never));
    }
    return () => cancelAnimation(phase);
  }, [visible, phase]);
  useEffect(() => {
    amplitude.set(withTiming(reduced ? OCEAN_REDUCED_AMPLITUDE : 1, {
      duration: 1_000, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never,
    }));
    return () => cancelAnimation(amplitude);
  }, [reduced, amplitude]);
  const value = useMemo(() => ({ phase, amplitude }), [phase, amplitude]);
  return <Motion.Provider value={value}>{children}</Motion.Provider>;
}
export function useOceanMotion() {
  const motion = useContext(Motion);
  if (!motion) throw new Error('OceanMotionProvider is required');
  return motion;
}
