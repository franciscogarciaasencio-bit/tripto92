const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { BREATH_GUIDE, nextBreath } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'breath-rhythm.js'));

test('Counting out-breaths goes from one to ten, then begins again at one', () => {
  const counts = [];
  let count = 0;
  for (let breath = 0; breath < 12; breath++) { count = nextBreath(count); counts.push(count); }
  assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2]);
});

test('The suggested breath is slow and gentle: ten seconds, a longer out-breath', () => {
  assert.equal(BREATH_GUIDE.inhale + BREATH_GUIDE.exhale, 10_000);
  assert.ok(BREATH_GUIDE.exhale > BREATH_GUIDE.inhale);
  assert.equal(BREATH_GUIDE.count, 10);
});
