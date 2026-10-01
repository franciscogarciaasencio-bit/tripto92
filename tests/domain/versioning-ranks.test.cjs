const { test } = require('node:test');
const { assert, api, domain, context, session, start, daily, snapshot } = require('./helpers.cjs');
const { rankForProgress } = domain('progression/ranks.js');

for (const [index, rank] of api.PROGRESSION_V1.ranks.entries()) {
  test(`Rank ${rank.id} resolves at its threshold and not a cent earlier`, () => {
    assert.equal(rankForProgress(rank.thresholdCentiXp, api.PROGRESSION_V1.ranks).id, rank.id);
    if (index > 0) assert.equal(rankForProgress(rank.thresholdCentiXp - 1, api.PROGRESSION_V1.ranks).id, api.PROGRESSION_V1.ranks[index - 1].id);
  });
}

test('A new rank and renamed label require only configuration changes', () => {
  const rules = {
    ...api.PROGRESSION_V1, version: 'extra_rank_test',
    ranks: [api.PROGRESSION_V1.ranks[0], { id: 'small_step', name: 'Small Step', thresholdCentiXp: 5000, theme: 'A step.' },
      ...api.PROGRESSION_V1.ranks.slice(1).map((rank) => rank.id === 'first_pause' ? { ...rank, name: 'A Pause' } : rank)],
  };
  const state = api.recordSession(start(rules), session());
  const view = snapshot(state, 1, 12);
  assert.equal(view.currentRank.id, 'small_step');
  assert.equal(view.progressToNextRank.nextRank.name, 'A Pause');
  assert.equal(view.progressToNextRank.earnedCentiXp, 3000);
  assert.equal(view.progressToNextRank.requiredCentiXp, 15000);
  assert.equal(view.progressToNextRank.remainingCentiXp, 12000);
  assert.equal(view.progressToNextRank.fraction, 0.2);
});

test('Rank can fall through decay while the highest achieved rank remains permanent', () => {
  const state = daily(3);
  assert.equal(snapshot(state, 3, 12).currentRank.id, 'first_pause');
  const view = snapshot(state, 1000);
  assert.equal(view.currentRank.id, 'monkey_mind');
  assert.equal(view.highestRankAchieved.rank.id, 'first_pause');
  assert.equal(view.highestRankAchieved.rulesVersion, 'progression_v1');
});

test('Maximum rank has a defined, complete progress display', () => {
  const rules = { ...api.PROGRESSION_V1, version: 'one_rank_test', ranks: [api.PROGRESSION_V1.ranks[0]] };
  const view = snapshot(api.recordSession(start(rules), session()), 1, 12);
  assert.deepEqual(view.progressToNextRank, {
    nextRank: null, earnedCentiXp: 0, requiredCentiXp: 0, remainingCentiXp: 0, fraction: 1,
  });
});

test('Version change leaves historical receipts untouched and governs new occasions', () => {
  const original = api.recordSession(start(), session());
  const receipts = JSON.stringify(original.awards);
  const v2 = { ...api.PROGRESSION_V1, version: 'progression_v2_test', duration: { ...api.PROGRESSION_V1.duration, baseCentiXp: 7000 } };
  let state = api.changeProgressionRules(original, v2, context(1, 11));
  assert.equal(state.lifetimeXpCenti, 8000);
  assert.equal(JSON.stringify(state.awards), receipts);
  state = api.recordSession(state, session({ hour: 12 }));
  assert.equal(state.awards[1].xpCenti, 6750); // 90 XP base * second-occasion 75%.
  assert.equal(state.awards[1].rulesVersion, 'progression_v2_test');
  assert.equal(state.lifetimeXpCenti, 14750);
  assert.equal(state.awards[0].xpCenti, 8000);
  assert.equal(state.awards[0].rulesVersion, 'progression_v1');
});

