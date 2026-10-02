import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { DurationPicker } from '@/ui/duration-picker';
import { Action, ChoiceRow, Header, Notice, Screen, styles, Type } from '@/ui/primitives';
export default function Setup() {
  const app = useOna();
  const [seconds, setSeconds] = useState(Math.max(60, Math.min(10_800, app.preferences?.defaultDurationSeconds ?? 600)));
  const [expanded, setExpanded] = useState(false);
  return <Screen>
    <Header title="Meditation" back={() => router.dismissTo('/')} />
    <View style={[styles.center, { paddingTop: 48, paddingBottom: 24 }]}><DurationPicker seconds={seconds} onChange={setSeconds} /></View>
    <ChoiceRow divider={false} label="Sound & gong" value={expanded ? 'Close' : 'None · None'} onPress={() => setExpanded(!expanded)} />
    {expanded && <><ChoiceRow label="Ambience" value="None" /><ChoiceRow label="Gong" value="None" />
      <Type role="secondary" style={{ marginTop: 16 }}>This version is silent. Your sound preferences are kept for the future audio flow.</Type></>}
    <Notice>{app.error ? 'Meditation could not start. Please try again.' : null}</Notice>
    <View style={[styles.footer, { flex: 1, justifyContent: 'flex-end', paddingTop: 40, paddingBottom: 50 }]}><Action disabled={app.busy} onPress={() => {
      void app.begin(seconds).then((saved) => { if (saved) router.replace('/session'); });
    }}>{app.busy ? 'Beginning…' : 'Begin'}</Action></View>
  </Screen>;
}
