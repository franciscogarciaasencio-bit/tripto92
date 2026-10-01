const { test } = require('node:test');
const { assert, api, domain, at, context, session, start, daily, snapshot } = require('./helpers.cjs');
const { durationRewardCentiXp } = domain('progression/earnings.js');

for (const [seconds, qualifies, xp] of [[0, false, 0], [120, false, 0], [299, false, 0], [300, true, 6000]]) {
  test(`${seconds} active seconds: qualification=${qualifies}`, () => {
    const state = api.recordSession(start(), session({ activeSeconds: seconds }));
    assert.equal(state.sessions[0].qualified, qualifies);
    assert.equal(state.lifetimeXpCenti, xp);
    assert.equal(state.totalMeditationSeconds, seconds);
    assert.equal(snapshot(state, 1, 12).totalQualifyingPracticeDays, qualifies ? 1 : 0);
  });
}

test('Paused wall time cannot turn 4:59 of activity into a qualifying session', () => {
  const state = api.recordSession(start(), session({ activeSeconds: 299, pausedSeconds: 301 }));
  assert.equal(state.lifetimeXpCenti, 0);
  assert.equal(snapshot(state, 1, 12).totalMeditationSeconds, 299);
});

test('Five active minutes plus pauses earn exactly the five-minute reward', () => {
  const state = api.recordSession(start(), session({ activeSeconds: 300, pausedSeconds: 300 }));
  assert.equal(state.lifetimeXpCenti, 6000);
});

test('An early stop can qualify based on actual duration', () => {
  const state = api.recordSession(start(), session({ minutes: 10, status: 'ended_early' }));
  assert.equal(state.lifetimeXpCenti, 8000);
});

for (const [minutes, centi] of [[5, 6000], [10, 8000], [15, 9170], [20, 10000], [30, 11170], [60, 13170], [120, 13170]]) {
  test(`Duration reward for ${minutes} minutes is ${centi} centi-XP`, () => {
    assert.equal(durationRewardCentiXp(minutes * 60, api.PROGRESSION_V1), centi);
  });
}

test('First, second, third, fourth and later occasions have the specified weights', () => {
  let state = start();
  [6, 8, 10, 12, 14].forEach((hour) => { state = api.recordSession(state, session({ hour })); });
  assert.deepEqual(state.awards.map((award) => award.xpCenti), [8000, 6000, 2000, 0, 0]);
  assert.deepEqual(state.occasions.map((occasion) => occasion.ordinalInDay), [1, 2, 3, 4, 5]);
  assert.equal(state.totalMeditationSeconds, 3000);
  assert.equal(state.sessions[3].qualified, true);
  assert.equal(snapshot(state, 1, 18).totalQualifyingPracticeDays, 1);
});

for (const [gap, expectedOccasions] of [[5399, 1], [5400, 2], [5401, 2]]) {
  test(`A ${gap}-second end-to-start gap creates ${expectedOccasions} occasion(s)`, () => {
    const first = session();
    const state = api.recordSession(api.recordSession(start(), first), session({ startedAt: first.endedAt + gap * 1000 }));
    assert.equal(state.occasions.length, expectedOccasions);
    assert.equal(state.lifetimeXpCenti, expectedOccasions === 1 ? 10000 : 14000);
  });
}

test('Nearby 10 + 10 minutes award 80 then 20, never 80 then 100', () => {
  const before = api.recordSession(start(), session());
  const after = api.recordSession(before, session({ startedAt: at(1, 9.5) }));
  assert.deepEqual(after.awards.map((award) => award.xpCenti), [8000, 2000]);
  assert.equal(after.lifetimeXpCenti, 10000);
  assert.equal(after.occasions[0].activeDurationSeconds, 1200);
  assert.deepEqual(before.awards.map((award) => award.xpCenti), [8000]);
});

test('Repeated incremental extensions telescope to the cumulative occasion reward', () => {
  let state = start();
  for (let i = 0; i < 12; i++) state = api.recordSession(state, session({ startedAt: at(1, 6) + i * 600_000, minutes: 5 }));
  assert.equal(state.occasions.length, 1);
  assert.equal(state.lifetimeXpCenti, 13170);
  assert.equal(state.awards.reduce((total, award) => total + award.xpCenti, 0), 13170);
});

test('Extensions after the duration ceiling record time and a zero-XP receipt', () => {
  let state = api.recordSession(start(), session({ hour: 6, minutes: 60 }));
  state = api.recordSession(state, session({ hour: 7.1, minutes: 10 }));
  assert.equal(state.lifetimeXpCenti, 13170);
  assert.equal(state.awards[1].xpCenti, 0);
  assert.equal(state.totalMeditationSeconds, 4200);
});

test('Fractional consistency and frequency still award only the rounded cumulative target', () => {
  let state = daily(6);
  state = api.recordSession(state, session({ day: 7, hour: 9 }));
  for (const hour of [12, 12.5, 13]) state = api.recordSession(state, session({ day: 7, hour, minutes: 5 }));
  const increments = state.awards.slice(-3).map((award) => award.xpCenti);
  assert.deepEqual(increments, [6043, 2014, 1179]);
  assert.equal(increments.reduce((sum, amount) => sum + amount, 0), 9236);
  assert.equal(state.occasions.at(-1).awardedCentiXp, 9236);
});

test('Duplicate processing is a no-op even after another session or a later checkpoint', () => {
  const first = session();
  let state = api.recordSession(start(), first);
  state = api.recordSession(state, session({ hour: 12 }));
  state = api.advanceProgression(state, context(5));
  assert.equal(api.recordSession(state, { ...first }), state);
  assert.equal(state.awards.length, 2);
});

test('Reusing a session ID for changed data fails', () => {
  const first = session();
  const state = api.recordSession(start(), first);
  assert.throws(() => api.recordSession(state, { ...first, status: 'ended_early' }), /Conflicting session ID/);
});

for (const count of [10, 1000]) {
  test(`${count} two-minute runs cannot pool their time into qualification`, () => {
    let state = start();
    for (let i = 0; i < count; i++) {
      state = api.recordSession(state, session({ startedAt: at(1, 1) + i * 180_000, minutes: 2 }));
    }
    assert.equal(state.lifetimeXpCenti, 0);
    assert.equal(state.occasions.length, 0);
    assert.equal(state.awards.length, 0);
    assert.equal(state.totalMeditationSeconds, count * 120);
  });
}

test('Short sessions neither extend nor bridge qualifying occasions', () => {
  let state = api.recordSession(start(), session({ hour: 9 }));
  state = api.recordSession(state, session({ hour: 10, minutes: 2 }));
  state = api.recordSession(state, session({ hour: 10.75 }));
  assert.equal(state.occasions.length, 2);
  assert.equal(state.lifetimeXpCenti, 14000);
  assert.equal(state.totalMeditationSeconds, 1320);
});

test('Consecutive short sessions do not increase a nearby qualifying occasion duration', () => {
  let state = api.recordSession(start(), session({ hour: 9 }));
  state = api.recordSession(state, session({ hour: 9.5, minutes: 2 }));
  assert.equal(state.occasions[0].activeDurationSeconds, 600);
  assert.equal(state.lifetimeXpCenti, 8000);
});
