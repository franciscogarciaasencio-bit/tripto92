const { test } = require('node:test');
const { assert, api, context, session } = require('./helpers.cjs');
const V7 = api.PROGRESSION_V7;
const begin = () => api.createProgressionState(context(1), V7);

test('V7 pays 16 Ripples a minute to 15 minutes, then +80 per doubling to 400, rounded to 5', () => {
  const table = { 0: 0, 179: 0, 180: 50, 300: 80, 600: 160, 900: 240, 1200: 275, 1500: 300, 1800: 320, 2100: 340,
    2400: 355, 2700: 365, 3000: 380, 3300: 390, 3600: 400, 7200: 400 };
  for (const [seconds, ripples] of Object.entries(table)) assert.equal(api.durationRewardCentiXp(Number(seconds), V7), ripples * 100, seconds);
  for (let seconds = 180; seconds <= 3600; seconds++) {
    const reward = api.durationRewardCentiXp(seconds, V7);
    assert.equal(reward % 500, 0);
    assert.ok(reward >= api.durationRewardCentiXp(seconds - 1, V7), `never less for longer: ${seconds}`);
  }
  assert.deepEqual(V7.occasionWeightsBasisPoints, [10_000, 7_500, 5_000]);
});

test('A third separate practice in a day counts half; a fourth earns nothing', () => {
  let state = begin();
  for (const hour of [6, 9, 12, 15]) state = api.recordSession(state, session({ day: 1, hour, minutes: 10 }));
  assert.deepEqual(state.awards.map((award) => award.breakdown.incrementalBaseCentiXp), [16_000, 12_000, 8_000, 0]);
});

test('Consistency eases out: early practice counts most; full after 42 contributions is +700%', () => {
  const unit = V7.continuousConsistency.contributionUnits;
  const bonus = (points) => { const r = api.consistencyMultiplier(V7, points * unit); return (r.numerator - r.denominator) / r.denominator; };
  assert.equal(V7.continuousConsistency.targetContributions, 42);
  assert.equal(bonus(0), 0);
  assert.equal(bonus(42), 7);
  assert.ok(Math.abs(bonus(7) - 7 * (1 - (35 / 42) ** 2)) < 1e-5);
  assert.ok(Math.abs(bonus(21) - 5.25) < 1e-5, 'three weeks daily: +525%');
  for (let points = 1; points <= 42; points++) assert.ok(bonus(points) - bonus(points - 1) <= bonus(1) + 1e-9, 'each point adds no more than the first');
  assert.equal(api.consistencyDisplayFraction(V7, 0.5), 0.75);
  assert.equal(api.consistencyDisplayFraction(api.PROGRESSION_V6, 0.5), 0.5);
});

test('Each award splits into practice and Consistency; a practice’s own contribution counts toward its bonus', () => {
  let state = begin();
  for (let day = 1; day <= 2; day++) state = api.recordSession(state, session({ day, minutes: 10 }));
  state.awards.forEach((award, index) => {
    const points = index + 1, expected = Math.round(16_000 * 7 * (1 - ((42 - points) / 42) ** 2));
    assert.ok(Math.abs(award.breakdown.bonusCentiXp - expected) <= 1, `${award.breakdown.bonusCentiXp} vs ${expected}`);
    assert.equal(award.breakdown.incrementalBaseCentiXp, 16_000);
    assert.equal(award.xpCenti, award.breakdown.incrementalBaseCentiXp + award.breakdown.bonusCentiXp);
  });
});

function pace(minutes, hours, days, skip = () => false) {
  let state = begin(), checkpoint = api.createHabitCheckpoint(state);
  const reached = {};
  for (let day = 1; day <= days; day++) {
    if (skip(day)) continue;
    for (const hour of hours) {
      const after = api.recordSession(state, session({ day, hour, minutes })), result = api.recordHabitReward(checkpoint, state, after);
      state = after; checkpoint = result.checkpoint;
      for (const level of [10, 50, 100, 125]) if (!reached[level] && result.journey.level.number >= level) reached[level] = day;
    }
  }
  return reached;
}

test('Owner-approved pacing (2026-10-17): ten minutes daily reaches Level 100 in about 3.5 months, 125 in about 6.5', () => {
  assert.deepEqual(pace(10, [9], 210), { 10: 5, 50: 19, 100: 105, 125: 200 });
  assert.deepEqual(pace(20, [7, 15], 75), { 10: 2, 50: 8, 100: 37, 125: 69 });
});

test('Level thresholds: 1–49 unchanged, then every level to 125 costs a little more than the last', () => {
  const xp = api.HABIT_LEVELS.map((level) => level.xpCenti);
  const gentle = (index) => Math.round(12_000 + 1_400_000 * index / 124 + 2_688_000 * (index / 124) ** 1.75);
  for (let index = 0; index < 49; index++) assert.equal(xp[index], gentle(index), `level ${index + 1}`);
  const steps = xp.slice(1).map((value, index) => value - xp[index]);
  for (let index = 49; index < 124; index++) assert.ok(steps[index] > steps[index - 1], `level ${index + 2}`);
  assert.ok(steps[100] - steps[99] < steps[99] * 0.03, 'Level 101 costs only slightly more than Level 100');
  assert.ok(Math.abs(xp[99] - 11_879_900) < 200, String(xp[99]));
  assert.ok(api.HABIT_LEVELS.every((level) => level.realDays === 1 && level.elapsedDays === 0 && level.credits === 1));
});

test('Switching V6 to V7 keeps every V6 receipt and carries Consistency over in proportion', () => {
  let state = api.createProgressionState(context(1), api.PROGRESSION_V6);
  for (let day = 1; day <= 6; day++) state = api.recordSession(state, session({ day, minutes: 10 }));
  const before = api.getProgressSnapshot(state, context(7)), awards = state.awards;
  const switched = api.changeProgressionRules(state, V7, context(7));
  assert.deepEqual(switched.awards, awards);
  const after = api.getProgressSnapshot(switched, context(7));
  assert.ok(Math.abs(after.consistency.fraction - before.consistency.fraction) < 1e-6);
  assert.ok(Math.abs(after.consistency.indicatorFraction - (1 - (1 - after.consistency.fraction) ** 2)) < 1e-9);
  const next = api.recordSession(switched, session({ day: 7, minutes: 10 }));
  assert.equal(next.awards.at(-1).rulesVersion, 'progression_v7');
  assert.equal(next.awards.at(-1).breakdown.incrementalBaseCentiXp, 16_000);
});
