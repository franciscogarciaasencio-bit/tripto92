// The friends migration against a real Postgres (PGlite) with Supabase's roles and auth.users.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supabase, USERS } = require('./supabase-helpers.cjs');

/** A date `offset` days from the server's current date. */
const day = (offset = 0) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
const UNTIL = day(5);

async function friends(t) {
  const s = await supabase(t);
  return {
    ...s,
    list: (user) => s.call(user, 'ona_friends', {}),
    add: async (user, email) => (await s.call(user, 'ona_add_friend', { p_email: email })).status,
    remove: (user, friend) => s.call(user, 'ona_remove_friend', { p_friend: USERS[friend] }),
    cancel: (user, email) => s.call(user, 'ona_cancel_invitation', { p_email: email }),
    share: (user, level, weeks = 0, until = UNTIL) =>
      s.call(user, 'ona_share_progress', { p_level: level, p_week_streak: weeks, p_streak_until: until }),
    key: async (email) => (await s.db.query('select public.ona_email_key($1) as key', [email])).rows[0].key,
  };
}

test('Clients can neither read nor write friends tables, and only the five friends functions are callable', async (t) => {
  const s = await friends(t);
  for (const table of ['ona_profiles', 'ona_friend_requests']) {
    await assert.rejects(s.as(null, `select * from public.${table}`), /permission denied/);
    await assert.rejects(s.as('a', `select * from public.${table}`), /permission denied/);
  }
  await assert.rejects(s.as('a', `insert into public.ona_friend_requests (from_user, to_email_key, to_email) values ('${USERS.a}', 'x@y.z', 'x@y.z')`), /permission denied/);
  await assert.rejects(s.as('a', `update public.ona_profiles set level = 125`), /permission denied/);
  for (const sql of ['select public.ona_touch_profile()', "select public.ona_email_key('a@b.co')"]) {
    await assert.rejects(s.as('a', sql), /permission denied/);
  }
  await assert.rejects(s.as(null, 'select public.ona_friends()'), /permission denied/);
  await assert.rejects(s.as(null, "select public.ona_add_friend('a@b.co')"), /permission denied/);
  await assert.rejects(s.list(''), /Sign in/);
});

test('Addresses match the way mail does: case, spaces, Gmail dots, +tags and googlemail', async (t) => {
  const s = await friends(t);
  assert.equal(await s.key('  David.Sample+ona@GoogleMail.com '), 'davidsample@gmail.com');
  assert.equal(await s.key('d.a.v.i.d.sample@gmail.com'), 'davidsample@gmail.com');
  assert.equal(await s.key('First.Last@Example.org'), 'first.last@example.org', 'dots matter outside Gmail');
  for (const invalid of ['', 'david', 'david@', '@gmail.com', 'a b@c.de', 'a@b', '+@gmail.com', null]) {
    assert.equal(await s.key(invalid), null, String(invalid));
  }
});

test('Nothing is shared until both have added each other; then only name, level and weeks in a row', async (t) => {
  const s = await friends(t);
  await s.share('a', 9, 2);
  await s.share('b', 3, 1);
  // Francisco adds David with a differently written Gmail address.
  assert.equal(await s.add('a', 'David.Sample@Gmail.com'), 'invited');
  assert.deepEqual(await s.list('a'), { friends: [], requests: [], invited: ['david.sample@gmail.com'] });
  // David sees who asked (name and email) but nothing of Francisco's practice.
  assert.deepEqual(await s.list('b'), { friends: [], invited: [],
    requests: [{ id: USERS.a, name: 'Francisco Example', email: 'francisco.example@gmail.com' }] });
  // A stranger sees nothing of either.
  assert.deepEqual(await s.list('c'), { friends: [], requests: [], invited: [] });
  // David adds Francisco back: friends, each seeing only the other's shared fields.
  assert.equal(await s.add('b', 'francisco.example@gmail.com'), 'friends');
  assert.deepEqual(await s.list('a'), { requests: [], invited: [],
    friends: [{ id: USERS.b, name: 'David Sample', level: 3, weeks: 1, weeksUntil: UNTIL }] });
  assert.deepEqual((await s.list('b')).friends, [{ id: USERS.a, name: 'Francisco Example', level: 9, weeks: 2, weeksUntil: UNTIL }]);
  assert.deepEqual(await s.list('c'), { friends: [], requests: [], invited: [] });
  // Sharing again updates what friends see.
  await s.share('b', 4, 2);
  assert.equal((await s.list('a')).friends[0].level, 4);
});

