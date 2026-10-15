import { AuthClient, type Session } from '@supabase/auth-js';
import { makeRedirectUri } from 'expo-auth-session';
import { AppState } from 'react-native';
import { clearWebCallback, openSignIn, pendingWebCallback } from './auth-browser';
import { createAuthCallbackHandler } from './auth-callback';
import { authStorage } from './auth-storage';
import type { CloudConfig } from './config';

/** The signed-in identity Ona needs: a stable account ID and an address to show. */
export interface CloudAccount {
  readonly id: string;
  readonly email: string | null;
}
export type SignInResult = { readonly status: 'signed_in'; readonly account: CloudAccount } | { readonly status: 'cancelled' | 'redirecting' };

const ACTIVE_ACCOUNT_KEY = 'ona.active-account';
/** Which local ledger to open at launch; independent of network so offline starts are instant. */
export async function loadActiveAccount(): Promise<CloudAccount | null> {
  const raw = await authStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown; email?: unknown };
    if (typeof value.id !== 'string' || !value.id) return null;
    return { id: value.id, email: typeof value.email === 'string' ? value.email : null };
  } catch { return null; }
}
export async function saveActiveAccount(account: CloudAccount | null) {
  if (account) await authStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(account));
  else await authStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

const accountOf = (session: Session | null): CloudAccount | null =>
  session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;

/** Google sign-in through Supabase (PKCE in the system browser), tokens in the secure store. */
export function createCloudAuth(config: CloudConfig) {
  const client = new AuthClient({
    url: `${config.url}/auth/v1`,
    headers: { apikey: config.publishableKey },
    storageKey: 'ona-auth',
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  });
  // Refresh only while the app is in use.
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void client.startAutoRefresh(); else void client.stopAutoRefresh();
  });

  const finishCallback = createAuthCallbackHandler(async (code, flowId) => {
    const exchanged = await client.exchangeCodeForSession(code, { flowId });
    if (exchanged.error) throw exchanged.error;
    const account = accountOf(exchanged.data.session);
    if (!account) throw new Error('Google sign-in did not return an account');
    return account;
  });
  let webCompletion: Promise<SignInResult> | undefined;

  return {
    redirectUri: () => makeRedirectUri({ scheme: 'meditationapp', path: 'auth-callback' }),

    async signInWithGoogle(): Promise<SignInResult> {
      const redirectTo = makeRedirectUri({ scheme: 'meditationapp', path: 'auth-callback' });
      const { data, error } = await client.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data.url) throw error ?? new Error('Google sign-in is unavailable');
      const result = await openSignIn(data.url, redirectTo, data.flowId ?? undefined);
      if (result.status !== 'callback') return result;
      const account = await finishCallback(result.url, data.flowId ?? undefined);
      return account ? { status: 'signed_in', account } : { status: 'cancelled' };
    },

    /** Web returns in the same tab; native completes inside openAuthSessionAsync. */
    completeWebSignIn(): Promise<SignInResult> {
      webCompletion ??= (async () => {
        try {
          const callback = pendingWebCallback();
          if (!callback) return { status: 'cancelled' };
          const account = await finishCallback(callback.url, callback.flowId);
          if (!account) throw new Error('Google sign-in did not return an authorization code');
          return { status: 'signed_in', account };
        } finally { clearWebCallback(); }
      })();
      return webCompletion;
    },

    /** Current access token, refreshed when needed; null when signed out or the session ended. */
    async accessToken(expectedAccountId: string): Promise<string | null> {
      const { data, error } = await client.getSession();
      if (error) throw error;
      // A different browser tab may have changed the shared session. Never send this
      // ledger's practice with another account's token, even midway through a sync.
      return data.session?.user.id === expectedAccountId ? data.session.access_token : null;
    },

    async currentAccount(): Promise<CloudAccount | null> {
      const { data } = await client.getSession();
      return accountOf(data.session);
    },

    /** Ends this device's session. Local practice files are kept. */
    async signOut() {
      const { error } = await client.signOut({ scope: 'local' });
      if (error) await authStorage.removeItem('ona-auth');
    },

    dispose() { appState.remove(); void client.stopAutoRefresh(); },
  };
}
export type CloudAuth = ReturnType<typeof createCloudAuth>;
