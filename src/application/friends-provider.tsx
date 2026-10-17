import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { cloudFriendsFor, type AddFriendResult, type CloudErrorKind, type CloudFriends, type FriendsList } from '@/cloud';
import type { MeditationSession } from '@/domain/progression';
import { sharedStreak } from '@/domain/progression';
import { currentContext, useOna } from './ona-provider';

/** idle: nothing loaded yet. offline / signed_out / failed: the last load did not complete. */
export type FriendsPhase = 'idle' | 'loading' | 'ready' | 'offline' | 'signed_out' | 'failed';
export type FriendActionResult = AddFriendResult | 'offline' | 'failed';

const HISTORY_PAGE = 50;
const kindOf = (failure: unknown) => (failure as { kind?: CloudErrorKind } | null)?.kind;

/** Every saved practice (the same pages the calendar reads), for the weeks in a row friends see. */
async function allSessions(history: (offset: number) => Promise<readonly { session: MeditationSession }[]>) {
  const sessions: MeditationSession[] = [];
  for (;;) {
    const page = await history(sessions.length);
    sessions.push(...page.map((record) => record.session));
    if (page.length < HISTORY_PAGE) return sessions;
  }
}

/**
 * Friends for the signed-in account. While signed in, this phone shares its level and weeks in a
 * row: once per launch, after each practice, after sync brings practice from another phone, and on
 * return to the app. Sharing never runs during a practice or its completion, and never blocks it.
 */
function useFriendsState() {
  const app = useOna();
  const accountId = app.account?.id ?? null;
  const client = useMemo(() => accountId ? cloudFriendsFor(accountId) : null, [accountId]);
  // Everything below belongs to one account: another account (or none) starts from nothing, and
  // answers that arrive for a previous account are ignored.
  const [state, setState] = useState<FriendsState>(() => blank(null));
  const mine = state.owner === accountId ? state : blank(accountId);
  const update = useCallback((owner: string, change: Partial<FriendsState>) =>
    setState((previous) => ({ ...(previous.owner === owner ? previous : blank(owner)), ...change })), []);
  const shared = useRef<{ owner: string; signature: string } | null>(null);
  const loaded = useRef<{ owner: string; at: number } | null>(null);

  const level = app.journey?.level.number ?? null;
  const { history } = app;
  const share = useCallback(async () => {
    if (!client || !accountId || level === null) return;
    const streak = sharedStreak(await allSessions(history), currentContext().localDate);
    const signature = `${level}|${streak.weeks}|${streak.until}`;
    if (shared.current?.owner === accountId && shared.current.signature === signature) return;
    await client.share({ level, weeks: streak.weeks, until: streak.until });
    shared.current = { owner: accountId, signature };
  }, [client, accountId, level, history]);

  const [returns, setReturns] = useState(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => { if (next === 'active') setReturns((value) => value + 1); });
    return () => listener.remove();
  }, []);
  const quiet = !app.ready || app.busy || app.draft !== null || app.completion !== null;
  const { practiceRevision, completedPractices } = app;
  useEffect(() => {
    if (!client || quiet) return;
    // A moment after things settle; a failure (offline) simply waits for the next occasion.
    const timer = setTimeout(() => { void share().catch(() => undefined); }, 1200);
    return () => clearTimeout(timer);
  }, [client, quiet, share, practiceRevision, completedPractices, returns]);

  const refresh = useCallback(async () => {
    if (!client || !accountId) return;
    const owner = accountId;
    loaded.current = { owner, at: Date.now() };
    setState((previous) => {
      const base = previous.owner === owner ? previous : blank(owner);
      return { ...base, refreshing: true, phase: base.phase === 'ready' ? 'ready' : 'loading' };
    });
    void share().catch(() => undefined);
    try {
      update(owner, { list: await client.list(), phase: 'ready', refreshing: false });
    } catch (failure) {
      const kind = kindOf(failure);
      update(owner, { phase: kind === 'offline' ? 'offline' : kind === 'signed_out' ? 'signed_out' : 'failed', refreshing: false });
    }
  }, [client, accountId, share, update]);

  // Load quietly after launch and on return to the app (at most every five minutes), so Home can
  // show a small mark when someone has added you.
  useEffect(() => {
    if (!client || !accountId || quiet) return;
    if (loaded.current?.owner === accountId && Date.now() - loaded.current.at < 5 * 60_000) return;
    const timer = setTimeout(() => { void refresh(); }, 2500);
    return () => clearTimeout(timer);
  }, [client, accountId, quiet, returns, refresh]);

  /** Runs an action, then reloads the list (which also restores it if an optimistic change failed). */
  const act = useCallback(async <T,>(work: (friends: CloudFriends) => Promise<T>, optimistic?: (list: FriendsList) => FriendsList): Promise<T | 'offline' | 'failed'> => {
    if (!client || !accountId) return 'failed';
    if (optimistic) setState((previous) => previous.owner === accountId && previous.list ? { ...previous, list: optimistic(previous.list) } : previous);
    try { return await work(client); }
    catch (failure) { return kindOf(failure) === 'offline' ? 'offline' : 'failed'; }
    finally { void refresh(); }
  }, [client, accountId, refresh]);

  return {
    /** Friends need an account, and accounts need this build's cloud settings. */
    available: app.cloudAvailable,
    signedIn: client !== null,
    list: mine.list, phase: mine.phase, refreshing: mine.refreshing, refresh,
    add: (email: string): Promise<FriendActionResult> => act((friends) => friends.add(email)),
    remove: (id: string) => act((friends) => friends.remove(id), (previous) => ({ ...previous,
      friends: previous.friends.filter((friend) => friend.id !== id), requests: previous.requests.filter((request) => request.id !== id) })),
    cancel: (email: string) => act((friends) => friends.cancel(email), (previous) => ({ ...previous,
      invited: previous.invited.filter((invited) => invited !== email) })),
  };
}

interface FriendsState { readonly owner: string | null; readonly list: FriendsList | null; readonly phase: FriendsPhase; readonly refreshing: boolean }
const blank = (owner: string | null): FriendsState => ({ owner, list: null, phase: 'idle', refreshing: false });

const FriendsContext = createContext<ReturnType<typeof useFriendsState> | null>(null);
export function FriendsProvider({ children }: { children: ReactNode }) {
  const friends = useFriendsState();
  return <FriendsContext.Provider value={friends}>{children}</FriendsContext.Provider>;
}
export function useFriends() {
  const value = useContext(FriendsContext);
  if (!value) throw new Error('FriendsProvider is required');
  return value;
}
export { looksLikeEmail, type Friend, type FriendRequest, type FriendsList } from '@/cloud';
