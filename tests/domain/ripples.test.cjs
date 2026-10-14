const { test } = require('node:test');
const { assert, api, domain, context, session, at } = require('./helpers.cjs');
const { durationRewardCentiXp } = domain('progression/earnings.js');
const start = () => api.createProgressionState(context(1), api.PROGRESSION_V3);

for (const [seconds, centi] of [[0,0],[1,25],[20,503],[60,1509],[120,3017],[179,4501],[180,4526],[300,6000],[600,8000],[3600,13170],[7200,13170]]) {
  test(`V3 duration ${seconds}s: ${centi} centi-Ripples with unchanged logarithmic rewards`, () => {
    assert.equal(durationRewardCentiXp(seconds, api.PROGRESSION_V3), centi);
    if (seconds >= 180) assert.equal(centi, durationRewardCentiXp(seconds, api.PROGRESSION_V2));
  });
}

test('The short curve is positive, monotone, and joins the rounded 180-second reward continuously', () => {
  let previous = 0;
  for (let seconds = 1; seconds <= 180; seconds++) {
    const reward = durationRewardCentiXp(seconds, api.PROGRESSION_V3);
    assert.ok(Number.isSafeInteger(reward) && reward > previous);
    assert.equal(reward, Math.round(4526 * seconds / 180));
    previous = reward;
  }
  assert.equal(previous, durationRewardCentiXp(180, api.PROGRESSION_V2));
  assert.equal(durationRewardCentiXp(180, api.PROGRESSION_V3) - durationRewardCentiXp(179, api.PROGRESSION_V3), 25);
  assert.throws(() => durationRewardCentiXp(0.5, api.PROGRESSION_V3), /integer/);
  assert.throws(() => durationRewardCentiXp(-1, api.PROGRESSION_V3), /integer/);
});

for (const status of ['completed', 'ended_early']) {
  for (const seconds of [0, 1, 20, 179, 180, 600]) {
    test(`Saved ${status} ${seconds}s: reward eligibility and qualifying practice remain separate`, () => {
      const input = session({ activeSeconds: seconds, pausedSeconds: 600, status });
      const state = api.recordSession(start(), input);
      const qualifies = status === 'completed' && seconds >= 180;
      assert.equal(api.isRewardEligible(input, api.PROGRESSION_V3), seconds > 0);
      assert.equal(state.lifetimeXpCenti, durationRewardCentiXp(seconds, api.PROGRESSION_V3));
      assert.equal(state.sessions[0].qualified, qualifies);
      assert.equal(state.awards.length, seconds > 0 ? 1 : 0);
      assert.equal(state.totalMeditationSeconds, seconds);
      assert.equal(api.practiceCredits([input]).credits, qualifies ? 1 : 0);
      assert.equal(api.getProgressSnapshot(state, context(2)).consistency.precedingActiveDays, qualifies ? 1 : 0);
      assert.equal(api.getJourneyFromState(state).level.number, 0);
    });
  }
}

test('Short split runs telescope to one cumulative duration reward without pooled qualification', () => {
  let state = start();
  for (let i = 0; i < 10; i++) state = api.recordSession(state,
    session({ id: `short-${i}`, startedAt: at(1, 9) + i * 30_000, activeSeconds: 20 }));
  assert.equal(state.occasions.length, 1);
  assert.equal(state.lifetimeXpCenti, durationRewardCentiXp(200, api.PROGRESSION_V3));
  assert.equal(state.awards.reduce((n, award) => n + award.xpCenti, 0), state.lifetimeXpCenti);
  assert.equal(state.occasions[0].activeDurationSeconds, 200);
  assert.equal(state.sessions.filter(entry => entry.qualified).length, 0);
  assert.equal(api.practiceCredits(state.sessions.map(entry => entry.session)).credits, 0);
  assert.equal(api.getProgressSnapshot(state, context(2)).consistency.multiplier, 1);
  assert.equal(api.getJourneyFromState(state).level.number, 0);
});

test('Thousands of tiny saved runs cannot exceed one capped occasion or unlock a level', () => {
  let state = start();
  // Each individually ineligible run is saved, but their incremental receipts share one duration cap.
  for (let i = 0; i < 4000; i++) state = api.recordSession(state,
    session({ id: `one-second-${i}`, startedAt: at(1, 7) + i * 1000, activeSeconds: 1 }));
  assert.equal(state.sessions.length, 4000);
  assert.equal(state.awards.length, 4000);
  assert.equal(state.occasions.length, 1);
  assert.equal(state.lifetimeXpCenti, 13170);
  assert.equal(state.awards.at(-1).xpCenti, 0);
  assert.equal(api.getJourneyFromState(state).level.number, 0);
});

