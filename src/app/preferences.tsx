import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { DEFAULT_AUDIO_PREFERENCES } from '@/data';
import { HomeNavigation } from '@/ui/home-navigation';
import { Action, ChoiceRow, colors, Header, Notice, Screen, Type } from '@/ui/primitives';
import { VolumeControl } from '@/ui/session-sound';
import { MeditationSounds } from '@/ui/meditation-sounds';

export default function Preferences() {
  const app = useOna();
  const [edited, setEdited] = useState(app.audioPreferences ?? DEFAULT_AUDIO_PREFERENCES);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [lastAction, setLastAction] = useState<'preferences' | 'reset'>('preferences');
  const canReset = !app.busy && !app.draft && !app.completion;
  const unsaved = Object.entries(edited).some(([key, value]) => app.audioPreferences?.[key as keyof typeof edited] !== value);
  const back = useCallback(() => {
    if (app.busy) return;
    if (confirmReset) setConfirmReset(false);
    else router.dismissTo('/');
  }, [app.busy, confirmReset]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  }, [back]));
  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <Header title="Preferences" back={back} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
    {!confirmReset && <View pointerEvents={app.busy ? 'none' : 'auto'} style={{ marginTop: 24 }}>
      <ChoiceRow label="Home ambience" value={edited.homeEnabled ? 'On' : 'Off'} onPress={() => setEdited({ ...edited, homeEnabled: !edited.homeEnabled })} />
      <ChoiceRow label="Home volume" value={`${Math.round(edited.homeVolume * 100)}%`} divider={false} />
      <VolumeControl value={edited.homeVolume} onChange={(homeVolume) => setEdited({ ...edited, homeVolume })} />
      <MeditationSounds preferences={edited} onChange={setEdited} />
      <Action quiet textRole="label" onPress={() => router.push('/credits')}>About Ona sound</Action>
    </View>}
    <View style={{ marginTop: confirmReset ? 40 : 32, gap: 12, paddingTop: confirmReset ? 0 : 24, borderTopWidth: confirmReset ? 0 : 1, borderTopColor: colors.line }}>
      {confirmReset ? <>
        <Type role="heading">Delete all practice data?</Type>
        <Type role="secondary">This permanently deletes every meditation, your history, calendar activity, Ripples and achievements. You will return to Level 0 · Monkey Mind. Your app and sound preferences stay. This cannot be undone.</Type>
        <Action quiet disabled={app.busy} onPress={() => setConfirmReset(false)}>Keep my practice data</Action>
        <Action disabled={!canReset} onPress={() => {
          setLastAction('reset');
          void app.resetAllPracticeData().then((saved) => {
            if (saved) { setConfirmReset(false); setResetComplete(true); }
          });
        }}>{app.busy ? 'Deleting…' : 'Delete all practice data'}</Action>
      </> : <>
        <Action quiet disabled={!canReset} onPress={() => { setResetComplete(false); setConfirmReset(true); }}>Reset All Practice Data</Action>
        {!canReset && !app.busy && <Type role="secondary">Finish or discard your current practice and return Home before restarting your journey.</Type>}
        {resetComplete && <Type role="secondary">All practice data deleted. Level 0 · Monkey Mind.</Type>}
      </>}
    </View>
    <Notice>{app.error ? lastAction === 'reset' ? 'Practice data could not be deleted. Please try again.' : 'Preferences could not be saved. Please try again.' : null}</Notice>
    </ScrollView>
    {!confirmReset && <View style={{ gap: 4, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.line }}>
      {unsaved && <Type role="secondary" accessibilityLiveRegion="polite" style={{ fontSize: 12, textAlign: 'center' }}>Unsaved sound changes</Type>}
      <Action disabled={app.busy} onPress={() => {
      setLastAction('preferences');
      void app.saveAudioPreferences(edited).then((saved) => { if (saved) router.dismissTo('/'); });
    }}>{app.busy ? 'Saving…' : app.error ? 'Retry save' : unsaved ? 'Save changes' : 'Done'}</Action></View>}
  </Screen><HomeNavigation active="settings" /></View>;
}
