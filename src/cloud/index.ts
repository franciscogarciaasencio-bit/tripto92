import { createCloudAuth } from './auth';
import { parseCloudConfig } from './config';
import { createSupabaseLedger } from './ledger-client';

/**
 * Optional cloud services. Null unless EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are configured for this build (see docs/SUPABASE_SETUP.md).
 */
export const cloudConfig = parseCloudConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
export const cloudAuth = cloudConfig ? createCloudAuth(cloudConfig) : null;
/** Bind every RPC to the account whose local ledger is being synced. */
export const cloudLedgerFor = (accountId: string) => cloudConfig && cloudAuth
  ? createSupabaseLedger(cloudConfig, () => cloudAuth.accessToken(accountId)) : null;
export { loadActiveAccount, saveActiveAccount, type CloudAccount } from './auth';
