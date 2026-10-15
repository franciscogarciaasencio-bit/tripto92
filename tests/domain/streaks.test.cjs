const { test } = require('node:test');
const { assert, api } = require('./helpers.cjs');
const { practiceStreaks, STREAK_RULES } = api;

const practice = (localDate, minutes = 10, status = 'completed') => ({ localDate, activeDurationSeconds: minutes * 60, status });
const days = (from, to) => {
  const result = [];
  for (let day = Date.parse(`${from}T00:00:00Z`); day <= Date.parse(`${to}T00:00:00Z`); day += 86_400_000) {
    result.push(new Date(day).toISOString().slice(0, 10));
  }
  return result;
};
/** Three active days (Monday, Wednesday, Friday) in each week starting on the given Mondays. */
const activeWeeks = (...mondays) => mondays.flatMap((monday) => {
  const week = days(monday, new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10));
  return [week[0], week[2], week[4]].map((date) => practice(date));
});

test('Rules: three qualifying minutes, three active days a week', () => {
  assert.equal(STREAK_RULES.minimumActiveSeconds, 180);
  assert.equal(STREAK_RULES.activeDaysPerWeek, 3);
  assert.ok(Object.isFrozen(STREAK_RULES));
});

test('Day streak continues through today until today is over, then breaks after a missed day', () => {
  const sessions = days('2026-10-10', '2026-10-14').map((date) => practice(date));
  assert.deepEqual(practiceStreaks(sessions, '2026-10-14').days, { current: 5, best: 5 });
  assert.deepEqual(practiceStreaks(sessions, '2026-10-15').days, { current: 5, best: 5 }, 'today is still open');
  assert.deepEqual(practiceStreaks(sessions, '2026-10-16').days, { current: 0, best: 5 });
  const resumed = [...sessions, practice('2026-10-16'), practice('2026-10-17')];
  assert.deepEqual(practiceStreaks(resumed, '2026-10-17').days, { current: 2, best: 5 });
});

test('Short practices and early stops of legacy timed sessions never count; several practices are one day', () => {
  const streaks = practiceStreaks([practice('2026-10-12', 2.99), practice('2026-10-13', 20, 'ended_early'),
    practice('2026-10-14', 3), practice('2026-10-14', 4)], '2026-10-14');
  assert.equal(streaks.isActiveDay('2026-10-12'), false);
  assert.equal(streaks.isActiveDay('2026-10-13'), false);
  assert.equal(streaks.isActiveDay('2026-10-14'), true);
  assert.deepEqual(streaks.days, { current: 1, best: 1 });
  assert.equal(streaks.week('2026-10-14').activeDays, 1);
});

test('A week is active at three days, open while still possible, missed once it cannot reach three', () => {
  const two = [practice('2026-10-12'), practice('2026-10-13')]; // Monday and Tuesday
  assert.equal(practiceStreaks(two, '2026-10-17').week('2026-10-12').state, 'open', 'Saturday: Sat or Sun can still make three');
  assert.equal(practiceStreaks(two, '2026-10-18').week('2026-10-12').state, 'open', 'Sunday not yet practised');
  assert.equal(practiceStreaks([...two, practice('2026-10-18')], '2026-10-18').week('2026-10-12').state, 'active');
  assert.equal(practiceStreaks(two, '2026-10-19').week('2026-10-12').state, 'missed');
  assert.equal(practiceStreaks([], '2026-10-17').week('2026-10-12').state, 'missed', 'Saturday with no active day');
  assert.equal(practiceStreaks([], '2026-10-16').week('2026-10-12').state, 'open', 'Friday: Fri, Sat, Sun remain');
  assert.equal(practiceStreaks([practice('2026-10-15')], '2026-10-17').week('2026-10-12').state, 'open', 'Thursday + Saturday + Sunday');
  assert.equal(practiceStreaks([practice('2026-10-15')], '2026-10-18').week('2026-10-12').state, 'missed', 'Sunday: at most two');
});

