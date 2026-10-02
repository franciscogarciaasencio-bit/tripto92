import { advanceProgression, createProgressionState, getProgressSnapshot, recordSession } from '../../domain/progression';
import { settleTimer, timerSession } from '../../domain/meditation/timer';
import type { CalendarContext, ProgressionRules } from '../../domain/progression';
import { DEFAULT_PREFERENCES } from '../preferences';
import { createMeditationRepository } from '../repositories/meditation-repository';
import { createSettingsRepository, loadPreferences } from '../repositories/settings-repository';
import { createTimerRepository, loadTimer } from '../repositories/timer-repository';
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
    const restored = await database.transaction(async (sql) => {
      const migration = await migrate(sql);
      if (migration.previousVersion === 0) {
        await appendTransition(sql, null, createProgressionState(asOf), asOf.timestamp);
        await sql.run('INSERT INTO meditation_preferences(id, preferences_json) VALUES (1, ?)', [JSON.stringify(DEFAULT_PREFERENCES)]);
      }
      let state = await loadState(sql, registry);
      const storedDraft = await loadTimer(sql);
      const draft = storedDraft ? settleTimer(storedDraft, asOf.timestamp) : null;
      let recoveredSession = null;
      const previousRank = getProgressSnapshot(state, state.asOf).currentRank;
      // Recover a pending completion BEFORE advancing the chronological progression cursor.
      if (draft?.phase === 'finished') {
        recoveredSession = timerSession(draft);
        const after = recordSession(state, recoveredSession);
        if (after !== state) await appendTransition(sql, state, after, asOf.timestamp);
        state = after;
        await sql.run('DELETE FROM meditation_timer WHERE id = 1');
      }
      state = advanceProgression(state, asOf);
      await loadPreferences(sql);
      await writeCheckpoint(sql, state);
      return { initialSnapshot: getProgressSnapshot(state, asOf), initialTimer: draft?.phase === 'finished' ? null : draft,
        recoveredSession, previousRank };
    });
    return {
      meditations: createMeditationRepository(database, registry),
      settings: createSettingsRepository(database),
      timer: createTimerRepository(database),
      ...restored,
      close: database.close,
    };
  } catch (error) {
    try { await database.close(); }
    catch (closeError) { throw new AggregateError([error, closeError], 'Initialization and database cleanup failed'); }
    throw error;
  }
}
export type MeditationStore = Awaited<ReturnType<typeof openStore>>;
