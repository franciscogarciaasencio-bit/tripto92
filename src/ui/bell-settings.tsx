import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { AudioPreferences } from '@/data';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import type { Bell } from '@/audio/session-controller';
import { HomeIcon } from './home-icons';
import { colors, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { VolumeControl } from './session-sound';

const INTERVALS = [null, 300, 600, 900] as const;

/**
 * Settings owns only what lives nowhere else: the bells (ambience is chosen before each practice and
 * adjusted from the speaker during it). Each bell is one row: tap to switch, play to hear it.
 */
export function BellSettings({ preferences: prefs, onChange }: { preferences: AudioPreferences; onChange: (next: AudioPreferences) => void }) {
  const audio = useOnaAudio(), app = useOna();
  const stopPreview = audio.stopPreview;
  // A screen owns its previews, never the meditation/end-bell player.
  useFocusEffect(useCallback(() => () => stopPreview(), [stopPreview]));
  const canPreview = app.draft?.phase !== 'running' && prefs.bellVolume > 0;
  const play = (sound: Bell, name: string) => {
    const playing = audio.previewing === sound;
    return <QuietPressable accessibilityRole="button" accessibilityLabel={playing ? `Stop ${name} preview` : `Preview ${name}`}
      accessibilityState={{ disabled: !canPreview }} disabled={!canPreview} onPress={() => audio.preview(sound, prefs.bellVolume)} style={styles.play}>
      <View style={styles.playDisc}><HomeIcon name={playing ? 'pause' : 'play'} size={12} color={colors.ink} /></View>
    </QuietPressable>;
  };
  const toggle = (label: string, value: boolean, sound: Bell, change: () => void) => <View style={styles.row}>
    <QuietPressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} aria-checked={value}
      onPress={change} style={styles.toggle}>
      <Type style={{ flex: 1 }}>{label}</Type>
      <Type role="secondary">{value ? 'On' : 'Off'}</Type>
    </QuietPressable>
    {play(sound, label.toLowerCase())}
  </View>;
  return <View>
    <Type role="heading" style={styles.heading}>Bells</Type>
    {toggle('Starting bell', prefs.openingBellEnabled, 'start', () => onChange({ ...prefs, openingBellEnabled: !prefs.openingBellEnabled }))}
    {toggle('Ending bell', prefs.closingBellEnabled, 'end', () => onChange({ ...prefs, closingBellEnabled: !prefs.closingBellEnabled }))}
    <View style={[styles.row, { borderBottomWidth: 0 }]}>
      <Type style={{ flex: 1 }}>Interval bell</Type>
      {play('interval', 'interval bell')}
    </View>
    <View style={styles.intervals}>
      {INTERVALS.map((seconds) => <QuietPressable key={seconds ?? 'off'} accessibilityRole="radio"
        accessibilityLabel={seconds === null ? 'Interval bell off' : `Interval bell every ${seconds / 60} minutes`}
        accessibilityState={{ checked: prefs.intervalSeconds === seconds }} aria-checked={prefs.intervalSeconds === seconds}
        onPress={() => onChange({ ...prefs, intervalSeconds: seconds })}
        style={[styles.interval, prefs.intervalSeconds === seconds && styles.intervalChosen]}>
        <Type role={prefs.intervalSeconds === seconds ? 'label' : 'secondary'}>{seconds === null ? 'Off' : `${seconds / 60} min`}</Type>
      </QuietPressable>)}
    </View>
    <Type role="secondary" style={styles.note}>Intervals follow meditation time. Pauses don’t count.</Type>
    <Type style={styles.volumeLabel}>Bell volume</Type>
    <VolumeControl value={prefs.bellVolume} label="Bell volume" onChange={(bellVolume) => {
      onChange({ ...prefs, bellVolume }); if (audio.previewing && ['start', 'end', 'interval'].includes(audio.previewing)) audio.previewVolume(bellVolume);
    }} />
    {audio.notice && <Type role="secondary" accessibilityRole="alert">Sound could not play. Try a preview again.</Type>}
  </View>;
}

const styles = StyleSheet.create({
  heading: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, borderBottomWidth: 1, borderColor: colors.line, gap: 4 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  play: { width: 48, height: 48, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  playDisc: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingLeft: 1 },
  intervals: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -10 },
  interval: { minWidth: 64, minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: 'transparent' },
  intervalChosen: { borderColor: colors.ink },
  note: { fontSize: 13, lineHeight: 18, marginTop: 6, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line },
  volumeLabel: { marginTop: 18 },
});
