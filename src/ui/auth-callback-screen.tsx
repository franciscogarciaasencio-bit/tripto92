import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Screen, Type } from './primitives';

/** Web returns in the same tab. The provider owns exchanging and switching ledgers. */
export function AuthCallbackScreen() {
  const { ready, completeWebSignIn } = useOna();
  useEffect(() => {
    if (Platform.OS !== 'web' || !ready) return;
    let disposed = false;
    void completeWebSignIn().then(() => { if (!disposed) router.replace('/account'); });
    return () => { disposed = true; };
  }, [ready, completeWebSignIn]);

  if (Platform.OS !== 'web') return <Redirect href="/account" />;
  return <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Type accessibilityLiveRegion="polite">Completing sign-in…</Type>
  </Screen>;
}
