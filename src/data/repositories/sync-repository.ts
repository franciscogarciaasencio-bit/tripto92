import type { SqlConnection, Transactions } from '../database/connection';
import type { RulesRegistry } from '../database/decoders';
import { diffLedger, exportLedger, isSignificant, ledgerRow, ledgerTable, refId, replaceLedger, type LedgerDiff, type LedgerRef, type LedgerRow, type LedgerSnapshot } from '../database/ledger';
import { array, integer, json, object, requireData, text, timestamp } from '../database/validation';

export const SYNC_DOCUMENTS = ['meditation_preferences', 'audio_preferences', 'application_preferences'] as const;
export type SyncDocument = (typeof SYNC_DOCUMENTS)[number];
export type PushKind = 'upload' | 'merge';

/** One durable push awaiting the server's answer; resent unchanged after a crash or lost response. */
export interface InflightPush {
  readonly pushId: string;
  readonly expectedRevision: number;
  readonly kind: PushKind;
  readonly diff: LedgerDiff;
  /** Manifest of the cloud state this push produces (expected state − removes + adds). */
  readonly target: readonly (readonly [string, string])[];
}
export interface SyncState {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly syncedRevision: number;
  readonly inflight: InflightPush | null;
  readonly lastSyncedAt: number | null;
}

function decodeRef(value: unknown): LedgerRef {
  const ref = object(value);
  return { table: ledgerTable(ref.table), key: text(ref.key) };
}
function decodeInflight(value: unknown): InflightPush {
  const source = object(value);
  const kind = source.kind;
  requireData(kind === 'upload' || kind === 'merge', 'Invalid sync push kind');
  const diff = object(source.diff);
  return {
    pushId: text(source.pushId), expectedRevision: integer(source.expectedRevision), kind,
    diff: {
      removes: array(diff.removes, decodeRef),
      adds: array(diff.adds, (entry) => { const row = object(entry); return ledgerRow(row.table, row.row); }),
    },
    target: array(source.target, (entry) => {
      requireData(Array.isArray(entry) && entry.length === 2, 'Invalid sync manifest entry');
      return [text(entry[0]), text(entry[1])] as const;
    }),
  };
}

export async function loadSyncState(sql: SqlConnection): Promise<SyncState> {
  const rows = await sql.all('SELECT * FROM sync_state');
  requireData(rows.length === 1 && object(rows[0]).id === 1, 'Sync state singleton is missing');
  const row = object(rows[0]);
  return {
    deviceId: text(row.device_id),
    accountId: row.account_id === null ? null : text(row.account_id),
    syncedRevision: integer(row.synced_revision),
    inflight: row.inflight_json === null ? null : decodeInflight(json(row.inflight_json)),
    lastSyncedAt: row.last_synced_at === null ? null : timestamp(row.last_synced_at),
  };
}

export async function loadManifest(sql: SqlConnection): Promise<Map<string, string>> {
  return new Map((await sql.all('SELECT table_name, row_key, row_hash FROM sync_manifest')).map((value) => {
    const row = object(value);
    return [refId({ table: ledgerTable(row.table_name), key: text(row.row_key) }), text(row.row_hash)] as const;
  }));
}

async function writeManifest(sql: SqlConnection, entries: Iterable<readonly [string, string]>) {
  await sql.run('DELETE FROM sync_manifest');
  for (const [id, hash] of entries) {
    const [table, key] = id.split('\u0000');
    await sql.run('INSERT INTO sync_manifest(table_name, row_key, row_hash) VALUES (?, ?, ?)', [ledgerTable(table), text(key), text(hash)]);
  }
}

/** Record a local edit time for a synced preference document (newest edit wins across devices). */
export async function touchDocument(sql: SqlConnection, document: SyncDocument, updatedAt: number) {
  await sql.run(`INSERT INTO sync_document_clocks(document, updated_at) VALUES (?, ?)
    ON CONFLICT(document) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`, [document, timestamp(updatedAt)]);
}

export function createSyncRepository(database: Transactions, registry: RulesRegistry) {
  return {
    loadState: () => database.transaction(loadSyncState),

    /** Bind a fresh ledger file to an account. A file never changes account. */
    async bindAccount(accountId: string) {
      const id = text(accountId);
      return database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId === null || state.accountId === id, 'This practice file belongs to another account');
        if (state.accountId === null) await sql.run('UPDATE sync_state SET account_id = ? WHERE id = 1', [id]);
        return loadSyncState(sql);
      });
    },

    exportLedger: (): Promise<LedgerSnapshot> => database.transaction(exportLedger),

    /** Current rows and their difference from the last synced cloud state. Read-only. */
    async localChanges() {
      return database.transaction(async (sql) => {
        const snapshot = await exportLedger(sql);
        const manifest = await loadManifest(sql);
        const diff = diffLedger(manifest, snapshot.rows);
        return { snapshot, manifest, diff, significant: isSignificant(diff) };
      });
    },

    /** Persist the push before any network request, so a crash resends exactly the same push. */
    async beginPush(push: InflightPush) {
      const decoded = decodeInflight(JSON.parse(JSON.stringify(push)));
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null, 'Sign in before syncing');
        requireData(state.inflight === null || state.inflight.pushId === decoded.pushId, 'Another sync push is still pending');
        await sql.run('UPDATE sync_state SET inflight_json = ? WHERE id = 1', [JSON.stringify(decoded)]);
      });
    },

    /** The server applied (or had already applied) this push as `revision`. */
    async completePush(pushId: string, revision: number, at: number) {
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.inflight?.pushId === pushId, 'Unknown sync push acknowledgement');
        requireData(integer(revision, 1) > state.inflight.expectedRevision, 'Sync acknowledgement does not advance the revision');
        await writeManifest(sql, state.inflight.target);
        await sql.run('UPDATE sync_state SET synced_revision = ?, inflight_json = NULL, last_synced_at = ? WHERE id = 1', [revision, timestamp(at)]);
      });
    },

    /** The server rejected the push without applying it (revision conflict). */
    async abandonPush(pushId: string) {
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.inflight?.pushId === pushId, 'Unknown sync push');
        await sql.run('UPDATE sync_state SET inflight_json = NULL WHERE id = 1');
      });
    },

    /** Replace this device's ledger with the validated cloud state at `revision`. */
    async applyRemote(rows: readonly LedgerRow[], revision: number, at: number) {
      return database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null && state.inflight === null, 'Cannot apply cloud practice now');
        const progression = await replaceLedger(sql, registry, rows, at);
        // Validation may settle projections (e.g. habit decay); the manifest records the cloud rows themselves.
        await writeManifest(sql, rows.map((row) => [refId(row), row.hash] as const));
        await sql.run('UPDATE sync_state SET synced_revision = ?, last_synced_at = ? WHERE id = 1', [integer(revision), timestamp(at)]);
        return progression;
      });
    },

    /** Nothing to exchange: remember when the device last confirmed it matches the cloud. */
    async confirmSynced(revision: number, at: number) {
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null && state.inflight === null && state.syncedRevision === integer(revision), 'Sync state changed');
        await sql.run('UPDATE sync_state SET last_synced_at = ? WHERE id = 1', [timestamp(at)]);
      });
    },

    async documentClocks(): Promise<Partial<Record<SyncDocument, number>>> {
      return database.transaction(async (sql) => Object.fromEntries((await sql.all('SELECT * FROM sync_document_clocks')).map((value) => {
        const row = object(value);
        return [text(row.document), timestamp(row.updated_at)];
      })));
    },
  };
}
export type SyncRepository = ReturnType<typeof createSyncRepository>;
