// A real Postgres (PGlite, WebAssembly) with the parts of Supabase the sync migration relies on:
// anon/authenticated roles, Supabase's broad default privileges, auth.users and auth.uid().
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = (name) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8');
/** Every migration, in order, as the production project has them. */
const MIGRATIONS = ['20261014120000_ona_sync.sql', '20261017120000_ona_friends.sql'].map(migration);
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
    provider text not null, identity_data jsonb not null, last_sign_in_at timestamptz, created_at timestamptz default now());
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
  c: '33333333-3333-4333-8333-333333333333',
};
/** Google accounts as Supabase stores them: the user, and the Google identity with Google's claims. */
const ACCOUNTS = {
  a: { email: 'Francisco.Example@gmail.com', meta: { full_name: 'Francisco Example', name: 'Francisco Example', email_verified: true } },
  b: { email: 'david.sample@gmail.com', meta: { full_name: 'David Sample', email_verified: true } },
  c: { email: 'carla@example.org', meta: { email_verified: true } },
};

async function supabase(t) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const sql of MIGRATIONS) await db.exec(sql);
  for (const [user, account] of Object.entries(ACCOUNTS)) {
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [USERS[user], account.email, JSON.stringify(account.meta)]);
    await db.query(`insert into auth.identities (user_id, provider, identity_data, last_sign_in_at) values ($1, 'google', $2, now())`,
      [USERS[user], JSON.stringify({ ...account.meta, email: account.email, sub: user })]);
  }
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
  const ledgers = new Map();
  const pushRaw = async (user, { pushId, expected, ledger, removes = [], adds = [], kind = 'upload', device = 'a'.repeat(32), schema = 13, asOf = 0 }) => {
    // Tests that do not name a ledger push onto the user's current one.
    const expectedLedger = ledger !== undefined ? ledger : expected > 0 ? ledgers.get(user) ?? (await changes(user, 0)).ledgerId : null;
    const result = await call(user, 'ona_push_ledger', { p_push_id: pushId, p_expected_ledger: expectedLedger, p_expected_revision: expected, p_device_id: device, p_kind: kind,
      p_schema_version: schema, p_as_of: asOf, p_removes: JSON.stringify(removes), p_adds: JSON.stringify(adds) });
    if (result?.ledgerId) ledgers.set(user, result.ledgerId);
    return result;
  };
  /** Status and revision only; pushRaw also returns the ledger identity. */
  const push = async (user, request) => { const { status, revision } = await pushRaw(user, request); return { status, revision }; };
  const changes = (user, from, to = null) => call(user, 'ona_ledger_changes', { p_from: from, p_to: to });
  return { db, as, call, push, pushRaw, changes, USERS };
}

module.exports = { supabase, USERS, ACCOUNTS, MIGRATIONS };
