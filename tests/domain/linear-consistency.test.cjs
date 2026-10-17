const { test } = require('node:test');
const { assert, api, domain, context, session, at } = require('./helpers.cjs');
const { multiplyRatio } = domain('progression/numeric.js');
const begin = rules => api.createProgressionState(context(1), rules ?? api.PROGRESSION_V5);
const score = state => api.progressionConsistency(state).score;
const records = (days, hours = [9], minutes = 10) => Array.from({ length: days }, (_, i) =>
  hours.map(hour => session({ day: i + 1, hour, minutes }))).flat();
const earn = (sessions, initial = begin()) => sessions.reduce((state, practice) => api.recordSession(state, practice), initial);

test('V5 is additive: sixty exact fixed-point contributions and the original earning parameters', () => {
  const v4 = api.PROGRESSION_V4, v5 = api.PROGRESSION_V5;
  assert.deepEqual(Object.fromEntries(Object.entries(v5).filter(([k]) => !['version', 'continuousConsistency'].includes(k))),
    Object.fromEntries(Object.entries(v4).filter(([k]) => !['version', 'continuousConsistency'].includes(k))));
  assert.equal(v4.continuousConsistency.scale, 1_000_000);
  assert.equal(v4.continuousConsistency.growthBasisPoints, 1500);
  assert.equal(v4.continuousConsistency.algorithm, undefined);
  assert.equal(v5.continuousConsistency.scale, 60_000_000);
  assert.equal(v5.continuousConsistency.scale / v5.continuousConsistency.contributionUnits, 60);
  assert.equal(v5.maximumConsistencyBonusBasisPoints, 4000);
  assert.ok(Object.isFrozen(v5.continuousConsistency));
});

test('One daily contribution grows linearly through every boundary and reaches exactly full on day sixty', () => {
  let state = begin();
  for (let day = 1; day <= 65; ++day) {
    state = api.recordSession(state, session({ day }));
    const expected = Math.min(day, 60) * 1_000_000;
    assert.equal(score(state), expected);
    const projection = api.getProgressSnapshot(state, state.asOf).consistency;
    assert.equal(projection.fraction, expected / 60_000_000);
    assert.equal(projection.indicatorFraction, projection.fraction);
    assert.ok(Math.abs(projection.multiplier - (1 + .4 * projection.fraction)) < 1e-12);
  }
});

test('Two eligible contributions per captured date reach full on day thirty, never create sixty practice dates', () => {
  const state = earn(records(30, [7, 15]));
  assert.equal(score(state), 60_000_000);
  assert.equal(api.practiceCredits(state.sessions.map(e => e.session)).credits, 60);
  assert.equal(api.practiceCredits(state.sessions.map(e => e.session)).realDays, 30);
  assert.equal(earn(records(29, [7, 15])).awards.at(-1).breakdown.continuousConsistencyScore, 58_000_000);
});

for (const [seconds, expected] of [[0, 0], [1, 0], [179, 0], [180, 1_000_000]]) {
  test(`V5 ${seconds} active seconds with long pauses receives ${expected ? 'one' : 'no'} contribution`, () => {
    const practice = session({ activeSeconds: seconds, pausedSeconds: 10_000 });
    const state = api.recordSession(begin(), practice);
    assert.equal(score(state), expected);
    assert.equal(state.sessions[0].qualified, seconds >= 180);
    if (seconds > 0) assert.ok(state.lifetimeXpCenti > 0, 'Positive short practices still earn their own modest Ripples');
  });
}

test('Early-ended practice earns allowed Ripples without a contribution; tiny sessions never combine', () => {
  const ended = earn([session({ minutes: 10, status: 'ended_early' })]);
  assert.equal(score(ended), 0); assert.equal(ended.lifetimeXpCenti, 8000);
  const tiny = Array.from({ length: 100 }, (_, i) => session({ id: `tiny-${i}`, startedAt: at(1, 1) + i * 60_000, activeSeconds: 20 }));
  const state = earn(tiny);
  assert.equal(score(state), 0); assert.equal(api.practiceCredits(tiny).credits, 0);
  assert.ok(state.lifetimeXpCenti > 0);
});

