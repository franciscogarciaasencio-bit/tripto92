const { test } = require('node:test');
const { assert, api, daily, session } = require('./helpers.cjs');
const { ONA_LEVELS, getLevelProgress } = api;
test('Exactly 100 strictly increasing safe integer thresholds, ten stable named stages', () => {
  assert.equal(ONA_LEVELS.length, 100);
  assert.equal(new Set(ONA_LEVELS.map(l => l.stage.id)).size, 10);
  assert.equal(ONA_LEVELS[0].thresholdCentiXp, 0);
  ONA_LEVELS.forEach((level, i) => {
    assert.equal(level.number, i + 1);
    assert.ok(Number.isSafeInteger(level.thresholdCentiXp));
    if (i) assert.ok(level.thresholdCentiXp > ONA_LEVELS[i - 1].thresholdCentiXp);
  });
  assert.ok(Object.isFrozen(ONA_LEVELS));
});
for (const level of ONA_LEVELS) test(`Level ${level.number} exact inclusive boundary and centi-XP neighbours`, () => {
  assert.equal(getLevelProgress(level.thresholdCentiXp).level.number, level.number);
  assert.equal(getLevelProgress(level.thresholdCentiXp + 1).level.number, level.number);
  if (level.number > 1) assert.equal(getLevelProgress(level.thresholdCentiXp - 1).level.number, level.number - 1);
  const progress = getLevelProgress(level.thresholdCentiXp);
  assert.equal(progress.fraction, level.number === 100 ? 1 : 0);
  assert.equal(progress.remainingCenti, progress.requiredCenti);
});
test('The original rank thresholds anchor Levels 1, 12, 23 … 100', () => {
  api.PROGRESSION_V1.ranks.forEach((rank, index) => {
    const progress = getLevelProgress(rank.thresholdCentiXp);
    assert.equal(progress.level.number, index * 11 + 1);
    assert.equal(progress.level.stage.id, rank.id);
  });
});
test('Existing balances map explicitly without replaying or mutating historical receipts', () => {
  const state = daily(30);
  const original = JSON.stringify(state);
  assert.equal(state.currentProgressionCenti, 323200);
  assert.equal(getLevelProgress(state.currentProgressionCenti).level.number, 46);
  assert.equal(getLevelProgress(304000).level.number, 45);
  assert.equal(JSON.stringify(state), original);
  assert.ok(state.awards.every(a => a.rulesVersion === 'progression_v1'));
});
test('A single normal award crosses multiple levels with actual before/after boundaries', () => {
  const empty = api.createProgressionState({ timestamp: 0, localDate: '1970-01-01', timeZone: 'UTC' });
  const after = api.recordSession(empty, session());
  assert.equal(getLevelProgress(empty.currentProgressionCenti).level.number, 1);
  assert.equal(getLevelProgress(after.currentProgressionCenti).level.number, 5);
});
test('Level 100 has no next level; additional XP is retained without displaying Level 101', () => {
  for (const value of [3000000, 3000001, Number.MAX_SAFE_INTEGER]) {
    const p = getLevelProgress(value);
    assert.equal(p.level.number, 100);
    assert.equal(p.nextLevel, null);
    assert.equal(p.remainingCenti, 0);
  }
});
test('Invalid balances cannot produce a bogus display level', () => {
  for (const value of [-1, 0.1, NaN, Infinity]) assert.throws(() => getLevelProgress(value), /safe integer/);
});
test('Practice and immutable XP continue beyond Level 100; decay keeps the highest stage', () => {
  const atCap = daily(300);
  assert.equal(getLevelProgress(atCap.currentProgressionCenti).level.number, 100);
  const continued = api.recordSession(atCap, session({ day: 301 }));
  assert.ok(continued.lifetimeXpCenti > atCap.lifetimeXpCenti);
  assert.equal(continued.sessions.length, 301);
  assert.equal(continued.awards.length, 301);
  assert.deepEqual(continued.awards.slice(0, 300), atCap.awards);
  assert.equal(getLevelProgress(continued.currentProgressionCenti).nextLevel, null);
  const later = api.advanceProgression(continued, require('./helpers.cjs').context(1000));
  assert.ok(getLevelProgress(later.currentProgressionCenti).level.number < 100);
  assert.equal(later.highestRankAchieved.rank.id, 'steady_presence');
});
