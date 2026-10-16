const { test } = require('node:test');
const { assert, data, fixture, save, session } = require('./helpers.cjs');
const { groupPracticeHistory, monthPracticeSummary, appendHistoryPage, practiceDateLabel, practiceClockLabel, practiceTimeLabel } = data('../ui/practice-history.js');

const stored = options => { const value = session(options); return { session: value, createdAt: value.endedAt }; };

test('Day grouping preserves captured travel dates and repository order within a day', () => {
  const japan = stored({ id: 'japan', startedAt: Date.parse('2026-01-31T23:30:00Z'), minutes: 10, localDate: '2026-02-01', timeZone: 'Asia/Tokyo' });
  const hawaii = stored({ id: 'hawaii', startedAt: Date.parse('2026-02-01T01:00:00Z'), minutes: 10, localDate: '2026-01-31', timeZone: 'Pacific/Honolulu' });
  const other = stored({ id: 'other', day: 1 });
  const sameDay = stored({ id: 'same-day', startedAt: Date.parse('2026-02-01T02:00:00Z'), minutes: 2, localDate: '2026-01-31', timeZone: 'Pacific/Honolulu' });
  const input = Object.freeze([sameDay, hawaii, japan, other]), original = structuredClone(input);
  const days = groupPracticeHistory(input);
  assert.deepEqual(days.map(day => day.key), ['2026-02-01', '2026-01-31', '2026-01-05']);
  assert.deepEqual(days[1].data.map(record => record.session.id), ['same-day', 'hawaii']);
  assert.equal(days[1].activeSeconds, 720);
  assert.deepEqual(input, original);
});

test('Monthly summary counts practices of three minutes or more (early-ended too), excludes shorter ones, paused time and other months', () => {
  const records = [stored({ day: 1, minutes: 2, pausedSeconds: 600 }), stored({ day: 1, hour: 14, minutes: 10 }),
    stored({ day: 2, minutes: 5, status: 'ended_early' }), stored({ day: 30, minutes: 20 })];
  assert.deepEqual(monthPracticeSummary(records, '2026-01'), { practiceDays: 2, practices: 2, activeSeconds: 900 });
  assert.deepEqual(monthPracticeSummary(records, '2026-02'), { practiceDays: 1, practices: 1, activeSeconds: 1200 });
  assert.deepEqual(monthPracticeSummary(records, '2026-03'), { practiceDays: 0, practices: 0, activeSeconds: 0 });
});

test('Day grouping and month summary handle empty or reset history', () => {
  assert.deepEqual(groupPracticeHistory([]), []);
  assert.deepEqual(monthPracticeSummary([], '2026-01'), { practiceDays: 0, practices: 0, activeSeconds: 0 });
});

test('Page merging preserves first records and prevents duplicate display across page boundaries', () => {
  const a = stored({ id: 'a', day: 3 }), b = stored({ id: 'b', day: 2 }), c = stored({ id: 'c', day: 1 });
  const existing = Object.freeze([a, b]), page = Object.freeze([b, c, c]);
  assert.deepEqual(appendHistoryPage(existing, page), [a, b, c]);
  assert.deepEqual(existing, [a, b]); assert.deepEqual(page, [b, c, c]);
  assert.deepEqual(appendHistoryPage(existing, []), existing);
});

test('Calendar labels retain their historical date across zones and at leap-day boundaries', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['Pacific/Honolulu', 'Asia/Tokyo', 'Europe/Madrid']) {
      process.env.TZ = zone;
      assert.equal(practiceDateLabel('2024-02-29', { month: 'long', day: 'numeric', year: 'numeric' }), 'February 29, 2024');
      assert.equal(practiceDateLabel('2026-01-01', { month: 'long', day: 'numeric' }), 'January 1');
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('Compact active-time labels preserve tiny practices and format hour boundaries', () => {
  for (const [seconds, expected] of [[0, '0 min'], [1, '<1 min'], [59, '<1 min'], [60, '1 min'],
    [3599, '59 min'], [3600, '1h'], [3661, '1h 1m'], [7500, '2h 5m']]) assert.equal(practiceTimeLabel(seconds), expected);
});

test('Practice time labels use the captured zone rather than the device zone, including travel and DST', () => {
  const timestamp = Date.parse('2026-01-05T23:40:00Z');
  assert.equal(practiceClockLabel(timestamp, 'Asia/Tokyo'), '8:40 AM');
  assert.equal(practiceClockLabel(timestamp, 'Pacific/Honolulu'), '1:40 PM');
  assert.equal(practiceClockLabel(Date.parse('2026-03-29T00:30:00Z'), 'Europe/Madrid'), '1:30 AM');
  assert.equal(practiceClockLabel(Date.parse('2026-03-29T01:30:00Z'), 'Europe/Madrid'), '3:30 AM');
});

test('Unavailable historical time zones do not silently fall back to the current zone', () => {
  assert.equal(practiceClockLabel(Date.parse('2026-01-05T23:40:00Z'), 'Unavailable/Zone'), null);
});

test('Real saved history produces correct summaries through paging, reload and full reset', async t => {
  const { meditations } = await fixture(t);
  await save(meditations, session({ id: 'short', day: 1, minutes: 2, pausedSeconds: 60 }));
  await save(meditations, session({ id: 'longer', day: 1, hour: 14, minutes: 10 }));
  await save(meditations, session({ id: 'return', day: 2, minutes: 5 }));
  const first = await meditations.getMeditationHistory({ limit: 2 });
  const rest = await meditations.getMeditationHistory({ limit: 2, offset: 2 });
  const merged = appendHistoryPage(first, rest), checkpoint = await meditations.loadProgressionState();
  assert.deepEqual(monthPracticeSummary(merged, '2026-01'), { practiceDays: 2, practices: 2, activeSeconds: 900 }, 'the two-minute practice stays in history but not in the totals');
  assert.deepEqual(groupPracticeHistory(merged).map(day => [day.key, day.data.length]), [['2026-01-06', 1], ['2026-01-05', 2]]);
  assert.deepEqual(merged, await meditations.getMeditationHistory());
  assert.deepEqual(await meditations.loadProgressionState(), checkpoint, 'Reading and summarizing does not change awards or progression');
  await meditations.resetAllPracticeData({ timestamp: Date.parse('2026-01-07T09:00:00Z'), localDate: '2026-01-07', timeZone: 'UTC' });
  assert.deepEqual(groupPracticeHistory(await meditations.getMeditationHistory()), []);
});
