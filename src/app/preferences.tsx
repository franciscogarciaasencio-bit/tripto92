import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { DEFAULT_PREFERENCES } from '@/data';
import { DurationPicker } from '@/ui/duration-picker';
import { Action, ChoiceRow, Header, Notice, Screen, styles, Type } from '@/ui/primitives';
export default function Preferences() {
  const app = useOna();
  const [edited, setEdited] = useState(app.preferences ?? DEFAULT_PREFERENCES);
  return <Screen>
    <Header title="Preferences" back={() => router.dismissTo('/')} />
    <Type role="secondary" style={{ marginTop: 32, marginBottom: 24 }}>Default duration</Type>
    <DurationPicker seconds={edited.defaultDurationSeconds} onChange={(defaultDurationSeconds) => setEdited({ ...edited, defaultDurationSeconds })} />
    <View style={{ marginTop: 32 }}><ChoiceRow label="Ambience" value={edited.ambientSoundId ?? 'None'} />
      <ChoiceRow label="Gong" value={edited.gongIntervalSeconds ? `${edited.gongIntervalSeconds / 60} min` : 'None'} />
      <ChoiceRow label="Ambience volume" value={`${Math.round(edited.ambienceVolume * 100)}%`} /><ChoiceRow label="Gong volume" value={`${Math.round(edited.gongVolume * 100)}%`} /></View>
    <Type role="secondary" style={{ marginTop: 20 }}>Applies to your next session. Audio is not available in this version.</Type>
    <Notice>{app.error ? 'Preferences could not be saved. Your edits are kept here.' : null}</Notice>
    <View style={[styles.footer, { flex: 1, justifyContent: 'flex-end' }]}><Action disabled={app.busy} onPress={() => {
      void app.savePreferences(edited).then((saved) => { if (saved) router.dismissTo('/'); });
    }}>{app.busy ? 'Saving…' : app.error ? 'Retry save' : 'Done'}</Action></View>
  </Screen>;
}
