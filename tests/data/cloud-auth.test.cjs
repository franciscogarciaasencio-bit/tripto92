const { test } = require('node:test');
const path = require('node:path');
const { assert, data } = require('./helpers.cjs');
const cloud = (file) => require(path.join(process.env.DATA_BUILD_DIR, '..', 'cloud', file));
const { parseCloudConfig } = cloud('config.js');
const { createChunkedSecureStorage } = cloud('secure-storage.js');
const { parseAuthCallback } = cloud('auth-callback.js');
const { createSupabaseLedger, CloudError } = cloud('ledger-client.js');
const { databaseNameFor, GUEST_DATABASE } = data('namespace.js');

const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

test('Cloud stays off unless a well-formed public URL and publishable key are configured', () => {
  assert.deepEqual(parseCloudConfig({ url: 'https://abc.supabase.co/', publishableKey: ' sb_publishable_123 ' }),
    { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_123' });
  assert.deepEqual(parseCloudConfig({ url: 'http://localhost:54321', publishableKey: jwt({ role: 'anon' }) })?.url, 'http://localhost:54321');
  for (const env of [{}, { url: 'https://abc.supabase.co' }, { publishableKey: 'k' }, { url: '  ', publishableKey: 'k' },
    { url: 'http://abc.supabase.co', publishableKey: 'k' }, { url: 'not a url', publishableKey: 'k' },
    { url: 'https://abc.supabase.co/rest/v1', publishableKey: 'k' }]) assert.equal(parseCloudConfig(env), null, JSON.stringify(env));
});

test('Secret and service-role keys are refused, so a misconfigured build cannot bypass row security', () => {
  assert.equal(parseCloudConfig({ url: 'https://abc.supabase.co', publishableKey: 'sb_secret_abc' }), null);
  assert.equal(parseCloudConfig({ url: 'https://abc.supabase.co', publishableKey: jwt({ role: 'service_role' }) }), null);
  assert.ok(parseCloudConfig({ url: 'https://abc.supabase.co', publishableKey: jwt({ role: 'anon' }) }));
});

function memoryBackend() {
  const values = new Map();
  let failAfter = Infinity;
  return {
    values,
    failSetsAfter(n) { failAfter = n; },
    async getItemAsync(key) { return values.has(key) ? values.get(key) : null; },
    async setItemAsync(key, value) {
      assert.match(key, /^[A-Za-z0-9._-]+$/, 'secure-store key characters');
      if (failAfter-- <= 0) throw new Error('process killed');
      values.set(key, value);
    },
    async deleteItemAsync(key) { values.delete(key); },
  };
}

test('Secure session storage splits large tokens, shrinks cleanly and removes every chunk', async () => {
  const backend = memoryBackend();
  const storage = createChunkedSecureStorage(backend);
  assert.equal(await storage.getItem('ona-auth'), null);
  const large = 'x'.repeat(5000) + '✓';
  await storage.setItem('ona-auth', large);
  assert.equal(await storage.getItem('ona-auth'), large);
  assert.ok([...backend.values.keys()].length >= 4);
  await storage.setItem('ona-auth', 'small');
  assert.equal(await storage.getItem('ona-auth'), 'small');
  assert.deepEqual([...backend.values.keys()].sort(), ['ona-auth.0', 'ona-auth.n']);
  await storage.setItem('weird key/with:chars', 'v');
  assert.equal(await storage.getItem('weird key/with:chars'), 'v');
  await storage.removeItem('ona-auth');
  await storage.removeItem('weird key/with:chars');
  assert.equal(backend.values.size, 0);
});

test('An interrupted token write never yields a truncated token; unreadable restored values read as signed out', async () => {
  const backend = memoryBackend();
  const storage = createChunkedSecureStorage(backend);
  await storage.setItem('ona-auth', 'a'.repeat(4000));
  backend.failSetsAfter(1);
  await assert.rejects(storage.setItem('ona-auth', 'b'.repeat(4000)), /killed/);
  assert.equal(await storage.getItem('ona-auth'), null);
  const broken = createChunkedSecureStorage({ ...backend, getItemAsync: async () => { throw new Error('Could not decrypt'); } });
  assert.equal(await broken.getItem('ona-auth'), null);
});

test('OAuth callbacks accept only a PKCE code or a readable error', () => {
  assert.deepEqual(parseAuthCallback('meditationapp://auth-callback?code=abc%2B1'), { kind: 'code', code: 'abc+1' });
  assert.deepEqual(parseAuthCallback('exp://192.168.1.2:8081/--/auth-callback#code=xyz'), { kind: 'code', code: 'xyz' });
  assert.deepEqual(parseAuthCallback('meditationapp://auth-callback?error=access_denied&error_description=User+cancelled'),
    { kind: 'error', message: 'User cancelled' });
  assert.deepEqual(parseAuthCallback('meditationapp://auth-callback#access_token=t&refresh_token=r'), { kind: 'none' });
  assert.deepEqual(parseAuthCallback('meditationapp://auth-callback'), { kind: 'none' });
  assert.equal(parseAuthCallback('meditationapp://auth-callback?code=%E0%A4%A').kind, 'error');
});

test('Each account has its own opaque ledger file; guest keeps the original file', () => {
  assert.equal(databaseNameFor(null), GUEST_DATABASE);
  assert.equal(GUEST_DATABASE, 'meditation.db');
  const a = databaseNameFor('11111111-1111-4111-8111-111111111111');
  assert.equal(a, databaseNameFor('11111111-1111-4111-8111-111111111111'));
  assert.notEqual(a, databaseNameFor('22222222-2222-4222-8222-222222222222'));
  assert.match(a, /^ona-account-[0-9a-f]{32}\.db$/);
  assert.ok(!a.includes('1111'), 'account IDs never appear in file names');
  assert.throws(() => databaseNameFor(' '), /required/);
});

function fakeFetch(responses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next.status < 400, status: next.status, text: async () => typeof next.body === 'string' ? next.body : JSON.stringify(next.body) };
  };
  return { fetch, calls };
}
const config = { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_k' };

test('Supabase RPC client sends authenticated, parameterized calls and validates responses', async () => {
  const { fetch, calls } = fakeFetch([
    { status: 200, body: { status: 'applied', revision: 3 } },
    { status: 200, body: { revision: 3, head: 3, schemaVersion: 11, adds: [], removes: [] } },
    { status: 200, body: { document: 'audio_preferences', data: { a: 1 }, updatedAt: 9, deviceId: 'd' } },
    { status: 200, body: [{ document: 'audio_preferences', document_data: { a: 1 }, updated_at: 9, device_id: 'd' }] },
    { status: 204, body: '' },
  ]);
  const client = createSupabaseLedger(config, async () => 'token-1', fetch);
  assert.deepEqual(await client.push({ pushId: 'p', expectedRevision: 2, deviceId: 'd', kind: 'upload', schemaVersion: 12, asOf: 5, removes: [], adds: [] }),
    { status: 'applied', revision: 3 });
  assert.equal(calls[0].url, 'https://abc.supabase.co/rest/v1/rpc/ona_push_ledger');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-1');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_k');
  assert.deepEqual(calls[0].body, { p_push_id: 'p', p_expected_revision: 2, p_device_id: 'd', p_kind: 'upload', p_schema_version: 12, p_as_of: 5, p_removes: [], p_adds: [] });
  assert.equal((await client.changes(0)).head, 3);
  assert.deepEqual(calls[1].body, { p_from: 0, p_to: null });
  assert.equal((await client.saveSetting('audio_preferences', { a: 1 }, 9, 'd')).updatedAt, 9);
  assert.deepEqual(await client.settings(), [{ document: 'audio_preferences', data: { a: 1 }, updatedAt: 9, deviceId: 'd' }]);
  assert.equal(calls[3].init.method, 'GET');
  await client.deleteCloudData();
  assert.equal(calls[4].url.endsWith('/rpc/ona_delete_my_cloud_data'), true);
});