test('Adding an address never reveals whether it belongs to an Ona account', async (t) => {
  const s = await friends(t);
  await s.list('c'); // Carla has used Friends, so she has a profile.
  assert.equal(await s.add('a', 'carla@example.org'), 'invited');
  assert.equal(await s.add('a', 'nobody@example.org'), 'invited');
  assert.equal(await s.add('a', 'carla@example.org'), 'invited', 'adding twice changes nothing');
  assert.deepEqual((await s.list('a')).invited, ['carla@example.org', 'nobody@example.org']);
  assert.equal(await s.add('a', 'francisco.example+test@googlemail.com'), 'self');
  await assert.rejects(s.add('a', 'not an address'), /Not an email/);
});

test('A friend who never shared yet appears without a level', async (t) => {
  const s = await friends(t);
  await s.add('a', 'david.sample@gmail.com');
  assert.equal(await s.add('b', 'francisco.example@gmail.com'), 'friends');
  assert.deepEqual((await s.list('a')).friends, [{ id: USERS.b, name: 'David Sample', level: null, weeks: null, weeksUntil: null }]);
});

test('Shared progress is validated', async (t) => {
  const s = await friends(t);
  await assert.rejects(s.share('a', 126), /Invalid progress/);
  await assert.rejects(s.share('a', -1), /Invalid progress/);
  await assert.rejects(s.share('a', 5, -1), /Invalid progress/);
  await assert.rejects(s.share('a', 5, 1001), /Invalid progress/);
  await assert.rejects(s.share('a', 5, 1, day(-3)), /Invalid progress/, 'a streak that already lapsed');
  await assert.rejects(s.share('a', 5, 1, day(17)), /Invalid progress/, 'no streak holds that long without practice');
  await assert.rejects(s.share('a', 5, 1, null), /Invalid progress/);
  await s.share('a', 5, 1, day(-1)); await s.share('a', 5, 1, day(15));
  await assert.rejects(s.share(null, 5), /permission denied/);
  await s.share('a', 0);
});

test('Not now and Remove stop both sides seeing each other; adding again restores the friendship', async (t) => {
  const s = await friends(t);
  await s.share('a', 9); await s.share('b', 3);
  // Carla asks Francisco, who puts it aside: it disappears for him; Carla still sees her invitation.
  await s.add('c', 'francisco.example@gmail.com');
  assert.equal((await s.list('a')).requests.length, 1);
  await s.remove('a', 'c');
  assert.deepEqual((await s.list('a')).requests, []);
  assert.deepEqual((await s.list('c')).invited, ['francisco.example@gmail.com']);
  // Francisco and David are friends; Francisco removes David.
  await s.add('a', 'david.sample@gmail.com'); await s.add('b', 'francisco.example@gmail.com');
  await s.remove('a', 'b');
  assert.deepEqual(await s.list('a'), { friends: [], requests: [], invited: [] });
  assert.deepEqual(await s.list('b'), { friends: [], requests: [], invited: ['francisco.example@gmail.com'] });
  // Adding David again restores it (David's own request still stands).
  assert.equal(await s.add('a', 'david.sample@gmail.com'), 'friends');
  assert.equal((await s.list('b')).friends.length, 1);
  // Removing someone who is not a friend changes nothing.
  await s.remove('b', 'c');
  assert.equal((await s.list('b')).friends.length, 1);
});

test('An invitation can be withdrawn before it is answered', async (t) => {
  const s = await friends(t);
  await s.add('a', 'david.sample@gmail.com');
  assert.equal((await s.list('b')).requests.length, 1);
  await s.cancel('a', 'David.Sample@gmail.com');
  assert.deepEqual((await s.list('a')).invited, []);
  assert.deepEqual((await s.list('b')).requests, []);
});

