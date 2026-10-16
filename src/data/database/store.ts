import { advanceProgression, changeProgressionRules, createProgressionState, getProgressSnapshot, readingContext } from '../../domain/progression';
import { settleTimer, timerSession } from '../../domain/meditation/timer';
import type { CalendarContext, ProgressionRules } from '../../domain/progression';
import { DEFAULT_PREFERENCES } from '../preferences';
import { createMeditationRepository } from '../repositories/meditation-repository';
import { createSettingsRepository, loadPreferences, loadAudioPreferences } from '../repositories/settings-repository';
import { createTimerRepository, loadTimer } from '../repositories/timer-repository';
import { createTransactions, type SqlConnection } from './connection';
import { createRulesRegistry, decodeContext } from './decoders';
import { migrate } from './migrations';
import { appendTransition, loadState, writeCheckpoint } from './records';
import { completedPracticeCount, isSetAside, pendingCompletion, persistCompletion, validateCompletions } from './completions';
import { loadJourney } from './journey';
import { createApplicationRepository, loadExplanationDismissal } from '../repositories/application-repository';
import { loadHabit } from './habit';
import { DEFAULT_AUDIO_PREFERENCES } from '../audio-preferences';
import { createSyncRepository, loadSyncState } from '../repositories/sync-repository';

/** Internal factory shared by native adapter and real SQLite tests; application code uses initializeDatabase. */
export async function openStore(connection: SqlConnection, input: CalendarContext, supportedRules?: readonly ProgressionRules[], activateRulesVersion?: string) {
  const database = createTransactions(connection);
  try {
    const asOf = decodeContext(input);
    const registry = createRulesRegistry(supportedRules);
    // All configuration is connection-local. No other code receives this connection.
    await connection.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    const restored = await database.transaction(async (sql) => {
      const migration = await migrate(sql);
      if (migration.previousVersion < 5) await sql.run('UPDATE audio_preferences SET preferences_json=? WHERE id=1', [JSON.stringify(DEFAULT_AUDIO_PREFERENCES)]);
      if (migration.previousVersion === 0) {
        await appendTransition(sql, null, createProgressionState(asOf), asOf.timestamp);
        await sql.run('INSERT INTO meditation_preferences(id, preferences_json) VALUES (1, ?)', [JSON.stringify(DEFAULT_PREFERENCES)]);
      }
      let state = await loadState(sql, registry);
      await loadJourney(sql, state, migration.previousVersion < 4);
      const storedDraft = await loadTimer(sql);
      const draft = storedDraft ? settleTimer(storedDraft, asOf.timestamp) : null;
      let recoveredSession = null, recoveredSetAside = false;
      const previousRank = getProgressSnapshot(state, state.asOf).currentRank;
      // Recover a pending completion BEFORE advancing the chronological progression cursor.
      if (draft?.phase === 'finished') {
        recoveredSession = timerSession(draft);
        state = await persistCompletion(sql, state, recoveredSession, asOf.timestamp);
        recoveredSetAside = await isSetAside(sql, recoveredSession.id);
      }
      // A device clock behind the stored settlement opens at that settlement; it never rewinds.
      const at = readingContext(state.asOf, asOf);
      state = advanceProgression(state, at);
      // Deliberate release policy supplied by the native adapter, AFTER old pending completions and old decay.
      const releasedUpgrade = (state.activeRulesVersion === 'progression_v1' && activateRulesVersion !== 'progression_v1') ||
        (['progression_v1', 'progression_v2', 'progression_v3'].includes(state.activeRulesVersion) && activateRulesVersion === 'progression_v4') ||
        (['progression_v1', 'progression_v2', 'progression_v3', 'progression_v4'].includes(state.activeRulesVersion) && activateRulesVersion === 'progression_v5') ||
        (['progression_v1', 'progression_v2', 'progression_v3', 'progression_v4', 'progression_v5'].includes(state.activeRulesVersion) && activateRulesVersion === 'progression_v6') ||
        (['progression_v1', 'progression_v2'].includes(state.activeRulesVersion) && activateRulesVersion === 'progression_v3');
      if (activateRulesVersion && releasedUpgrade) {
        const changed = changeProgressionRules(state, registry.get(activateRulesVersion), at);
        await appendTransition(sql, state, changed, at.timestamp);
        state = changed;
      }
      await loadPreferences(sql);
      await loadAudioPreferences(sql);
      await writeCheckpoint(sql, state);
      const habit = await loadHabit(sql, state, migration.previousVersion < 8 || releasedUpgrade);
      await validateCompletions(sql, registry);
      const dismissed = await loadExplanationDismissal(sql);
      const sync = await loadSyncState(sql);
      return { initialSnapshot: getProgressSnapshot(state, at), initialTimer: draft?.phase === 'finished' ? null : draft,
        initialJourney: habit?.journey ?? await loadJourney(sql, state), initialHabit: habit?.checkpoint ?? null, initialExplanationDismissed: dismissed !== null,
        recoveredSession, recoveredSetAside, previousRank, initialCompletion: await pendingCompletion(sql),
        initialCompletedPractices: await completedPracticeCount(sql), initialSync: sync };
    });
    return {
      meditations: createMeditationRepository(database, registry),
      settings: createSettingsRepository(database),
      timer: createTimerRepository(database),
      application: createApplicationRepository(database),
      sync: createSyncRepository(database, registry),
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
