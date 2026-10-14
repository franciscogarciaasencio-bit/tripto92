// Real phones (SQLite stores) syncing through the real Supabase SQL (PGlite).
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { connection, openStore, context, at } = require('./helpers.cjs');
const { USERS } = require('./supabase-helpers.cjs');
const engine = require(path.join(process.env.DATA_BUILD_DIR, '..', 'application', 'sync-engine.js'));
const { CloudError } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'cloud', 'ledger-client.js'));
const { CONTINUATION_TABLES } = require(path.join(process.env.DATA_BUILD_DIR, 'database', 'ledger.js'));

/** CloudLedger over the real SQL functions, with fault injection for lost responses and outages. */
function pgliteCloud(s, user) {
  const faults = { loseNextPushResponse: false, offline: false, calls: [] };
  const guard = (name) => { faults.calls.push(name); if (faults.offline) throw new CloudError('offline', 'No connection'); };
  const cloud = {
    faults,
    async push(request) {
      guard('push');
      const result = await s.pushRaw(user, { pushId: request.pushId, expected: request.expectedRevision, ledger: request.expectedLedger, device: request.deviceId,
        kind: request.kind, schema: request.schemaVersion, asOf: request.asOf, removes: request.removes, adds: request.adds });
      if (faults.loseNextPushResponse) { faults.loseNextPushResponse = false; throw new CloudError('offline', 'Response lost'); }
      return result;
    },
    async changes(from, to = null) { guard('changes'); return s.changes(user, from, to); },
    async revisionBefore(time, max) { guard('revisionBefore'); return Number(await s.call(user, 'ona_ledger_revision_before', { p_time: time, p_max: max })); },
    async saveSetting(document, data, updatedAt, deviceId) {
      guard('saveSetting');
      return s.call(user, 'ona_save_setting', { p_document: document, p_data: JSON.stringify(data), p_updated_at: updatedAt, p_device_id: deviceId });
    },
    async settings() {
      guard('settings');
      return (await s.as(user, 'select document, document_data, updated_at, device_id from public.ona_settings order by document'))
        .map((row) => ({ document: row.document, data: row.document_data, updatedAt: Number(row.updated_at), deviceId: row.device_id }));
    },
    async deleteCloudData() { guard('delete'); await s.call(user, 'ona_delete_my_cloud_data', {}); },
  };
  // Mirror the HTTP client: database exceptions arrive as classified CloudErrors.
  for (const name of ['push', 'changes', 'revisionBefore', 'saveSetting', 'settings', 'deleteCloudData']) {
    const call = cloud[name];
    cloud[name] = async (...args) => {
      try { return await call(...args); }
      catch (error) {
        if (error instanceof CloudError) throw error;
        throw new CloudError(/Sign in to sync/.test(error.message) ? 'signed_out' : 'rejected', error.message, 400);
      }
    };
  }
  return cloud;
}

/** A phone signed in to `user`, with its own clock; `file` makes it survive restarts. */
async function phone(t, s, user = 'a', start = context(1), file = ':memory:') {
  let conn = connection(file);
  let store = await openStore(conn, start, undefined, 'progression_v5');
  t.after(() => store.close());
  await store.sync.bindAccount(USERS[user]);
  const cloud = pgliteCloud(s, user);
  let clock = start.timestamp;
  const device = {
    get store() { return store; },
    get conn() { return conn; },
    cloud,
    /** Close and reopen the app from the same file (process death / relaunch). */
    async restart() {
      if (file === ':memory:') throw new Error('restart needs a file-backed phone');
      await store.close();
      conn = connection(file);
      store = await openStore(conn, { timestamp: clock, localDate: new Date(clock).toISOString().slice(0, 10), timeZone: 'UTC' }, undefined, 'progression_v5');
      t.after(() => store.close());
      await store.sync.bindAccount(USERS[user]);
    },
    setTime(timestamp) { clock = timestamp; },
    now: () => clock,
    async practice(session) {
      clock = Math.max(clock, session.endedAt);
      await store.meditations.completePractice(session, session.endedAt);
      await store.meditations.acknowledgeCompletion(session.id, session.endedAt);
    },
    context(overrides = {}) {
      return {
        sync: store.sync, cloud, now: () => clock, uuid: randomUUID,
        calendar: () => ({ timestamp: clock, localDate: new Date(clock).toISOString().slice(0, 10), timeZone: 'UTC' }),
        busy: async () => (await store.timer.load()) !== null || (await store.meditations.getPendingCompletion()) !== null,
        ...overrides,
      };
    },
    sync(overrides) { return engine.syncLedger(device.context(overrides)); },
    rows: async () => (await store.sync.exportLedger()).rows.map((row) => `${row.table}|${row.key}|${row.hash}`).sort(),
    /** History rows, excluding continuation singletons that each phone re-settles to its own clock. */
    history: async () => (await store.sync.exportLedger()).rows.filter((row) => !CONTINUATION_TABLES.includes(row.table))
      .map((row) => `${row.table}|${row.key}|${row.hash}`).sort(),
  };
  return device;
}

module.exports = { pgliteCloud, phone, engine, at };
