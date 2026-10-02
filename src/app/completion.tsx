import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Action, formatDuration, Notice, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
export default function CompletionScreen() {
  const app = useOna();
  const completion = app.completion;
  const rank = app.snapshot?.currentRank;
  const rankChanged = !!completion && !!rank && rank.thresholdCentiXp > completion.previousRank.thresholdCentiXp;
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const showRank = rankChanged && acknowledged !== completion?.session.id;
  const newRankName = rankChanged ? rank?.name : undefined;
  const sessionId = completion?.session.id;
  useEffect(() => {
    if (!newRankName || !sessionId) return;
    AccessibilityInfo.announceForAccessibility(`Your practice: ${newRankName}`);
    let timeout: ReturnType<typeof setTimeout>;
    let disposed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!disposed) timeout = setTimeout(() => setAcknowledged(sessionId), reduced ? 150 : 1700);
    });
    return () => { disposed = true; clearTimeout(timeout); };
  }, [newRankName, sessionId]);
  useEffect(() => {
    if (completion || app.busy) return;
    if (!app.draft) router.dismissTo('/');
    else if (app.draft.phase !== 'finished') router.replace('/session');
  }, [completion, app.draft, app.busy]);
  return <Screen>
    <View style={[styles.center, { flex: 1, minHeight: 360 }]}>
      {!completion ? <><Type role="heading" style={{ textAlign: 'center' }}>{app.error ? 'Your practice is ready to save' : 'Saving your practice…'}</Type>
        <Notice>{app.error ? 'Your completed session has not been saved. Please retry.' : null}</Notice>
        {app.error && <Action disabled={app.busy} onPress={() => { void app.retrySave(); }}>Retry save</Action>}</> : showRank && rank ? <>
        <Wave rankId={rank.id} previousId={completion.previousRank.id} animate />
        <Type role="heading" style={{ textAlign: 'center' }}>{rank.name}</Type><Type role="secondary" style={{ textAlign: 'center' }}>{rank.theme}</Type></> : <>
        <Type role="heading" style={{ textAlign: 'center' }}>{completion.session.status === 'completed' ? 'Practice complete' : 'Practice ended'}</Type>
        <Type>{formatDuration(completion.session.activeDurationSeconds)}</Type>
        {completion.session.status === 'ended_early' && <Type role="secondary">Saved to history</Type>}</>}
    </View>
    {completion && <View style={styles.footer}>
      <Action onPress={() => { app.dismissCompletion(); router.dismissTo('/'); }}>Home</Action>
      <Action quiet onPress={() => { app.dismissCompletion(); router.replace('/practice'); }}>View practice</Action>
    </View>}
  </Screen>;
}
