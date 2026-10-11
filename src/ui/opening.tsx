import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, Type } from './primitives';
import { Wordmark } from './wordmark';

/** Cold-launch only; owns touch interception so skipping never activates Meditate underneath. */
export function Opening({ children, reveal }: { children: ReactNode; reveal: () => Promise<void> }) {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(0));
  const [home] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let disposed = false;
    async function run() {
      const [reduced, reader] = await Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()]);
      // Start the visible hold only after the host splash has been dismissed, independent of SQLite startup.
      await reveal();
      if (disposed) return;
      const entrance = reduced || reader ? 0 : 300;
      const exit = reduced || reader ? 0 : 350;
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: entrance, easing: Easing.bezier(.22, .61, .36, 1), useNativeDriver: true }),
          Animated.delay(1100), Animated.timing(opacity, { toValue: 0, duration: exit, easing: Easing.bezier(.4, 0, .2, 1), useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(entrance + 1100), Animated.timing(home, { toValue: 1, duration: exit, useNativeDriver: true })]),
      ]).start(({ finished }) => { if (finished && !disposed) setVisible(false); });
    }
    void run();
    return () => { disposed = true; opacity.stopAnimation(); home.stopAnimation(); };
  }, [home, opacity, reveal]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Animated.View style={{ flex: 1, opacity: home }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</Animated.View>
    {visible && <Pressable accessibilityRole="button" accessibilityLabel="Ona. Build your meditation habit. Skip introduction" onPress={() => { opacity.stopAnimation(); home.stopAnimation(); home.setValue(1); setVisible(false); }}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.View style={{ opacity, alignItems: 'center', gap: 16 }}><Wordmark /><Type role="secondary">Build your meditation habit</Type></Animated.View>
    </Pressable>}
  </View>;
}
