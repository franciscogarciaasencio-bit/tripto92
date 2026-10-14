const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const domainHelpers = require('../domain/helpers.cjs');
const data = (file) => require(path.join(process.env.DATA_BUILD_DIR, file));
const { openStore } = data('database/store.js');

function connection(filename = ':memory:') {
  const raw = new DatabaseSync(filename);
  let fault;
  let closed = false;
  function check(sql) {
    if (fault?.(sql)) { fault = undefined; throw new Error('Simulated SQLite failure'); }
  }
  return {
    raw,
    failOnce: (predicate) => { fault = predicate; },
    exec: async (sql) => { check(sql); raw.exec(sql); },
    run: async (sql, parameters = []) => { check(sql); raw.prepare(sql).run(...parameters); },
    all: async (sql, parameters = []) => { check(sql); return raw.prepare(sql).all(...parameters); },
    close: async () => { if (!closed) { closed = true; raw.close(); } },
  };
}

async function fixture(t, context = domainHelpers.context(1), rules) {
  const conn = connection();
  const store = await openStore(conn, context, rules);
  t.after(() => store.close());
  return { conn, store, meditations: store.meditations, settings: store.settings };
}
function disk(t) {
  const root = path.resolve(tmpdir());
  const dir = mkdtempSync(path.join(root, 'meditation-sqlite-tests-'));
  t.after(() => {
    if (path.dirname(path.resolve(dir)) !== root || !path.basename(dir).startsWith('meditation-sqlite-tests-')) throw new Error('Unsafe cleanup');
    rmSync(dir, { recursive: true, force: true });
  });
  return path.join(dir, 'meditation.db');
}
const save = (repo, session) => repo.recordCompletedMeditation(session, session.endedAt);
function checkpoint(conn) {
  return JSON.parse(conn.raw.prepare('SELECT metadata_json FROM progression_checkpoint').get().metadata_json);
}
function corruptCheckpoint(conn, change) {
  const meta = checkpoint(conn);
  change(meta);
  conn.raw.prepare('UPDATE progression_checkpoint SET metadata_json = ?').run(JSON.stringify(meta));
}
/** Real released SQL shape, rather than pretending that deleting new markers downgrades a DB. */
async function writeLegacyFixture(conn, version, state, preferences = data('preferences.js').DEFAULT_PREFERENCES) {
  const { migrate, MIGRATIONS } = data('database/migrations.js');
  const { checkpointMetadata } = data('database/decoders.js');
  const { api } = domainHelpers;
  await migrate(conn, MIGRATIONS.slice(0, version));
  for (const [index, rules] of state.ruleSets.entries()) await conn.run('INSERT INTO progression_rules VALUES (?, ?, ?)',
    [rules.version, index + 1, JSON.stringify(rules)]);
  for (const [index, entry] of state.sessions.entries()) {
    const s = entry.session;
    await conn.run(`INSERT INTO meditation_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${version >= 6 ? ', ?' : ''})`,
      [s.id, index + 1, s.startedAt, s.endedAt, s.activeDurationSeconds, s.pausedDurationSeconds, s.status,
        s.localDate, s.timeZone, s.endedAt, entry.qualified ? 1 : 0, entry.qualificationRulesVersion, ...(version >= 6 ? [1] : [])]);
  }
  for (const [index, a] of state.awards.entries()) await conn.run(`INSERT INTO progression_awards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?${version >= 6 ? ', ?' : ''})`,
    [a.id, index + 1, a.sessionId, a.occasionId, a.rulesVersion, a.awardedAt, a.localDate, a.rewardDate, a.xpCenti, JSON.stringify(a.breakdown), ...(version >= 6 ? [1] : [])]);
  await conn.run('INSERT INTO progression_checkpoint VALUES (1, ?, ?)', [state.currentProgressionCenti, JSON.stringify(checkpointMetadata(state))]);
  await conn.run('INSERT INTO meditation_preferences VALUES (1, ?)', [JSON.stringify(preferences)]);
  if (version >= 3) {
    const first = state.sessions[0]?.session;
    let prefix = api.createProgressionState(first ? { timestamp: first.startedAt, localDate: first.localDate, timeZone: first.timeZone } : state.asOf, state.ruleSets[0]);
    for (const entry of state.sessions) {
      if (entry.qualificationRulesVersion !== prefix.activeRulesVersion) prefix = api.changeProgressionRules(prefix,
        state.ruleSets.find(r => r.version === entry.qualificationRulesVersion), prefix.asOf);
      const s = entry.session;
      const before = api.advanceProgression(prefix, { timestamp: s.endedAt, localDate: s.localDate, timeZone: s.timeZone });
      const after = api.recordSession(prefix, s);
      await conn.run('INSERT INTO practice_completions(session_id, before_progression_centi, after_progression_centi) VALUES (?, ?, ?)',
        [s.id, before.currentProgressionCenti, after.currentProgressionCenti]);
      if (version >= 4) {
        const a = api.getJourneyFromState(before, null, { legacyLevelOneStart: version < 6, version: api.LEGACY_JOURNEY_VERSION });
        const b = api.getJourneyFromState(after, null, { legacyLevelOneStart: version < 6, version: api.LEGACY_JOURNEY_VERSION });
        const dateCredits = api.practiceCredits(after.sessions.map(e => e.session)).dates.find(d => d.localDate === s.localDate)?.credits ?? 0;
        await conn.run(`INSERT INTO journey_completions VALUES (?, ?, ?, ?, ?${version >= 6 ? ', ?' : ''})`, [s.id, a.level.number, b.level.number,
          b.metrics.credits - a.metrics.credits, dateCredits, ...(version >= 6 ? [2] : [])]);
      }
      prefix = after;
    }
  }
  if (version >= 4) {
    const peak = api.getJourneyFromState(state, null, { legacyLevelOneStart: version < 6, version: api.LEGACY_JOURNEY_VERSION });
    await conn.run(`INSERT INTO journey_checkpoint VALUES (1, ${version >= 6 ? '1, ' : ''}?, ?, ?)`, [api.LEGACY_JOURNEY_VERSION, peak.level.number, state.asOf.timestamp]);
  }
}
/** Remove migration 11's empty sync objects, reconstructing a released V10 file for upgrade tests. */
const DROP_SYNC_MIGRATION = `DROP TABLE sync_state; DROP TABLE sync_manifest; DROP TABLE sync_document_clocks;
  DROP TABLE sync_set_aside_sessions; DELETE FROM schema_migrations WHERE version = 11;`;
module.exports = { ...domainHelpers, data, connection, fixture, disk, openStore, save, checkpoint, corruptCheckpoint, writeLegacyFixture, DROP_SYNC_MIGRATION };
