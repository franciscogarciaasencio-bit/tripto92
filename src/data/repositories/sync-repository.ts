import type { SqlConnection, Transactions } from '../database/connection';
import type { RulesRegistry } from '../database/decoders';
import { applyLedgerDiff, diffLedger, exportLedger, isSignificant, recordsPractice, ledgerRow, ledgerTable, manifestOf, replaceLedger,
  type LedgerDiff, type LedgerRef, type LedgerRow, type LedgerSnapshot } from '../database/ledger';
import { array, integer, json, object, requireData, text, timestamp } from '../database/validation';
import { decodePreferences } from '../preferences';
import { decodeAudioPreferences } from '../audio-preferences';
import { loadPreferences, loadAudioPreferences } from './settings-repository';
import { loadExplanationDismissal } from './application-repository';

export const SYNC_DOCUMENTS = ['meditation_preferences', 'audio_preferences', 'application_preferences'] as const;
export type SyncDocument = (typeof SYNC_DOCUMENTS)[number];
export type PushKind = 'upload' | 'merge';

/** One durable push awaiting the server's answer; resent unchanged after a crash or lost response. */
export interface InflightPush {
  readonly pushId: string;
  readonly expectedRevision: number;
  readonly kind: PushKind;
  readonly diff: LedgerDiff;
  /** Settlement time (checkpoint asOf) of the state this push produces; lets merges pick a safe base. */
  readonly asOf: number;
}
export interface SyncState {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly syncedRevision: number;
  readonly inflight: InflightPush | null;
  readonly lastSyncedAt: number | null;
}
export interface SyncedDocument { readonly document: SyncDocument; readonly data: unknown; readonly updatedAt: number }

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
    pushId: text(source.pushId), expectedRevision: integer(source.expectedRevision), kind, asOf: timestamp(source.asOf),
    diff: {
      removes: array(diff.removes, decodeRef),
      adds: array(diff.adds, (entry) => { const row = object(entry); return ledgerRow(row.table, row.row); }),
    },
  };
}
const syncDocument = (value: unknown): SyncDocument => {
  requireData((SYNC_DOCUMENTS as readonly unknown[]).includes(value), 'Unknown synced document');
  return value as SyncDocument;
};

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

/** The last synced cloud state as full rows; null if this file predates stored base content. */
export async function loadBase(sql: SqlConnection): Promise<LedgerRow[] | null> {
  const rows: LedgerRow[] = [];
  for (const value of await sql.all('SELECT table_name, row_key, row_hash, row_json FROM sync_manifest')) {
    const entry = object(value);
    if (entry.row_json === null) return null;
    const row = ledgerRow(entry.table_name, json(entry.row_json));
    requireData(row.key === text(entry.row_key) && row.hash === text(entry.row_hash), 'Synced base row is corrupt');
    rows.push(row);
  }
  return rows;
}

async function writeBase(sql: SqlConnection, rows: readonly LedgerRow[]) {
  await sql.run('DELETE FROM sync_manifest');
  for (const row of rows) {
    await sql.run('INSERT INTO sync_manifest(table_name, row_key, row_hash, row_json) VALUES (?, ?, ?, ?)',
      [row.table, row.key, row.hash, JSON.stringify(row.row)]);
  }
}

/** Settlement time recorded in a ledger's progression checkpoint. */
export function ledgerAsOf(rows: readonly LedgerRow[]): number {
  const checkpoint = rows.find((row) => row.table === 'progression_checkpoint');
  requireData(checkpoint, 'Ledger has no progression checkpoint');
  return timestamp(object(object(json(checkpoint.row.metadata_json)).asOf).timestamp);
}

/** Record a local edit time for a synced preference document (newest edit wins across devices). */
export async function touchDocument(sql: SqlConnection, document: SyncDocument, updatedAt: number) {
  await sql.run(`INSERT INTO sync_document_clocks(document, updated_at) VALUES (?, ?)
    ON CONFLICT(document) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`, [document, timestamp(updatedAt)]);
}

async function documentContent(sql: SqlConnection, document: SyncDocument): Promise<unknown> {
  if (document === 'meditation_preferences') return loadPreferences(sql);
  if (document === 'audio_preferences') return loadAudioPreferences(sql);
  return { explanationDismissedAt: await loadExplanationDismissal(sql) };
}

