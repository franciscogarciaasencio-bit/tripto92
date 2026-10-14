import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Action, colors, Header, Notice, Screen, Type } from './primitives';

/** Optional Google account: a quiet place to keep practice safe across phones. */
export function AccountScreen() {
  const app = useOna();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const between = !app.draft && !app.completion;
  const back = useCallback(() => {
    if (app.busy) return;
    if (confirmSignOut) setConfirmSignOut(false);
    else router.back();
  }, [app.busy, confirmSignOut]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  }, [back]));

  const signIn = () => {
    setMessage(null);
    void app.signIn().then((signedIn) => { if (!signedIn && !app.error) setMessage('Sign-in was cancelled.'); });
  };
  const signOut = () => {
    setMessage(null);
    void app.signOut().then((done) => { if (done) setConfirmSignOut(false); });
  };

  return <Screen><Header title="Account" back={back} />
    <View style={{ gap: 16, paddingTop: 32 }}>
      {!app.cloudAvailable ? <>
        <Type>Accounts are not available in this version of Ona.</Type>
        <Type role="secondary">Your practice is saved on this phone.</Type>
      </> : app.account ? confirmSignOut ? <>
        <Type role="heading">Sign out?</Type>
        <Type role="secondary">This phone returns to its own practice without an account. Your account’s practice stays saved and comes back when you sign in again.</Type>
        <Action quiet disabled={app.busy} onPress={() => setConfirmSignOut(false)}>Stay signed in</Action>
        <Action disabled={app.busy || !between} onPress={signOut}>{app.busy ? 'Signing out…' : 'Sign out'}</Action>
      </> : <>
        <Type role="secondary">Signed in with Google</Type>
        <Type role="heading">{app.account.email ?? 'Google account'}</Type>
        <Type role="secondary">Your practice in this account is saved on this phone.</Type>
        <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line }}>
          <Action quiet disabled={app.busy || !between} onPress={() => setConfirmSignOut(true)}>Sign out</Action>
        </View>
      </> : <>
        <Type role="heading">Keep your practice safe</Type>
        <Type role="secondary">Optional. Sign in with Google to keep your meditation history, levels and forest if you change or lose your phone. Ona works fully without an account.</Type>
        <View style={{ marginTop: 16 }}>
          <Action disabled={app.busy || !between} onPress={signIn}>{app.busy ? 'Opening…' : 'Continue with Google'}</Action>
        </View>
      </>}
      {!between && <Type role="secondary">Finish your current practice and return Home first.</Type>}
      <Notice>{app.error ? 'Something went wrong. Please try again.' : message}</Notice>
    </View>
  </Screen>;
}
