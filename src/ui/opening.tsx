import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, Type } from './primitives';

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
          Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.bezier(.22, .61, .36, 1), useNativeDriver: true }),
          Animated.delay(650), Animated.timing(opacity, { toValue: 0, duration: 450, easing: Easing.bezier(.4, 0, .2, 1), useNativeDriver: true }),
        ]),
        Animated.sequence([Animated.delay(1350), Animated.timing(home, { toValue: 1, duration: 400, useNativeDriver: true })]),
      ]).start(({ finished }) => { if (finished && !disposed) setVisible(false); });
    }
    void run();
    return () => { disposed = true; opacity.stopAnimation(); home.stopAnimation(); };
  }, [home, opacity]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Animated.View style={{ flex: 1, opacity: home }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</Animated.View>
    {visible && <Pressable accessible={false} onPress={() => { opacity.stopAnimation(); home.stopAnimation(); home.setValue(1); setVisible(false); }}
      style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.View style={{ opacity }}><Type role="wordmark">Ona</Type></Animated.View>
    </Pressable>}
  </View>;
}