for (const [gap, expected] of [[6 * 3_600_000 - 1, 1_000_000], [6 * 3_600_000, 2_000_000], [6 * 3_600_000 + 1, 2_000_000]]) {
  test(`The six-hour gate uses previous qualifying END and accepts gap ${gap}ms exactly`, () => {
    const first = session({ hour: 6, activeSeconds: 180, pausedSeconds: 600 });
    const second = session({ id: 'second', startedAt: first.endedAt + gap, activeSeconds: 180 });
    assert.equal(score(earn([first, second])), expected);
  });
}

test('A nearby qualifying return earns no extra contribution; a later third session may earn the second, never a third', () => {
  const state = earn([1, 2, 9, 20].map(hour => session({ hour, minutes: 3 })));
  assert.deepEqual(state.awards.map(a => a.breakdown.continuousConsistencyScore), [1_000_000, 1_000_000, 2_000_000, 2_000_000]);
  assert.equal(api.practiceCredits(state.sessions.map(e => e.session)).credits, 2);
});

test('Frequency reward caps do not suppress eligible Consistency or protect short practice days', () => {
  const state = earn([1, 3, 5, 9, 18].map(hour => session({ hour, minutes: 3 })));
  assert.equal(state.awards[3].xpCenti, 0); assert.equal(state.awards[4].xpCenti, 0);
  assert.equal(state.awards[3].breakdown.continuousConsistencyScore, 2_000_000);
  assert.equal(score(state), 2_000_000);
  const later = earn([session({ day: 3, activeSeconds: 179 })], state);
  assert.equal(score(later), multiplyRatio(2_000_000, 840_896, 1_000_000));
});

test('The first bonus uses the new exact score; nearby duration extension never re-awards the first reward', () => {
  const first = session(), next = session({ id: 'nearby', startedAt: first.endedAt + 20 * 60_000 });
  const state = earn([first, next]);
  assert.equal(state.awards[0].breakdown.incrementalBaseCentiXp, 8000);
  assert.equal(state.awards[0].breakdown.bonusCentiXp, 53);
  assert.equal(state.awards[0].xpCenti, 8053);
  assert.equal(state.awards[1].breakdown.incrementalBaseCentiXp, 2000);
  assert.equal(state.awards[1].breakdown.bonusCentiXp, 13);
  assert.equal(state.lifetimeXpCenti, 10066);
  assert.equal(api.recordSession(state, next), state);
});

test('Duplicate processing is idempotent and conflicting or out-of-order practice cannot mutate an anchor', () => {
  const practice = session(), state = earn([practice]), original = structuredClone(state);
  assert.deepEqual(api.recordSession(state, practice), state);
  assert.throws(() => api.recordSession(state, { ...practice, activeDurationSeconds: 599 }), /Conflicting/);
  assert.throws(() => api.recordSession(state, session({ id: 'older', hour: 8 })), /order|rewind/i);
  assert.deepEqual(state, original); assert.ok(Object.isFrozen(state.consistencyActivations[0]));
});

test('An incomplete inactive date does not decay; four complete missed dates halve the score in integer units', () => {
  const state = earn(records(60)), before = structuredClone(state);
  assert.equal(score(api.advanceProgression(state, context(61, 23.999))), 60_000_000);
  let expected = 60_000_000;
  for (let complete = 1; complete <= 4; ++complete) {
    expected = multiplyRatio(expected, 840_896, 1_000_000);
    const projected = api.advanceProgression(state, context(62 + complete - 1));
    assert.equal(score(projected), expected);
    assert.deepEqual(api.advanceProgression(projected, projected.asOf), projected);
    assert.equal(score(projected), score(projected));
  }
  assert.ok(Math.abs(expected - 30_000_000) <= 80);
  assert.deepEqual(state, before);
});

test('A returning contribution rebuilds immediately from the settled score with no recovery debt', () => {
  const before = earn(records(20)), settled = api.advanceProgression(before, context(25));
  const expected = score(settled) + 1_000_000;
  const after = earn([session({ day: 25 })], settled);
  assert.equal(score(after), expected);
  assert.equal(score(api.advanceProgression(after, context(26))), expected);
  assert.ok(after.lifetimeXpCenti > before.lifetimeXpCenti);
});

