import type { CloudConfig } from './config';
import { CloudError, createRestClient, responseList, responseRecord, type FetchLike } from './rest';

export { CloudError, type CloudErrorKind } from './rest';

export interface CloudRow { readonly table: string; readonly key: string; readonly hash: string; readonly row: Readonly<Record<string, unknown>> }
export interface CloudRef { readonly table: string; readonly key: string }
export interface PushRequest {
  readonly pushId: string;
  /** Cloud ledger the expected revision belongs to (null only when expecting revision 0). */
  readonly expectedLedger: string | null;
  readonly expectedRevision: number;
  readonly deviceId: string;
  readonly kind: 'upload' | 'merge';
  readonly schemaVersion: number;
  /** Settlement time of the state this push produces. */
  readonly asOf: number;
  readonly removes: readonly CloudRef[];
  readonly adds: readonly CloudRow[];
}
export interface PushResult { readonly status: 'applied' | 'duplicate' | 'conflict' | 'replaced'; readonly revision: number; readonly ledgerId: string | null }
export interface CloudChanges {
  readonly revision: number;
  readonly head: number;
  readonly ledgerId: string | null;
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

export function createSupabaseLedger(config: CloudConfig, accessToken: () => Promise<string | null>, fetchImpl?: FetchLike): CloudLedger {
  const { request, rpc } = createRestClient(config, accessToken, fetchImpl);
  const record = responseRecord;
  const revision = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new CloudError('server', 'Unexpected server revision');
    return value;
  };
  const ledgerId = (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) throw new CloudError('server', 'Unexpected cloud ledger identity');
    return value;
  };
  const list = responseList;

  return {
    async push(input) {
      const result = record(await rpc('ona_push_ledger', {
        p_push_id: input.pushId, p_expected_ledger: input.expectedLedger, p_expected_revision: input.expectedRevision, p_device_id: input.deviceId, p_kind: input.kind,
        p_schema_version: input.schemaVersion, p_as_of: input.asOf, p_removes: input.removes, p_adds: input.adds,
      }));
      if (result.status !== 'applied' && result.status !== 'duplicate' && result.status !== 'conflict' && result.status !== 'replaced') {
        throw new CloudError('server', 'Unexpected push status');
      }
      return { status: result.status, revision: revision(result.revision), ledgerId: ledgerId(result.ledgerId) };
    },
    async changes(from, to = null) {
      const result = record(await rpc('ona_ledger_changes', { p_from: from, p_to: to }));
      return {
        revision: revision(result.revision), head: revision(result.head), ledgerId: ledgerId(result.ledgerId),
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
