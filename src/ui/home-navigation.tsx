import { router, useFocusEffect, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, type HomeIconName } from './home-icons';
import { QuietPressable } from './quiet-pressable';
import { useOna } from '@/application/ona-provider';

const destinations: readonly { id: 'home' | 'journey' | 'info' | 'settings'; label: string; route: Href; icon: HomeIconName }[] = [
  { id: 'home', label: 'Ona', route: '/', icon: 'wave' },
  { id: 'journey', label: 'Journey', route: { pathname: '/practice', params: { view: 'calendar' } }, icon: 'journey' },
  { id: 'info', label: 'Guide', route: '/info', icon: 'info' },
  { id: 'settings', label: 'Settings', route: '/preferences', icon: 'settings' },
];

/** Quiet Router navigation, usable both in normal flow and in Home's measured composition. */
export function HomeNavigation({ active, scale = 1 }: { active: typeof destinations[number]['id']; scale?: number }) {
  const insets = useSafeAreaInsets();
  const { busy } = useOna();
  const route = usePathname(), { view } = useLocalSearchParams<{ view?: string }>();
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => { navigating.current = false; }, []));
  return <View style={{ paddingHorizontal: 25 * scale, paddingBottom: Math.max(insets.bottom, 6 * scale) }}>
    <View style={styles.line} />
    <View style={{ flexDirection: 'row', marginLeft: -21 * scale, marginRight: -20 * scale, paddingTop: 2 * scale }}>
      {destinations.map((item) => <QuietPressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
        aria-selected={active === item.id} aria-disabled={busy}
        disabled={busy} disabledOpacity={.75} accessibilityState={{ selected: active === item.id, disabled: busy }} onPress={() => {
          if (navigating.current || active === item.id && (item.id !== 'journey' || route === '/practice' && view !== 'levels')) return;
          navigating.current = true;
          router.dismissTo(item.route);
        }}
        style={{ flex: 1, minHeight: Math.max(48 * scale, 48), alignItems: 'center', justifyContent: 'center', gap: 4 * scale }}>
        <HomeIcon name={item.icon} selected={active === item.id} size={21 * scale} color={active === item.id ? '#171B18' : '#898579'} />
        <Text style={{ fontFamily: 'ManropeRegular', fontSize: 11 * scale, lineHeight: 15 * scale, color: active === item.id ? '#242722' : '#898579' }}>{item.label}</Text>
      </QuietPressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({ line: { height: StyleSheet.hairlineWidth, backgroundColor: '#D8CEBC' } });
