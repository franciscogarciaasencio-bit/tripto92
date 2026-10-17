import { StyleSheet, View } from 'react-native';
import type { AudioPreferences } from '@/data';
import { Type } from './primitives';
import { VolumeControl } from './session-sound';

/**
 * Settings owns only what lives nowhere else: how loud the bells ring. The bells always ring, the
 * interval is chosen before each practice, and there is nothing to audition here (owner, 2026-10-17:
 * "There's no reason why someone would like to just listen to the bells").
 */
export function BellSettings({ preferences: prefs, onChange }: { preferences: AudioPreferences; onChange: (next: AudioPreferences) => void }) {
  return <View>
    <Type role="heading" style={styles.heading}>Bells</Type>
    <Type style={styles.volumeLabel}>Bell volume</Type>
    <VolumeControl value={prefs.bellVolume} label="Bell volume" onChange={(bellVolume) => onChange({ ...prefs, bellVolume })} />
  </View>;
}

const styles = StyleSheet.create({
  heading: { marginBottom: 4 },
  volumeLabel: { marginTop: 14 },
});