test('Week streak counts back from the current week and skips a week still in progress', () => {
  const sessions = [...activeWeeks('2026-09-21', '2026-09-28', '2026-10-05'), practice('2026-10-12')];
  assert.deepEqual(practiceStreaks(sessions, '2026-10-14').weeks, { current: 3, best: 3 });
  // The week of Oct 12 ends with one day: the streak is broken from Monday the 19th.
  assert.deepEqual(practiceStreaks(sessions, '2026-10-19').weeks, { current: 0, best: 3 });
  const missedEarlier = [...activeWeeks('2026-09-07', '2026-09-21', '2026-09-28')];
  assert.deepEqual(practiceStreaks(missedEarlier, '2026-10-01').weeks, { current: 2, best: 2 });
});

test('Weeks belong to the month holding their Thursday', () => {
  const streaks = practiceStreaks([], '2026-10-14');
  assert.equal(streaks.week('2026-09-29').month, '2026-10');
  assert.deepEqual(streaks.month('2026-10').weeks.map((week) => week.start),
    ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(streaks.month('2026-09').weeks.map((week) => week.start), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
  assert.deepEqual(streaks.month('2027-01').weeks.map((week) => week.start), ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25']);
  assert.equal(streaks.week('2027-01-01').month, '2026-12');
  // Every week of a long span belongs to exactly one month.
  const seen = new Set();
  for (let month = 1; month <= 12; month++) {
    for (const week of streaks.month(`2028-${String(month).padStart(2, '0')}`).weeks) {
      assert.ok(!seen.has(week.start)); seen.add(week.start);
    }
  }
  assert.equal(seen.size, 52);
});

test('A month counts only when every one of its weeks is active', () => {
  const september = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'];
  const october = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
  const both = activeWeeks(...september, ...october);
  const streaks = practiceStreaks(both, '2026-11-03');
  assert.equal(streaks.month('2026-09').state, 'active');
  assert.equal(streaks.month('2026-10').state, 'active');
  assert.equal(streaks.month('2026-11').state, 'open');
  assert.deepEqual(streaks.months, { current: 2, best: 2 });
  // One October week with only two active days: October is missed and the streak restarts.
  const gap = both.filter((session) => session.localDate !== '2026-10-16');
  const broken = practiceStreaks(gap, '2026-11-03');
  assert.equal(broken.month('2026-10').state, 'missed');
  assert.deepEqual(broken.months, { current: 0, best: 1 });
  // While October is under way and nothing is missed, September's streak stays.
  assert.deepEqual(practiceStreaks(activeWeeks(...september, '2026-09-28'), '2026-10-06').months, { current: 1, best: 1 });
  assert.equal(practiceStreaks(activeWeeks(...september, '2026-09-28'), '2026-10-06').month('2026-10').state, 'open');
});

test('Practice dated ahead of today (travel) is shown; empty history has no streaks', () => {
  const streaks = practiceStreaks([practice('2026-10-15')], '2026-10-14');
  assert.equal(streaks.isActiveDay('2026-10-15'), true);
  assert.deepEqual(streaks.days, { current: 0, best: 0 });
  const none = practiceStreaks([], '2026-10-14');
  assert.deepEqual([none.days, none.weeks, none.months], [{ current: 0, best: 0 }, { current: 0, best: 0 }, { current: 0, best: 0 }]);
});

test('A year of daily practice gives long streaks without error', () => {
  const streaks = practiceStreaks(days('2026-01-01', '2026-12-31').map((date) => practice(date)), '2026-12-31');
  assert.deepEqual(streaks.days, { current: 365, best: 365 });
  assert.ok(streaks.weeks.current >= 52);
  // January 2026's first week (Mon Dec 29 2025) had only Jan 1–4 active: four days, active.
  assert.equal(streaks.month('2026-01').state, 'active');
  assert.equal(streaks.months.current, 12);
});

test('Recent weeks and months end with the current period, oldest first', () => {
  const sessions = activeWeeks('2026-09-21', '2026-09-28', '2026-10-05');
  const streaks = practiceStreaks(sessions, '2026-10-14');
  assert.deepEqual(streaks.recentWeeks(4).map((week) => [week.start, week.state]),
    [['2026-09-21', 'active'], ['2026-09-28', 'active'], ['2026-10-05', 'active'], ['2026-10-12', 'open']]);
  assert.deepEqual(streaks.recentMonths(3).map((month) => [month.month, month.state]),
    [['2026-08', 'missed'], ['2026-09', 'missed'], ['2026-10', 'open']]);
  // A Monday-to-Wednesday week whose Thursday is in the next month belongs to that month.
  assert.equal(practiceStreaks([], '2026-12-29').recentMonths(1)[0].month, '2026-12');
  assert.equal(practiceStreaks([], '2027-03-30').recentMonths(1)[0].month, '2027-04');
  assert.throws(() => streaks.recentWeeks(0), RangeError);
});

test('Streak moment: what one saved practice changed, for the celebration after completion', () => {
  const { streakMoment } = api;
  const saved = (id, localDate, minutes = 10, status = 'completed') => ({ id, ...practice(localDate, minutes, status) });
  // 2026-10-12 is a Monday.
  const first = saved('a', '2026-10-12');
  assert.deepEqual({ ...streakMoment([first], first, '2026-10-12') }, { kind: 'day', date: '2026-10-12', daysInRow: 1,
    weekDaysBefore: 0, weekDays: 1, weekBecameActive: false, weeksInRow: 0, monthBecameActive: false, month: '2026-10', monthsInRow: 0 });
  const second = saved('b', '2026-10-13');
  const two = streakMoment([first, second], second, '2026-10-13');
  assert.equal(two.kind, 'days'); assert.equal(two.daysInRow, 2); assert.equal(two.weekDays, 2);
  const third = saved('c', '2026-10-14');
  const week = streakMoment([first, second, third], third, '2026-10-14');
  assert.equal(week.kind, 'week', 'the third day of the week outranks days in a row');
  assert.equal(week.daysInRow, 3); assert.equal(week.weekBecameActive, true); assert.equal(week.weeksInRow, 1);
  const fourth = saved('d', '2026-10-15');
  const after = streakMoment([first, second, third, fourth], fourth, '2026-10-15');
  assert.equal(after.kind, 'days', 'a week that already counted is not celebrated twice');
  assert.equal(after.weekBecameActive, false); assert.equal(after.weeksInRow, 1);
  // Nothing new: a second practice the same day, a short one, or one ended early.
  assert.equal(streakMoment([first, saved('e', '2026-10-12')], saved('e', '2026-10-12'), '2026-10-12'), null);
  assert.equal(streakMoment([saved('s', '2026-10-12', 2)], saved('s', '2026-10-12', 2), '2026-10-12'), null);
  assert.equal(streakMoment([saved('x', '2026-10-12', 10, 'ended_early')], saved('x', '2026-10-12', 10, 'ended_early'), '2026-10-12'), null);
  // A gap restarts days in a row, but the week still counts its days.
  const gap = [saved('m', '2026-10-12'), saved('w', '2026-10-14')];
  const gapMoment = streakMoment(gap, gap[1], '2026-10-14');
  assert.equal(gapMoment.kind, 'day'); assert.equal(gapMoment.daysInRow, 1); assert.equal(gapMoment.weekDays, 2);
});

test('Streak moment: completing every week of a month is the biggest moment; weeks in a row carry over', () => {
  const { streakMoment } = api;
  let id = 0;
  // October 2026 owns the weeks starting Sep 28, Oct 5, 12, 19 and 26 (by their Thursdays).
  const sessions = activeWeeks('2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19')
    .map((entry) => ({ id: `p${++id}`, ...entry }));
  const lastWeek = ['2026-10-26', '2026-10-27'].map((date) => ({ id: `p${++id}`, ...practice(date) }));
  const closing = { id: 'close', ...practice('2026-10-28') };
  const moment = streakMoment([...sessions, ...lastWeek, closing], closing, '2026-10-28');
  assert.equal(moment.kind, 'month'); assert.equal(moment.month, '2026-10');
  assert.equal(moment.monthBecameActive, true); assert.equal(moment.weekBecameActive, true);
  assert.equal(moment.weeksInRow, 6); assert.equal(moment.daysInRow, 3);
  assert.equal(moment.monthsInRow, 1, 'September had a missed week before the 21st');
});
