// A real Postgres (PGlite, WebAssembly) with the parts of Supabase the sync migration relies on:
// anon/authenticated roles, Supabase's broad default privileges, auth.users and auth.uid().
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATION = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261014120000_ona_sync.sql'), 'utf8');
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

const USERS = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
};

async function supabase(t) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATION);
  await db.exec(`insert into auth.users (id) values ('${USERS.a}'), ('${USERS.b}');`);
  t.after(() => db.close());
  /** Run as a client: anon (no user) or an authenticated user, never as the table owner. */
  async function as(user, sql, params = []) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ? USERS[user] ?? user : '']);
    await db.exec(`set role ${user === null ? 'anon' : 'authenticated'}`);
    try { return (await db.query(sql, params)).rows; }
    finally { await db.exec('reset role'); }
  }
  const call = async (user, fn, args) => {
    const names = Object.keys(args);
    const sql = `select public.${fn}(${names.map((name, i) => `${name} => $${i + 1}`).join(', ')}) as result`;
    return (await as(user, sql, names.map((name) => args[name])))[0]?.result;
  };
  const push = (user, { pushId, expected, removes = [], adds = [], kind = 'upload', device = 'a'.repeat(32), schema = 11 }) =>
    call(user, 'ona_push_ledger', { p_push_id: pushId, p_expected_revision: expected, p_device_id: device, p_kind: kind,
      p_schema_version: schema, p_removes: JSON.stringify(removes), p_adds: JSON.stringify(adds) });
  const changes = (user, from, to = null) => call(user, 'ona_ledger_changes', { p_from: from, p_to: to });
  return { db, as, call, push, changes, USERS };
}

module.exports = { supabase, USERS };
