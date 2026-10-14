const { test } = require('node:test');
const { assert, domain } = require('./helpers.cjs');
const { getForestStage, FOREST_GROWTH_V1: rules } = domain('forest/growth.js');

test('Sparse start and all five growth stages resolve at their explicit achievement thresholds', () => {
  for (const [level, id] of [[0,'coast_0'],[1,'coast_1'],[19,'coast_1'],[20,'coast_2'],[39,'coast_2'],
    [40,'coast_3'],[64,'coast_3'],[65,'coast_4'],[99,'coast_4'],[100,'coast_5'],[125,'coast_5']]) {
    assert.equal(getForestStage({ highestLevel: level, currentLevel: level }).id, id);
  }
});
test('Highest-level forest survives current-level decay without another stored balance', () => {
  for (let currentLevel = 50; currentLevel <= 100; currentLevel++) {
    assert.equal(getForestStage({ highestLevel: 100, currentLevel }).id, 'coast_5');
  }
  assert.equal(getForestStage({ highestLevel: 0, currentLevel: 0 }).id, 'coast_0');
});
test('Growth is deterministic, immutable and has no effect on its progression input', () => {
  const input = Object.freeze({ highestLevel: 65, currentLevel: 40 });
  assert.deepEqual(getForestStage(input), getForestStage(input));
  assert.ok(Object.isFrozen(rules) && Object.isFrozen(rules.stages) && rules.stages.every(Object.isFrozen));
  assert.deepEqual(input, { highestLevel: 65, currentLevel: 40 });
});
test('Adding a stage or switching visual basis requires only configuration, not algorithm changes', () => {
  const expanded = { ...rules, version: 'forest_test_v2', stages: [...rules.stages,
    { id: 'future_canopy', name: 'Future canopy', minimumLevel: 120 }] };
  assert.equal(getForestStage({ highestLevel: 125, currentLevel: 65 }, expanded).id, 'future_canopy');
  assert.equal(getForestStage({ highestLevel: 125, currentLevel: 65 }, { ...expanded, basis: 'current' }).id, 'coast_4');
});
test('Corrupt progression inputs fail explicitly rather than displaying unearned vegetation', () => {
  for (const bad of [-1, 126, 1.5, NaN, Infinity]) {
    assert.throws(() => getForestStage({ highestLevel: bad, currentLevel: 0 }), RangeError);
    assert.throws(() => getForestStage({ highestLevel: 125, currentLevel: bad }), RangeError);
  }
  assert.throws(() => getForestStage({ highestLevel: 1, currentLevel: 2 }), /historical/);
});
test('Invalid, repeated or reordered configuration stages are rejected', () => {
  for (const stages of [[], [{ id:'a', name:'A', minimumLevel:1 }],
    [{id:'a',name:'A',minimumLevel:0},{id:'a',name:'B',minimumLevel:10}],
    [{id:'a',name:'A',minimumLevel:0},{id:'b',name:'B',minimumLevel:0}],
    [{id:'',name:'A',minimumLevel:0}], [{id:'a',name:'A',minimumLevel:0},{id:'b',name:'B',minimumLevel:126}]]) {
    assert.throws(() => getForestStage({ highestLevel: 0, currentLevel: 0 }, { ...rules, stages }), RangeError);
  }
});
