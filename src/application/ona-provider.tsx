import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { cloudAuth, cloudLedger, loadActiveAccount, saveActiveAccount, type CloudAccount } from '@/cloud';
import { databaseNameFor, initializeDatabase, type MeditationStore, type MeditationPreferences, type PracticeCompletion, type AudioPreferences } from '@/data';
import { finishTimer, pauseTimer, practiceContext, resumeTimer, startOpenEndedTimer, timerSession, type TimerDraft } from '@/domain/meditation/timer';
import type { ProgressSnapshot, LifetimeJourney, HabitCheckpoint } from '@/domain/progression';
import { watchTimerDeadline } from './practice-lifecycle';
import { syncLedger, type MergeRemote } from './sync-engine';
import { failurePhase, type SyncStatus } from './sync-status';

const SYNC_INTERVAL = 15 * 60_000;

export function currentContext() {
  return practiceContext(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** Open the ledger file that belongs to `account` (guest when null) and bind it on first use. */
async function openLedger(account: CloudAccount | null) {
  const opened = await initializeDatabase(currentContext(), { databaseName: databaseNameFor(account?.id ?? null) });
  if (account) {
    try { await opened.sync.bindAccount(account.id); }
    catch (failure) { await opened.close(); throw failure; }
  }
  return opened;
}

function useApplication() {
  const store = useRef<MeditationStore | null>(null);
  // undefined while the remembered account loads; null is guest practice.
  const [account, setAccount] = useState<CloudAccount | null | undefined>(cloudAuth ? undefined : null);
  const accountRef = useRef<CloudAccount | null>(null);
  const timer = useRef<TimerDraft | null>(null);
  const locked = useRef(false);
  const needsReopen = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
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

  // Optional account sync. Never blocks meditation: it runs beside the operation lock, every local
  // step is one atomic transaction, and imports refuse while a practice is open.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ phase: 'idle', lastSyncedAt: null });
  const syncRunning = useRef(false);
  const syncAgain = useRef(false);
  const runSync = useCallback(async () => {
    const database = store.current;
    if (!cloudLedger || !accountRef.current || !database) return;
    if (syncRunning.current) { syncAgain.current = true; return; }
    syncRunning.current = true;
    setSyncStatus((status) => ({ ...status, phase: 'syncing' }));
    try {
      do {
        syncAgain.current = false;
        const merge: MergeRemote = async () => { throw new Error('Combining practice from two phones is not available yet'); };
        const result = await syncLedger({
          sync: database.sync, cloud: cloudLedger, now: Date.now, uuid: randomUUID, calendar: currentContext, merge,
          busy: async () => timer.current !== null || (await database.meditations.getPendingCompletion()) !== null,
        });
        if (store.current !== database) return; // The account changed meanwhile; its own sync will run.
        if (result.status === 'synced') {
          if (result.action === 'pulled' || result.action === 'merged') {
            const progress = await database.meditations.getCurrentPracticeProgress(currentContext());
            setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
            setCompletedPractices(await database.meditations.getCompletedPracticeCount());
            setHasHistory((await database.meditations.getMeditationHistory({ limit: 1 })).length > 0);
            setPracticeRevision((revision) => revision + 1);
          }
          if (result.documents.includes('meditation_preferences')) setPreferences(await database.settings.loadPreferences());
          if (result.documents.includes('audio_preferences')) setAudioPreferences(await database.settings.loadAudioPreferences());
          if (result.documents.includes('application_preferences')) setExplanationDismissed(await database.application.isExplanationDismissed());
          setSyncStatus({ phase: 'synced', lastSyncedAt: (await database.sync.loadState()).lastSyncedAt });
        } else {
          setSyncStatus((status) => ({ ...status, phase: status.lastSyncedAt === null ? 'idle' : 'synced' }));
        }
      } while (syncAgain.current && store.current === database);
    } catch (failure) {
      if (store.current === database) setSyncStatus((status) => ({ ...status, phase: failurePhase(failure) }));
    } finally { syncRunning.current = false; }
  }, []);

  useEffect(() => {
    if (!cloudAuth) return;
    let disposed = false;
    // A missing or unreadable remembered account falls back to guest; it never blocks meditation.
    void loadActiveAccount().catch(() => null).then((remembered) => { if (!disposed) setAccount(remembered); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (account === undefined) return;
    let disposed = false;
    let opened: MeditationStore | null = null;
    accountRef.current = account;
    async function load() {
      try {
        opened = await openLedger(account ?? null);
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
        setSyncStatus({ phase: 'idle', lastSyncedAt: opened.initialSync.lastSyncedAt });
        setPracticeRevision((revision) => revision + 1);
        setSwitching(false);
        setReady(true);
      } catch (failure) {
        if (opened) await opened.close();
        if (!disposed) { setError(String(failure)); setSwitching(false); setReady(false); }
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
  }, [attempt, account, acceptDraft]);

  const operation = useCallback(async (work: (database: MeditationStore) => Promise<void>) => {
    if (locked.current || !store.current) return false;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      if (needsReopen.current) {
        await store.current.close();
        store.current = await openLedger(accountRef.current);
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

  // Sync when a signed-in ledger opens, on return to the app, and quietly every 15 minutes.
  useEffect(() => {
    if (!ready || switching || !account || !cloudLedger) return;
    void runSync();
  }, [ready, switching, account, runSync]);
  useEffect(() => {
    if (!ready || !account || !foreground || activation === 0) return;
    void runSync();
  }, [ready, account, foreground, activation, runSync]);
  useEffect(() => {
    if (!ready || !account || !foreground || !cloudLedger) return;
    const interval = setInterval(() => { void runSync(); }, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [ready, account, foreground, runSync]);

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

  /** Switch to another account's ledger (or guest). Only between practices. */
  const switchAccount = useCallback(async (next: CloudAccount | null) => {
    if (locked.current || timer.current || completion) throw new Error('Finish your current practice and return Home first');
    locked.current = true;
    setBusy(true);
    try {
      await saveActiveAccount(next);
      // Screens stay mounted; the provider swaps ledgers underneath and refreshes history views.
      setSwitching(true);
      setAccount(next);
    } finally { locked.current = false; setBusy(false); }
  }, [completion]);

  return {
    ready, busy: busy || switching, error, draft, snapshot,
    cloudAvailable: cloudAuth !== null,
    account: account ?? null,
    syncStatus,
    syncNow: () => runSync(),
    /** Google sign-in, then open this account's own practice file. Returns false if cancelled. */
    async signIn() {
      if (!cloudAuth) return false;
      setError(null);
      try {
        const result = await cloudAuth.signInWithGoogle();
        if (result.status !== 'signed_in') return false;
        await switchAccount(result.account);
        return true;
      } catch (failure) { setError(String(failure)); return false; }
    },
    /** End the session on this device and return to guest practice. Account files stay on the device. */
    async signOut() {
      if (!cloudAuth) return false;
      setError(null);
      try {
        await switchAccount(null);
        await cloudAuth.signOut();
        return true;
      } catch (failure) { setError(String(failure)); return false; }
    }, journey, habit, explanationDismissed, preferences, audioPreferences, completion, hasHistory, completedPractices, practiceRevision,
    async saveAudioPreferences(next: AudioPreferences) {
      const saved = await operation(async (database) => { await database.settings.saveAudioPreferences(next); setAudioPreferences(next); });
      if (saved) void runSync();
      return saved;
    },
    async dismissExplanation() {
      const saved = await operation(async (database) => { await database.application.dismissExplanation(Date.now()); setExplanationDismissed(true); });
      if (saved) void runSync();
      return saved;
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
      const saved = await operation(async (database) => { await database.settings.savePreferences(next); setPreferences(next); });
      if (saved) void runSync();
      return saved;
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
      }).then((done) => { if (done) void runSync(); return done; });
    },
    history,
    practiceDetails,
    async dismissCompletion() {
      if (!completion) return false;
      const done = await operation(async (database) => {
        await database.meditations.acknowledgeCompletion(completion.session.id, Date.now());
        const progress = await database.meditations.getCurrentPracticeProgress(currentContext());
        setSnapshot(progress.snapshot); setJourney(progress.journey); setHabit(progress.habit);
        setCompletion(null);
      });
      if (done) void runSync();
      return done;
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
