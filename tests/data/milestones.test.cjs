const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { milestoneOf, STAGE_NOTES, HABIT_NOTE, COMPLETE_NOTE, FIRST_STAGE_NOTE, stageOf, stageLevels, reachedStages, stageGuides } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'milestones.js'));

test('Every new stage has its own guide, and no guide uses numbers (other than levels) or empty promises', () => {
  const firsts = Array.from({ length: 24 }, (_, index) => 5 + index * 5).filter((level) => level !== 100);
  assert.deepEqual(Object.keys(STAGE_NOTES).map(Number), firsts, 'Level 100 is the habit, not a stage guide');
  const notes = [FIRST_STAGE_NOTE, ...Object.values(STAGE_NOTES), HABIT_NOTE, COMPLETE_NOTE];
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

test('Every reached stage stays visitable in Journey with the guide that opened it (owner, 2026-10-17)', () => {
  assert.deepEqual(reachedStages(0), [1]);
  assert.deepEqual(reachedStages(20), [1, 2, 3, 4, 5], 'at Level 20 the first stage and every one since');
  assert.equal(reachedStages(125).length, 25);
  assert.deepEqual(stageLevels(1), { first: 0, last: 4 }); assert.deepEqual(stageLevels(5), { first: 20, last: 24 });
  assert.deepEqual(stageLevels(25), { first: 120, last: 125 });
  assert.deepEqual(stageGuides(1, 20), [FIRST_STAGE_NOTE], 'the first stage has its own guide');
  for (let stage = 2; stage <= 25; stage++) {
    const first = stageLevels(stage).first;
    assert.equal(stageGuides(stage, 125)[0], first === 100 ? HABIT_NOTE : STAGE_NOTES[first], `stage ${stage}`);
  }
  assert.deepEqual(stageGuides(25, 122), [STAGE_NOTES[120]]);
  assert.deepEqual(stageGuides(25, 125), [STAGE_NOTES[120], COMPLETE_NOTE], 'the journey\'s end joins the last stage once reached');
});