test('The same bar and bonus score stay capped at full with stable 40-percent earnings', () => {
  const state = earn(records(90));
  assert.equal(score(state), 60_000_000);
  assert.equal(state.awards.at(-1).breakdown.bonusCentiXp, 3200);
  assert.equal(state.awards.at(-1).xpCenti, 11200);
  const c = api.getProgressSnapshot(state, state.asOf).consistency;
  assert.equal(c.fraction, 1); assert.equal(c.indicatorFraction, 1); assert.equal(c.multiplier, 1.4);
});

test('V5 activation carries the settled V4 fraction, never reprices history or replays old contributions', () => {
  const v4 = earn(records(7), begin(api.PROGRESSION_V4));
  const settled = api.advanceProgression(v4, context(12));
  const previous = api.progressionConsistency(settled);
  const state = api.changeProgressionRules(v4, api.PROGRESSION_V5, context(12));
  const activation = state.consistencyActivations[0];
  assert.equal(activation.score, previous.score * 60);
  assert.equal(activation.previousRulesVersion, 'progression_v4');
  assert.equal(activation.awardCount, v4.awards.length); assert.equal(activation.sessionCount, v4.sessions.length);
  assert.equal(score(state), activation.score);
  assert.deepEqual(state.awards, v4.awards); assert.equal(state.lifetimeXpCenti, v4.lifetimeXpCenti);
  assert.equal(state.currentProgressionCenti, settled.currentProgressionCenti);
  assert.deepEqual(api.changeProgressionRules(state, api.PROGRESSION_V5, state.asOf), state);
  const after = earn([session({ day: 12 })], state);
  assert.equal(score(after), Math.min(60_000_000, activation.score + 1_000_000));
  assert.deepEqual(after.awards.slice(0, v4.awards.length), v4.awards);
  assert.equal(after.awards.at(-1).rulesVersion, 'progression_v5');
});

test('Activating V5 across a nearby open occasion closes its old formula without a historical top-up', () => {
  const first = session(), old = earn([first], begin(api.PROGRESSION_V4));
  const switched = api.changeProgressionRules(old, api.PROGRESSION_V5, old.asOf);
  const after = earn([session({ id: 'new', startedAt: first.endedAt + 1000, minutes: 3 })], switched);
  assert.equal(after.occasions.length, 2); assert.deepEqual(after.awards[0], old.awards[0]);
  assert.equal(after.awards[1].rulesVersion, 'progression_v5');
  assert.equal(after.awards[1].breakdown.weightBasisPoints, 7500);
  assert.equal(after.awards[1].breakdown.continuousConsistencyScore, 9_000_000);
  assert.equal(after.awards[1].breakdown.incrementalBaseCentiXp, 3395);
});

test('Activation retains captured-date contribution gates: an old first qualifies the later second but an old double remains capped', () => {
  const first = session({ hour: 6, minutes: 3 });
  const old = earn([first], begin(api.PROGRESSION_V4));
  const switched = api.changeProgressionRules(old, api.PROGRESSION_V5, old.asOf);
  const second = session({ id: 'second', startedAt: first.endedAt + 6 * 3_600_000, minutes: 3 });
  const after = earn([second], switched);
  assert.equal(score(after), 10_000_000);
  const oldDouble = earn([first, second], begin(api.PROGRESSION_V4));
  const switchedDouble = api.changeProgressionRules(oldDouble, api.PROGRESSION_V5, oldDouble.asOf);
  const third = earn([session({ hour: 22, minutes: 3 })], switchedDouble);
  assert.equal(score(third), 277500 * 60);
});

test('V1–V3 activation preserves every receipt and deliberately starts an absent continuous score at zero', () => {
  for (const version of [api.PROGRESSION_V1, api.PROGRESSION_V2, api.PROGRESSION_V3]) {
    const previous = earn(records(7), begin(version)), after = api.changeProgressionRules(previous, api.PROGRESSION_V5, previous.asOf);
    assert.equal(score(after), 0); assert.deepEqual(after.awards, previous.awards);
    assert.equal(after.lifetimeXpCenti, previous.lifetimeXpCenti);
    const returned = earn([session({ day: 8 })], after);
    assert.equal(score(returned), 1_000_000);
  }
});

