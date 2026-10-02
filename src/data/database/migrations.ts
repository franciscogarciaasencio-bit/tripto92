import type { SqlConnection } from './connection';
import { PersistenceError } from './errors';
import { SCHEMA_V1 } from './schema';
import { integer, object, text } from './validation';

export interface Migration { readonly version: number; readonly name: string; readonly sql: string }
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'local_meditation_v1', sql: SCHEMA_V1 },
  { version: 2, name: 'durable_meditation_timer', sql: `CREATE TABLE meditation_timer (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), draft_json TEXT NOT NULL
  );` },
];

/** Caller owns the transaction: schema, migration markers and first checkpoint commit together. */
export async function migrate(sql: SqlConnection, migrations = MIGRATIONS): Promise<{ previousVersion: number; version: number }> {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1 || !migration.name.trim()) throw new Error('Migrations must be sequential from V1');
  });
  await sql.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL
  )`);
  const applied = await sql.all('SELECT version, name FROM schema_migrations ORDER BY version');
  applied.forEach((value, index) => {
    const row = object(value);
    const expected = migrations[index];
    if (!expected || integer(row.version, 1) !== expected.version || text(row.name) !== expected.name) {
      throw new PersistenceError('UNSUPPORTED_SCHEMA', 'Database migration history does not match this application');
    }
  });
  for (const migration of migrations.slice(applied.length)) {
    await sql.exec(migration.sql);
    await sql.run('INSERT INTO schema_migrations(version, name) VALUES (?, ?)', [migration.version, migration.name]);
  }
  return { previousVersion: applied.length, version: migrations.length };
}
