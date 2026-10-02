import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { getLevelProgress } from '@/domain/progression';
import { LevelProgress } from '@/ui/level-progress';
import { Action, Notice, Screen, styles, Type } from '@/ui/primitives';
export default function Home() {
  const app = useOna();
  useFocusEffect(useCallback(() => {
    if (app.draft) router.replace(app.draft.phase === 'finished' ? '/completion' : '/session');
    else if (app.completion) router.replace('/completion');
  }, [app.draft, app.completion]));
  const level = getLevelProgress(app.snapshot?.currentProgressionCenti ?? 0).level.number;
  return <Screen>
    <View style={{ alignItems: 'flex-end', marginRight: -12 }}><Action quiet textRole="label" onPress={() => router.push('/preferences')}>Preferences</Action></View>
    <View style={[styles.center, { flex: 1, minHeight: 240 }]}>
      <Action disabled={app.busy} onPress={() => { void app.begin(); }}>
        {app.busy ? 'Beginning…' : 'Meditate'}
      </Action>
      <Notice>{app.error ? 'Practice could not start. Please try again.' : null}</Notice>
    </View>
    <View style={[styles.footer, { minHeight: 128 }]}>{app.hasHistory && <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${app.completedPractices} practices. Level ${level}. View progression`}
        onPress={() => router.push('/practice')} style={{ alignItems: 'center', width: '100%', gap: 16, paddingVertical: 16, minHeight: 64 }}>
        <Type role="secondary">{`${app.completedPractices} ${app.completedPractices === 1 ? 'practice' : 'practices'} · Level ${level}`}</Type>
        <LevelProgress progressionCenti={app.snapshot?.currentProgressionCenti ?? 0} compact />
      </Pressable>
      <Action quiet onPress={() => router.push('/history')}>History</Action>
    </>}</View>
  </Screen>;
}
