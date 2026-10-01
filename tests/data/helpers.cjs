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
module.exports = { ...domainHelpers, data, connection, fixture, disk, openStore, save, checkpoint, corruptCheckpoint };
