import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, View, useWindowDimensions } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { activeElapsedSeconds } from '@/domain/meditation/timer';
import { Action, formatTime, Notice, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
import { useForeground } from '@/ui/use-foreground';
export default function Session() {
  const app = useOna();
  const { height } = useWindowDimensions();
  const foreground = useForeground();
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [timeHidden, setTimeHidden] = useState(false);
  useEffect(() => {
    if (app.draft?.phase !== 'running' || !foreground) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [app.draft?.phase, foreground]);
  useFocusEffect(useCallback(() => {
    if (app.completion || app.draft?.phase === 'finished') router.replace('/completion');
    else if (!app.draft && !app.busy) router.replace('/');
  }, [app.draft, app.completion, app.busy]));
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!app.busy && app.draft?.phase === 'running') void app.pause();
      return true;
    });
    return () => listener.remove();
  }, [app]));
  if (!app.draft) return <Screen />;
  const draft = app.draft;
  const elapsed = activeElapsedSeconds(draft, Math.max(now, draft.changedAt));
  const paused = draft.phase === 'paused';
  return <Screen>
    <View style={[styles.center, { flex: 1, minHeight: height * .48, paddingVertical: 32 }]}>
      {confirming ? <><Type role="heading" style={{ textAlign: 'center' }}>Discard this practice?</Type>
        <Type role="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>This practice will not be saved or earn XP.</Type></> : <>
        <Pressable accessibilityRole="button" accessibilityLabel={timeHidden ? 'Show elapsed meditation time' : 'Hide elapsed meditation time'}
          accessibilityValue={{ text: timeHidden ? 'Time hidden' : `${formatTime(elapsed)} active meditation time` }}
          accessibilityHint="Meditation continues while the time is hidden" onPress={() => setTimeHidden(!timeHidden)}
          style={{ alignItems: 'center', minHeight: 100, justifyContent: 'center', minWidth: 184 }}>
          <Type role={timeHidden ? 'secondary' : 'timer'}>{timeHidden ? 'Show time' : formatTime(elapsed).padStart(5, '0')}</Type>
          {!timeHidden && <Type role="secondary">elapsed</Type>}
        </Pressable>
        <Type role={paused ? 'body' : 'secondary'}>{paused ? 'Paused' : 'Meditating'}</Type>
        {app.journey && <Wave level={app.journey.level.number} moving={!paused && draft.phase === 'running'} />}
      </>}
    </View>
    <Notice>{app.error ? 'Your practice could not be updated. Please try again.' : null}</Notice>
    <View style={[styles.footer, { paddingBottom: 16 }]}>{confirming ? <>
      <Action disabled={app.busy} onPress={() => setConfirming(false)}>Keep practice</Action>
      <Action quiet disabled={app.busy} onPress={() => { void app.discard().then((saved) => { if (saved) router.dismissTo('/'); }); }}>Discard practice</Action>
    </> : <>
      <Action disabled={app.busy} onPress={() => { void (paused ? app.resume() : app.pause()); }}>{paused ? 'Resume' : 'Pause'}</Action>
      <Action quiet textRole="label" disabled={app.busy} onPress={() => { void app.end(); }}>Finish</Action>
      {paused && <Action quiet disabled={app.busy} onPress={() => setConfirming(true)}>Discard practice</Action>}
    </>}</View>
  </Screen>;
}