test('Daily 100/75/25/0 weights also cap short runs and later extensions', () => {
  let state = start();
  for (const hour of [1, 3, 5, 7, 9]) state = api.recordSession(state, session({ hour, activeSeconds: 20 }));
  assert.deepEqual(state.awards.map(award => award.xpCenti), [503,377,126,0,0]);
  assert.equal(state.lifetimeXpCenti, 1006);
  state = api.recordSession(state, session({ hour: 9.25, minutes: 60 }));
  assert.equal(state.awards.at(-1).xpCenti, 0);
  assert.equal(state.lifetimeXpCenti, 1006);
  assert.equal(api.getJourneyFromState(state).level.number, 0); // It qualifies, but its Ripple balance still needs regular practice.
});

test('Three capped rewarded occasions retain the existing daily maximum, even with short extensions', () => {
  let state = start();
  for (const hour of [1, 4, 7, 10, 13]) {
    state = api.recordSession(state, session({ hour, activeSeconds: 20 }));
    state = api.recordSession(state, session({ hour: hour + 0.1, minutes: 60 }));
  }
  assert.deepEqual(state.occasions.map(occasion => occasion.awardedCentiXp), [13170,9878,3293,0,0]);
  assert.equal(state.lifetimeXpCenti, 26341); // Each weighted occasion rounds once: 131.70 + 98.78 + 32.93.
  assert.equal(state.occasions.length, 5);
  assert.equal(state.awards.reduce((n, award) => n + award.xpCenti, 0), 26341);
});

for (const [gap, occasions] of [[5399,1],[5400,2]]) {
  test(`V3 ${gap}s separation: short and long runs share the existing occasion boundary`, () => {
    const first = session({ activeSeconds: 20 });
    let state = api.recordSession(start(), first);
    state = api.recordSession(state, session({ id: 'later', startedAt: first.endedAt + gap * 1000, minutes: 10 }));
    assert.equal(state.occasions.length, occasions);
    assert.equal(state.lifetimeXpCenti, occasions === 1 ? durationRewardCentiXp(620, api.PROGRESSION_V3) : 6503);
  });
}

test('Cross-midnight short extensions freeze the first reward day without qualifying either date', () => {
  const first = session({ startedAt: at(1, 23.99), activeSeconds: 20, timeZone: 'Europe/Madrid' });
  const second = session({ id: 'midnight', startedAt: at(2, 0.01), activeSeconds: 20, timeZone: 'Asia/Tokyo' });
  let state = api.recordSession(start(), first);
  state = api.recordSession(state, second);
  assert.equal(state.occasions.length, 1);
  assert.equal(state.occasions[0].rewardDate, first.localDate);
  assert.equal(state.sessions[1].session.localDate, second.localDate);
  assert.equal(state.sessions[0].session.timeZone, 'Europe/Madrid');
  assert.equal(state.lifetimeXpCenti, durationRewardCentiXp(40, api.PROGRESSION_V3));
  assert.equal(api.getProgressSnapshot(state, context(3)).totalQualifyingPracticeDays, 0);
});

test('Seven preceding qualifying dates give a short run the real 1.4 bonus, never new credits', () => {
  let state = start();
  for (let day = 1; day <= 7; day++) state = api.recordSession(state, session({ day, minutes: 3 }));
  state = api.recordSession(state, session({ day: 8, activeSeconds: 20 }));
  const last = state.awards.at(-1);
  assert.equal(last.xpCenti, 704);
  assert.equal(last.breakdown.precedingActiveDays, 7);
  assert.equal(api.getJourneyFromState(state).metrics.credits, 7);
  assert.equal(api.getProgressSnapshot(state, state.asOf).consistency.multiplier, 1.4);
  assert.equal(api.getProgressSnapshot(state, context(9)).consistency.precedingActiveDays, 6);
});

