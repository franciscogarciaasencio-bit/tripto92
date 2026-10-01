/** V1 is immutable once released. Add a migration for subsequent schema changes. */
export const SCHEMA_V1 = `
CREATE TABLE progression_rules (
  version TEXT PRIMARY KEY NOT NULL CHECK(length(trim(version)) > 0),
  sequence INTEGER NOT NULL UNIQUE CHECK(sequence > 0),
  rules_json TEXT NOT NULL
);
CREATE TABLE meditation_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  sequence INTEGER NOT NULL UNIQUE CHECK(sequence > 0),
  started_at INTEGER NOT NULL CHECK(typeof(started_at) = 'integer' AND started_at >= 0),
  ended_at INTEGER NOT NULL CHECK(typeof(ended_at) = 'integer' AND ended_at >= started_at),
  active_seconds INTEGER NOT NULL CHECK(typeof(active_seconds) = 'integer' AND active_seconds >= 0),
  paused_seconds INTEGER NOT NULL CHECK(typeof(paused_seconds) = 'integer' AND paused_seconds >= 0),
  status TEXT NOT NULL CHECK(status IN ('completed', 'ended_early')),
  local_date TEXT NOT NULL,
  time_zone TEXT NOT NULL CHECK(length(trim(time_zone)) > 0),
  created_at INTEGER NOT NULL CHECK(typeof(created_at) = 'integer' AND created_at >= ended_at),
  qualified INTEGER NOT NULL CHECK(qualified IN (0, 1)),
  qualification_rules_version TEXT NOT NULL REFERENCES progression_rules(version),
  CHECK((active_seconds + paused_seconds) * 1000 <= ended_at - started_at)
);
CREATE TABLE progression_awards (
  id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id)) > 0),
  sequence INTEGER NOT NULL UNIQUE CHECK(sequence > 0),
  session_id TEXT NOT NULL UNIQUE REFERENCES meditation_sessions(id),
  occasion_id TEXT NOT NULL,
  rules_version TEXT NOT NULL REFERENCES progression_rules(version),
  awarded_at INTEGER NOT NULL CHECK(typeof(awarded_at) = 'integer' AND awarded_at >= 0),
  local_date TEXT NOT NULL,
  reward_date TEXT NOT NULL,
  xp_centi INTEGER NOT NULL CHECK(typeof(xp_centi) = 'integer' AND xp_centi >= 0),
  breakdown_json TEXT NOT NULL
);
CREATE TABLE progression_checkpoint (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  current_progression_centi INTEGER NOT NULL
    CHECK(typeof(current_progression_centi) = 'integer' AND current_progression_centi >= 0),
  metadata_json TEXT NOT NULL
);
CREATE TABLE meditation_preferences (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  preferences_json TEXT NOT NULL
);
CREATE INDEX meditation_history_order ON meditation_sessions(ended_at DESC, sequence DESC);
CREATE INDEX awards_by_occasion ON progression_awards(occasion_id, sequence);
${['meditation_sessions', 'progression_awards', 'progression_rules'].map((table) => `
CREATE TRIGGER ${table}_immutable_update BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, 'Historical records are immutable'); END;
CREATE TRIGGER ${table}_immutable_delete BEFORE DELETE ON ${table}
BEGIN SELECT RAISE(ABORT, 'Historical records are immutable'); END;
`).join('')}
`;
