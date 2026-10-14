import type { CalendarContext } from '../domain/progression';
import { applyLedgerDiff, ledgerRow, ledgerTable, LEDGER_SCHEMA_VERSION, type LedgerRow } from '../data/database/ledger';
import type { SyncDocument, SyncRepository, InflightPush } from '../data/repositories/sync-repository';
import type { CloudChanges, CloudLedger, CloudRow, PushRequest } from '../cloud/ledger-client';

export type SyncAction = 'none' | 'pushed' | 'pulled' | 'merged';
export type SyncResult =
  | { readonly status: 'synced'; readonly action: SyncAction; readonly revision: number; readonly documents: readonly SyncDocument[] }
  | { readonly status: 'skipped'; readonly reason: 'unbound' | 'busy' };

/** The cloud holds practice from a newer Ona; this version must not import or overwrite it. */
export class SyncUpgradeRequired extends Error {
  constructor() { super('Update Ona to sync this account'); this.name = 'SyncUpgradeRequired'; }
}

/** Merges both sides into the device ledger and makes `head` the synced base at `revision`. */
export type MergeRemote = (input: { readonly head: readonly LedgerRow[]; readonly revision: number; readonly cloud: CloudLedger }) => Promise<void>;

export interface SyncContext {
  readonly sync: SyncRepository;
  readonly cloud: CloudLedger;
  readonly now: () => number;
  readonly uuid: () => string;
  readonly calendar: () => CalendarContext;
  /** True while a practice is running/paused or a saved completion awaits acknowledgement. */
  readonly busy: () => Promise<boolean>;
  readonly merge: MergeRemote;
}

const toRows = (rows: readonly CloudRow[]) => rows.map((row) => ledgerRow(row.table, row.row));
function checkSchema(changes: CloudChanges) {
  if (changes.schemaVersion !== null && changes.schemaVersion > LEDGER_SCHEMA_VERSION) throw new SyncUpgradeRequired();
}
const request = (push: InflightPush, deviceId: string): PushRequest => ({
  pushId: push.pushId, expectedRevision: push.expectedRevision, deviceId, kind: push.kind,
  schemaVersion: LEDGER_SCHEMA_VERSION, asOf: push.asOf,
  removes: push.diff.removes, adds: push.diff.adds.map(({ table, key, hash, row }) => ({ table, key, hash, row })),
});
const rank: Record<SyncAction, number> = { none: 0, pulled: 1, pushed: 2, merged: 3 };

/** Send a durable push and record the server's verdict. Returns whether it was applied. */
async function deliver(context: SyncContext, push: InflightPush, deviceId: string) {
  const result = await context.cloud.push(request(push, deviceId));
  if (result.status === 'conflict') { await context.sync.abandonPush(push.pushId); return false; }
  await context.sync.completePush(push.pushId, result.revision, context.now());
  return true;
}

/** Newest edit wins for each preference document. Returns documents whose local content changed. */
export async function syncDocuments(context: SyncContext, deviceId: string): Promise<SyncDocument[]> {
  const changed = new Set<SyncDocument>();
  for (const pending of await context.sync.pendingDocuments()) {
    const winner = await context.cloud.saveSetting(pending.document, pending.data, pending.updatedAt, deviceId);
    if (await context.sync.acceptDocument(pending.document, winner.data, winner.updatedAt)) changed.add(pending.document);
  }
  for (const remote of await context.cloud.settings()) {
    if (await context.sync.acceptDocument(remote.document as SyncDocument, remote.data, remote.updatedAt)) changed.add(remote.document as SyncDocument);
  }
  return [...changed];
}

/**
 * One sync cycle (docs/SYNC.md). Safe to call at any time and to interrupt: every step is either a
 * read, an idempotent server call, or a single local transaction. Bounded retries on races.
 */
export async function syncLedger(context: SyncContext): Promise<SyncResult> {
  let action: SyncAction = 'none';
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await context.sync.loadState();
    if (!state.accountId) return { status: 'skipped', reason: 'unbound' };
    if (state.inflight) {
      if (await deliver(context, state.inflight, state.deviceId) && rank.pushed > rank[action]) action = 'pushed';
      continue;
    }

    const remote = await context.cloud.changes(state.syncedRevision);
    checkSchema(remote);
    let local = await context.sync.localChanges();
    if (local.base === null) {
      // A file from before base content was stored: download the synced revision once.
      const full = await context.cloud.changes(0, state.syncedRevision);
      checkSchema(full);
      await context.sync.adoptBase(toRows(full.adds), state.syncedRevision);
      local = await context.sync.localChanges();
    }
    const base = local.base!;

    if (remote.head === state.syncedRevision) {
      if (!local.significant) {
        await context.sync.confirmSynced(state.syncedRevision, context.now());
        const documents = await syncDocuments(context, state.deviceId);
        return { status: 'synced', action, revision: state.syncedRevision, documents };
      }
      const push: InflightPush = { pushId: context.uuid(), expectedRevision: state.syncedRevision, kind: 'upload', diff: local.diff, asOf: local.asOf };
      await context.sync.beginPush(push);
      if (await deliver(context, push, state.deviceId) && rank.pushed > rank[action]) action = 'pushed';
      continue;
    }

    // The cloud moved on. Importing or merging replaces local practice, so never during a practice.
    if (await context.busy()) return { status: 'skipped', reason: 'busy' };
    const head = applyLedgerDiff(base, { removes: remote.removes.map((ref) => ({ table: ledgerTable(ref.table), key: ref.key })), adds: toRows(remote.adds) });
    if (!local.significant) {
      await context.sync.applyRemote(head, remote.head, context.now());
      if (rank.pulled > rank[action]) action = 'pulled';
      continue;
    }
    await context.merge({ head, revision: remote.head, cloud: context.cloud });
    action = 'merged';
  }
  throw new Error('Sync is still changing on another device; it will try again shortly');
}