test('Short or early-ended returns earn normally but do not interrupt inactivity decay', () => {
  let original = api.recordSession(start(), session());
  const settled = api.advanceProgression(original, context(5, 9));
  assert.equal(settled.currentProgressionCenti, 7920);
  for (const options of [{ activeSeconds: 20 }, { activeSeconds: 600, status: 'ended_early' }]) {
    const input = session({ day: 5, ...options });
    const state = api.recordSession(original, input);
    const earned = durationRewardCentiXp(input.activeDurationSeconds, api.PROGRESSION_V3);
    // One preceding qualifying date still gives the unchanged 1 + 0.4/7 earning bonus.
    assert.equal(state.awards.at(-1).xpCenti, Math.round(earned * 74 / 70));
    assert.equal(state.currentProgressionCenti, 7920 + state.awards.at(-1).xpCenti);
    assert.equal(api.getProgressSnapshot(state, context(6)).inactivity.lastQualifyingDate, original.asOf.localDate);
    assert.ok(api.advanceProgression(state, context(6)).currentProgressionCenti < state.currentProgressionCenti);
    assert.equal(api.getJourneyFromState(state).metrics.credits, 1);
  }
});

test('Repeated and reconstructed short receipts preserve exact integer balances', () => {
  const input = session({ activeSeconds: 20 });
  const first = api.recordSession(start(), input);
  const serialized = JSON.stringify(first);
  const reopened = JSON.parse(serialized);
  assert.deepEqual(api.recordSession(reopened, input), first);
  assert.equal(api.recordSession(first, input), first);
  let state = api.recordSession(reopened, session({ hour: 9.25, activeSeconds: 20 }));
  assert.deepEqual(state.awards.map(award => award.xpCenti), [503,503]);
  assert.equal(state.lifetimeXpCenti, 1006);
  assert.equal(JSON.stringify(first), serialized);
});

test('V1/V2 short history is not retroactively rewarded when V3 becomes active', () => {
  for (const oldRules of [api.PROGRESSION_V1, api.PROGRESSION_V2]) {
    const oldInput = session({ activeSeconds: 20 });
    let state = api.recordSession(api.createProgressionState(context(1), oldRules), oldInput);
    state = api.recordSession(state, session({ hour: 12 }));
    const historical = JSON.stringify(state.awards);
    state = api.changeProgressionRules(state, api.PROGRESSION_V3, context(2));
    assert.equal(JSON.stringify(state.awards), historical);
    assert.equal(api.recordSession(state, oldInput), state);
    state = api.recordSession(state, session({ day: 2, activeSeconds: 20 }));
    assert.equal(state.awards[0].rulesVersion, oldRules.version);
    assert.equal(state.awards.at(-1).rulesVersion, 'progression_v3');
    assert.equal(state.sessions[0].qualified, false);
    assert.equal(state.awards.length, 2);
  }
});

test('V3 cannot insert a short run into a frozen V1/V2 occasion or alter its receipt', () => {
  for (const oldRules of [api.PROGRESSION_V1, api.PROGRESSION_V2]) {
    let state = api.recordSession(api.createProgressionState(context(1), oldRules), session());
    const historical = JSON.stringify(state.awards[0]);
    state = api.changeProgressionRules(state, api.PROGRESSION_V3, context(1, 9.25));
    state = api.recordSession(state, session({ hour: 9.5, activeSeconds: 20 }));
    assert.equal(state.occasions.length, 2);
    assert.equal(state.occasions[0].activeDurationSeconds, 600);
    assert.equal(JSON.stringify(state.awards[0]), historical);
    assert.equal(state.awards[1].rulesVersion, 'progression_v3');
    assert.equal(state.awards[1].xpCenti, 377); // New compatible occasion takes the second daily slot.
  }
});

test('Compatible V3 long top-ups retain frozen V1/V2 occasion terms and incremental accounting', () => {
  for (const oldRules of [api.PROGRESSION_V1, api.PROGRESSION_V2]) {
    let state = api.recordSession(api.createProgressionState(context(1), oldRules), session());
    state = api.changeProgressionRules(state, api.PROGRESSION_V3, context(1, 9.25));
    state = api.recordSession(state, session({ hour: 9.5 }));
    assert.equal(state.occasions.length, 1);
    assert.equal(state.awards[1].rulesVersion, oldRules.version);
    assert.equal(state.awards[1].xpCenti, 2000);
    assert.equal(state.lifetimeXpCenti, 10000);
    assert.equal(state.sessions[1].qualificationRulesVersion, 'progression_v3');
  }
});

