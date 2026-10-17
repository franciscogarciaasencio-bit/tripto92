import type { CloudConfig } from './config';

export type CloudErrorKind = 'offline' | 'signed_out' | 'server' | 'rejected';
/** Network and server failures, classified so callers can decide between retrying and stopping. */
export class CloudError extends Error {
  constructor(readonly kind: CloudErrorKind, message: string, readonly status: number | null = null) {
    super(message);
    this.name = 'CloudError';
  }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
const platformFetch = (globalThis as unknown as { fetch: FetchLike }).fetch;

/**
 * Supabase REST (PostgREST) for one signed-in account: every request carries that account's token,
 * and failures arrive as CloudErrors. `accessToken` returns null once that account is signed out.
 */
export function createRestClient(config: CloudConfig, accessToken: () => Promise<string | null>,
  fetchImpl: FetchLike = (url, init) => platformFetch(url, init)) {
  async function request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
    const token = await accessToken().catch(() => { throw new CloudError('offline', 'Could not refresh the sign-in session'); });
    if (!token) throw new CloudError('signed_out', 'Sign in to sync');
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
        method,
        headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CloudError('offline', 'No connection');
    }
    const text = await response.text();
    if (!response.ok) {
      let message = `Server responded ${response.status}`;
      try { const parsed = JSON.parse(text) as { message?: unknown; code?: unknown }; if (typeof parsed.message === 'string') message = parsed.message; } catch { /* plain text */ }
      if (response.status === 401 || /^Sign in to /.test(message)) throw new CloudError('signed_out', message, response.status);
      throw new CloudError(response.status >= 500 ? 'server' : 'rejected', message, response.status);
    }
    try { return text ? JSON.parse(text) as unknown : null; }
    catch { throw new CloudError('server', 'Unreadable server response', response.status); }
  }
  return { request, rpc: (name: string, args: Record<string, unknown>) => request(`rpc/${name}`, 'POST', args) };
}

/** A JSON object from the server, or a CloudError: responses are never trusted blindly. */
export function responseRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new CloudError('server', 'Unexpected server response');
  return value as Record<string, unknown>;
}
export function responseList<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new CloudError('server', 'Unexpected server response');
  return value as T[];
}
