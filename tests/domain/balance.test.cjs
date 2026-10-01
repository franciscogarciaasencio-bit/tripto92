const { test } = require('node:test');
const { assert, api, at, session, start, daily, snapshot, nearXp } = require('./helpers.cjs');

const cases = [
  ['A: 10 minutes daily', () => daily(30), 3232, 300],
  ['B: 10 minutes twice daily', () => daily(30, 10, [9, 18]), 5656, 600],
  ['C: 30 minutes daily', () => daily(30, 30), 4512.6497, 900],
  ['D: 60 minutes daily', () => daily(30, 60), 5320.6497, 1800],
  ['E: 10 minutes except Sundays', () => daily(30, 10, [9], (day) => day % 7 === 0), 2697.142857, 260],
  ['K: two nearby 10-minute sessions daily', () => daily(30, 10, [9, 9.5]), 4040, 600],
];

for (const [label, build, expected, minutes] of cases) {
  test(`Balance ${label}`, (t) => {
    const state = build();
    const view = snapshot(state, 31);
    nearXp(view.lifetimeXpCenti, expected);
    assert.equal(view.currentProgressionCenti, view.lifetimeXpCenti);
    assert.equal(view.totalMeditationMinutes, minutes);
    t.diagnostic(`Lifetime/current: ${view.lifetimeXpCenti / 100} XP`);
  });
}

test('Balance B progresses approximately 1.75 times as fast as A', () => {
  const a = daily(30), b = daily(30, 10, [9, 18]);
  assert.ok(Math.abs(b.lifetimeXpCenti / a.lifetimeXpCenti - 1.75) < 0.0001);
});

test('Balance J: ten tiny sessions every day for a month earn zero progression', () => {
  let state = start();
  for (let day = 1; day <= 30; day++) {
    for (let i = 0; i < 10; i++) state = api.recordSession(state, session({ startedAt: at(day, 9) + i * 180_000, minutes: 2 }));
  }
  const view = snapshot(state, 31);
  assert.equal(view.currentProgressionCenti, 0);
  assert.equal(view.lifetimeXpCenti, 0);
  assert.equal(view.totalQualifyingPracticeDays, 0);
  assert.equal(view.totalMeditationMinutes, 600);
});

test('Balance F: 14 practice days, one missed day, then a normal return', () => {
  const before = daily(14);
  const after = api.recordSession(before, session({ day: 16 }));
  nearXp(after.lifetimeXpCenti, 1547.428571);
  assert.equal(after.currentProgressionCenti, after.lifetimeXpCenti);
  assert.equal(after.awards.at(-1).breakdown.precedingActiveDays, 6);
});

test('Balance G: 14 practice days, three missed days, only one decay before return', () => {
  const after = api.recordSession(daily(14), session({ day: 18 }));
  nearXp(after.lifetimeXpCenti, 1538.285714);
  nearXp(after.currentProgressionCenti, 1523.885714);
  assert.equal(after.lifetimeXpCenti - after.currentProgressionCenti, 1440);
  assert.equal(after.awards.at(-1).breakdown.precedingActiveDays, 4);
});

for (const [label, days, lifetime, current] of [['H', 30, 3232, 3040], ['I', 180, 20032, 19840]]) {
  test(`Balance ${label}: ${days} practice days then fourteen COMPLETE inactive days`, (t) => {
    const state = daily(days);
    // Practice ends on day N; days N+1 through N+14 finish at start of N+15.
    const view = snapshot(state, days + 15);
    nearXp(view.lifetimeXpCenti, lifetime);
    nearXp(view.currentProgressionCenti, current);
    assert.equal(view.lifetimeXpCenti - view.currentProgressionCenti, 19200);
    assert.equal(view.inactivity.completeInactiveDays, 14);
    assert.equal(view.consistency.multiplier, 1);
    t.diagnostic(`Lifetime: ${view.lifetimeXpCenti / 100}; current: ${view.currentProgressionCenti / 100} XP`);
  });
}

test('The second meaningful occasion beats one long session without promoting fragmentation', () => {
  const twice15 = daily(1, 15, [9, 18]);
  const once60 = daily(1, 60);
  const nearby15 = daily(1, 15, [9, 9.5]);
  assert.ok(twice15.lifetimeXpCenti > once60.lifetimeXpCenti);
  assert.equal(nearby15.lifetimeXpCenti, daily(1, 30).lifetimeXpCenti);
});
