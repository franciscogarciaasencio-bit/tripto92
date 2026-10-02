import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Action, Screen, styles } from '@/ui/primitives';
export default function Home() {
  const app = useOna();
  useFocusEffect(useCallback(() => {
    if (app.draft) router.replace(app.draft.phase === 'finished' ? '/completion' : '/session');
    else if (app.completion) router.replace('/completion');
  }, [app.draft, app.completion]));
  return <Screen>
    <View style={{ alignItems: 'flex-end', marginRight: -12 }}><Action quiet textRole="label" onPress={() => router.push('/preferences')}>Preferences</Action></View>
    <View style={[styles.center, { flex: 1, minHeight: 240 }]}><Action onPress={() => router.push('/setup')}>Meditate</Action></View>
    <View style={[styles.footer, { minHeight: 128 }]}>{app.hasHistory && <>
      <Action quiet onPress={() => router.push('/practice')}>{`Practice · ${app.snapshot?.currentRank.name ?? ''}`}</Action>
      <Action quiet onPress={() => router.push('/history')}>History</Action>
    </>}</View>
  </Screen>;
}
