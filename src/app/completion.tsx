import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentContext, useOna } from '@/application/ona-provider';
import { coastalComposition, CoastalScene } from '@/ui/coastal-scene';
import { getForestStage } from '@/domain/forest/growth';
import { CompletionContent } from '@/ui/completion-content';
import { StreakCelebration } from '@/ui/streak-celebration';
import { Action, Notice, Type } from '@/ui/primitives';
import type { PracticeCompletion } from '@/data';
import { streakMoment, type LifetimeJourney, type MeditationSession, type ProgressSnapshot, type StreakMoment } from '@/domain/progression';

export default function CompletionScreen() {
  const app = useOna(), completion = app.completion;
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = coastalComposition(width, height, fontScale, insets.bottom);
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(height);
  // Presentation-only departure snapshot: successful acknowledgement must not flash "Saving".
  const [departing, setDeparting] = useState<{
    completion: PracticeCompletion; journey: LifetimeJourney; snapshot: ProgressSnapshot;
  } | null>(null);
  const displayed = useMemo(() => departing ?? (completion && app.journey && app.snapshot
    ? { completion, journey: app.journey, snapshot: app.snapshot } : null), [departing, completion, app.journey, app.snapshot]);
  const busy = app.busy, dismissCompletion = app.dismissCompletion, history = app.history;
  const returning = useRef(false);
  const scroll = useRef<ScrollView>(null);
  // After "Well done", a calendar moment celebrates what this practice added (a day in a row, a
  // consistent week, a full month). Display only: it reads saved history and changes nothing.
  const [rhythm, setRhythm] = useState<{ id: string; moment: StreakMoment; sessions: MeditationSession[] } | null>(null);
  const [stage, setStage] = useState<'reward' | 'rhythm'>('reward');
  const practice = completion?.session ?? null;
  useEffect(() => {
    if (!practice) return;
    let disposed = false;
    void (async () => {
      const sessions: MeditationSession[] = [];
      for (;;) {
        const page = await history(sessions.length);
        if (disposed) return;
        sessions.push(...page.map((record) => record.session));
        if (page.length < 50) break;
      }
      if (!sessions.some((session) => session.id === practice.id)) sessions.push(practice);
      const moment = streakMoment(sessions, practice, currentContext().localDate);
      if (!disposed && moment) setRhythm({ id: practice.id, moment, sessions });
    })().catch(() => { /* Without history the celebration is simply skipped. */ });
    return () => { disposed = true; };
  }, [practice, history]);
  const continueHome = useCallback(() => {
    if (!displayed || returning.current || busy) return;
    returning.current = true;
    setDeparting(displayed);
    void dismissCompletion().then(saved => {
      if (saved) router.dismissTo('/');
      else { returning.current = false; setDeparting(null); }
    });
  }, [displayed, busy, dismissCompletion]);
  const next = useCallback(() => {
    if (stage === 'reward' && rhythm && practice && rhythm.id === practice.id && !busy) {
      setStage('rhythm');
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else continueHome();
  }, [stage, rhythm, practice, busy, continueHome]);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    if (!focused) return;
    // Back cannot expose the already-finished timer or replay a pending completion.
    const back = BackHandler.addEventListener('hardwareBackPress', () => { continueHome(); return true; });
    return () => back.remove();
  }, [focused, continueHome]);
  useEffect(() => {
    if (!focused || completion || app.busy || departing) return;
    if (!app.draft) router.dismissTo('/');
    else if (app.draft.phase !== 'finished') router.replace('/session');
  }, [focused, completion, app.draft, app.busy, departing]);
  return <View style={{ flex: 1, backgroundColor: '#F4EBDD' }}>
    <ScrollView ref={scroll} onContentSizeChange={(_, measuredHeight) => setContentHeight(Math.max(height, measuredHeight))}
      contentContainerStyle={{ minHeight: height, width: c.canvasWidth, alignSelf: 'center',
      paddingTop: Math.max(insets.top + 183 * c.scale, 232 * c.scale),
      paddingHorizontal: 18 * c.scale, paddingBottom: Math.max(insets.bottom + 14, 24 * c.scale) }} bounces={false}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: c.canvasWidth, height: contentHeight }}>
        <CoastalScene composition={{ ...c, contentHeight }} completion stageId={getForestStage({ highestLevel: app.habit?.highestLevel ?? 0,
          currentLevel: app.journey?.level.number ?? 0 }).id} />
      </View>
      {stage === 'rhythm' && rhythm ? <StreakCelebration key={rhythm.id} moment={rhythm.moment} sessions={rhythm.sessions} scale={c.scale}
        busy={app.busy || departing !== null} onContinue={continueHome} />
      : displayed ? <CompletionContent key={displayed.completion.session.id}
        completion={displayed.completion} journey={displayed.journey} snapshot={displayed.snapshot} scale={c.scale}
        busy={app.busy || departing !== null} error={app.error} active={focused && departing === null} onContinue={next} /> : <View style={{ alignItems: 'center', paddingVertical: 64, gap: 16 }}>
        <Type role="heading" style={{ textAlign: 'center' }}>{app.error ? 'Your practice is ready to save' : 'Saving your practice…'}</Type>
        <Notice>{app.error ? 'Your finished practice has not been confirmed saved. Please retry.' : null}</Notice>
        {app.error && <Action disabled={app.busy} onPress={() => { void app.retrySave(); }}>Retry save</Action>}
      </View>}
    </ScrollView>
  </View>;
}
