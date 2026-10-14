import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

const MotionPreference = createContext<boolean | null>(null);

/** One live accessibility subscription for the application, including press feedback. */
export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let disposed = false;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!disposed && !changed) setReduced(value);
    }).catch(() => { if (!disposed && !changed) setReduced(true); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (!disposed) setReduced(value);
    });
    return () => { disposed = true; listener.remove(); };
  }, []);
  return createElement(MotionPreference.Provider, { value: reduced }, children);
}
/** Start conservatively until resolved; live changes cannot be overwritten by an older query. */
export function useMotionPreference() { return useContext(MotionPreference); }
export function useReducedMotion() { return useMotionPreference() ?? true; }
