import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, Type } from './primitives';
import { Wordmark } from './wordmark';

/** Cold-launch only; owns touch interception so skipping never activates Meditate underneath. */
export function Opening({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(0));
  const [home] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let disposed = false;
    async function run() {
      const [reduced, reader] = await Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()]);
      if (disposed) return;
      if (reduced || reader) {
        setVisible(false);
        Animated.timing(home, { toValue: 1, duration: reader ? 0 : 180, useNativeDriver: true }).start();
        return;
      }
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.bezier(.22, .61, .36, 1), useNativeDriver: true }),
          Animated.delay(500), Animated.timing(opacity, { toValue: 0, duration: 320, easing: Easing.bezier(.4, 0, .2, 1), useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(900), Animated.timing(home, { toValue: 1, duration: 300, useNativeDriver: true })]),
      ]).start(({ finished }) => { if (finished && !disposed) setVisible(false); });
    }
    void run();
    return () => { disposed = true; opacity.stopAnimation(); home.stopAnimation(); };
  }, [home, opacity]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Animated.View style={{ flex: 1, opacity: home }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</Animated.View>
    {visible && <Pressable accessibilityRole="button" accessibilityLabel="Ona. Build your meditation habit. Skip introduction" onPress={() => { opacity.stopAnimation(); home.stopAnimation(); home.setValue(1); setVisible(false); }}
      style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.View style={{ opacity, alignItems: 'center', gap: 16 }}><Wordmark /><Type role="secondary">Build your meditation habit</Type></Animated.View>
    </Pressable>}
  </View>;
}
