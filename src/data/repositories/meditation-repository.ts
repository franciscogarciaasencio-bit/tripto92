import { advanceProgression, changeProgressionRules, getProgressSnapshot } from '../../domain/progression';
import type { CalendarContext, MeditationSession } from '../../domain/progression';
import type { Transactions } from '../database/connection';
import { decodeContext, decodeSession, decodeSessionRow, type RulesRegistry, type StoredMeditationSession } from '../database/decoders';
import { appendTransition, loadState, writeCheckpoint } from '../database/records';
import { integer, requireData, timestamp } from '../database/validation';
import { completedPracticeCount, loadCompletion, pendingCompletion, persistCompletion } from '../database/completions';

export interface HistoryQuery { readonly limit?: number; readonly offset?: number }

export function createMeditationRepository(database: Transactions, registry: RulesRegistry) {
  return {
    loadProgressionState: () => database.transaction((sql) => loadState(sql, registry)),
    getCompletedPracticeCount: () => database.transaction(completedPracticeCount),
    getPendingCompletion: () => database.transaction(pendingCompletion),
    async acknowledgeCompletion(id: string, acknowledgedAt: number) {
      const at = timestamp(acknowledgedAt);
      return database.transaction(async (sql) => {
        const completion = await loadCompletion(sql, id);
        requireData(completion && at >= completion.session.endedAt, 'Invalid completion acknowledgement');
        await sql.run('UPDATE practice_completions SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE session_id = ?', [at, id]);
      });
    },
    async completePractice(input: MeditationSession, createdAt: number) {
      const session = decodeSession(input);
      const created = timestamp(createdAt);
      requireData(created >= session.endedAt, 'Creation timestamp precedes completion');
      return database.transaction(async (sql) => {
        const after = await persistCompletion(sql, await loadState(sql, registry), session, created);
        const completion = await loadCompletion(sql, session.id);
        requireData(completion, 'Legacy history cannot fabricate a completion summary');
        return { snapshot: getProgressSnapshot(after, after.asOf), completion };
      });
    },

    async recordCompletedMeditation(input: MeditationSession, createdAt: number) {
      // Decode immediately so caller mutation while this operation is queued cannot affect the save.
      const session = decodeSession(input);
      const created = timestamp(createdAt);
      requireData(created >= session.endedAt, 'Creation timestamp precedes completion');
      return database.transaction(async (sql) => {
        const before = await loadState(sql, registry);
        const after = await persistCompletion(sql, before, session, created);
        return getProgressSnapshot(after, after.asOf);
      });
    },

    async getMeditationHistory(query: HistoryQuery = {}): Promise<readonly StoredMeditationSession[]> {
      const limit = integer(query.limit ?? 50, 1);
      const offset = integer(query.offset ?? 0);
      requireData(limit <= 1000, 'History limit must not exceed 1000');
      return database.transaction(async (sql) => {
        const rows = await sql.all('SELECT * FROM meditation_sessions ORDER BY ended_at DESC, sequence DESC LIMIT ? OFFSET ?', [limit, offset]);
        return rows.map((value) => {
          const row = decodeSessionRow(value);
          return { session: row.session, createdAt: row.createdAt };
        });
      });
    },

    async getCurrentProgressionSnapshot(input: CalendarContext) {
      const asOf = decodeContext(input);
      return database.transaction(async (sql) => {
        const state = advanceProgression(await loadState(sql, registry), asOf);
        await writeCheckpoint(sql, state);
        return getProgressSnapshot(state, asOf);
      });
    },

    /** Deliberate release boundary; opening the database never opts into new rules automatically. */
    async changeRules(version: string, input: CalendarContext) {
      const rules = registry.get(version);
      const asOf = decodeContext(input);
      return database.transaction(async (sql) => {
        const before = await loadState(sql, registry);
        const after = changeProgressionRules(before, rules, asOf);
        await appendTransition(sql, before, after, asOf.timestamp);
        return getProgressSnapshot(after, asOf);
      });
    },
  };
}
export type MeditationRepository = ReturnType<typeof createMeditationRepository>;
