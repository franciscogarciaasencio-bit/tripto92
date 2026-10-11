import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { ConsistencyProgress, LevelProgress } from '@/ui/level-progress';
import { Action, Notice, Screen, styles, Type } from '@/ui/primitives';
export default function Home() {
  const app = useOna();
  useFocusEffect(useCallback(() => {
    if (app.draft) router.replace(app.draft.phase === 'finished' ? '/completion' : '/session');
    else if (app.completion) router.replace('/completion');
  }, [app.draft, app.completion]));
  return <Screen>
    <View style={{ alignItems: 'flex-end', marginRight: -12 }}><Action quiet textRole="label" onPress={() => router.push('/preferences')}>Preferences</Action></View>
    <View style={[styles.center, { flex: 1, minHeight: 240 }]}>
      <Action disabled={app.busy} onPress={() => { void app.begin(); }}>
        {app.busy ? 'Beginning…' : 'Meditate'}
      </Action>
      <Notice>{app.error ? 'Practice could not start. Please try again.' : null}</Notice>
    </View>
    <View style={[styles.footer, { minHeight: 128 }]}>{app.journey && app.snapshot && <>
      <Pressable accessibilityRole="button" accessibilityLabel="View Journey"
        onPress={() => router.push('/practice')} style={{ alignItems: 'center', width: '100%', gap: 16, paddingVertical: 16, minHeight: 64 }}>
        <LevelProgress journey={app.journey} compact />
        <ConsistencyProgress snapshot={app.snapshot} />
        <Type role="secondary">Journey</Type>
      </Pressable>
      {app.hasHistory && <Action quiet onPress={() => router.push('/history')}>{`History · ${app.completedPractices} ${app.completedPractices === 1 ? 'practice' : 'practices'}`}</Action>}
    </>}</View>
  </Screen>;
}
