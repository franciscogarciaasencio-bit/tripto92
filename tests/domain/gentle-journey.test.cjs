const { test } = require('node:test');
const { assert, api, context, session, at } = require('./helpers.cjs');
const start = () => api.createProgressionState(context(1), api.PROGRESSION_V3);

test('A three-minute first practice preserves its reward and advances only 38% of Level 0', () => {
  const state = api.recordSession(start(), session({ minutes: 3 }));
  const journey = api.getJourneyFromState(state);
  assert.equal(state.lifetimeXpCenti, 4526);
  assert.equal(journey.level.number, 0);
  assert.equal(journey.fraction, 4526 / 12000);
  assert.equal(journey.next.number, 1);
  assert.equal(api.getJourneyFromState(state, null, { version: api.LEGACY_JOURNEY_VERSION }).level.number, 2);
});

test('Two daily ten-minute practices open Level 1 with modest progress toward Level 2', () => {
  let state = api.recordSession(start(), session());
  const before = api.getJourneyFromState(state);
  state = api.recordSession(state, session({ day: 2 }));
  const after = api.getJourneyFromState(state), plan = api.getJourneyProgressTransition(before, after);
  assert.equal(after.level.number, 1);
  assert.ok(after.fraction > 0 && after.fraction < .5);
  assert.deepEqual(plan.segments, [{ level: 0, from: 8000 / 12000, to: 1 }, { level: 1, from: 0, to: after.fraction }]);
  assert.ok(Object.isFrozen(plan.segments[0]));
});

test('Early and later Ripple intervals strictly grow; maximum and original reward balancing stay fixed', () => {
  let interval = api.JOURNEY_LEVELS[0].xpCenti;
  for (let i = 1; i < 125; i++) {
    const next = api.JOURNEY_LEVELS[i].xpCenti - api.JOURNEY_LEVELS[i - 1].xpCenti;
    assert.ok(next > interval || i === 1); interval = next;
  }
  assert.equal(api.JOURNEY_LEVELS.at(-1).xpCenti, 3000000);
  assert.equal(api.LEGACY_JOURNEY_LEVELS[1].xpCenti, 651);
  assert.equal(api.LEGACY_JOURNEY_LEVELS[2].xpCenti, 2190);
  assert.throws(() => api.getJourneyFromState(start(), null, { version: 'unknown' }), /Unsupported/);
});

test('First level requires BOTH 120 Ripples and qualifying practice, including exact Ripple boundary', () => {
  const metrics = { lifetimeXpCenti: 12000, credits: 1, realDays: 1, firstPracticeAt: at(1), asOf: at(2) };
  assert.equal(api.getLifetimeJourney(metrics).level.number, 1);
  assert.equal(api.getLifetimeJourney({ ...metrics, lifetimeXpCenti: 11999 }).level.number, 0);
  for (const key of ['credits', 'realDays']) assert.equal(api.getLifetimeJourney({ ...metrics, [key]: 0 }).level.number, 0);
});

for (const [minutes, days] of [[3, [11,60,140,237,349,475]], [10, [7,37,100,178,267,366]],
  [20, [6,37,100,178,267,366]], [30, [5,37,100,178,267,366]]]) {
  test(`V3 actual-engine pacing for ${minutes} minutes daily`, () => {
    let state = start(); const targets = [5,25,50,75,100,125], reached = {};
    for (let day = 1; day <= days.at(-1); day++) {
      state = api.recordSession(state, session({ day, minutes }));
      const journey = api.getJourneyFromState(state);
      for (const level of targets) if (!reached[level] && journey.level.number >= level) reached[level] = day;
    }
    assert.deepEqual(targets.map(level => reached[level]), days);
  });
}

test('Multiple-level animation fills each crossed bar and ends at the exact saved fraction', () => {
  const metrics = { lifetimeXpCenti: 0, credits: 20, realDays: 20, firstPracticeAt: at(1), asOf: at(20) };
  const before = api.getLifetimeJourney(metrics), after = api.getLifetimeJourney({ ...metrics, lifetimeXpCenti: 90000 });
  const plan = api.getJourneyProgressTransition(before, after);
  assert.equal(plan.segments.length, after.level.number + 1);
  assert.equal(plan.segments.at(-1).to, after.fraction);
  for (const [index, segment] of plan.segments.entries()) {
    assert.equal(segment.level, index); assert.equal(segment.from, 0);
    if (index !== plan.segments.length - 1) assert.equal(segment.to, 1);
  }
  assert.throws(() => api.getJourneyProgressTransition(after, before), /Invalid/);
});

test('Same-level, no-progress and maximum animation plans remain truthful', () => {
  const metrics = { lifetimeXpCenti: 0, credits: 1, realDays: 1, firstPracticeAt: at(1), asOf: at(500) };
  const before = api.getLifetimeJourney(metrics), after = api.getLifetimeJourney({ ...metrics, lifetimeXpCenti: 4526 });
  assert.deepEqual(api.getJourneyProgressTransition(before, after).segments, [{ level: 0, from: 0, to: 4526/12000 }]);
  assert.deepEqual(api.getJourneyProgressTransition(after, after).segments, [{ level: 0, from: after.fraction, to: after.fraction }]);
  const maximum = api.getLifetimeJourney({ ...metrics, lifetimeXpCenti: 3000000, credits: 365, realDays: 365 });
  assert.equal(maximum.level.number, 125);
  assert.deepEqual(api.getJourneyProgressTransition(maximum, maximum).segments, [{ level: 125, from: 1, to: 1 }]);
});
