import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnaProvider, useOna } from '@/application/ona-provider';
import { AudioProvider } from '@/application/audio-provider';
import { Opening } from '@/ui/opening';
import { Action, colors, Screen, Type } from '@/ui/primitives';
import { ProgressExplanation } from '@/ui/progress-explanation';

void SplashScreen.preventAutoHideAsync();
function Application() {
  const app = useOna();
  const [details, setDetails] = useState(false);
  return <Opening reveal={SplashScreen.hideAsync}>
    {app.ready && !app.explanationDismissed && !app.draft && !app.completion ? <ProgressExplanation firstUse /> : app.ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade', animationDuration: 200 }}>
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="completion" options={{ gestureEnabled: false }} />
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
  return <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}><StatusBar style="dark" />
    {fontError ? <Screen style={{ justifyContent: 'center' }}><Type>Ona’s font could not be loaded. Please reopen the app.</Type></Screen> :
      <OnaProvider><AudioProvider><Application /></AudioProvider></OnaProvider>}
  </SafeAreaProvider>;
}
