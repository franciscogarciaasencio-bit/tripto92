const { test } = require('node:test');
const { assert, data, connection, fixture, session, save, context, openStore } = require('./helpers.cjs');
const { createTransactions } = data('database/connection.js');
const { migrate, MIGRATIONS } = data('database/migrations.js');

test('Released migrations run once; recognizing the current schema leaves records intact', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  const database = createTransactions(conn);
  const result = await database.transaction((sql) => migrate(sql));
  assert.deepEqual(result, { previousVersion: 12, version: 12 });
  assert.equal(conn.raw.prepare('SELECT COUNT(*) AS n FROM meditation_sessions').get().n, 1);
});

test('A future sequential V13 migration adds data without altering V1 history', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  const before = await meditations.loadProgressionState();
  const future = [...MIGRATIONS, { version: 13, name: 'fixture_v13', sql: `CREATE TABLE fixture_notes(id TEXT PRIMARY KEY, note TEXT NOT NULL);
    INSERT INTO fixture_notes VALUES ('first', 'kept');` }];
  const database = createTransactions(conn);
  assert.deepEqual(await database.transaction((sql) => migrate(sql, future)), { previousVersion: 12, version: 13 });
  assert.deepEqual(await database.transaction((sql) => migrate(sql, future)), { previousVersion: 13, version: 13 });
  assert.equal(conn.raw.prepare('SELECT note FROM fixture_notes').get().note, 'kept');
  assert.deepEqual(await meditations.loadProgressionState(), before);
  await assert.rejects(database.transaction((sql) => migrate(sql)), (error) => error.code === 'UNSUPPORTED_SCHEMA');
});

test('Failed migration rolls back DDL, data, and the migration marker', async (t) => {
  const { conn, meditations } = await fixture(t);
  await save(meditations, session());
  const database = createTransactions(conn);
  const future = [...MIGRATIONS, { version: 13, name: 'bad_fixture', sql: 'CREATE TABLE rolled_back(id INTEGER); INSERT INTO missing_table VALUES (1);' }];
  await assert.rejects(database.transaction((sql) => migrate(sql, future)), /missing_table/);
  assert.equal(conn.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'rolled_back'").get().n, 0);
  assert.equal(conn.raw.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 12);
  assert.equal((await meditations.loadProgressionState()).lifetimeXpCenti, 8000);
});

test('Out-of-order migration definitions and tampered markers are rejected', async (t) => {
  const { conn } = await fixture(t);
  const database = createTransactions(conn);
  await assert.rejects(database.transaction((sql) => migrate(sql, [{ ...MIGRATIONS[0], version: 2 }])), /sequential/);
  conn.raw.exec("UPDATE schema_migrations SET name = 'wrong'");
  await assert.rejects(database.transaction((sql) => migrate(sql)), (error) => error.code === 'UNSUPPORTED_SCHEMA');
});

test('First initialization failure leaves no schema or partially initialized state on disk', async (t) => {
  const { disk } = require('./helpers.cjs');
  const filename = disk(t);
  const conn = connection(filename);
  conn.failOnce((sql) => sql.startsWith('INSERT INTO meditation_preferences'));
  await assert.rejects(openStore(conn, context(1)), /Simulated/);
  const check = connection(filename);
  assert.equal(check.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get().n, 0);
  const store = await openStore(check, context(1));
  await store.close();
});
