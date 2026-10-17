const { test } = require('node:test');
const path = require('node:path');
const { assert } = require('./helpers.cjs');
const { supabase, USERS } = require('./supabase-helpers.cjs');
const cloud = (file) => require(path.join(process.env.DATA_BUILD_DIR, '..', 'cloud', file));
const { createSupabaseFriends, looksLikeEmail } = cloud('friends-client.js');
const { CloudError } = cloud('rest.js');

const config = { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_k' };
const day = (offset = 0) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };

/** PostgREST over the real migration: POST /rest/v1/rpc/<name> with named JSON arguments, as `user`. */
function postgrest(s, user, calls = []) {
  return async (url, init) => {
    calls.push({ url, init });
    const name = url.slice(`${config.url}/rest/v1/rpc/`.length);
    try {
      const result = await s.call(user, name, JSON.parse(init.body));
      return { ok: true, status: 200, text: async () => result === null || result === undefined || result === '' ? '' : JSON.stringify(result) };
    } catch (error) {
      return { ok: false, status: /permission denied/.test(error.message) ? 401 : 400, text: async () => JSON.stringify({ message: error.message }) };
    }
  };
}
function canned(responses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next.status < 400, status: next.status, text: async () => typeof next.body === 'string' ? next.body : JSON.stringify(next.body) };
  };
  return { fetch, calls };
}

test('Two phones become friends through the real database, sharing only level and weeks in a row', async (t) => {
  const s = await supabase(t);
  const calls = [];
  const francisco = createSupabaseFriends(config, async () => 'token-a', postgrest(s, 'a', calls));
  const david = createSupabaseFriends(config, async () => 'token-b', postgrest(s, 'b'));
  await francisco.share({ level: 9, weeks: 2, until: day(3) });
  await david.share({ level: 3, weeks: 0, until: day(0) });
  assert.equal(calls[0].url, 'https://abc.supabase.co/rest/v1/rpc/ona_share_progress');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-a');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_k');

  assert.equal(await francisco.add(' David.Sample@gmail.com '), 'invited');
  assert.deepEqual(await francisco.list(), { friends: [], requests: [], invited: ['david.sample@gmail.com'] });
  const asked = await david.list();
  assert.deepEqual(asked.requests, [{ id: USERS.a, name: 'Francisco Example', email: 'francisco.example@gmail.com' }]);
  assert.equal(await david.add(asked.requests[0].email), 'friends');
  assert.deepEqual((await francisco.list()).friends, [{ id: USERS.b, name: 'David Sample', level: 3, streak: { weeks: 0, until: day(0) } }]);
  assert.deepEqual((await david.list()).friends, [{ id: USERS.a, name: 'Francisco Example', level: 9, streak: { weeks: 2, until: day(3) } }]);

  await david.remove(USERS.a);
  assert.deepEqual((await david.list()).friends, []);
  assert.deepEqual(await francisco.list(), { friends: [], requests: [], invited: ['david.sample@gmail.com'] });
  await francisco.cancel('david.sample@gmail.com');
  assert.deepEqual((await francisco.list()).invited, []);
  assert.equal(await francisco.add('francisco.example@googlemail.com'), 'self');
});

test('Malformed answers and invalid input never reach the screen', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const good = { id, name: 'David', level: 3, weeks: 1, weeksUntil: '2026-10-20' };
  const answers = [
    { friends: [{ ...good, id: 'not-a-uuid' }], requests: [], invited: [] },
    { friends: [{ ...good, level: 126 }], requests: [], invited: [] },
    { friends: [{ ...good, weeks: -1 }], requests: [], invited: [] },
    { friends: [{ ...good, name: '' }], requests: [], invited: [] },
    { friends: [good], requests: [{ id, name: 'Ana' }], invited: [] },
    { friends: [good], requests: [], invited: [7] },
    { friends: {}, requests: [], invited: [] },
    [],
  ];
  for (const body of answers) {
    const { fetch } = canned([{ status: 200, body }]);
    await assert.rejects(createSupabaseFriends(config, async () => 't', fetch).list(), (error) => error instanceof CloudError && error.kind === 'server', JSON.stringify(body));
  }
  const { fetch } = canned([{ status: 200, body: { friends: [good, { ...good, id: id.replace('2', '3'), level: null, weeks: null, weeksUntil: null }], requests: [], invited: [] } }]);
  assert.deepEqual((await createSupabaseFriends(config, async () => 't', fetch).list()).friends.map((friend) => [friend.level, friend.streak]),
    [[3, { weeks: 1, until: '2026-10-20' }], [null, null]]);
  const status = canned([{ status: 200, body: { status: 'accepted' } }]);
  await assert.rejects(createSupabaseFriends(config, async () => 't', status.fetch).add('a@b.co'), /Unexpected/);
  const client = createSupabaseFriends(config, async () => 't', canned([]).fetch);
  for (const progress of [{ level: 126, weeks: 0, until: '2026-10-20' }, { level: 3, weeks: -1, until: '2026-10-20' }, { level: 3, weeks: 0, until: 'soon' }]) {
    await assert.rejects(client.share(progress), RangeError);
  }
});

test('Offline, signed out and server failures are told apart', async () => {
  const kind = async (response, token = 't') => {
    const { fetch } = canned([response]);
    try { await createSupabaseFriends(config, async () => token, fetch).list(); return 'none'; }
    catch (error) { assert.ok(error instanceof CloudError); return error.kind; }
  };
  assert.equal(await kind(new TypeError('Network request failed')), 'offline');
  assert.equal(await kind({ status: 200, body: {} }, null), 'signed_out');
  assert.equal(await kind({ status: 400, body: { message: 'Sign in to use friends' } }), 'signed_out');
  assert.equal(await kind({ status: 503, body: 'unavailable' }), 'server');
  assert.equal(await kind({ status: 400, body: { message: 'Not an email address' } }), 'rejected');
});

test('Email addresses are checked the way the database checks them', () => {
  for (const valid of ['david@gmail.com', ' David.Sample+x@GoogleMail.com ', 'a@b.co']) assert.ok(looksLikeEmail(valid), valid);
  for (const invalid of ['', 'david', 'david@gmail', '@gmail.com', 'a b@c.de', `${'x'.repeat(320)}@a.co`]) assert.ok(!looksLikeEmail(invalid), invalid);
});
