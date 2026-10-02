import { useEffect, useState } from 'react';
import { Animated, AccessibilityInfo } from 'react-native';
import { Type } from './primitives';

/** Animate one saved-history increment, never an independently stored or frame-by-frame counter. */
export function PracticeCount({ before, after }: { before: number; after: number }) {
  const [count, setCount] = useState(before);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout>;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (disposed) return;
      if (reduced || before === after) { setCount(after); return; }
      setCount(before);
      timeout = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(({ finished }) => {
          if (!finished || disposed) return;
          setCount(after);
          Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
        });
      }, 320);
    });
    return () => { disposed = true; clearTimeout(timeout); opacity.stopAnimation(); };
  }, [before, after, opacity]);
  return <Animated.View style={{ opacity }} accessible accessibilityLabel={`${after} completed ${after === 1 ? 'practice' : 'practices'}`}>
    <Type>{`${count} ${count === 1 ? 'practice' : 'practices'}`}</Type>
  </Animated.View>;
}
