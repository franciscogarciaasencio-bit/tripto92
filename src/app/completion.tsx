import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { getLevelProgress } from '@/domain/progression';
import { PracticeCount } from '@/ui/practice-count';
import { LevelProgress } from '@/ui/level-progress';
import { Action, formatDuration, Notice, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
export default function CompletionScreen() {
  const app = useOna();
  const completion = app.completion;
  useEffect(() => {
    if (completion || app.busy) return;
    if (!app.draft) router.dismissTo('/');
    else if (app.draft.phase !== 'finished') router.replace('/session');
  }, [completion, app.draft, app.busy]);
  const before = getLevelProgress(completion?.beforeProgressionCenti ?? 0).level.number;
  const after = getLevelProgress(completion?.afterProgressionCenti ?? 0).level.number;
  const current = getLevelProgress(app.snapshot?.currentProgressionCenti ?? 0);
  return <Screen>
    <View style={[styles.center, { flex: 1, minHeight: 380, paddingVertical: 32 }]}>
      {!completion ? <><Type role="heading" style={{ textAlign: 'center' }}>{app.error ? 'Your practice is ready to save' : 'Saving your practice…'}</Type>
        <Notice>{app.error ? 'Your finished practice has not been confirmed saved. Please retry.' : null}</Notice>
        {app.error && <Action disabled={app.busy} onPress={() => { void app.retrySave(); }}>Retry save</Action>}</> : <>
        <Type role="title" style={{ textAlign: 'center' }}>Well done.</Type>
        <Type style={{ textAlign: 'center' }}>You made time for yourself.</Type>
        <Type role="secondary" style={{ marginTop: 8 }}>{formatDuration(completion.session.activeDurationSeconds)}</Type>
        <PracticeCount key={completion.session.id} before={completion.previousCompletedPractices} after={completion.completedPractices} />
        <Type role="secondary">{`${(completion.awardedXpCenti / 100).toFixed(2)} XP earned`}</Type>
        <Wave rankId={current.level.stage.id} />
        <Type role="heading">{`Level ${current.level.number}`}</Type>
        {after > before && <Type role="secondary" accessibilityLiveRegion="polite">{`Level ${before} → Level ${after}`}</Type>}
        <LevelProgress progressionCenti={app.snapshot?.currentProgressionCenti ?? 0} />
      </>}
    </View>
    {completion && <View style={styles.footer}>
      <Notice>{app.error ? 'Your practice is saved. Returning Home could not be confirmed. Please retry.' : null}</Notice>
      <Action disabled={app.busy} onPress={() => { void app.dismissCompletion().then((saved) => { if (saved) router.dismissTo('/'); }); }}>
        {app.busy ? 'Returning…' : 'Home'}
      </Action>
    </View>}
  </Screen>;
}