test('An open occasion retains its original formula and bonus across a version change', () => {
  let state = api.recordSession(start(), session());
  state = api.changeProgressionRules(state, {
    ...api.PROGRESSION_V1, version: 'progression_v2_test', duration: { ...api.PROGRESSION_V1.duration, baseCentiXp: 1000 },
  }, context(1, 9.25));
  state = api.recordSession(state, session({ hour: 9.5 }));
  assert.equal(state.lifetimeXpCenti, 10000);
  assert.equal(state.awards[1].xpCenti, 2000);
  assert.equal(state.awards[1].rulesVersion, 'progression_v1');
  assert.equal(state.sessions[1].qualificationRulesVersion, 'progression_v2_test');
});

test('Qualification decisions remain historical when a later version raises the minimum', () => {
  let state = api.recordSession(start(), session({ minutes: 5 }));
  state = api.changeProgressionRules(state, { ...api.PROGRESSION_V1, version: 'new_minimum_test', minimumActiveSeconds: 600 }, context(2));
  state = api.recordSession(state, session({ day: 2, minutes: 5 }));
  assert.equal(state.lifetimeXpCenti, 6000);
  assert.equal(snapshot(state, 3).totalQualifyingPracticeDays, 1);
});

test('Past decay is settled under the old rules before changing the future rate', () => {
  let state = api.recordSession(start(), session());
  state = api.changeProgressionRules(state, { ...api.PROGRESSION_V1, version: 'no_decay_test', dailyDecayBasisPoints: 0 }, context(5));
  assert.equal(state.currentProgressionCenti, 7920);
  assert.equal(snapshot(state, 20).currentProgressionCenti, 7920);
  assert.equal(state.lifetimeXpCenti, 8000);
});

test('A version ID cannot silently be repurposed with different balancing values', () => {
  assert.throws(() => api.changeProgressionRules(start(), { ...api.PROGRESSION_V1, dailyDecayCapCentiXp: 999 }, context(2)), /cannot be reused/);
});

test('Identical rules with a different object key order reuse the existing version safely', () => {
  const reversed = Object.fromEntries(Object.entries(api.PROGRESSION_V1).reverse());
  const state = api.changeProgressionRules(start(), reversed, context(2));
  assert.equal(state.ruleSets.length, 1);
});

test('Raising a protected floor above an existing balance requires an explicit migration', () => {
  const state = api.advanceProgression(api.recordSession(start(), session()), context(1000));
  assert.throws(() => api.changeProgressionRules(state, { ...api.PROGRESSION_V1, version: 'higher_floor_test', protectedFloorBasisPoints: 5000 }, context(1001)), /explicit migration/);
});

test('Historical achievement labels survive later rank renaming', () => {
  let state = daily(3);
  state = api.changeProgressionRules(state, {
    ...api.PROGRESSION_V1, version: 'rename_test', ranks: api.PROGRESSION_V1.ranks.map((rank) => ({ ...rank, name: `New ${rank.name}` })),
  }, context(4));
  assert.equal(snapshot(state, 4).currentRank.name, 'New First Pause');
  assert.equal(snapshot(state, 4).highestRankAchieved.rank.name, 'First Pause');
});

test('Configuration and session inputs stay caller-owned and cannot alter captured state', () => {
  const rules = JSON.parse(JSON.stringify(api.PROGRESSION_V1));
  const input = session();
  const state = api.recordSession(start(rules), input);
  assert.equal(Object.isFrozen(rules), false);
  assert.equal(Object.isFrozen(input), false);
  rules.duration.baseCentiXp = 1;
  input.activeDurationSeconds = 1;
  assert.equal(state.ruleSets[0].duration.baseCentiXp, 6000);
  assert.equal(state.sessions[0].session.activeDurationSeconds, 600);
  assert.equal(Object.isFrozen(state.awards[0].breakdown), true);
});

test('Serialization preserves receipts, checkpoint precision, and subsequent calculations', () => {
  const state = api.advanceProgression(daily(30), context(45));
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(api.getProgressSnapshot(restored, context(46)), api.getProgressSnapshot(state, context(46)));
  assert.equal(Object.isFrozen(restored.sessions), false);
  assert.deepEqual(api.recordSession(restored, session({ day: 46 })), api.recordSession(state, session({ day: 46 })));
});