test('Linear rule reactivation requires a new immutable version rather than a second contradictory anchor', () => {
  const v5 = earn(records(1));
  assert.throws(() => api.changeProgressionRules(v5, api.PROGRESSION_V4, v5.asOf), /downgrade/);
  const v6 = { ...api.PROGRESSION_V5, version: 'test_linear_v6' };
  const next = api.changeProgressionRules(v5, v6, v5.asOf);
  assert.equal(next.consistencyActivations.length, 2);
  assert.equal(score(next), score(v5));
  assert.throws(() => api.changeProgressionRules(next, api.PROGRESSION_V5, next.asOf), /reactivated/);
  assert.equal(earn([session({ day: 2 })], next).awards.at(-1).rulesVersion, 'test_linear_v6');
});

test('Absolute midnight separation and captured travel dates stay independent of the later device time zone', () => {
  const first = session({ id: 'midnight-1', startedAt: at(1, 23.98), minutes: 3, localDate: context(2).localDate, timeZone: 'Asia/Tokyo' });
  const second = session({ id: 'midnight-2', startedAt: first.endedAt + 1000, minutes: 3, localDate: context(2).localDate, timeZone: 'Europe/Madrid' });
  const state = earn([first, second]);
  assert.equal(state.occasions.length, 1); assert.equal(score(state), 1_000_000);
  const later = { timestamp: at(2, 20), localDate: context(2).localDate, timeZone: 'America/Los_Angeles' };
  assert.equal(api.getProgressSnapshot(state, later).consistency.fraction, 1 / 60);
  assert.equal(state.sessions[0].session.localDate, context(2).localDate);
});

test('Backward travel cannot recover lost score; return receipt uses the monotonic logical date', () => {
  let state = api.advanceProgression(earn(records(1)), context(6));
  const previous = score(state), travel = { timestamp: state.asOf.timestamp + 1, localDate: context(5).localDate, timeZone: 'Pacific/Honolulu' };
  state = api.advanceProgression(state, travel); assert.equal(score(state), previous);
  const returning = session({ id: 'travel-return', startedAt: travel.timestamp + 1000, minutes: 3, localDate: travel.localDate, timeZone: travel.timeZone });
  state = earn([returning], state); assert.equal(score(state), previous + 1_000_000);
  assert.equal(state.awards.at(-1).breakdown.continuousConsistencyDate, context(6).localDate);
  assert.equal(score(api.advanceProgression(state, context(7))), score(state));
});

test('Activation during backward travel retains its settled logical date and cannot decay the same date twice', () => {
  const old = api.advanceProgression(earn(records(1), begin(api.PROGRESSION_V4)), context(6));
  const travel = { timestamp: old.asOf.timestamp + 1, localDate: context(5).localDate, timeZone: 'Pacific/Honolulu' };
  const next = api.changeProgressionRules(old, api.PROGRESSION_V5, travel);
  assert.equal(next.consistencyActivations[0].asOf.localDate, context(6).localDate);
  assert.equal(score(next), api.progressionConsistency(old).score * 60);
  assert.equal(score(api.advanceProgression(next, travel)), score(next));
});

test('Pure V5 simulations are order-independent, duplicate-safe and deterministic without altering input history', () => {
  const input = records(20, [7, 15]), original = structuredClone(input), config = api.LINEAR_CONSISTENCY_V1;
  const expected = api.continuousConsistency(input, context(20, 23), config);
  assert.equal(expected.score, 40_000_000);
  assert.deepEqual(api.continuousConsistency([...input].reverse(), context(20, 23), config), expected);
  assert.deepEqual(api.continuousConsistency([...input, input[0]], context(20, 23), config), expected);
  assert.deepEqual(input, original);
  assert.throws(() => api.continuousConsistency(input, context(1), config), /future/);
  assert.throws(() => api.continuousConsistency([...input, { ...input[0], activeDurationSeconds: 599 }], context(20, 23), config), /Conflicting/);
});

