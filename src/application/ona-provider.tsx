import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { initializeDatabase, type MeditationStore, type MeditationPreferences } from '@/data';
import { finishTimer, pauseTimer, practiceContext, resumeTimer, settleTimer, startTimer, timerSession, type TimerDraft } from '@/domain/meditation/timer';
import type { MeditationSession, ProgressSnapshot, RankDefinition } from '@/domain/progression';
import { getProgressSnapshot } from '@/domain/progression';

export function currentContext() {
  return practiceContext(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}
export interface Completion {
  readonly session: MeditationSession;
  readonly previousRank: RankDefinition;
}

function useApplication() {
  const store = useRef<MeditationStore | null>(null);
  const timer = useRef<TimerDraft | null>(null);
  const locked = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TimerDraft | null>(null);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [preferences, setPreferences] = useState<MeditationPreferences | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
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
        setCompletion(opened.recoveredSession ? { session: opened.recoveredSession, previousRank: opened.previousRank } : null);
        setReady(true);
      } catch (failure) {
        if (opened) await opened.close();
        if (!disposed) setError(String(failure));
      }
    }
    void load();
    return () => {
      disposed = true;
      store.current = null;
      if (opened) void opened.close();
    };
  }, [attempt, acceptDraft]);

  const operation = useCallback(async (work: (database: MeditationStore) => Promise<void>) => {
    if (locked.current || !store.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try { await work(store.current); return true; }
    catch (failure) { setError(String(failure)); return false; }
    finally { locked.current = false; setBusy(false); }
  }, []);

  const complete = useCallback(async (finished: TimerDraft) => operation(async (database) => {
    acceptDraft(finished);
    // Save the exact payload first. A failed transaction or process death retains it for retry.
    await database.timer.save(finished);
    const before = await database.meditations.loadProgressionState();
    const previousRank = getProgressSnapshot(before, before.asOf).currentRank;
    const session = timerSession(finished);
    const saved = await database.meditations.recordCompletedMeditation(session, Date.now());
    setSnapshot(saved);
    setCompletion({ session, previousRank });
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
    ready, busy, error, draft, snapshot, preferences, completion, hasHistory,
    retryInitialization: () => { setReady(false); setError(null); setAttempt((value) => value + 1); },
    async begin(targetSeconds: number) {
      return operation(async (database) => {
        if (timer.current) throw new Error('A meditation is already in progress');
        const context = currentContext();
        const next = startTimer(randomUUID(), targetSeconds, context.timestamp, context.timeZone);
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
    async savePreferences(next: MeditationPreferences) {
      return operation(async (database) => { await database.settings.savePreferences(next); setPreferences(next); });
    },
    history,
    dismissCompletion: () => { setCompletion(null); setError(null); },
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
