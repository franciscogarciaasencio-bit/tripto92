import { advanceProgression, createProgressionState, getProgressSnapshot } from '../../domain/progression';
import type { CalendarContext, ProgressionRules } from '../../domain/progression';
import { DEFAULT_PREFERENCES } from '../preferences';
import { createMeditationRepository } from '../repositories/meditation-repository';
import { createSettingsRepository, loadPreferences } from '../repositories/settings-repository';
import { createTransactions, type SqlConnection } from './connection';
import { createRulesRegistry, decodeContext } from './decoders';
import { migrate } from './migrations';
import { appendTransition, loadState, writeCheckpoint } from './records';

/** Internal factory shared by native adapter and real SQLite tests; application code uses initializeDatabase. */
export async function openStore(connection: SqlConnection, input: CalendarContext, supportedRules?: readonly ProgressionRules[]) {
  const database = createTransactions(connection);
  try {
    const asOf = decodeContext(input);
    const registry = createRulesRegistry(supportedRules);
    // All configuration is connection-local. No other code receives this connection.
    await connection.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    const initialSnapshot = await database.transaction(async (sql) => {
      const migration = await migrate(sql);
      if (migration.previousVersion === 0) {
        await appendTransition(sql, null, createProgressionState(asOf), asOf.timestamp);
        await sql.run('INSERT INTO meditation_preferences(id, preferences_json) VALUES (1, ?)', [JSON.stringify(DEFAULT_PREFERENCES)]);
      }
      const state = advanceProgression(await loadState(sql, registry), asOf);
      await loadPreferences(sql);
      await writeCheckpoint(sql, state);
      return getProgressSnapshot(state, asOf);
    });
    return {
      meditations: createMeditationRepository(database, registry),
      settings: createSettingsRepository(database),
      initialSnapshot,
      close: database.close,
    };
  } catch (error) {
    try { await database.close(); }
    catch (closeError) { throw new AggregateError([error, closeError], 'Initialization and database cleanup failed'); }
    throw error;
  }
}
export type MeditationStore = Awaited<ReturnType<typeof openStore>>;
