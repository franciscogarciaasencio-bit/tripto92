import type { Transactions, SqlConnection } from '../database/connection';
import { object, requireData, timestamp } from '../database/validation';
import { touchDocument } from './sync-repository';

export async function loadExplanationDismissal(sql: SqlConnection) {
  const rows = await sql.all('SELECT * FROM application_preferences');
  requireData(rows.length === 1 && object(rows[0]).id === 1, 'Invalid application preferences');
  const at = object(rows[0]).explanation_dismissed_at;
  return at === null ? null : timestamp(at);
}
export function createApplicationRepository(database: Transactions) {
  return {
    isExplanationDismissed: () => database.transaction(async (sql) => (await loadExplanationDismissal(sql)) !== null),
    async dismissExplanation(at: number) {
      const captured = timestamp(at);
      await database.transaction(async (sql) => {
        await loadExplanationDismissal(sql);
        if (await loadExplanationDismissal(sql) !== null) return;
        await sql.run('UPDATE application_preferences SET explanation_dismissed_at = ? WHERE id = 1', [captured]);
        await touchDocument(sql, 'application_preferences', captured);
      });
    },
  };
}
