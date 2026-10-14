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
export const cloudLedger = cloudConfig && cloudAuth ? createSupabaseLedger(cloudConfig, () => cloudAuth.accessToken()) : null;
export { loadActiveAccount, saveActiveAccount, type CloudAccount } from './auth';