test('Missing or malformed activation data fails explicitly instead of inventing a new consistency balance', () => {
  const state = earn(records(2)), anchor = state.consistencyActivations[0];
  assert.throws(() => score({ ...state, consistencyActivations: [] }), /activation anchor/);
  assert.throws(() => score({ ...state, consistencyActivations: [anchor, anchor] }), /exactly one/);
  for (const field of ['score', 'sessionCount', 'awardCount']) {
    assert.throws(() => api.validateConsistencyActivation({ ...anchor, [field]: .5 }, state), /integer/);
    assert.throws(() => api.validateConsistencyActivation({ ...anchor, [field]: -1 }, state), /integer/);
  }
  for (const wrong of [{ ...anchor, score: 60_000_001 }, { ...anchor, sessionCount: 3 },
    { ...anchor, awardCount: 3 }, { ...anchor, rulesVersion: 'progression_v4' },
    { ...anchor, asOf: context(3) }, { ...anchor, sessionCount: 1 }, { ...anchor, score: 1 },
    { ...anchor, previousRulesVersion: 'unknown' }, { ...anchor, previousRulesVersion: 'progression_v5' }]) {
    assert.throws(() => api.validateConsistencyActivation(wrong, state), /activation/i);
  }
  assert.throws(() => begin({ ...api.PROGRESSION_V5, continuousConsistency: { ...api.LINEAR_CONSISTENCY_V1, scale: 59_000_000 } }), /configuration/);
});

test('A forged in-range migrated score fails exact carry validation instead of silently affecting future earnings', () => {
  const old = earn(records(7), begin(api.PROGRESSION_V4));
  const state = api.changeProgressionRules(old, api.PROGRESSION_V5, context(12));
  const wrong = { ...state.consistencyActivations[0], score: state.consistencyActivations[0].score + 1 };
  assert.throws(() => score({ ...state, consistencyActivations: [wrong] }), /settled source/);
  const reordered = { ...state.consistencyActivations[0], sessionCount: 6, awardCount: 6 };
  assert.throws(() => score({ ...state, consistencyActivations: [reordered] }), /prefix|settled source/);
});

test('Serialization and repeated projections preserve every integer and immutable activation', () => {
  const state = earn(records(20)), restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(api.getProgressSnapshot(restored, context(25)), api.getProgressSnapshot(state, context(25)));
  assert.deepEqual(earn([session({ day: 25 })], restored), earn([session({ day: 25 })], state));
  assert.equal(state.lifetimeXpCenti, state.awards.reduce((total, award) => total + award.xpCenti, 0));
});

test('Released V5 daily earnings are unchanged (levels from 50 were re-paced for V7 on 2026-10-17)', () => {
  let state = begin(), checkpoint = api.createHabitCheckpoint(state);
  for (let day = 1; day <= 375; ++day) {
    const after = api.recordSession(state, session({ day }));
    const result = api.recordHabitReward(checkpoint, state, after);
    state = after; checkpoint = result.checkpoint;
    if (day === 30) assert.equal(state.lifetimeXpCenti, 264800);
    if (day === 60) assert.equal(state.lifetimeXpCenti, 577600);
    if (day === 365) assert.equal(state.lifetimeXpCenti, 3993600);
  }
  assert.equal(state.lifetimeXpCenti, 4105600);
  assert.ok(checkpoint.highestLevel >= 50 && checkpoint.highestLevel < 100);
});

test('Doubled V5 practice accelerates earnings and Consistency', () => {
  let state = begin(), checkpoint = api.createHabitCheckpoint(state);
  for (let day = 1; day <= 366; ++day) for (const hour of [7, 15]) {
    const after = api.recordSession(state, session({ day, hour })), result = api.recordHabitReward(checkpoint, state, after);
    state = after; checkpoint = result.checkpoint;
    if (day === 30 && hour === 15) assert.equal(state.lifetimeXpCenti, 505200);
  }
  assert.equal(api.practiceCredits(state.sessions.map(e => e.session)).realDays, 366);
  assert.ok(api.habitJourney(checkpoint, state).level.number > 50);
});

test('Habit inactivity remains three complete protected dates with permanent highest level and lifetime rewards', () => {
  const state = earn(records(60)), checkpoint = api.createHabitCheckpoint(state);
  for (const day of [61, 62, 63, 64]) assert.equal(api.advanceHabit(checkpoint, state, context(day)).effectiveXpCenti, checkpoint.effectiveXpCenti);
  const after = api.advanceHabit(checkpoint, state, context(65));
  assert.ok(after.effectiveXpCenti < checkpoint.effectiveXpCenti);
  assert.equal(after.highestLevel, checkpoint.highestLevel); assert.equal(state.lifetimeXpCenti, 577600);
  const annual = api.advanceHabit(checkpoint, state, context(426));
  const floor = api.protectedHabitLevel(checkpoint.highestLevel);
  assert.equal(api.habitJourney(annual, state).level.number, floor);
  assert.deepEqual(api.advanceHabit(annual, state, annual.asOf), annual);
});
