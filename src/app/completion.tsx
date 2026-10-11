import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { JOURNEY_LEVELS, journeyLabel } from '@/domain/progression';
import { PracticeCount } from '@/ui/practice-count';
import { LevelProgress } from '@/ui/level-progress';
import { Action, formatDuration, Notice, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
const creditMessages = {
  ordinary: '+1 practice credit', double_day: 'Double-session day completed · +1 practice credit',
  already_capped: 'This date already has its 2 practice credits.',
  already_credited: 'This date already has a practice credit. A second needs a 6-hour gap.',
  too_short: 'Saved in history. Practice for 3 active minutes to earn credit.',
  not_completed: 'Saved in history. Practice credits require a completed session.',
};
export default function CompletionScreen() {
  const app = useOna();
  const completion = app.completion;
  useEffect(() => {
    if (completion || app.busy) return;
    if (!app.draft) router.dismissTo('/');
    else if (app.draft.phase !== 'finished') router.replace('/session');
  }, [completion, app.draft, app.busy]);
  const before = completion?.journey?.beforeLevel ?? null;
  const after = completion?.journey?.afterLevel ?? null;
  const current = app.journey;
  const categoryChanged = before !== null && after !== null && JOURNEY_LEVELS[before - 1].category.id !== JOURNEY_LEVELS[after - 1].category.id;
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
        <Type role="secondary" style={{ textAlign: 'center' }}>{completion.journey ? creditMessages[completion.journey.creditOutcome]
          : 'See Journey for your saved practice credits.'}</Type>
        <Wave level={current?.level.number} />
        {current && <><Type role="heading" style={{ textAlign: 'center' }}>{journeyLabel(current.level).replace(/(\d) of 5$/, '$1\u00a0of\u00a05')}</Type>
          {before !== null && after !== null && after > before && <Type role="secondary" accessibilityLiveRegion="polite">{`Level ${before} → Level ${after}`}</Type>}
          {categoryChanged && after !== null && <Type role="secondary">{`Welcome to ${JOURNEY_LEVELS[after - 1].category.name}.`}</Type>}
          {before !== null && after !== null && before < 100 && after >= 100 && <Type style={{ textAlign: 'center' }}>You’ve completed Ona’s habit-building journey. Keep practising to strengthen the habit you’ve built.</Type>}
          <LevelProgress journey={current} />
        </>}
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
