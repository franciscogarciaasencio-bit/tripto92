import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { DEFAULT_AUDIO_PREFERENCES } from '@/data';
import { Action, ChoiceRow, Header, Notice, Screen, styles, Type } from '@/ui/primitives';
import { VolumeControl } from '@/ui/session-sound';

export default function Preferences() {
  const app = useOna();
  const [edited, setEdited] = useState(app.audioPreferences ?? DEFAULT_AUDIO_PREFERENCES);
  return <Screen>
    <Header title="Preferences" back={() => router.dismissTo('/')} />
    <View style={{ marginTop: 24 }}>
      <ChoiceRow label="Home ambience" value={edited.homeEnabled ? 'On' : 'Off'} onPress={() => setEdited({ ...edited, homeEnabled: !edited.homeEnabled })} />
      <ChoiceRow label="Home volume" value={`${Math.round(edited.homeVolume * 100)}%`} divider={false} />
      <VolumeControl value={edited.homeVolume} onChange={(homeVolume) => setEdited({ ...edited, homeVolume })} />
      <ChoiceRow label="Meditation sound" value={edited.sessionSound === 'silence' ? 'Silence' : 'Ocean music'}
        onPress={() => setEdited({ ...edited, sessionSound: edited.sessionSound === 'silence' ? 'ocean_music' : 'silence' })} />
      <ChoiceRow label="Meditation volume" value={`${Math.round(edited.sessionVolume * 100)}%`} divider={false} />
      <VolumeControl value={edited.sessionVolume} onChange={(sessionVolume) => setEdited({ ...edited, sessionVolume })} />
      <ChoiceRow label="Opening bell" value="Unavailable" />
      <ChoiceRow label="Closing bell" value="Unavailable" />
      <Type role="secondary" style={{ paddingTop: 16 }}>Bell recordings have not been added yet.</Type>
      <Action quiet textRole="label" onPress={() => router.push('/credits')}>Sound credits</Action>
    </View>
    <Notice>{app.error ? 'Preferences could not be saved. Please try again.' : null}</Notice>
    <View style={[styles.footer, { flex: 1, justifyContent: 'flex-end' }]}><Action disabled={app.busy} onPress={() => {
      void app.saveAudioPreferences(edited).then((saved) => { if (saved) router.dismissTo('/'); });
    }}>{app.busy ? 'Saving…' : app.error ? 'Retry save' : 'Done'}</Action></View>
  </Screen>;
}