test('Names and addresses come from the Google sign-in, which the person cannot edit', async (t) => {
  const s = await friends(t);
  await s.add('a', 'carla@example.org');
  await s.add('c', 'francisco.example@gmail.com');
  assert.equal((await s.list('a')).friends[0].name, 'carla', 'no Google name: the address');
  // Editable account metadata (supabase.auth.updateUser) never renames anyone.
  await s.db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Someone Else"}' where id = $1`, [USERS.a]);
  await s.share('a', 2);
  assert.equal((await s.list('c')).friends[0].name, 'Francisco Example');
  // A new name from Google shows once that person next shares or opens Friends.
  await s.db.query(`update auth.identities set identity_data = identity_data || '{"full_name":"Francisco E."}' where user_id = $1`, [USERS.a]);
  assert.equal((await s.list('c')).friends[0].name, 'Francisco Example');
  await s.share('a', 2);
  assert.equal((await s.list('c')).friends[0].name, 'Francisco E.');
});

test('Only Google sign-ins can use friends, so nobody can claim an address they do not own', async (t) => {
  const s = await friends(t);
  await s.add('a', 'david.sample@gmail.com');
  // Someone signs up with email and password using David's address (or an unverified Google address).
  const impostor = '66666666-6666-4666-8666-666666666666';
  await s.db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'david.sample@gmail.com', '{"full_name":"David Sample"}')`, [impostor]);
  await s.db.query(`insert into auth.identities (user_id, provider, identity_data) values ($1, 'email', '{"email":"david.sample@gmail.com"}')`, [impostor]);
  await assert.rejects(s.list(impostor), /Google sign-in/);
  await assert.rejects(s.call(impostor, 'ona_add_friend', { p_email: 'francisco.example@gmail.com' }), /Google sign-in/);
  await s.db.query(`insert into auth.identities (user_id, provider, identity_data) values ($1, 'google', '{"email":"david.sample@gmail.com","email_verified":false}')`, [impostor]);
  await assert.rejects(s.list(impostor), /Google sign-in/);
  assert.deepEqual(await s.list('a'), { friends: [], requests: [], invited: ['david.sample@gmail.com'] });
});

test('Deleting an account’s cloud copy removes it from its friends’ lists', async (t) => {
  const s = await friends(t);
  await s.share('a', 9); await s.share('b', 3);
  await s.add('a', 'david.sample@gmail.com'); await s.add('b', 'francisco.example@gmail.com');
  await s.call('a', 'ona_delete_my_cloud_data', {});
  assert.deepEqual(await s.list('b'), { friends: [], requests: [], invited: ['francisco.example@gmail.com'] });
  assert.equal((await s.db.query('select count(*)::int as n from public.ona_friend_requests where from_user = $1', [USERS.a])).rows[0].n, 0);
  // Using Friends again starts a fresh profile with nothing shared.
  assert.deepEqual(await s.list('a'), { friends: [], requests: [{ id: USERS.b, name: 'David Sample', email: 'david.sample@gmail.com' }], invited: [] });
});

test('One person can keep at most 200 friends and invitations', async (t) => {
  const s = await friends(t);
  await s.list('a');
  await s.db.query(`insert into public.ona_friend_requests (from_user, to_email_key, to_email)
    select $1, 'friend' || n || '@example.org', 'friend' || n || '@example.org' from generate_series(1, 200) n`, [USERS.a]);
  await assert.rejects(s.add('a', 'one-more@example.org'), /Too many/);
  assert.equal(await s.add('a', 'friend7@example.org'), 'invited', 'an existing invitation can still be repeated');
});

test('The migration can run again without changing anything', async (t) => {
  const s = await friends(t);
  await s.share('a', 9); await s.add('a', 'david.sample@gmail.com'); await s.add('b', 'francisco.example@gmail.com');
  const { MIGRATIONS } = require('./supabase-helpers.cjs');
  await s.db.exec(MIGRATIONS[1]);
  assert.equal((await s.list('b')).friends[0].level, 9);
  await assert.rejects(s.as('a', 'select * from public.ona_profiles'), /permission denied/);
});
