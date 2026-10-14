import type { CloudErrorKind } from '../cloud/ledger-client';

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'signed_out' | 'upgrade' | 'error';
export interface SyncStatus {
  readonly phase: SyncPhase;
  readonly lastSyncedAt: number | null;
}

/** Map a failure to a calm, actionable state; unknown failures stay generic. */
export function failurePhase(error: unknown): SyncPhase {
  if (error && typeof error === 'object') {
    if ((error as { name?: unknown }).name === 'SyncUpgradeRequired') return 'upgrade';
    const kind = (error as { kind?: CloudErrorKind }).kind;
    if (kind === 'offline' || kind === 'server') return 'offline';
    if (kind === 'signed_out') return 'signed_out';
  }
  return 'error';
}

function ago(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** One quiet line for the Account screen. */
export function describeSync(status: SyncStatus, now: number): string {
  const saved = status.lastSyncedAt === null ? null : `Saved to your account ${ago(Math.max(0, now - status.lastSyncedAt))}.`;
  switch (status.phase) {
    case 'syncing': return 'Saving to your account…';
    case 'offline': return saved ? `${saved} Offline right now; it will continue when connected.` : 'Offline right now. Your practice is safe on this phone and will be saved when connected.';
    case 'signed_out': return 'Sign in again to keep saving to your account. Your practice is safe on this phone.';
    case 'upgrade': return 'Update Ona to keep saving to this account. Your practice is safe on this phone.';
    case 'error': return saved ? `${saved} The last attempt did not finish; it will try again.` : 'Not saved to your account yet; it will try again.';
    default: return saved ?? 'Your practice will be saved to your account.';
  }
}
