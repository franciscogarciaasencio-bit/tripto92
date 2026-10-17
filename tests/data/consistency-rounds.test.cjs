const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { consistencyRounds } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'consistency-rounds.js'));

const at = (practices) => consistencyRounds(practices / 60);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test('The big bar fills once per milestone of 12 practices, then a small bar fills and it starts again', () => {
  assert.deepEqual(at(0), { completed: 0, current: 0 });
  close(at(6).current, .5); assert.equal(at(6).completed, 0);
  assert.equal(at(11).completed, 0); close(at(11).current, 11 / 12);
  assert.deepEqual(at(12), { completed: 1, current: 0 }, 'full: one small bar, big bar empty again');
  assert.equal(at(18).completed, 1); close(at(18).current, .5);
  assert.equal(at(48).completed, 4); close(at(48).current, 0);
  assert.deepEqual(at(60), { completed: 5, current: 1 }, 'the end: all five small bars and the big bar full');
});

test('Fading Consistency empties the rounds in reverse; odd values stay in range', () => {
  assert.equal(at(23.5).completed, 1); close(at(23.5).current, 11.5 / 12);
  assert.deepEqual(consistencyRounds(-1), { completed: 0, current: 0 });
  assert.deepEqual(consistencyRounds(7), { completed: 5, current: 1 });
  assert.deepEqual(consistencyRounds(NaN), { completed: 0, current: 0 });
});