test('Cloud failures are classified for retry decisions and never leak as unknown shapes', async () => {
  const kind = async (responses, token = 'token') => {
    const { fetch } = fakeFetch(responses);
    try { await createSupabaseLedger(config, async () => token, fetch).changes(0); return 'ok'; }
    catch (error) { assert.ok(error instanceof CloudError); return error.kind; }
  };
  assert.equal(await kind([new TypeError('Network request failed')]), 'offline');
  assert.equal(await kind([{ status: 401, body: { message: 'JWT expired' } }]), 'signed_out');
  assert.equal(await kind([{ status: 400, body: { message: 'Sign in to sync' } }]), 'signed_out');
  assert.equal(await kind([{ status: 503, body: 'unavailable' }]), 'server');
  assert.equal(await kind([{ status: 400, body: { message: 'Invalid sync revision range' } }]), 'rejected');
  assert.equal(await kind([{ status: 200, body: '<html>' }]), 'server');
  assert.equal(await kind([{ status: 200, body: { revision: -1, head: 0, schemaVersion: null, adds: [], removes: [] } }]), 'server');
  assert.equal(await kind([], null), 'signed_out');
});

test('Sync status reads calmly and maps failures to actionable states', () => {
  const { describeSync, failurePhase } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'application', 'sync-status.js'));
  const now = 10 * 86_400_000;
  assert.equal(describeSync({ phase: 'idle', lastSyncedAt: null }, now), 'Your practice will be saved to your account.');
  assert.equal(describeSync({ phase: 'synced', lastSyncedAt: now - 30_000 }, now), 'Saved to your account just now.');
  assert.equal(describeSync({ phase: 'synced', lastSyncedAt: now - 5 * 60_000 }, now), 'Saved to your account 5 minutes ago.');
  assert.equal(describeSync({ phase: 'synced', lastSyncedAt: now - 3 * 3_600_000 }, now), 'Saved to your account 3 hours ago.');
  assert.equal(describeSync({ phase: 'synced', lastSyncedAt: now - 30 * 3_600_000 }, now), 'Saved to your account yesterday.');
  assert.match(describeSync({ phase: 'offline', lastSyncedAt: null }, now), /safe on this phone/);
  assert.match(describeSync({ phase: 'upgrade', lastSyncedAt: now }, now), /Update Ona/);
  assert.equal(failurePhase(new CloudError('offline', 'x')), 'offline');
  assert.equal(failurePhase(new CloudError('server', 'x')), 'offline');
  assert.equal(failurePhase(new CloudError('signed_out', 'x')), 'signed_out');
  assert.equal(failurePhase(Object.assign(new Error('x'), { name: 'SyncUpgradeRequired' })), 'upgrade');
  assert.equal(failurePhase(new Error('Disk full')), 'error');
});
