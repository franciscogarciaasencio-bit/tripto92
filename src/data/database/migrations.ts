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
  { version: 3, name: 'open_ended_practice_and_completion_summary', sql: `
    UPDATE meditation_timer SET draft_json = json_set(draft_json, '$.mode', 'timed');
    CREATE TABLE practice_completions (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES meditation_sessions(id),
      before_progression_centi INTEGER NOT NULL CHECK (typeof(before_progression_centi) = 'integer' AND before_progression_centi >= 0),
      after_progression_centi INTEGER NOT NULL CHECK (typeof(after_progression_centi) = 'integer' AND after_progression_centi >= 0),
      acknowledged_at INTEGER CHECK (acknowledged_at IS NULL OR (typeof(acknowledged_at) = 'integer' AND acknowledged_at >= 0))
    );
    CREATE TRIGGER practice_completions_immutable BEFORE UPDATE OF session_id, before_progression_centi, after_progression_centi ON practice_completions
      BEGIN SELECT RAISE(ABORT, 'Completion summary is immutable'); END;
    CREATE TRIGGER practice_completions_no_delete BEFORE DELETE ON practice_completions
      BEGIN SELECT RAISE(ABORT, 'Completion summary is immutable'); END;
  ` },
  { version: 4, name: 'permanent_habit_journey', sql: `
    CREATE TABLE journey_checkpoint (
      id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1), version TEXT NOT NULL,
      level INTEGER NOT NULL CHECK(typeof(level) = 'integer' AND level BETWEEN 1 AND 125),
      achieved_at INTEGER NOT NULL CHECK(typeof(achieved_at) = 'integer' AND achieved_at >= 0)
    );
    CREATE TRIGGER journey_checkpoint_monotonic BEFORE UPDATE ON journey_checkpoint
      WHEN NEW.level < OLD.level OR NEW.version != OLD.version OR NEW.achieved_at < OLD.achieved_at
      BEGIN SELECT RAISE(ABORT, 'Journey achievement cannot decrease'); END;
    CREATE TRIGGER journey_checkpoint_no_delete BEFORE DELETE ON journey_checkpoint
      BEGIN SELECT RAISE(ABORT, 'Journey achievement cannot be deleted'); END;
    CREATE TABLE journey_completions (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES practice_completions(session_id),
      before_level INTEGER NOT NULL CHECK(typeof(before_level) = 'integer' AND before_level BETWEEN 1 AND 125),
      after_level INTEGER NOT NULL CHECK(typeof(after_level) = 'integer' AND after_level BETWEEN before_level AND 125),
      credits_added INTEGER NOT NULL CHECK(typeof(credits_added) = 'integer' AND credits_added BETWEEN 0 AND 1),
      date_credits INTEGER NOT NULL CHECK(typeof(date_credits) = 'integer' AND date_credits BETWEEN 0 AND 2)
    );
    CREATE TRIGGER journey_completions_immutable BEFORE UPDATE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    CREATE TRIGGER journey_completions_no_delete BEFORE DELETE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    CREATE TABLE application_preferences (
      id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
      explanation_dismissed_at INTEGER CHECK(explanation_dismissed_at IS NULL OR
        (typeof(explanation_dismissed_at) = 'integer' AND explanation_dismissed_at >= 0))
    );
    INSERT INTO application_preferences VALUES (1, NULL);
  ` },
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
