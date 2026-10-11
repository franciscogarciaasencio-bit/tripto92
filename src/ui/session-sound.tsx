import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { Action, Type } from './primitives';

export function VolumeControl({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const change = (direction: number) => onChange(Math.min(1, Math.max(0, Math.round((value + direction * 0.05) * 100) / 100)));
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <Action quiet label="Decrease volume" disabled={disabled || value === 0} onPress={() => change(-1)}>Less</Action>
    <Type role="secondary" accessibilityLabel={`Volume ${Math.round(value * 100)} percent`}>{`${Math.round(value * 100)}%`}</Type>
    <Action quiet label="Increase volume" disabled={disabled || value === 1} onPress={() => change(1)}>More</Action>
  </View>;
}
export function SessionSound() {
  const app = useOna();
  const audio = useOnaAudio();
  const [expanded, setExpanded] = useState(false);
  const prefs = app.audioPreferences;
  if (!prefs) return null;
  return <View style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
    <Action quiet label="Meditation sound settings" onPress={() => setExpanded(!expanded)}>{`Sound · ${prefs.sessionSound === 'silence' ? 'Silence' : 'Ocean music'}`}</Action>
    {expanded && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Action quiet disabled={app.busy || prefs.sessionSound === 'ocean_music'} onPress={() => { void app.saveAudioPreferences({ ...prefs, sessionSound: 'ocean_music' }); }}>Ocean music</Action>
        <Action quiet disabled={app.busy || prefs.sessionSound === 'silence'} onPress={() => { void app.saveAudioPreferences({ ...prefs, sessionSound: 'silence' }); }}>Silence</Action>
      </View>
      <VolumeControl value={prefs.sessionVolume} disabled={app.busy} onChange={(sessionVolume) => { void app.saveAudioPreferences({ ...prefs, sessionVolume }); }} />
    </>}
    {audio.notice && prefs.sessionSound !== 'silence' && app.draft?.phase === 'running' &&
      <Action quiet onPress={audio.retry}>{audio.notice === 'interrupted' ? 'Resume sound' : 'Play sound'}</Action>}
  </View>;
}
