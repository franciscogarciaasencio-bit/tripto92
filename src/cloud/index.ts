import { createCloudAuth } from './auth';
import { parseCloudConfig } from './config';
import { createSupabaseFriends } from './friends-client';
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
/** Friends for the signed-in account; requests stop (signed_out) if another account signs in meanwhile. */
export const cloudFriendsFor = (accountId: string) => cloudConfig && cloudAuth
  ? createSupabaseFriends(cloudConfig, () => cloudAuth.accessToken(accountId)) : null;
export { loadActiveAccount, saveActiveAccount, type CloudAccount } from './auth';
export { looksLikeEmail, type AddFriendResult, type CloudFriends, type Friend, type FriendRequest, type FriendsList } from './friends-client';
export type { CloudErrorKind } from './rest';
