import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { describeSync } from '@/application/sync-status';
import { Action, colors, Header, Notice, Screen, Type } from './primitives';

type Confirm = 'sign-out' | 'delete' | 'remove' | null;

/** Optional Google account: a quiet place to keep practice safe across phones. */
export function AccountScreen() {
  const app = useOna();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<string | null>(null);
  const between = !app.draft && !app.completion;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);
  const back = useCallback(() => {
    if (app.busy) return;
    if (confirm) setConfirm(null);
    else router.back();
  }, [app.busy, confirm]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  }, [back]));

  const run = (work: () => Promise<boolean>, success: string | null = null) => {
    setMessage(null);
    void work().then((done) => { if (done) { setConfirm(null); setMessage(success); } });
  };
  const signIn = () => {
    setMessage(null);
    void app.signIn().then((signedIn) => { if (!signedIn && !app.error) setMessage('Sign-in was cancelled.'); });
  };
  const disabled = app.busy || !between;
  const practices = (count: number) => count === 1 ? '1 practice' : `${count} practices`;

  let body;
  if (!app.cloudAvailable) {
    body = <>
      <Type>Accounts are not available in this version of Ona.</Type>
      <Type role="secondary">Your practice is saved on this phone.</Type>
    </>;
  } else if (!app.account) {
    body = <>
      <Type role="heading">Keep your practice safe</Type>
      <Type role="secondary">Optional. Sign in with Google to keep your meditation history, levels and forest if you change or lose your phone. Ona works fully without an account.</Type>
      <View style={{ marginTop: 16 }}>
        <Action disabled={disabled} onPress={signIn}>{app.busy ? 'Opening…' : 'Continue with Google'}</Action>
      </View>
    </>;
  } else if (confirm === 'sign-out') {
    body = <>
      <Type role="heading">Sign out?</Type>
      <Type role="secondary">This phone returns to its own practice without an account. Your account’s practice stays saved and comes back when you sign in again.</Type>
      <Action quiet disabled={app.busy} onPress={() => setConfirm(null)}>Stay signed in</Action>
      <Action disabled={disabled} onPress={() => run(app.signOut)}>{app.busy ? 'Signing out…' : 'Sign out'}</Action>
    </>;
  } else if (confirm === 'delete') {
    body = <>
      <Type role="heading">Delete this account’s practice?</Type>
      <Type role="secondary">This permanently deletes the practice saved in your account and this phone’s copy of it, then signs out. Other phones signed in to this account keep their own copy until removed. This cannot be undone.</Type>
      <Action quiet disabled={app.busy} onPress={() => setConfirm(null)}>Keep my practice</Action>
      <Action disabled={disabled} onPress={() => run(app.deleteAccountData, 'This account’s practice was deleted.')}>{app.busy ? 'Deleting…' : 'Delete permanently'}</Action>
    </>;
  } else if (confirm === 'remove') {
    body = <>
      <Type role="heading">Remove this account from this phone?</Type>
      <Type role="secondary">This phone’s copy of the account’s practice is deleted and you are signed out. Nothing is changed in the account itself.</Type>
      <Action quiet disabled={app.busy} onPress={() => setConfirm(null)}>Keep it</Action>
      <Action disabled={disabled} onPress={() => run(app.removeAccountFromPhone)}>{app.busy ? 'Removing…' : 'Remove from this phone'}</Action>
    </>;
  } else {
    body = <>
      <Type role="secondary">Signed in with Google</Type>
      <Type role="heading">{app.account.email ?? 'Google account'}</Type>
      <Type role="secondary" accessibilityLiveRegion="polite">{describeSync(app.syncStatus, now)}</Type>
      {app.syncStatus.phase === 'replaced' ? <>
        <Action disabled={disabled} onPress={() => run(app.savePracticeAgain)}>Save this phone’s practice to the account</Action>
        <Action quiet disabled={disabled} onPress={() => setConfirm('remove')}>Remove this account from this phone</Action>
      </> : <Action quiet disabled={app.syncStatus.phase === 'syncing'} onPress={() => { void app.syncNow(); }}>Save now</Action>}
      {app.guestCopyOffer !== null && <View style={{ gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line }}>
        <Type role="heading">Bring your practice along?</Type>
        <Type role="secondary">{`This phone has ${practices(app.guestCopyOffer)} from before you signed in. Save them to your account too? They also stay on this phone without an account.`}</Type>
        <Action disabled={disabled} onPress={() => run(app.saveGuestPractice)}>Save to my account</Action>
        <Action quiet disabled={app.busy} onPress={app.declineGuestPractice}>Not now</Action>
      </View>}
      <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line }}>
        <Action quiet disabled={disabled} onPress={() => setConfirm('sign-out')}>Sign out</Action>
        <Action quiet disabled={disabled} onPress={() => setConfirm('delete')}>Delete this account’s practice</Action>
      </View>
    </>;
  }

  return <Screen><Header title="Account" back={back} />
    <View style={{ gap: 16, paddingTop: 32 }}>
      {body}
      {!between && app.cloudAvailable && <Type role="secondary">Finish your current practice and return Home first.</Type>}
      <Notice>{app.error ? 'Something went wrong. Please try again.' : message}</Notice>
    </View>
  </Screen>;
}
