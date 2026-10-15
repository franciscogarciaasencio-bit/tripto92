const FLOW_KEY = 'ona.oauth-flow';

/** Same-tab navigation preserves SQLite's COOP isolation, which severs OAuth popup openers. */
export async function openSignIn(url: string, _redirectTo: string, flowId?: string) {
  window.sessionStorage.setItem(FLOW_KEY, flowId ?? '');
  window.location.assign(url);
  return { status: 'redirecting' as const };
}

export function pendingWebCallback(): { url: string; flowId?: string } | null {
  if (typeof window === 'undefined' || window.location.pathname !== '/auth-callback') return null;
  const flowId = window.sessionStorage.getItem(FLOW_KEY);
  // Only this tab's explicitly started sign-in may switch its local practice account.
  if (flowId === null) throw new Error('This sign-in has expired. Please continue with Google again.');
  return { url: window.location.href, flowId: flowId || undefined };
}

export function clearWebCallback() { window.sessionStorage.removeItem(FLOW_KEY); }
