import type { CalendarContext } from '../domain/progression';
import { applyLedgerDiff, ledgerRow, ledgerTable, LEDGER_SCHEMA_VERSION, type LedgerRow } from '../data/database/ledger';
import type { SyncDocument, SyncRepository, InflightPush } from '../data/repositories/sync-repository';
import { planMerge } from '../data/database/ledger-merge';
import type { CloudChanges, CloudLedger, CloudRow, PushRequest } from '../cloud/ledger-client';

export type SyncAction = 'none' | 'pushed' | 'pulled' | 'merged';
export type SyncResult =
  | { readonly status: 'synced'; readonly action: SyncAction; readonly revision: number; readonly documents: readonly SyncDocument[] }
  | { readonly status: 'skipped'; readonly reason: 'unbound' | 'busy' };

/** The cloud copy this phone synced with was deleted or replaced; never write to the new one blindly. */
export class SyncCloudReplaced extends Error {
  constructor() { super('The saved practice in this account was deleted or replaced'); this.name = 'SyncCloudReplaced'; }
}

/** The cloud holds practice from a newer Ona; this version must not import or overwrite it. */
export class SyncUpgradeRequired extends Error {
  constructor() { super('Update Ona to sync this account'); this.name = 'SyncUpgradeRequired'; }
}

export interface SyncContext {
  readonly sync: SyncRepository;
  readonly cloud: CloudLedger;
  readonly now: () => number;
  readonly uuid: () => string;
  readonly calendar: () => CalendarContext;
  /** True while a practice is running/paused or a saved completion awaits acknowledgement. */
  readonly busy: () => Promise<boolean>;
}

const toRows = (rows: readonly CloudRow[]) => rows.map((row) => ledgerRow(row.table, row.row));
function checkSchema(changes: CloudChanges) {
  if (changes.schemaVersion !== null && changes.schemaVersion > LEDGER_SCHEMA_VERSION) throw new SyncUpgradeRequired();
}
const request = (push: InflightPush, deviceId: string): PushRequest => ({
  pushId: push.pushId, expectedLedger: push.expectedLedger, expectedRevision: push.expectedRevision, deviceId, kind: push.kind,
  schemaVersion: LEDGER_SCHEMA_VERSION, asOf: push.asOf,
  removes: push.diff.removes, adds: push.diff.adds.map(({ table, key, hash, row }) => ({ table, key, hash, row })),
});
const rank: Record<SyncAction, number> = { none: 0, pulled: 1, pushed: 2, merged: 3 };

/** Send a durable push and record the server's verdict. Returns whether it was applied. */
async function deliver(context: SyncContext, push: InflightPush, deviceId: string) {
  const result = await context.cloud.push(request(push, deviceId));
  if (result.status === 'conflict') { await context.sync.abandonPush(push.pushId); return false; }
  if (result.status === 'replaced' || result.ledgerId === null) { await context.sync.abandonPush(push.pushId); throw new SyncCloudReplaced(); }
  await context.sync.completePush(push.pushId, result.revision, result.ledgerId, context.now());
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
  let merged = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await context.sync.loadState();
    if (!state.accountId) return { status: 'skipped', reason: 'unbound' };
    if (state.inflight) {
      if (await deliver(context, state.inflight, state.deviceId) && rank.pushed > rank[action]) action = 'pushed';
      continue;
    }

    const remote = await context.cloud.changes(state.syncedRevision).catch(async (error: unknown) => {
      // The synced revision no longer exists: the cloud copy was deleted (and maybe re-created).
      if ((error as { kind?: string }).kind !== 'rejected' || state.syncedRevision === 0) throw error;
      const probe = await context.cloud.changes(0);
      if (probe.head < state.syncedRevision || probe.ledgerId !== state.cloudLedgerId) throw new SyncCloudReplaced();
      throw error;
    });
    if (state.cloudLedgerId !== null && remote.ledgerId !== state.cloudLedgerId) throw new SyncCloudReplaced();
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
      const push: InflightPush = { pushId: context.uuid(), expectedLedger: state.cloudLedgerId, expectedRevision: state.syncedRevision,
        kind: merged ? 'merge' : 'upload', diff: local.diff, asOf: local.asOf };
      await context.sync.beginPush(push);
      if (await deliver(context, push, state.deviceId) && rank.pushed > rank[action]) action = 'pushed';
      continue;
    }

    // The cloud moved on. Importing or merging replaces local practice, so never during a practice.
    if (await context.busy()) return { status: 'skipped', reason: 'busy' };
    const head = applyLedgerDiff(base, { removes: remote.removes.map((ref) => ({ table: ledgerTable(ref.table), key: ref.key })), adds: toRows(remote.adds) });
    if (!local.significant) {
      await context.sync.applyRemote(head, remote.head, remote.ledgerId, context.now());
      if (rank.pulled > rank[action]) action = 'pulled';
      continue;
    }
    // Both sides practiced. Follow the cloud when possible; otherwise replay from a revision settled
    // before the earliest new practice so nothing is recorded out of order.
    const plan = planMerge(base, head, local.snapshot.rows);
    let start: readonly LedgerRow[] | null = head;
    if (!plan.fastForward) {
      const revision = await context.cloud.revisionBefore(plan.earliest.timestamp, remote.head);
      start = revision === 0 ? null : revision === remote.head ? head : revision === state.syncedRevision ? base
        : toRows((await context.cloud.changes(0, revision)).adds);
    }
    const result = await context.sync.mergeRemote({ start, head, revision: remote.head, ledgerId: remote.ledgerId, localRows: local.snapshot.rows,
      earliest: plan.earliest, reset: plan.reset, now: context.calendar() });
    if (result) { action = 'merged'; merged = true; }
  }
  throw new Error('Sync is still changing on another device; it will try again shortly');
}
