import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { DEFAULT_PREFERENCES } from '@/data';
import { Action, ChoiceRow, Header, Notice, Screen, styles, Type } from '@/ui/primitives';
const SOUNDS = [null, 'rain', 'wind', 'stream', 'forest', 'soft_noise'] as const;
const GONGS = [null, 300, 600, 900] as const;
function next<T>(values: readonly T[], current: T): T { return values[(values.indexOf(current) + 1) % values.length]; }
export default function Preferences() {
  const app = useOna();
  const [edited, setEdited] = useState(app.preferences ?? DEFAULT_PREFERENCES);
  return <Screen>
    <Header title="Preferences" back={() => router.dismissTo('/')} />
    <View style={{ marginTop: 32 }}><ChoiceRow label="Ambience" value={edited.ambientSoundId?.replace('_', ' ') ?? 'None'}
      onPress={() => setEdited({ ...edited, ambientSoundId: next<string | null>(SOUNDS, edited.ambientSoundId) })} />
      <ChoiceRow label="Gong interval" value={edited.gongIntervalSeconds ? `${edited.gongIntervalSeconds / 60} min` : 'None'}
        onPress={() => setEdited({ ...edited, gongIntervalSeconds: next<number | null>(GONGS, edited.gongIntervalSeconds) })} />
      {(['ambienceVolume', 'gongVolume'] as const).map((field) => <View key={field} style={{ paddingTop: 20 }}>
        <Type>{`${field === 'ambienceVolume' ? 'Ambience' : 'Gong'} volume · ${Math.round(edited[field] * 100)}%`}</Type>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Action quiet label={`Reduce ${field === 'ambienceVolume' ? 'ambience' : 'gong'} volume`} onPress={() => setEdited({ ...edited, [field]: Math.max(0, Math.round(edited[field] * 100 - 5) / 100) })}>Less</Action>
          <Action quiet label={`Increase ${field === 'ambienceVolume' ? 'ambience' : 'gong'} volume`} onPress={() => setEdited({ ...edited, [field]: Math.min(1, Math.round(edited[field] * 100 + 5) / 100) })}>More</Action>
        </View>
      </View>)}</View>
    <Type role="secondary" style={{ marginTop: 20 }}>These preferences are saved for future playback. Audio is not available in this version.</Type>
    <Notice>{app.error ? 'Preferences could not be saved. Your edits are kept here.' : null}</Notice>
    <View style={[styles.footer, { flex: 1, justifyContent: 'flex-end' }]}><Action disabled={app.busy} onPress={() => {
      void app.savePreferences(edited).then((saved) => { if (saved) router.dismissTo('/'); });
    }}>{app.busy ? 'Saving…' : app.error ? 'Retry save' : 'Done'}</Action></View>
  </Screen>;
}
