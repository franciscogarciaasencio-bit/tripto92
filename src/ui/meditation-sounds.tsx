import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { AudioPreferences } from '@/data';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { AMBIENCES } from '@/audio/assets';
import type { Bell } from '@/audio/session-controller';
import { Action, ChoiceRow, colors, Type } from './primitives';
import { VolumeControl } from './session-sound';
import { QuietPressable } from './quiet-pressable';

export function MeditationSounds({ preferences: prefs, onChange }: { preferences: AudioPreferences; onChange: (next: AudioPreferences) => void }) {
  const audio = useOnaAudio(), app = useOna();
  const stopPreview = audio.stopPreview;
  // A screen owns its previews, never the meditation/end-bell player.
  useFocusEffect(useCallback(() => () => stopPreview(), [stopPreview]));
  const canPreview = app.draft?.phase !== 'running';
  const bellPreview = (sound: Bell, name: string) => <Action quiet disabled={!canPreview || prefs.bellVolume === 0}
    label={audio.previewing === sound ? `Stop ${name} preview` : `Preview ${name}`} onPress={() => audio.preview(sound,prefs.bellVolume)}>{audio.previewing === sound ? 'Stop preview' : `Preview ${name}`}</Action>;
  return <View style={{ gap: 14, marginTop: 28 }}>
    <Type role="heading">Meditation Sounds</Type>
    <Type role="secondary">A quiet companion to your practice.</Type>
    <Type role="label" style={{ marginTop: 12 }}>Meditation ambience</Type>
    {AMBIENCES.map(sound => <View key={sound.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
      borderColor: colors.line, paddingVertical: 6, gap: 8 }}>
      <QuietPressable accessibilityRole="radio" accessibilityLabel={sound.name} accessibilityState={{ checked: prefs.sessionSound === sound.id }} aria-checked={prefs.sessionSound === sound.id}
        onPress={() => { audio.stopPreview(); onChange({ ...prefs,sessionSound: sound.id }); }}
        style={{ flex: 1, minHeight: 64, justifyContent: 'center' }}>
        <Type role={prefs.sessionSound === sound.id ? 'label' : 'body'}>{`${prefs.sessionSound === sound.id ? '✓  ' : ''}${sound.name}`}</Type>
        <Type role="secondary" style={{ fontSize: 13, lineHeight: 18 }}>{sound.description}</Type>
      </QuietPressable>
      {sound.id !== 'silence' && <Action quiet disabled={!canPreview || prefs.sessionVolume === 0} label={audio.previewing === sound.id ? `Stop ${sound.name} preview` : `Preview ${sound.name}`}
        onPress={() => audio.preview(sound.id as Exclude<AudioPreferences['sessionSound'],'silence'>,prefs.sessionVolume)}>
        {audio.previewing === sound.id ? 'Stop' : 'Preview'}
      </Action>}
    </View>)}
    <Type role="secondary">Ambience volume</Type>
    <VolumeControl value={prefs.sessionVolume} label="Ambience volume" onChange={sessionVolume => {
      onChange({ ...prefs,sessionVolume }); if (audio.previewing && AMBIENCES.some(sound => sound.id === audio.previewing)) audio.previewVolume(sessionVolume);
    }} />
    <Type role="label" style={{ marginTop: 16 }}>Meditation bells</Type>
    <ChoiceRow label="Starting bell" value={prefs.openingBellEnabled ? 'On' : 'Off'} onPress={() => onChange({ ...prefs,openingBellEnabled: !prefs.openingBellEnabled })} />
    {bellPreview('start','starting bell')}
    <ChoiceRow label="Ending bell" value={prefs.closingBellEnabled ? 'On' : 'Off'} onPress={() => onChange({ ...prefs,closingBellEnabled: !prefs.closingBellEnabled })} />
    {bellPreview('end','ending bell')}
    <Type>Interval bell</Type>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      {([null,300,600,900] as const).map(seconds => <QuietPressable key={seconds ?? 'off'} accessibilityRole="radio"
        accessibilityLabel={seconds === null ? 'Interval bell off' : `Interval bell every ${seconds/60} minutes`}
        accessibilityState={{ checked: prefs.intervalSeconds === seconds }} aria-checked={prefs.intervalSeconds === seconds} onPress={() => onChange({ ...prefs,intervalSeconds: seconds })}
        style={{ minWidth: 64, minHeight: 48, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
          borderBottomWidth: prefs.intervalSeconds === seconds ? 1 : 0, borderColor: colors.ink }}>
        <Type role="secondary">{seconds === null ? 'Off' : `${seconds/60} min`}</Type>
      </QuietPressable>)}
    </View>
    <Type role="secondary">Intervals follow meditation time. Pauses don’t count.</Type>
    {bellPreview('interval','interval bell')}
    <Type role="secondary">Bell volume</Type>
    <VolumeControl value={prefs.bellVolume} label="Bell volume" onChange={bellVolume => {
      onChange({ ...prefs,bellVolume }); if (audio.previewing && ['start','end','interval'].includes(audio.previewing)) audio.previewVolume(bellVolume);
    }} />
    <ChoiceRow label="Gentle haptics" value={prefs.hapticsEnabled ? 'On' : 'Off'} onPress={() => onChange({ ...prefs,hapticsEnabled: !prefs.hapticsEnabled })} />
    <Type role="secondary">A soft touch when you begin, pause, resume or finish. Optional, and separate from sound.</Type>
    {audio.notice && <Type role="secondary" accessibilityRole="alert">Sound could not play. Try a preview again.</Type>}
  </View>;
}
