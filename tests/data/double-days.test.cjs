const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { doubleDays, doubleDaysBefore } = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'double-days.js'));

const HOUR = 3_600_000;
const practice = (id, date, hour, minutes = 10) => {
  const startedAt = Date.parse(`${date}T00:00:00Z`) + hour * HOUR;
  return { id, startedAt, endedAt: startedAt + minutes * 60_000, activeDurationSeconds: minutes * 60, pausedDurationSeconds: 0,
    status: 'completed', localDate: date, timeZone: 'UTC' };
};

test('A day is practised twice only with two qualifying practices six hours apart (end to start)', () => {
  const sessions = [
    practice('a', '2026-10-12', 7), practice('b', '2026-10-12', 13.2), // 07:10 end → 13:12 start: twice
    practice('c', '2026-10-13', 7), practice('d', '2026-10-13', 13),   // 07:10 → 13:00: under six hours
    practice('e', '2026-10-14', 7), practice('f', '2026-10-14', 18, 2), // second practice too short
    practice('g', '2026-10-15', 8),
  ];
  assert.deepEqual([...doubleDays(sessions)], ['2026-10-12']);
});

test('Before the newest practice, its day was not yet practised twice', () => {
  const sessions = [practice('a', '2026-10-12', 7), practice('b', '2026-10-12', 14)];
  assert.deepEqual([...doubleDays(sessions)], ['2026-10-12']);
  assert.deepEqual([...doubleDaysBefore(sessions, 'b')], []);
});

test('Unreadable history shows no twice-a-day marks instead of breaking the calendar', () => {
  const broken = [practice('a', '2026-10-12', 7), { ...practice('a', '2026-10-12', 9) }];
  assert.equal(doubleDays(broken).size, 0);
});
