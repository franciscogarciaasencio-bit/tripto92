import { useFonts } from 'expo-font';
import { router, Stack, usePathname, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnaProvider, useOna } from '@/application/ona-provider';
import { AudioProvider } from '@/application/audio-provider';
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
  return <Opening reveal={SplashScreen.hideAsync} ready={app.ready && routeReady || app.error !== null}>
    {app.ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: reduced ? 'none' : 'fade', animationDuration: reduced ? 0 : UI_MOTION.navigation }}>
      <Stack.Screen name="forest" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="completion" options={{ gestureEnabled: false }} />
      <Stack.Screen name="introduction" options={{ gestureEnabled: false }} />
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
  });
  useEffect(() => { if (fontError) void SplashScreen.hideAsync(); }, [fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><MotionPreferenceProvider><SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}><StatusBar style="dark" />
    {fontError ? <Screen style={{ justifyContent: 'center' }}><Type>Ona’s font could not be loaded. Please reopen the app.</Type></Screen> :
      <OnaProvider><AudioProvider><OceanMotionProvider><ForestNavigationProvider><Application /></ForestNavigationProvider></OceanMotionProvider></AudioProvider></OnaProvider>}
  </SafeAreaProvider></MotionPreferenceProvider></GestureHandlerRootView>;
}
