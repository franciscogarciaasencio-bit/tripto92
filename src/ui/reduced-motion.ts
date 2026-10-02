import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Start static until the accessibility preference is known; respond to changes during practice. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let disposed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (!disposed) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { disposed = true; listener.remove(); };
  }, []);
  return reduced;
}
