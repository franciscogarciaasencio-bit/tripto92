import * as WebBrowser from 'expo-web-browser';

export async function openSignIn(url: string, redirectTo: string, _flowId?: string) {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  return result.type === 'success' ? { status: 'callback' as const, url: result.url } : { status: 'cancelled' as const };
}

export function pendingWebCallback(): { url: string; flowId?: string } | null { return null; }
export function clearWebCallback() {}