test('V3 transition respects each older occasion\'s exact duration and completion eligibility', () => {
  for (const [oldRules, options, shouldExtend] of [
    [api.PROGRESSION_V1, { minutes: 3 }, false],
    [api.PROGRESSION_V2, { minutes: 10, status: 'ended_early' }, false],
    [api.PROGRESSION_V1, { minutes: 10, status: 'ended_early' }, true],
  ]) {
    let state = api.recordSession(api.createProgressionState(context(1), oldRules), session());
    state = api.changeProgressionRules(state, api.PROGRESSION_V3, context(1, 9.25));
    state = api.recordSession(state, session({ hour: 9.5, ...options }));
    assert.equal(state.occasions.length, shouldExtend ? 1 : 2);
    assert.equal(state.awards.at(-1).rulesVersion, shouldExtend ? oldRules.version : 'progression_v3');
    assert.equal(state.sessions.at(-1).qualified, options.status !== 'ended_early');
    assert.equal(state.sessions.at(-1).qualificationRulesVersion, 'progression_v3');
  }
});

test('Existing V1-to-V2 three-minute top-ups retain their historical replay behavior', () => {
  let state = api.recordSession(api.createProgressionState(context(1), api.PROGRESSION_V1), session());
  state = api.changeProgressionRules(state, api.PROGRESSION_V2, context(1, 9.25));
  state = api.recordSession(state, session({ hour: 9.5, minutes: 3 }));
  assert.equal(state.occasions.length, 1);
  assert.equal(state.awards.at(-1).rulesVersion, 'progression_v1');
  assert.equal(state.lifetimeXpCenti, durationRewardCentiXp(780, api.PROGRESSION_V1));
});

test('Thirty mixed qualifying days retain the exact V2 balances, bonuses, weights and credits', () => {
  const run = rules => {
    let state = api.createProgressionState(context(1), rules);
    for (let day = 1; day <= 30; day++) {
      if (day % 7 === 0) continue;
      for (const hour of [7,15]) state = api.recordSession(state, session({ day, hour, minutes: [3,5,10,20,30,60][day % 6] }));
    }
    return state;
  };
  const v2 = run(api.PROGRESSION_V2), v3 = run(api.PROGRESSION_V3);
  assert.equal(v3.lifetimeXpCenti, v2.lifetimeXpCenti);
  assert.equal(v3.currentProgressionCenti, v2.currentProgressionCenti);
  assert.deepEqual(v3.awards.map(award => ({ xp: award.xpCenti, breakdown: award.breakdown })),
    v2.awards.map(award => ({ xp: award.xpCenti, breakdown: award.breakdown })));
  assert.deepEqual(api.practiceCredits(v3.sessions.map(entry => entry.session)), api.practiceCredits(v2.sessions.map(entry => entry.session)));
});

test('Level 0 is a separate prelude; a three-minute practice makes modest progress without skipping levels', () => {
  const initial = api.getJourneyFromState(start());
  assert.equal(initial.level, api.JOURNEY_PRELUDE);
  assert.equal(initial.level.number, 0);
  assert.equal(initial.level.category.name, 'Monkey Mind');
  assert.equal(initial.next.number, 1);
  assert.equal(initial.fraction, 0);
  assert.deepEqual(initial.missing, { xpCenti: 12000, credits: 1, realDays: 1, elapsedDays: 0 });
  assert.equal(api.journeyLabel(initial.level), 'Level 0 · Monkey Mind');
  assert.equal(api.JOURNEY_CATEGORIES.length, 25);
  assert.equal(api.JOURNEY_LEVELS.length, 125);
  assert.equal(api.JOURNEY_LEVELS[0].categoryStep, 1);
  assert.equal(api.getJourneyFromState(api.recordSession(start(), session({ minutes: 3 }))).level.number, 0);
});

test('Large short-run Ripple balance alone cannot bypass Level 0, credits or qualifying dates', () => {
  const metrics = { lifetimeXpCenti: 10_000_000, credits: 0, realDays: 0, firstPracticeAt: null, asOf: at(500) };
  const journey = api.getLifetimeJourney(metrics);
  assert.equal(journey.level.number, 0);
  assert.equal(journey.fraction, 0);
  assert.equal(journey.next.number, 1);
  assert.equal(api.getLifetimeJourney(metrics, null, { legacyLevelOneStart: true }).level.number, 1);
  assert.equal(api.getLifetimeJourney(metrics, { version: api.JOURNEY_VERSION, level: 0, achievedAt: 0 }).level.number, 0);
  assert.throws(() => api.getLifetimeJourney(metrics, { version: api.JOURNEY_VERSION, level: -1, achievedAt: 0 }), /Invalid journey/);
});
