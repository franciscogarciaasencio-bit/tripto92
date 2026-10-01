const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { assert, api, domain, at, context, session, start, daily, snapshot } = require('./helpers.cjs');
const { multiplyRatio } = domain('progression/numeric.js');

test('Integer ratios round half upward and avoid unsafe multiplication drift', () => {
  assert.equal(multiplyRatio(1, 1, 2), 1);
  assert.equal(multiplyRatio(101, 1, 4), 25);
  assert.equal(multiplyRatio(101, 1, 4, true), 26);
  assert.equal(multiplyRatio(Number.MAX_SAFE_INTEGER, 10000, 10000), Number.MAX_SAFE_INTEGER);
  assert.throws(() => multiplyRatio(Number.MAX_SAFE_INTEGER, 2, 1), /safe integer/);
});

test('Repeated projections do not drift or mutate the stored state', () => {
  const state = daily(30);
  const before = JSON.stringify(state);
  const expected = snapshot(state, 45);
  for (let i = 0; i < 50; i++) assert.deepEqual(snapshot(state, 45), expected);
  assert.equal(JSON.stringify(state), before);
});

test('Settling one day at a time equals settling the same interval once', () => {
  const initial = daily(14);
  let stepped = initial;
  for (let day = 15; day <= 70; day++) stepped = api.advanceProgression(stepped, context(day));
  const direct = api.advanceProgression(initial, context(70));
  assert.deepEqual(stepped, direct);
  assert.deepEqual(api.advanceProgression(direct, context(70)), direct);
});

test('Long mixed history always conserves receipts and obeys balance bounds', () => {
  let state = start();
  let previousLifetime = 0;
  // Fixed schedule: varied durations, gaps, early stops, and below-minimum runs.
  for (let day = 1; day <= 120; day++) {
    if (day % 9 < 4) continue;
    const options = { day, minutes: [2, 5, 10, 20, 60][day % 5], status: day % 2 ? 'completed' : 'ended_early' };
    state = api.recordSession(state, session(options));
    assert.ok(state.lifetimeXpCenti >= previousLifetime);
    assert.ok(Number.isSafeInteger(state.currentProgressionCenti));
    assert.ok(state.currentProgressionCenti <= state.lifetimeXpCenti);
    assert.ok(state.currentProgressionCenti >= Math.ceil(state.lifetimeXpCenti / 4));
    assert.equal(state.lifetimeXpCenti, state.awards.reduce((sum, award) => sum + award.xpCenti, 0));
    assert.equal(api.recordSession(state, session(options)), state);
    previousLifetime = state.lifetimeXpCenti;
  }
});

test('Machine time zone cannot affect domain results', () => {
  const script = `
    const { api, daily, snapshot } = require(${JSON.stringify(require.resolve('./helpers.cjs'))});
    process.stdout.write(JSON.stringify(snapshot(daily(30), 45)));
  `;
  const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map((TZ) => {
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(outputs[0], outputs[1]);
  assert.equal(outputs[1], outputs[2]);
});

for (const [label, changes] of [
  ['negative active time', { activeDurationSeconds: -1 }],
  ['fractional active seconds', { activeDurationSeconds: 1.5 }],
  ['nonfinite duration', { activeDurationSeconds: Infinity }],
  ['negative paused time', { pausedDurationSeconds: -1 }],
  ['impossible elapsed time', { activeDurationSeconds: 900 }],
  ['reversed timestamps', { endedAt: at(1, 8) }],
  ['empty ID', { id: '' }],
  ['invalid date', { localDate: '2026-02-30' }],
  ['unsupported calendar year', { localDate: '0000-01-01' }],
  ['unqualified date format', { localDate: '01/05/2026' }],
  ['missing zone', { timeZone: '' }],
  ['unfinished status', { status: 'running' }],
]) {
  test(`Rejects ${label}`, () => {
    assert.throws(() => api.recordSession(start(), { ...session(), ...changes }));
  });
}

test('Overlapping or backdated session writes are rejected rather than rewriting awards', () => {
  const state = api.recordSession(start(), session({ day: 2 }));
  assert.throws(() => api.recordSession(state, session({ day: 1 })), /order without overlaps/);
  assert.throws(() => api.recordSession(state, session({ day: 2, hour: 9.05 })), /order without overlaps/);
  assert.throws(() => api.recordSession(api.advanceProgression(state, context(5)), session({ day: 3 })), /rewind/);
  assert.throws(() => snapshot(state, 1), /rewind/);
});

for (const [label, changes] of [
  ['empty version', { version: '' }],
  ['unsupported earnings', { earningsAlgorithm: 'unknown' }],
  ['unsupported decay', { decayAlgorithm: 'unknown' }],
  ['zero minimum', { minimumActiveSeconds: 0 }],
  ['zero window', { consistencyWindowDays: 0 }],
  ['invalid decay percentage', { dailyDecayBasisPoints: 10001 }],
  ['invalid floor', { protectedFloorBasisPoints: -1 }],
  ['increasing frequency weights', { occasionWeightsBasisPoints: [1000, 2000] }],
  ['missing frequency weights', { occasionWeightsBasisPoints: [] }],
  ['missing ranks', { ranks: [] }],
  ['rank without a zero threshold', { ranks: api.PROGRESSION_V1.ranks.slice(1) }],
  ['duplicate rank IDs', { ranks: [api.PROGRESSION_V1.ranks[0], { ...api.PROGRESSION_V1.ranks[1], id: 'monkey_mind' }] }],
  ['unordered ranks', { ranks: [api.PROGRESSION_V1.ranks[0], api.PROGRESSION_V1.ranks[2], api.PROGRESSION_V1.ranks[1]] }],
  ['cap below qualification', { duration: { ...api.PROGRESSION_V1.duration, capSeconds: 60 } }],
]) {
  test(`Rejects rules with ${label}`, () => assert.throws(() => start({ ...api.PROGRESSION_V1, ...changes })));
}