async function writeDocument(sql: SqlConnection, document: SyncDocument, data: unknown) {
  if (document === 'meditation_preferences') {
    await sql.run('UPDATE meditation_preferences SET preferences_json = ? WHERE id = 1', [JSON.stringify(decodePreferences(data))]);
  } else if (document === 'audio_preferences') {
    await sql.run('UPDATE audio_preferences SET preferences_json = ? WHERE id = 1', [JSON.stringify(decodeAudioPreferences(data))]);
  } else {
    const value = object(data).explanationDismissedAt;
    // Dismissal is one-way: a remote "not dismissed" never reopens the explanation here.
    if (value !== null && value !== undefined) await sql.run(
      'UPDATE application_preferences SET explanation_dismissed_at = COALESCE(explanation_dismissed_at, ?) WHERE id = 1', [timestamp(value)]);
  }
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

    /**
     * Current rows, the last synced base and their difference. Read-only. `base` is null when it
     * must be downloaded again (files from before base content was stored).
     */
    async localChanges() {
      return database.transaction(async (sql) => {
        const snapshot = await exportLedger(sql);
        const base = await loadBase(sql);
        const manifest = new Map((await sql.all('SELECT table_name, row_key, row_hash FROM sync_manifest')).map((value) => {
          const row = object(value);
          return [`${ledgerTable(row.table_name)}\u0000${text(row.row_key)}`, text(row.row_hash)] as const;
        }));
        const diff = diffLedger(manifest, snapshot.rows);
        const significant = isSignificant(diff) && recordsPractice(snapshot.rows);
        return { snapshot, base, diff, significant, asOf: ledgerAsOf(snapshot.rows) };
      });
    },

    /** Replace the stored base with a downloaded copy of the cloud state at the synced revision. */
    async adoptBase(rows: readonly LedgerRow[], revision: number) {
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null && state.inflight === null && state.syncedRevision === integer(revision), 'Sync state changed');
        const current = new Map(manifestOf(rows));
        const stored = await sql.all('SELECT table_name, row_key, row_hash FROM sync_manifest');
        requireData(stored.length === current.size && stored.every((value) => {
          const row = object(value);
          return current.get(`${text(row.table_name)}\u0000${text(row.row_key)}`) === text(row.row_hash);
        }), 'Downloaded base does not match the synced revision');
        await writeBase(sql, rows);
      });
    },

    /** Persist the push before any network request, so a crash resends exactly the same push. */
    async beginPush(push: InflightPush) {
      const decoded = decodeInflight(JSON.parse(JSON.stringify(push)));
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null, 'Sign in before syncing');
        requireData(state.inflight === null || state.inflight.pushId === decoded.pushId, 'Another sync push is still pending');
        requireData(decoded.expectedRevision === state.syncedRevision, 'A push must start from the synced revision');
        await sql.run('UPDATE sync_state SET inflight_json = ? WHERE id = 1', [JSON.stringify(decoded)]);
      });
    },

    /** The server applied (or had already applied) this push as `revision`: base := base + diff. */
    async completePush(pushId: string, revision: number, at: number) {
      await database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.inflight?.pushId === pushId, 'Unknown sync push acknowledgement');
        requireData(integer(revision, 1) === state.inflight.expectedRevision + 1, 'Sync acknowledgement skips a revision');
        const base = await loadBase(sql);
        requireData(base, 'Synced base is unavailable');
        await writeBase(sql, applyLedgerDiff(base, state.inflight.diff));
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

    /** Replace this device's ledger with the validated cloud state at `revision`, which becomes the base. */
    async applyRemote(rows: readonly LedgerRow[], revision: number, at: number) {
      return database.transaction(async (sql) => {
        const state = await loadSyncState(sql);
        requireData(state.accountId !== null && state.inflight === null, 'Cannot apply cloud practice now');
        const progression = await replaceLedger(sql, registry, rows, at);
        // Validation may settle projections (e.g. habit decay); the base records the cloud rows themselves.
        await writeBase(sql, rows);
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

    /** Preference documents edited here since they were last confirmed by the cloud. */
    async pendingDocuments(): Promise<SyncedDocument[]> {
      return database.transaction(async (sql) => {
        const result: SyncedDocument[] = [];
        for (const value of await sql.all('SELECT * FROM sync_document_clocks WHERE synced_at IS NULL OR synced_at < updated_at ORDER BY document')) {
          const row = object(value);
          const document = syncDocument(row.document);
          result.push({ document, data: await documentContent(sql, document), updatedAt: timestamp(row.updated_at) });
        }
        return result;
      });
    },

    /**
     * Apply the cloud's winning copy of a document. A newer local edit is kept (it is pushed next);
     * otherwise the cloud content is validated and stored, and the document is marked synced.
     */
    async acceptDocument(document: SyncDocument, data: unknown, updatedAt: number) {
      const name = syncDocument(document);
      const at = timestamp(updatedAt);
      return database.transaction(async (sql) => {
        const row = (await sql.all('SELECT updated_at FROM sync_document_clocks WHERE document = ?', [name]))[0];
        const local = row ? timestamp(object(row).updated_at) : null;
        if (local !== null && local > at) return false;
        if (local === null || local < at) await writeDocument(sql, name, data);
        await sql.run(`INSERT INTO sync_document_clocks(document, updated_at, synced_at) VALUES (?, ?, ?)
          ON CONFLICT(document) DO UPDATE SET updated_at = excluded.updated_at, synced_at = excluded.synced_at`, [name, at, at]);
        return local === null || local < at;
      });
    },
  };
}
export type SyncRepository = ReturnType<typeof createSyncRepository>;
