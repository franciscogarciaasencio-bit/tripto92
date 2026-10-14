import { AuthClient, type Session } from '@supabase/auth-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { parseAuthCallback } from './auth-callback';
import type { CloudConfig } from './config';
import { createChunkedSecureStorage } from './secure-storage';

/** The signed-in identity Ona needs: a stable account ID and an address to show. */
export interface CloudAccount {
  readonly id: string;
  readonly email: string | null;
}
export type SignInResult = { readonly status: 'signed_in'; readonly account: CloudAccount } | { readonly status: 'cancelled' };

const secureStorage = createChunkedSecureStorage({
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
});

const ACTIVE_ACCOUNT_KEY = 'ona.active-account';
/** Which local ledger to open at launch; independent of network so offline starts are instant. */
export async function loadActiveAccount(): Promise<CloudAccount | null> {
  const raw = await secureStorage.getItem(ACTIVE_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown; email?: unknown };
    if (typeof value.id !== 'string' || !value.id) return null;
    return { id: value.id, email: typeof value.email === 'string' ? value.email : null };
  } catch { return null; }
}
export async function saveActiveAccount(account: CloudAccount | null) {
  if (account) await secureStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(account));
  else await secureStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

const accountOf = (session: Session | null): CloudAccount | null =>
  session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;

/** Google sign-in through Supabase (PKCE in the system browser), tokens in the secure store. */
export function createCloudAuth(config: CloudConfig) {
  const client = new AuthClient({
    url: `${config.url}/auth/v1`,
    headers: { apikey: config.publishableKey },
    storageKey: 'ona-auth',
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  });
  // Refresh only while the app is in use.
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void client.startAutoRefresh(); else void client.stopAutoRefresh();
  });

  return {
    redirectUri: () => makeRedirectUri({ scheme: 'meditationapp', path: 'auth-callback' }),

    async signInWithGoogle(): Promise<SignInResult> {
      const redirectTo = makeRedirectUri({ scheme: 'meditationapp', path: 'auth-callback' });
      const { data, error } = await client.signInWithOAuth({
        provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data.url) throw error ?? new Error('Google sign-in is unavailable');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return { status: 'cancelled' };
      const callback = parseAuthCallback(result.url);
      if (callback.kind === 'error') throw new Error(callback.message);
      if (callback.kind === 'none') return { status: 'cancelled' };
      const exchanged = await client.exchangeCodeForSession(callback.code);
      if (exchanged.error) throw exchanged.error;
      const account = accountOf(exchanged.data.session);
      if (!account) throw new Error('Google sign-in did not return an account');
      return { status: 'signed_in', account };
    },

    /** Current access token, refreshed when needed; null when signed out or the session ended. */
    async accessToken(): Promise<string | null> {
      const { data, error } = await client.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },

    async currentAccount(): Promise<CloudAccount | null> {
      const { data } = await client.getSession();
      return accountOf(data.session);
    },

    /** Ends this device's session. Local practice files are kept. */
    async signOut() {
      const { error } = await client.signOut({ scope: 'local' });
      if (error) await secureStorage.removeItem('ona-auth');
    },

    dispose() { appState.remove(); void client.stopAutoRefresh(); },
  };
}
export type CloudAuth = ReturnType<typeof createCloudAuth>;
