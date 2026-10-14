const { test } = require('node:test');
const { assert, api, connection, context, disk, openStore, session, data } = require('./helpers.cjs');
const { rewardSteps } = data('../ui/reward-sequence.js');

test('Display endpoints reconstruct from saved history and preserve bonus receipts through reopen and reset', async t => {
  const filename = disk(t);
  let store = await openStore(connection(filename), context(1), undefined, 'progression_v4');
  let result;
  for (let day = 1; day <= 14; ++day) {
    const practice = session({ id: `day-${day}`, day, minutes: 3 });
    result = await store.meditations.completePractice(practice, practice.endedAt);
    assert.ok(Math.abs(result.completion.consistencyIndicator.before - (day - 1) / 14) < 1e-6);
    assert.ok(Math.abs(result.completion.consistencyIndicator.after - day / 14) < 1e-6);
    assert.equal(result.completion.awardedXpCenti, result.completion.habitReward.totalCentiXp);
    if (day < 14) await store.meditations.acknowledgeCompletion(practice.id, practice.endedAt);
  }
  const original = await store.meditations.loadProgressionState();
  await store.close();
  store = await openStore(connection(filename), context(14, 23), undefined, 'progression_v4');
  try {
    assert.deepEqual(store.initialCompletion.consistencyIndicator, result.completion.consistencyIndicator);
    assert.equal(store.initialSnapshot.consistency.indicatorFraction, 1);
    assert.deepEqual((await store.meditations.loadProgressionState()).awards, original.awards);
    const later = await store.meditations.getCurrentPracticeProgress(context(16));
    assert.ok(Math.abs(later.snapshot.consistency.indicatorFraction - .840896) < 1e-6);
    const same = await store.meditations.getCurrentPracticeProgress(context(16));
    assert.equal(same.snapshot.consistency.indicatorFraction, later.snapshot.consistency.indicatorFraction);
    assert.equal(same.snapshot.lifetimeXpCenti, original.lifetimeXpCenti);
    await store.meditations.acknowledgeCompletion('day-14', context(16).timestamp);
    const reset = await store.meditations.resetAllPracticeData(context(17));
    assert.equal(reset.snapshot.consistency.indicatorFraction, 0);
  } finally { await store.close(); }
});

test('The cosmetic sequence animates only the indicator while base/bonus XP transitions retain their receipt', async t => {
  const store = await openStore(connection(), context(1), undefined, 'progression_v4'); t.after(() => store.close());
  const practice = session({ minutes: 3 });
  const result = await store.meditations.completePractice(practice, practice.endedAt);
  const receipt = result.completion.habitReward, original = structuredClone(receipt);
  const old = rewardSteps(receipt), steps = rewardSteps(receipt, result.completion.consistencyIndicator);
  assert.deepEqual(steps.filter(step => step.stage !== 'consistency'), old.filter(step => step.stage !== 'consistency'));
  const indicator = steps.find(step => step.stage === 'consistency');
  assert.equal(indicator.from, 0); assert.equal(indicator.to, 1 / 14);
  assert.equal(receipt.consistencyAfter, .15);
  assert.deepEqual(receipt, original);
});
