const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { milestoneOf, STAGE_NOTES, HABIT_NOTE, COMPLETE_NOTE, stageOf } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'milestones.js'));

test('Every new stage has its own guide, and no guide uses numbers (other than levels) or empty promises', () => {
  const firsts = Array.from({ length: 24 }, (_, index) => 5 + index * 5).filter((level) => level !== 100);
  assert.deepEqual(Object.keys(STAGE_NOTES).map(Number), firsts, 'Level 100 is the habit, not a stage guide');
  const notes = [...Object.values(STAGE_NOTES), HABIT_NOTE, COMPLETE_NOTE];
  assert.equal(new Set(notes.map((note) => note.title)).size, notes.length, 'titles are distinct');
  for (const { title, paragraphs } of notes) {
    const text = `${title} ${paragraphs.join(' ')}`;
    assert.ok(title.length > 3 && paragraphs.length >= 1 && paragraphs.every((paragraph) => paragraph.length > 60), title);
    assert.doesNotMatch(text.replace(/Level \d+/g, 'Level'), /\d|%|×|guarantee|will make you|scientif/i, title);
  }
  // The first guide says Ona will guide every step from here (owner, 2026-10-17).
  assert.match(STAGE_NOTES[5].paragraphs.join(' '), /every five levels/i);
  for (const level of [5, 10]) assert.ok(STAGE_NOTES[level].paragraphs.length >= 3, `guide ${level} is a guide, not a snippet`);
});

test('A practice opens at most one milestone, the first time only: journey end, habit, then a new stage', () => {
  assert.equal(milestoneOf(3, 4, 3), null, 'within the first stage');
  assert.equal(milestoneOf(0, 1, 0), null, 'Level 0 already begins the first stage');
  assert.deepEqual(milestoneOf(4, 5, 4), { kind: 'stage', level: 5, previousLevel: 4, note: STAGE_NOTES[5] });
  assert.equal(milestoneOf(3, 8, 3).note, STAGE_NOTES[5], 'jumping within the next stage');
  assert.equal(milestoneOf(9, 12, 9).note, STAGE_NOTES[10]);
  assert.equal(milestoneOf(8, 10, 14), null, 'a stage already reached before (levels eased back) opens nothing');
  assert.equal(milestoneOf(99, 100, 99).kind, 'habit', 'Level 100 begins a stage and is the habit: the habit moment');
  assert.equal(milestoneOf(104, 105, 104).note, STAGE_NOTES[105]);
  assert.equal(milestoneOf(98, 100, 104), null, 'Level 100 opens its moment only the first time');
  assert.equal(milestoneOf(124, 125, 124).kind, 'complete');
  assert.equal(milestoneOf(124, 125, 125), null);
  assert.equal(milestoneOf(undefined, 6, 0), null);
  assert.equal(milestoneOf(6, 6, 5), null);
  assert.equal(stageOf(0), 1); assert.equal(stageOf(4), 1); assert.equal(stageOf(5), 2); assert.equal(stageOf(125), 25);
});
