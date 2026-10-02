import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { initializeDatabase, type MeditationStore, type MeditationPreferences, type PracticeCompletion } from '@/data';
import { finishTimer, pauseTimer, practiceContext, resumeTimer, settleTimer, startOpenEndedTimer, timerSession, type TimerDraft } from '@/domain/meditation/timer';
import type { ProgressSnapshot } from '@/domain/progression';

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
  const [preferences, setPreferences] = useState<MeditationPreferences | null>(null);
  const [completion, setCompletion] = useState<PracticeCompletion | null>(null);
  const [completedPractices, setCompletedPractices] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);

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
        const history = await opened.meditations.getMeditationHistory({ limit: 1 });
        if (disposed) { await opened.close(); return; }
        store.current = opened;
        acceptDraft(opened.initialTimer);
        setSnapshot(opened.initialSnapshot);
        setPreferences(savedPreferences);
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
        const savedHistory = await reopened.meditations.getMeditationHistory({ limit: 1 });
        acceptDraft(reopened.initialTimer);
        setSnapshot(reopened.initialSnapshot);
        setCompletion(reopened.initialCompletion);
        setCompletedPractices(reopened.initialCompletedPractices);
        setHasHistory(savedHistory.length > 0);
        setPreferences(savedPreferences);
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
    setCompletion(saved.completion);
    setCompletedPractices(saved.completion.completedPractices);
    setHasHistory(true);
    acceptDraft(null);
  }), [operation, acceptDraft]);

  useEffect(() => {
    const check = (observedLive = true) => {
      const pending = timer.current;
      if (!pending || locked.current || pending.phase !== 'running') return;
      if (observedLive && AppState.currentState !== 'active') return;
      try {
        const zone = observedLive ? Intl.DateTimeFormat().resolvedOptions().timeZone : pending.timeZone;
        const settled = settleTimer(pending, Date.now(), zone);
        if (settled.phase === 'finished') void complete(settled);
      } catch (failure) { setError(String(failure)); }
    };
    const interval = setInterval(check, 500);
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      check(false);
      if (!timer.current) void operation(async (database) => {
        setSnapshot(await database.meditations.getCurrentProgressionSnapshot(currentContext()));
      });
    });
    return () => { clearInterval(interval); listener.remove(); };
  }, [complete, operation]);

  const history = useCallback((offset = 0) => {
    if (!store.current) return Promise.reject(new Error('Storage is not ready'));
    return store.current.meditations.getMeditationHistory({ limit: 50, offset });
  }, []);

  return {
    ready, busy, error, draft, snapshot, preferences, completion, hasHistory, completedPractices,
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
        setSnapshot(await database.meditations.getCurrentProgressionSnapshot(currentContext()));
      });
    },
    async savePreferences(next: MeditationPreferences) {
      return operation(async (database) => { await database.settings.savePreferences(next); setPreferences(next); });
    },
    history,
    async dismissCompletion() {
      if (!completion) return false;
      return operation(async (database) => {
        await database.meditations.acknowledgeCompletion(completion.session.id, Date.now());
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
