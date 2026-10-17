import { useCallback, useEffect, useState } from 'react';
import { authStorage } from '@/cloud/auth-storage';

/**
 * How life and mind felt at the beginning (owner, 2026-10-17): optional words from the introduction,
 * shown again when Level 100 is reached so the difference can be felt. Personal and optional, kept on
 * this phone only in the platform key store (never synced, never sent anywhere), and readable by this
 * device's Ona alone. An unreadable value simply reads as "nothing written".
 */
const KEY = 'ona.reflection.beginning';
export const REFLECTION_MAX_LENGTH = 2000;
export interface BeginningReflection { readonly text: string; readonly writtenAt: number }

export function parseReflection(raw: string | null): BeginningReflection | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { text?: unknown; writtenAt?: unknown };
    if (typeof value.text !== 'string' || !value.text.trim() || typeof value.writtenAt !== 'number') return null;
    return { text: value.text.slice(0, REFLECTION_MAX_LENGTH), writtenAt: value.writtenAt };
  } catch { return null; }
}

export function useBeginningReflection() {
  const [reflection, setReflection] = useState<BeginningReflection | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void authStorage.getItem(KEY).then((raw) => { if (live) setReflection(parseReflection(raw)); })
      .catch(() => { if (live) setReflection(null); });
    return () => { live = false; };
  }, []);
  /** Save (or clear, with empty text). Failures are quiet: writing is optional. */
  const save = useCallback(async (text: string) => {
    const trimmed = text.trim().slice(0, REFLECTION_MAX_LENGTH);
    const next = trimmed ? { text: trimmed, writtenAt: Date.now() } : null;
    setReflection(next);
    try {
      if (next) await authStorage.setItem(KEY, JSON.stringify(next));
      else await authStorage.removeItem(KEY);
    } catch { /* optional */ }
  }, []);
  /** undefined while loading. */
  return { reflection, save };
}
