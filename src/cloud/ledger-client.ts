import type { CloudConfig } from './config';

export type CloudErrorKind = 'offline' | 'signed_out' | 'server' | 'rejected';
/** Network and server failures, classified so sync can decide between retrying and stopping. */
export class CloudError extends Error {
  constructor(readonly kind: CloudErrorKind, message: string, readonly status: number | null = null) {
    super(message);
    this.name = 'CloudError';
  }
}

export interface CloudRow { readonly table: string; readonly key: string; readonly hash: string; readonly row: Readonly<Record<string, unknown>> }
export interface CloudRef { readonly table: string; readonly key: string }
export interface PushRequest {
  readonly pushId: string;
  readonly expectedRevision: number;
  readonly deviceId: string;
  readonly kind: 'upload' | 'merge';
  readonly schemaVersion: number;
  /** Settlement time of the state this push produces. */
  readonly asOf: number;
  readonly removes: readonly CloudRef[];
  readonly adds: readonly CloudRow[];
}
export interface PushResult { readonly status: 'applied' | 'duplicate' | 'conflict'; readonly revision: number }
export interface CloudChanges {
  readonly revision: number;
  readonly head: number;
  readonly schemaVersion: number | null;
  readonly adds: readonly CloudRow[];
  readonly removes: readonly CloudRef[];
}
export interface CloudSetting { readonly document: string; readonly data: unknown; readonly updatedAt: number; readonly deviceId: string }

/** The four server operations sync needs; implemented over Supabase RPC and by in-memory fakes in tests. */
export interface CloudLedger {
  push(request: PushRequest): Promise<PushResult>;
  changes(from: number, to?: number | null): Promise<CloudChanges>;
  /** Newest revision <= max whose state was settled no later than `time`, or 0. */
  revisionBefore(time: number, max: number): Promise<number>;
  saveSetting(document: string, data: unknown, updatedAt: number, deviceId: string): Promise<CloudSetting>;
  settings(): Promise<readonly CloudSetting[]>;
  deleteCloudData(): Promise<void>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const platformFetch = (globalThis as unknown as { fetch: FetchLike }).fetch;
export function createSupabaseLedger(config: CloudConfig, accessToken: () => Promise<string | null>, fetchImpl: FetchLike = (url, init) => platformFetch(url, init)): CloudLedger {
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
      if (response.status === 401 || /Sign in to sync/.test(message)) throw new CloudError('signed_out', message, response.status);
      throw new CloudError(response.status >= 500 ? 'server' : 'rejected', message, response.status);
    }
    try { return text ? JSON.parse(text) as unknown : null; }
    catch { throw new CloudError('server', 'Unreadable server response', response.status); }
  }
  const rpc = (name: string, args: Record<string, unknown>) => request(`rpc/${name}`, 'POST', args);
  const record = (value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new CloudError('server', 'Unexpected server response');
    return value as Record<string, unknown>;
  };
  const revision = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new CloudError('server', 'Unexpected server revision');
    return value;
  };
  const list = <T>(value: unknown) => {
    if (!Array.isArray(value)) throw new CloudError('server', 'Unexpected server response');
    return value as T[];
  };

  return {
    async push(input) {
      const result = record(await rpc('ona_push_ledger', {
        p_push_id: input.pushId, p_expected_revision: input.expectedRevision, p_device_id: input.deviceId, p_kind: input.kind,
        p_schema_version: input.schemaVersion, p_as_of: input.asOf, p_removes: input.removes, p_adds: input.adds,
      }));
      if (result.status !== 'applied' && result.status !== 'duplicate' && result.status !== 'conflict') throw new CloudError('server', 'Unexpected push status');
      return { status: result.status, revision: revision(result.revision) };
    },
    async changes(from, to = null) {
      const result = record(await rpc('ona_ledger_changes', { p_from: from, p_to: to }));
      return {
        revision: revision(result.revision), head: revision(result.head),
        schemaVersion: result.schemaVersion === null ? null : revision(result.schemaVersion),
        adds: list<CloudRow>(result.adds), removes: list<CloudRef>(result.removes),
      };
    },
    async revisionBefore(time, max) {
      return revision(await rpc('ona_ledger_revision_before', { p_time: time, p_max: max }));
    },
    async saveSetting(document, data, updatedAt, deviceId) {
      const result = record(await rpc('ona_save_setting', { p_document: document, p_data: data, p_updated_at: updatedAt, p_device_id: deviceId }));
      return { document: String(result.document), data: result.data, updatedAt: revision(result.updatedAt), deviceId: String(result.deviceId) };
    },
    async settings() {
      return list<Record<string, unknown>>(await request('ona_settings?select=document,document_data,updated_at,device_id', 'GET'))
        .map((row) => ({ document: String(row.document), data: row.document_data, updatedAt: revision(row.updated_at), deviceId: String(row.device_id) }));
    },
    async deleteCloudData() { await rpc('ona_delete_my_cloud_data', {}); },
  };
}
