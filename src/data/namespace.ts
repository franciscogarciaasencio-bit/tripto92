import { sha256Hex } from './database/sha256';

export const GUEST_DATABASE = 'meditation.db';

/** Each account has its own ledger file; the guest file is never shared with an account. */
export function databaseNameFor(accountId: string | null): string {
  if (accountId === null) return GUEST_DATABASE;
  const id = accountId.trim();
  if (!id) throw new Error('Account ID is required');
  return `ona-account-${sha256Hex(`ona-account:${id}`).slice(0, 32)}.db`;
}
