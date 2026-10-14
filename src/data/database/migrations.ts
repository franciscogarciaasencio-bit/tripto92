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
  { version: 5, name: 'independent_audio_preferences', sql: `
    CREATE TABLE audio_preferences (
      id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1), preferences_json TEXT NOT NULL
    );
    INSERT INTO audio_preferences VALUES (1, '{"version":1,"homeEnabled":true,"homeVolume":0.15,"sessionSound":"ocean_music","sessionVolume":0.15,"openingBellEnabled":false,"closingBellEnabled":false}');
  ` },
  { version: 6, name: 'progression_generations_and_level_zero', sql: `
    CREATE TABLE progression_generations (
      id INTEGER PRIMARY KEY NOT NULL CHECK(typeof(id) = 'integer' AND id > 0),
      started_at INTEGER NOT NULL CHECK(typeof(started_at) = 'integer' AND started_at >= 0),
      boundary_json TEXT,
      closed_checkpoint_json TEXT,
      closed_progression_centi INTEGER CHECK(closed_progression_centi IS NULL OR
        (typeof(closed_progression_centi) = 'integer' AND closed_progression_centi >= 0)),
      closed_journey_json TEXT,
      CHECK((closed_checkpoint_json IS NULL) = (closed_progression_centi IS NULL)),
      CHECK((closed_checkpoint_json IS NULL) = (closed_journey_json IS NULL))
    );
    INSERT INTO progression_generations(id, started_at) VALUES(1, 0);
    CREATE TRIGGER progression_generations_close_once BEFORE UPDATE ON progression_generations
      WHEN OLD.closed_checkpoint_json IS NOT NULL OR NEW.id != OLD.id OR
        NEW.started_at != OLD.started_at OR NEW.boundary_json IS NOT OLD.boundary_json OR
        NEW.closed_checkpoint_json IS NULL
      BEGIN SELECT RAISE(ABORT, 'Progression generation is immutable once closed'); END;
    CREATE TRIGGER progression_generations_no_delete BEFORE DELETE ON progression_generations
      BEGIN SELECT RAISE(ABORT, 'Progression generation cannot be deleted'); END;
    -- SQLite rejects ADD COLUMN REFERENCES with a non-null default on populated tables.
    -- Existing immutable rows receive generation 1; insert triggers enforce the same relationship.
    ALTER TABLE meditation_sessions ADD COLUMN generation_id INTEGER NOT NULL DEFAULT 1
      CHECK(typeof(generation_id) = 'integer' AND generation_id > 0);
    ALTER TABLE progression_awards ADD COLUMN generation_id INTEGER NOT NULL DEFAULT 1
      CHECK(typeof(generation_id) = 'integer' AND generation_id > 0);
    CREATE TRIGGER sessions_generation_valid BEFORE INSERT ON meditation_sessions
      WHEN NOT EXISTS(SELECT 1 FROM progression_generations g WHERE g.id = NEW.generation_id AND
        g.closed_checkpoint_json IS NULL AND NEW.started_at >= g.started_at)
      BEGIN SELECT RAISE(ABORT, 'Invalid meditation progression generation'); END;
    CREATE TRIGGER awards_generation_valid BEFORE INSERT ON progression_awards
      WHEN EXISTS(SELECT 1 FROM meditation_sessions WHERE id = NEW.session_id) AND
        NOT EXISTS(SELECT 1 FROM meditation_sessions s WHERE s.id = NEW.session_id AND s.generation_id = NEW.generation_id)
      BEGIN SELECT RAISE(ABORT, 'Invalid award progression generation'); END;
    DROP TRIGGER journey_completions_immutable;
    DROP TRIGGER journey_completions_no_delete;
    ALTER TABLE journey_completions RENAME TO legacy_journey_completions;
    CREATE TABLE journey_completions (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES practice_completions(session_id),
      before_level INTEGER NOT NULL CHECK(typeof(before_level) = 'integer' AND before_level BETWEEN 0 AND 125),
      after_level INTEGER NOT NULL CHECK(typeof(after_level) = 'integer' AND after_level BETWEEN before_level AND 125),
      credits_added INTEGER NOT NULL CHECK(typeof(credits_added) = 'integer' AND credits_added BETWEEN 0 AND 1),
      date_credits INTEGER NOT NULL CHECK(typeof(date_credits) = 'integer' AND date_credits BETWEEN 0 AND 2),
      display_version INTEGER NOT NULL CHECK(display_version IN (1, 2))
    );
    INSERT INTO journey_completions SELECT *, 1 FROM legacy_journey_completions;
    DROP TABLE legacy_journey_completions;
    CREATE TRIGGER journey_completions_immutable BEFORE UPDATE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    CREATE TRIGGER journey_completions_no_delete BEFORE DELETE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    DROP TRIGGER journey_checkpoint_monotonic;
    DROP TRIGGER journey_checkpoint_no_delete;
    ALTER TABLE journey_checkpoint RENAME TO legacy_journey_checkpoint;
    CREATE TRIGGER legacy_journey_checkpoint_immutable_update BEFORE UPDATE ON legacy_journey_checkpoint
      BEGIN SELECT RAISE(ABORT, 'Historical journey checkpoint is immutable'); END;
    CREATE TRIGGER legacy_journey_checkpoint_immutable_delete BEFORE DELETE ON legacy_journey_checkpoint
      BEGIN SELECT RAISE(ABORT, 'Historical journey checkpoint is immutable'); END;
    CREATE TABLE journey_checkpoint (
      id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1), generation_id INTEGER NOT NULL REFERENCES progression_generations(id),
      version TEXT NOT NULL, level INTEGER NOT NULL CHECK(typeof(level) = 'integer' AND level BETWEEN 0 AND 125),
      achieved_at INTEGER NOT NULL CHECK(typeof(achieved_at) = 'integer' AND achieved_at >= 0)
    );
    INSERT INTO journey_checkpoint SELECT id, 1, version,
      CASE WHEN level = 1 AND NOT EXISTS(SELECT 1 FROM meditation_sessions WHERE status = 'completed' AND active_seconds >= 180)
        THEN 0 ELSE level END, achieved_at FROM legacy_journey_checkpoint;
    CREATE TRIGGER journey_checkpoint_monotonic BEFORE UPDATE ON journey_checkpoint
      WHEN NEW.generation_id < OLD.generation_id OR NEW.version != OLD.version OR NEW.achieved_at < OLD.achieved_at OR
        (NEW.generation_id = OLD.generation_id AND NEW.level < OLD.level)
      BEGIN SELECT RAISE(ABORT, 'Journey achievement cannot decrease within a generation'); END;
    CREATE TRIGGER journey_checkpoint_no_delete BEFORE DELETE ON journey_checkpoint
      BEGIN SELECT RAISE(ABORT, 'Journey achievement cannot be deleted'); END;
    CREATE INDEX sessions_by_generation ON meditation_sessions(generation_id, sequence);
    CREATE INDEX awards_by_generation ON progression_awards(generation_id, sequence);
  ` },
  { version: 7, name: 'gentle_journey_and_reward_animation', sql: `
    CREATE TABLE journey_legacy_peaks (
      generation_id INTEGER PRIMARY KEY NOT NULL REFERENCES progression_generations(id),
      version TEXT NOT NULL CHECK(version = 'ona_journey_v2'),
      level INTEGER NOT NULL CHECK(typeof(level) = 'integer' AND level BETWEEN 0 AND 125),
      achieved_at INTEGER NOT NULL CHECK(typeof(achieved_at) = 'integer' AND achieved_at >= 0)
    );
    INSERT INTO journey_legacy_peaks SELECT generation_id, version, level, achieved_at FROM journey_checkpoint;
    CREATE TRIGGER journey_legacy_peaks_immutable_update BEFORE UPDATE ON journey_legacy_peaks
      BEGIN SELECT RAISE(ABORT, 'Historical journey achievement is immutable'); END;
    CREATE TRIGGER journey_legacy_peaks_immutable_delete BEFORE DELETE ON journey_legacy_peaks
      BEGIN SELECT RAISE(ABORT, 'Historical journey achievement is immutable'); END;
    DROP TRIGGER journey_checkpoint_monotonic;
    UPDATE journey_checkpoint SET version = 'ona_journey_v3';
    CREATE TRIGGER journey_checkpoint_monotonic BEFORE UPDATE ON journey_checkpoint
      WHEN NEW.generation_id < OLD.generation_id OR NEW.version != OLD.version OR NEW.achieved_at < OLD.achieved_at OR
        (NEW.generation_id = OLD.generation_id AND NEW.level < OLD.level)
      BEGIN SELECT RAISE(ABORT, 'Journey achievement cannot decrease within a generation'); END;
    DROP TRIGGER journey_completions_immutable;
    DROP TRIGGER journey_completions_no_delete;
    ALTER TABLE journey_completions RENAME TO previous_journey_completions;
    CREATE TABLE journey_completions (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES practice_completions(session_id),
      before_level INTEGER NOT NULL CHECK(typeof(before_level) = 'integer' AND before_level BETWEEN 0 AND 125),
      after_level INTEGER NOT NULL CHECK(typeof(after_level) = 'integer' AND after_level BETWEEN before_level AND 125),
      credits_added INTEGER NOT NULL CHECK(typeof(credits_added) = 'integer' AND credits_added BETWEEN 0 AND 1),
      date_credits INTEGER NOT NULL CHECK(typeof(date_credits) = 'integer' AND date_credits BETWEEN 0 AND 2),
      display_version INTEGER NOT NULL CHECK(display_version IN (1, 2, 3))
    );
    INSERT INTO journey_completions SELECT * FROM previous_journey_completions;
    DROP TABLE previous_journey_completions;
    CREATE TRIGGER journey_completions_immutable BEFORE UPDATE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    CREATE TRIGGER journey_completions_no_delete BEFORE DELETE ON journey_completions
      BEGIN SELECT RAISE(ABORT, 'Journey completion is immutable'); END;
    CREATE TABLE journey_animation_receipts (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES journey_completions(session_id), projection_json TEXT NOT NULL
    );
    CREATE TRIGGER journey_animation_receipts_immutable_update BEFORE UPDATE ON journey_animation_receipts
      BEGIN SELECT RAISE(ABORT, 'Reward animation receipt is immutable'); END;
    CREATE TRIGGER journey_animation_receipts_immutable_delete BEFORE DELETE ON journey_animation_receipts
      BEGIN SELECT RAISE(ABORT, 'Reward animation receipt is immutable'); END;
  ` },
  { version: 8, name: 'continuous_habit_progression', sql: `
    CREATE TABLE habit_checkpoints (
      generation_id INTEGER PRIMARY KEY NOT NULL REFERENCES progression_generations(id), checkpoint_json TEXT NOT NULL
    );
    CREATE TABLE habit_reward_receipts (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES practice_completions(session_id), receipt_json TEXT NOT NULL
    );
    CREATE TRIGGER habit_reward_receipts_immutable_update BEFORE UPDATE ON habit_reward_receipts
      BEGIN SELECT RAISE(ABORT, 'Habit reward receipt is immutable'); END;
    CREATE TRIGGER habit_reward_receipts_immutable_delete BEFORE DELETE ON habit_reward_receipts
      BEGIN SELECT RAISE(ABORT, 'Habit reward receipt is immutable'); END;
  ` },
  { version: 9, name: 'meditation_sound_preferences', sql: `
    UPDATE audio_preferences SET preferences_json = json_set(preferences_json,
      '$.version', 2, '$.bellVolume', 0.18, '$.intervalSeconds', NULL, '$.hapticsEnabled', json('false'))
      WHERE json_extract(preferences_json, '$.version') = 1;
  ` },
  { version: 10, name: 'versioned_consistency_activation', sql: `
    CREATE TABLE progression_consistency_activations (
      generation_id INTEGER NOT NULL REFERENCES progression_generations(id),
      rules_version TEXT NOT NULL REFERENCES progression_rules(version),
      activation_json TEXT NOT NULL,
      PRIMARY KEY(generation_id, rules_version)
    );
    CREATE TRIGGER consistency_activations_immutable_update BEFORE UPDATE ON progression_consistency_activations
      BEGIN SELECT RAISE(ABORT, 'Consistency activation is immutable'); END;
    CREATE TRIGGER consistency_activations_immutable_delete BEFORE DELETE ON progression_consistency_activations
      BEGIN SELECT RAISE(ABORT, 'Consistency activation is immutable'); END;
  ` },
  { version: 11, name: 'optional_account_sync', sql: `
    CREATE TABLE sync_state (
      id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
      device_id TEXT NOT NULL CHECK(length(device_id) = 32 AND device_id NOT GLOB '*[^0-9a-f]*'),
      account_id TEXT CHECK(account_id IS NULL OR length(trim(account_id)) > 0),
      synced_revision INTEGER NOT NULL DEFAULT 0 CHECK(typeof(synced_revision) = 'integer' AND synced_revision >= 0),
      inflight_json TEXT,
      last_synced_at INTEGER CHECK(last_synced_at IS NULL OR (typeof(last_synced_at) = 'integer' AND last_synced_at >= 0)),
      CHECK(account_id IS NOT NULL OR (synced_revision = 0 AND inflight_json IS NULL AND last_synced_at IS NULL))
    );
    INSERT INTO sync_state(id, device_id) VALUES (1, lower(hex(randomblob(16))));
    CREATE TRIGGER sync_state_account_bound BEFORE UPDATE OF account_id, device_id ON sync_state
      WHEN NEW.device_id != OLD.device_id OR (OLD.account_id IS NOT NULL AND NEW.account_id IS NOT OLD.account_id)
      BEGIN SELECT RAISE(ABORT, 'A ledger file stays bound to one account and device identity'); END;
    CREATE TABLE sync_manifest (
      table_name TEXT NOT NULL CHECK(length(trim(table_name)) > 0),
      row_key TEXT NOT NULL CHECK(length(row_key) > 0),
      row_hash TEXT NOT NULL CHECK(length(row_hash) = 64),
      PRIMARY KEY(table_name, row_key)
    );
    CREATE TABLE sync_document_clocks (
      document TEXT PRIMARY KEY NOT NULL
        CHECK(document IN ('meditation_preferences', 'audio_preferences', 'application_preferences')),
      updated_at INTEGER NOT NULL CHECK(typeof(updated_at) = 'integer' AND updated_at >= 0)
    );
    CREATE TABLE sync_set_aside_sessions (
      session_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(session_id)) > 0),
      session_json TEXT NOT NULL,
      created_at INTEGER NOT NULL CHECK(typeof(created_at) = 'integer' AND created_at >= 0),
      set_aside_at INTEGER NOT NULL CHECK(typeof(set_aside_at) = 'integer' AND set_aside_at >= 0),
      reason TEXT NOT NULL CHECK(reason IN ('overlap'))
    );
    CREATE TRIGGER sync_set_aside_sessions_immutable_update BEFORE UPDATE ON sync_set_aside_sessions
      BEGIN SELECT RAISE(ABORT, 'Set-aside practice is immutable'); END;
    CREATE TRIGGER sync_set_aside_sessions_immutable_delete BEFORE DELETE ON sync_set_aside_sessions
      BEGIN SELECT RAISE(ABORT, 'Set-aside practice is immutable'); END;
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
