import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { initializeDatabase, type MeditationStore, type MeditationPreferences, type PracticeCompletion, type AudioPreferences } from '@/data';
import { finishTimer, pauseTimer, practiceContext, resumeTimer, startOpenEndedTimer, timerSession, type TimerDraft } from '@/domain/meditation/timer';
import type { ProgressSnapshot, LifetimeJourney, HabitCheckpoint } from '@/domain/progression';
import { watchTimerDeadline } from './practice-lifecycle';

export function currentContext() {
  return practiceContext(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function useApplication() {
  const store = useRef<MeditationStore | null>(null);
  const timer = useRef<TimerDraft | null>(null);
  const locked = useRef(false);
  const needsReopen = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TimerDraft | null>(null);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [journey, setJourney] = useState<LifetimeJourney | null>(null);
  const [habit, setHabit] = useState<HabitCheckpoint | null>(null);
  const [explanationDismissed, setExplanationDismissed] = useState(false);
  const [preferences, setPreferences] = useState<MeditationPreferences | null>(null);
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferences | null>(null);
  const [completion, setCompletion] = useState<PracticeCompletion | null>(null);
  const [completedPractices, setCompletedPractices] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const [practiceRevision, setPracticeRevision] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [activation, setActivation] = useState(0);
  const refreshOnReturn = useRef(false);

  const acceptDraft = useCallback((next: TimerDraft | null) => {
    timer.current = next;
    setDraft(next);
  }, []);

  useEffect(() => {
    let disposed = false;
    let opened: MeditationStore | null = null;
    async function load() {
      try {
        opened = await initializeDatabase(currentContext());
        const savedPreferences = await opened.settings.loadPreferences();
        const savedAudioPreferences = await opened.settings.loadAudioPreferences();
        const history = await opened.meditations.getMeditationHistory({ limit: 1 });
        if (disposed) { await opened.close(); return; }
        store.current = opened;
        acceptDraft(opened.initialTimer);
        setSnapshot(opened.initialSnapshot);
        setJourney(opened.initialJourney);
        setHabit(opened.initialHabit);
        setExplanationDismissed(opened.initialExplanationDismissed);
        setPreferences(savedPreferences);
        setAudioPreferences(savedAudioPreferences);
        setHasHistory(history.length > 0);
        setCompletion(opened.initialCompletion);
        setCompletedPractices(opened.initialCompletedPractices);
        setReady(true);
      } catch (failure) {
        if (opened) await opened.close();
        if (!disposed) setError(String(failure));
      }
    }
    void load();
    return () => {
      disposed = true;
      const activeStore = store.current;
      store.current = null;
      if (activeStore) void activeStore.close();
      if (opened && opened !== activeStore) void opened.close();
    };
  }, [attempt, acceptDraft]);

  const operation = useCallback(async (work: (database: MeditationStore) => Promise<void>) => {
    if (locked.current || !store.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      if (needsReopen.current) {
        await store.current.close();
        store.current = await initializeDatabase(currentContext());
        const reopened = store.current;
        const savedPreferences = await reopened.settings.loadPreferences();
        const savedAudioPreferences = await reopened.settings.loadAudioPreferences();
        const savedHistory = await reopened.meditations.getMeditationHistory({ limit: 1 });
        acceptDraft(reopened.initialTimer);
        setSnapshot(reopened.initialSnapshot);
        setJourney(reopened.initialJourney);
        setHabit(reopened.initialHabit);
        setExplanationDismissed(reopened.initialExplanationDismissed);
        setCompletion(reopened.initialCompletion);
        setCompletedPractices(reopened.initialCompletedPractices);
        setHasHistory(savedHistory.length > 0);
        setPreferences(savedPreferences);
        setAudioPreferences(savedAudioPreferences);
        needsReopen.current = false;
        // The durable state resolves an uncertain commit. Do not execute a closure built from the old cursor.
        return false;
      }
      await work(store.current);
      return true;
    }
    catch (failure) { needsReopen.current = needsReopen.current || failure instanceof AggregateError; setError(String(failure)); return false; }
    finally { locked.current = false; setBusy(false); }
  }, [acceptDraft]);

  const complete = useCallback(async (finished: TimerDraft) => operation(async (database) => {
    acceptDraft(finished);
    // Save the exact payload first. A failed transaction or process death retains it for retry.
    await database.timer.save(finished);
    const session = timerSession(finished);
    const saved = await database.meditations.completePractice(session, Date.now());
    setSnapshot(saved.snapshot);
    setJourney(saved.journey);
    setHabit(saved.habit);
    setCompletion(saved.completion);
    setCompletedPractices(saved.completion.completedPractices);
    setHasHistory(true);
    acceptDraft(null);
  }), [operation, acceptDraft]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') return;
      refreshOnReturn.current = true;
      setActivation(value => value + 1);
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!ready || busy || !foreground) return;
    return watchTimerDeadline(draft, {
      now: Date.now,
      timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule(callback, milliseconds) { const task = setTimeout(callback, milliseconds); return () => clearTimeout(task); },
    }, finished => { void complete(finished); }, failure => setError(String(failure)));
  }, [ready, busy, foreground, activation, draft, complete]);

  useEffect(() => {
    // Foreground events during a save are deferred, not dropped by the operation lock.
    // A pending timer/summary owns recovery first; refresh after its durable resolution.
    if (!ready || busy || !foreground || draft || completion || !refreshOnReturn.current) return;
    refreshOnReturn.current = false;
    void operation(async (database) => {
      const progress = await database.meditations.getCurrentPracticeProgress(currentContext());
      setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
    });
  }, [ready, busy, foreground, activation, draft, completion, operation]);

  const history = useCallback((offset = 0) => {
    if (!store.current) return Promise.reject(new Error('Storage is not ready'));
    return store.current.meditations.getMeditationHistory({ limit: 50, offset });
  }, []);
  const practiceDetails = useCallback((id: string) => {
    if (!store.current) return Promise.reject(new Error('Storage is not ready'));
    return store.current.meditations.getPracticeDetails(id);
  }, []);
  useEffect(() => {
    if (!ready || draft || completion) return;
    const refresh = setInterval(() => {
      if (AppState.currentState !== 'active' || locked.current) return;
      const context = currentContext();
      if (context.localDate === snapshot?.asOf.localDate) return;
      void operation(async (database) => {
        const progress = await database.meditations.getCurrentPracticeProgress(context);
        setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
      });
    }, 60_000);
    return () => clearInterval(refresh);
  }, [ready, draft, completion, snapshot?.asOf.localDate, operation]);

  return {
    ready, busy, error, draft, snapshot, journey, habit, explanationDismissed, preferences, audioPreferences, completion, hasHistory, completedPractices, practiceRevision,
    async saveAudioPreferences(next: AudioPreferences) {
      return operation(async (database) => { await database.settings.saveAudioPreferences(next); setAudioPreferences(next); });
    },
    async dismissExplanation() {
      return operation(async (database) => { await database.application.dismissExplanation(Date.now()); setExplanationDismissed(true); });
    },
    retryInitialization: () => { setReady(false); setError(null); setAttempt((value) => value + 1); },
    async begin() {
      return operation(async (database) => {
        if (timer.current) throw new Error('A meditation is already in progress');
        if (await database.meditations.getPendingCompletion()) throw new Error('Return Home from your saved summary before starting another practice');
        const context = currentContext();
        const next = startOpenEndedTimer(randomUUID(), context.timestamp, context.timeZone);
        await database.timer.save(next);
        setCompletion(null);
        acceptDraft(next);
      });
    },
    async pause() {
      const pending = timer.current;
      if (!pending) return false;
      try {
        const next = pauseTimer(pending, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (next.phase === 'finished') return complete(next);
        return operation(async (database) => { await database.timer.save(next); acceptDraft(next); });
      } catch (failure) { setError(String(failure)); return false; }
    },
    async resume() {
      const pending = timer.current;
      if (!pending) return false;
      return operation(async (database) => {
        const next = resumeTimer(pending, Date.now());
        await database.timer.save(next);
        acceptDraft(next);
      });
    },
    async end() {
      const pending = timer.current;
      if (!pending) return false;
      try { return complete(finishTimer(pending, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone)); }
      catch (failure) { setError(String(failure)); return false; }
    },
    async retrySave() {
      const pending = timer.current;
      return pending?.phase === 'finished' ? complete(pending) : false;
    },
    async discard() {
      const pending = timer.current;
      if (!pending || pending.phase === 'finished') return false;
      return operation(async (database) => {
        await database.timer.discard(pending.id);
        acceptDraft(null);
        const progress = await database.meditations.getCurrentPracticeProgress(currentContext());
        setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
      });
    },
    async savePreferences(next: MeditationPreferences) {
      return operation(async (database) => { await database.settings.savePreferences(next); setPreferences(next); });
    },
    async resetAllPracticeData() {
      return operation(async (database) => {
        if (timer.current || completion) throw new Error('Finish or discard your current practice and return Home before restarting your journey');
        const restarted = await database.meditations.resetAllPracticeData(currentContext());
        setSnapshot(restarted.snapshot);
        setJourney(restarted.journey);
        setHabit(restarted.habit);
        acceptDraft(null);
        setCompletion(null);
        setCompletedPractices(0);
        setHasHistory(false);
        setPracticeRevision((revision) => revision + 1);
      });
    },
    history,
    practiceDetails,
    async dismissCompletion() {
      if (!completion) return false;
      return operation(async (database) => {
        await database.meditations.acknowledgeCompletion(completion.session.id, Date.now());
        const progress = await database.meditations.getCurrentPracticeProgress(currentContext());
        setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
        setCompletion(null);
      });
    },
  };
}

const OnaContext = createContext<ReturnType<typeof useApplication> | null>(null);
export function OnaProvider({ children }: { children: ReactNode }) {
  const application = useApplication();
  return <OnaContext.Provider value={application}>{children}</OnaContext.Provider>;
}
export function useOna() {
  const value = useContext(OnaContext);
  if (!value) throw new Error('OnaProvider is required');
  return value;
}
