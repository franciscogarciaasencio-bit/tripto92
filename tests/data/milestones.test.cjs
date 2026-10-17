const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { milestoneOf, STAGE_NOTES, HABIT_NOTE, COMPLETE_NOTE, stageOf } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'milestones.js'));

test('Every new stage has its own note, and every note is free of numbers and empty promises', () => {
  const firsts = Array.from({ length: 24 }, (_, index) => 6 + index * 5);
  assert.deepEqual(Object.keys(STAGE_NOTES).map(Number), firsts);
  const notes = [...Object.values(STAGE_NOTES), HABIT_NOTE, COMPLETE_NOTE];
  assert.equal(new Set(notes.map((note) => note.title)).size, notes.length, 'titles are distinct');
  for (const { title, body } of notes) {
    assert.ok(title.length > 3 && body.length > 60, title);
    assert.doesNotMatch(`${title} ${body}`, /\d|%|×|guarantee|will make you|scientif/i, title);
  }
});

test('A practice opens at most one milestone, the first time only: journey end, habit, then a new stage', () => {
  assert.equal(milestoneOf(4, 5, 4), null, 'within the first stage');
  assert.equal(milestoneOf(0, 1, 0), null, 'the first level is not a new stage');
  assert.deepEqual(milestoneOf(5, 6, 5), { kind: 'stage', level: 6, previousLevel: 5, note: STAGE_NOTES[6] });
  assert.equal(milestoneOf(4, 9, 4).note, STAGE_NOTES[6], 'jumping within the next stage');
  assert.equal(milestoneOf(9, 12, 9).note, STAGE_NOTES[11]);
  assert.equal(milestoneOf(8, 11, 14), null, 'a stage already reached before (levels eased back) opens nothing');
  assert.equal(milestoneOf(99, 100, 99).kind, 'habit');
  assert.equal(milestoneOf(99, 101, 99).kind, 'habit', 'the habit outranks the stage crossed at the same time');
  assert.equal(milestoneOf(100, 101, 100).note, STAGE_NOTES[101]);
  assert.equal(milestoneOf(98, 100, 104), null, 'Level 100 opens its moment only the first time');
  assert.equal(milestoneOf(124, 125, 124).kind, 'complete');
  assert.equal(milestoneOf(124, 125, 125), null);
  assert.equal(milestoneOf(undefined, 6, 0), null);
  assert.equal(milestoneOf(6, 6, 5), null);
  assert.equal(stageOf(0), 1); assert.equal(stageOf(5), 1); assert.equal(stageOf(6), 2);
});
