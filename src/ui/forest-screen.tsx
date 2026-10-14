import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOna } from '@/application/ona-provider';
import { getForestStage } from '@/domain/forest/growth';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { forestEntrySource } from './forest-assets';
import { forestEntryStageComposition } from './forest-geometry';
import { QuietPressable } from './quiet-pressable';
import { HomeIcon } from './home-icons';
import { useReducedMotion } from './reduced-motion';

export function ForestScreen({ goHome }: { goHome: () => void }) {
  const app = useOna(), { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets(), reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const stage = getForestStage({ highestLevel: app.habit?.highestLevel ?? 0, currentLevel: app.journey?.level.number ?? 0 });
  const scene = forestEntryStageComposition(stage.id, width, height);
  return <View style={styles.screen}>
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}>
        <Image source={forestEntrySource(stage.id)} contentFit="contain"
          onLoad={() => setLoaded(true)}
          transition={reduced || !loaded || stage.id === 'coast_0' ? 0 : 900} style={{ position: 'absolute', ...scene }} />
      </View>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 24, alignItems: 'center' }}>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={goHome}
          style={{ position: 'absolute', top: insets.top + 8, left: 16, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><HomeIcon name="arrow" size={22} color={coastalQuiet} /></View>
        </QuietPressable>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.caption, { marginTop: 12, marginHorizontal: 48 }]}>{stage.name}</Text>
        <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={1.5}>Your forest</Text>
        <Text style={styles.caption} maxFontSizeMultiplier={1.5}>Grows with your practice.</Text>
      </View>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: Math.max(insets.bottom, 20), alignItems: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <QuietPressable onPress={goHome} accessibilityRole="button" accessibilityLabel="Return to Home" style={styles.dotTarget}>
            <View style={[styles.dot, { backgroundColor: '#CBBFA9' }]} />
          </QuietPressable>
          <View accessibilityLabel="Forest, second of two views" style={styles.dotTarget}><View style={[styles.dot, { backgroundColor: '#696947' }]} /></View>
        </View>
      </View>
    </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4EBDD', overflow: 'hidden' },
  title: { fontFamily: coastalSerif, color: coastalInk, fontSize: 36, lineHeight: 44, marginTop: 13 },
  caption: { fontFamily: 'ManropeRegular', fontSize: 14, lineHeight: 22, color: coastalQuiet, textAlign: 'center' },
  dotTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
