import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, useWindowDimensions } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { remainingSeconds } from '@/domain/meditation/timer';
import { Action, formatTime, Notice, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
export default function Session() {
  const app = useOna();
  const { height } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (app.draft?.phase !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [app.draft?.phase]);
  useEffect(() => {
    if (app.completion || app.draft?.phase === 'finished') router.replace('/completion');
    else if (!app.draft && !app.busy) router.replace('/');
  }, [app.draft, app.completion, app.busy]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!app.busy) { if (app.draft?.phase === 'running') void app.pause(); else setConfirming((value) => !value); }
      return true;
    });
    return () => listener.remove();
  }, [app]));
  if (!app.draft) return <Screen />;
  const draft = app.draft;
  const remaining = remainingSeconds(draft, Math.max(now, draft.changedAt));
  const paused = draft.phase === 'paused';
  return <Screen>
    <View style={[styles.center, { paddingTop: Math.min(200, height * .237), paddingBottom: 32 }]}>
      {confirming ? <><Type role="heading" style={{ textAlign: 'center' }}>End this session?</Type>
        <Type role="secondary" style={{ textAlign: 'center' }}>{`${formatTime(Math.floor(draft.activeMilliseconds / 1000))} active will be saved to history.`}</Type></> : <>
        <Type role="timer" accessibilityLabel={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}>{formatTime(remaining).padStart(5, '0')}</Type>
        <Type role={paused ? 'body' : 'secondary'}>{paused ? 'Paused' : 'remaining'}</Type>
        {app.snapshot && <Wave rankId={app.snapshot.currentRank.id} />}</>}
    </View>
    <Notice>{app.error ? 'Your session could not be updated. Please try again.' : null}</Notice>
    <View style={[styles.footer, { flex: 1, justifyContent: 'flex-end', paddingBottom: 16 }]}>{confirming ? <>
      <Action disabled={app.busy} onPress={() => { void app.resume().then((saved) => { if (saved) setConfirming(false); }); }}>Continue meditating</Action>
      <Action quiet disabled={app.busy} onPress={() => { void app.end(); }}>End session</Action>
      <Action quiet onPress={() => setConfirming(false)}>Back</Action></> : <>
      <Action disabled={app.busy} onPress={() => { void (paused ? app.resume() : app.pause()); }}>{paused ? 'Resume' : 'Pause'}</Action>
      {paused ? <Action quiet disabled={app.busy} onPress={() => setConfirming(true)}>End session</Action> : <View style={{ height: 56 }} />}</>}
    </View>
  </Screen>;
}
