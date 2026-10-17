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

/**
 * Settings owns only what lives nowhere else: bell volume, with a way to hear each bell (ambience and
 * the interval are chosen before each practice). The interval bell is the starting bell.
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
  // The bells always ring (owner, 2026-10-17): no switches, only a way to hear each one.
  const row = (label: string, sound: Bell) => <View style={styles.row}>
    <Type style={{ flex: 1 }}>{label}</Type>
    {play(sound, label.toLowerCase())}
  </View>;
  return <View>
    <Type role="heading" style={styles.heading}>Bells</Type>
    {row('Starting and interval bell', 'start')}
    {row('Ending bell', 'end')}
    <Type style={styles.volumeLabel}>Bell volume</Type>
    <VolumeControl value={prefs.bellVolume} label="Bell volume" onChange={(bellVolume) => {
      onChange({ ...prefs, bellVolume }); if (audio.previewing && (audio.previewing === 'start' || audio.previewing === 'end')) audio.previewVolume(bellVolume);
    }} />
    {audio.notice && <Type role="secondary" accessibilityRole="alert">Sound could not play. Try a preview again.</Type>}
  </View>;
}

const styles = StyleSheet.create({
  heading: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, borderBottomWidth: 1, borderColor: colors.line, gap: 4 },
  play: { width: 48, height: 48, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  playDisc: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingLeft: 1 },
  volumeLabel: { marginTop: 18 },
});
