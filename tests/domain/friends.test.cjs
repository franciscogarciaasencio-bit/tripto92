const { test } = require('node:test');
const { assert, api } = require('./helpers.cjs');
const { sharedStreak, sharedWeeksInARow, stageOfLevel, stageDiscovered, practiceStreaks, FRIEND_RULES } = api;

const practice = (localDate, minutes = 10) => ({ localDate, activeDurationSeconds: minutes * 60, status: 'completed' });
const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
/** Monday, Wednesday and Friday of the weeks starting on the given Mondays. */
const activeWeeks = (...mondays) => mondays.flatMap((monday) => [0, 2, 4].map((offset) => practice(shift(monday, offset))));

test('A shared streak holds exactly as long as the sharer’s own calendar would show it', () => {
  // Two complete weeks (5 and 12 October 2026), shared on Sunday the 18th.
  const sessions = activeWeeks('2026-10-05', '2026-10-12');
  const shared = sharedStreak(sessions, '2026-10-18');
  assert.deepEqual(shared, { weeks: 2, until: '2026-10-23' });
  // Without more practice, each day the friend sees what the sharer's calendar says.
  for (let offset = 0; offset <= 16; offset++) {
    const day = shift('2026-10-18', offset);
    assert.equal(sharedWeeksInARow(shared, day), practiceStreaks(sessions, day).weeks.current, day);
  }
  // The following week stays open until Friday: three days are still possible on Friday, not Saturday.
  assert.equal(sharedWeeksInARow(shared, '2026-10-23'), 2);
  assert.equal(sharedWeeksInARow(shared, '2026-10-24'), 0);
});

test('A week in progress is shared as it stands; a week that can no longer count shares nothing', () => {
  // One complete week, then Monday of the current week; shared on Tuesday 13 October.
  const sessions = [...activeWeeks('2026-10-05'), practice('2026-10-12')];
  const shared = sharedStreak(sessions, '2026-10-13');
  assert.equal(shared.weeks, 1);
  for (let offset = 0; offset <= 14; offset++) {
    const day = shift('2026-10-13', offset);
    assert.equal(sharedWeeksInARow(shared, day), practiceStreaks(sessions, day).weeks.current, day);
  }
  // The current week needs two more days by Sunday; on Sunday it can no longer count.
  assert.equal(shared.until, '2026-10-17');
  assert.deepEqual(sharedStreak([practice('2026-10-05')], '2026-10-10'), { weeks: 0, until: '2026-10-10' });
  assert.deepEqual(sharedStreak([], '2026-10-10'), { weeks: 0, until: '2026-10-10' });
});

test('Short practices never count toward a shared streak', () => {
  const sessions = ['2026-10-05', '2026-10-07', '2026-10-09'].map((date) => practice(date, 2.99));
  assert.equal(sharedStreak(sessions, '2026-10-11').weeks, 0);
});

test('Nothing shared, or a viewer a day behind in another time zone, never shows a wrong count', () => {
  assert.equal(sharedWeeksInARow(null, '2026-10-18'), 0);
  assert.equal(sharedWeeksInARow({ weeks: 4, until: '2026-10-20' }, '2026-10-17'), 4);
});

test('A shared level maps to its stage; level 0 is the starting point in the first stage', () => {
  assert.equal(stageOfLevel(0).firstLevel, 1);
  assert.equal(stageOfLevel(1).firstLevel, 1);
  assert.equal(stageOfLevel(5).firstLevel, 1);
  assert.equal(stageOfLevel(6).firstLevel, 6);
  assert.equal(stageOfLevel(125).lastLevel, 125);
  for (const invalid of [-1, 126, 2.5, Number.NaN]) assert.throws(() => stageOfLevel(invalid), /level/);
  assert.equal(FRIEND_RULES.maximumLevel, 125);
});

test('A friend’s stage shows only once you have reached that stage yourself', () => {
  assert.equal(stageDiscovered(0, 0), true, 'everyone starts in the first stage');
  assert.equal(stageDiscovered(4, 0), true);
  assert.equal(stageDiscovered(6, 5), false, 'one level short of their stage');
  assert.equal(stageDiscovered(9, 6), true, 'same stage, further along');
  assert.equal(stageDiscovered(3, 40), true, 'stages behind you are known');
  assert.equal(stageDiscovered(125, 124), true);
  assert.equal(stageDiscovered(121, 120), false);
});
