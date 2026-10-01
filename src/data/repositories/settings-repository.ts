import type { SqlConnection, Transactions } from '../database/connection';
import { json, object, requireData } from '../database/validation';
import { decodePreferences, type MeditationPreferences } from '../preferences';

export async function loadPreferences(sql: SqlConnection): Promise<MeditationPreferences> {
  const rows = await sql.all('SELECT * FROM meditation_preferences');
  requireData(rows.length === 1 && object(rows[0]).id === 1, 'Preferences singleton is missing or invalid');
  return decodePreferences(json(object(rows[0]).preferences_json));
}

export function createSettingsRepository(database: Transactions) {
  return {
    loadPreferences: () => database.transaction(loadPreferences),
    async savePreferences(input: MeditationPreferences): Promise<void> {
      const preferences = decodePreferences(input);
      await database.transaction(async (sql) => {
        await loadPreferences(sql);
        await sql.run('UPDATE meditation_preferences SET preferences_json = ? WHERE id = 1', [JSON.stringify(preferences)]);
      });
    },
  };
}
export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
