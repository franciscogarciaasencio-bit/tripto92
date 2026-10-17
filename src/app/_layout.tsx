import { useFonts } from 'expo-font';
import { router, Stack, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnaProvider, useOna } from '@/application/ona-provider';
import { AudioProvider } from '@/application/audio-provider';
import { FriendsProvider } from '@/application/friends-provider';
import { Opening } from '@/ui/opening';
import { Action, colors, Screen, Type } from '@/ui/primitives';
import { OceanMotionProvider } from '@/ui/ocean-motion';
import { MotionPreferenceProvider, useReducedMotion } from '@/ui/reduced-motion';
import { UI_MOTION } from '@/ui/motion';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ForestNavigationProvider } from '@/ui/forest-pages';
import { requiredPracticeRoute } from '@/application/practice-lifecycle';

void SplashScreen.preventAutoHideAsync();
function Application() {
  const app = useOna();
  const [details, setDetails] = useState(false);
  const pathname = usePathname(), navigation = useRootNavigationState();
  const required = requiredPracticeRoute(app.draft?.phase ?? null, app.completion !== null);
  const routeReady = required === null || pathname === required;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!app.ready || !navigation?.key) return;
    if (!routeReady && required) router.replace(required);
  }, [app.ready, navigation?.key, required, routeReady]);
  // First launch: a new user (no saved practice yet) sees the short guide once over Home, never over a
  // practice in progress or right after one.
  const introduced = useRef(false);
  useEffect(() => {
    if (!app.ready || !navigation?.key || introduced.current || app.explanationDismissed || app.hasHistory) return;
    if (required !== null || app.draft || app.completion || pathname !== '/') return;
    introduced.current = true;
    router.push('/introduction');
  }, [app.ready, navigation?.key, app.explanationDismissed, app.hasHistory, app.draft, app.completion, required, pathname]);
  return <Opening reveal={SplashScreen.hideAsync} ready={app.ready && routeReady || app.error !== null}>
    {app.ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: reduced ? 'none' : 'fade', animationDuration: reduced ? 0 : UI_MOTION.navigation }}>
      <Stack.Screen name="forest" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="completion" options={{ gestureEnabled: false }} />
      <Stack.Screen name="introduction" options={{ gestureEnabled: false }} />
      {/* Journey rises from below Home and settles back down (pull up on Home, down on Journey, or the tab). */}
      <Stack.Screen name="practice" options={{ animation: reduced ? 'none' : 'slide_from_bottom', animationDuration: reduced ? 0 : 380 }} />
    </Stack> : <Screen style={{ justifyContent: 'center', alignItems: 'center', gap: 24 }}>
      <Type role="heading" style={{ textAlign: 'center' }}>{app.error ? 'Your practice could not be opened' : 'Opening your practice…'}</Type>
      {app.error && <><Action onPress={app.retryInitialization}>Try again</Action>
        <Action quiet onPress={() => setDetails(!details)}>Technical details</Action>
        {details && <Type role="secondary">{app.error}</Type>}</>}
    </Screen>}
  </Opening>;
}
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ManropeRegular: require('../../assets/fonts/Manrope-Regular.ttf'),
    ManropeMedium: require('../../assets/fonts/Manrope-Medium.ttf'),
    NewsreaderRegular: require('../../assets/fonts/Newsreader-Regular.ttf'),
  });
  useEffect(() => { if (fontError) void SplashScreen.hideAsync(); }, [fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><MotionPreferenceProvider><SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}><StatusBar style="dark" />
    {fontError ? <Screen style={{ justifyContent: 'center' }}><Type>Ona’s font could not be loaded. Please reopen the app.</Type></Screen> :
      <OnaProvider><FriendsProvider><AudioProvider><OceanMotionProvider><ForestNavigationProvider><Application /></ForestNavigationProvider></OceanMotionProvider></AudioProvider></FriendsProvider></OnaProvider>}
  </SafeAreaProvider></MotionPreferenceProvider></GestureHandlerRootView>;
}
