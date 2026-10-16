import { useCallback, useEffect, useState } from 'react';
import { authStorage } from '@/cloud/auth-storage';

/**
 * How many times Home's pull-up into Journey was used, so its quiet hint can retire (owner, 2026-10-17).
 * A device-local convenience, not practice data: kept in the platform key store (localStorage on web)
 * beside nothing else, never synced, and reset harmlessly if unreadable.
 */
const KEY = 'ona.hints.journey-pull';
export const JOURNEY_PULL_HINT_USES = 3;

export function useJourneyPullHint() {
  const [uses, setUses] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void authStorage.getItem(KEY).then((raw) => {
      const value = raw === null ? 0 : Number(raw);
      if (live) setUses(Number.isSafeInteger(value) && value >= 0 ? value : 0);
    }).catch(() => { if (live) setUses(0); });
    return () => { live = false; };
  }, []);
  const used = useCallback(() => {
    setUses((current) => {
      const next = Math.min(JOURNEY_PULL_HINT_USES, (current ?? 0) + 1);
      void authStorage.setItem(KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);
  return { visible: uses !== null && uses < JOURNEY_PULL_HINT_USES, used };
}
