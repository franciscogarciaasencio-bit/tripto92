import { openDatabaseAsync } from 'expo-sqlite';
import { createProgressionState } from '../../domain/progression';
import type { CalendarContext, ProgressionRules } from '../../domain/progression';
import { decodeContext } from './decoders';
import { openStore, type MeditationStore } from './store';

export interface DatabaseOptions {
  readonly databaseName?: string;
  /** Register future definitions explicitly, retaining every historical version. */
  readonly supportedRules?: readonly ProgressionRules[];
}

/** Own and close one store at application lifecycle level, outside React screens. */
export async function initializeDatabase(asOf: CalendarContext, options: DatabaseOptions = {}): Promise<MeditationStore> {
  const context = decodeContext(asOf);
  const supportedRules = options.supportedRules?.map((rules) => createProgressionState(context, rules).ruleSets[0]!);
  const database = await openDatabaseAsync(options.databaseName ?? 'meditation.db', { useNewConnection: true });
  return openStore({
    exec: (sql) => database.execAsync(sql),
    run: async (sql, parameters = []) => { await database.runAsync(sql, [...parameters]); },
    all: (sql, parameters = []) => database.getAllAsync<unknown>(sql, [...parameters]),
    close: () => database.closeAsync(),
  }, context, supportedRules);
}
