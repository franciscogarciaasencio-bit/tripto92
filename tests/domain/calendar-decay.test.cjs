const { test } = require('node:test');
const { assert, api, domain, at, date, context, session, start, daily, snapshot } = require('./helpers.cjs');
const { decayOneDay, protectedFloor } = domain('progression/decay.js');

test('No previous days gives x1; today never counts toward its own bonus', () => {
  const state = api.recordSession(start(), session());
  assert.equal(snapshot(state, 1, 12).consistency.multiplier, 1);
  assert.equal(state.awards[0].breakdown.precedingActiveDays, 0);
});

// Exact reduced ratios avoid an extra binary-float rounding step in the expected display value.
for (const [active, expected] of [[6, 47 / 35], [7, 7 / 5]]) {
  test(`${active} preceding active dates produce the expected rational bonus`, () => {
    const state = daily(active);
    const view = snapshot(state, active + 1);
    assert.equal(view.consistency.precedingActiveDays, active);
    assert.equal(view.consistency.multiplier, expected);
  });
}

test('Several occasions today share one bonus and count as only one active date', () => {
  let state = daily(7);
  state = api.recordSession(state, session({ day: 8, hour: 9 }));
  state = api.recordSession(state, session({ day: 8, hour: 12 }));
  assert.deepEqual(state.awards.slice(-2).map((a) => a.breakdown.precedingActiveDays), [7, 7]);
  assert.equal(snapshot(state, 8, 18).totalQualifyingPracticeDays, 8);
});

test('A lost consistency bonus never removes previously awarded XP', () => {
  const state = daily(14);
  const view = snapshot(state, 16);
  assert.equal(view.lifetimeXpCenti, state.lifetimeXpCenti);
  assert.equal(view.currentProgressionCenti, state.currentProgressionCenti);
  assert.equal(view.consistency.precedingActiveDays, 6);
});

for (const [day, completed, current] of [[2, 0, 8000], [3, 1, 8000], [4, 2, 8000], [5, 3, 7920], [6, 4, 7841]]) {
  test(`Monday practice, snapshot day ${day}: ${completed} complete inactive days`, () => {
    const state = api.recordSession(start(), session());
    const view = snapshot(state, day);
    assert.equal(view.inactivity.completeInactiveDays, completed);
    assert.equal(view.currentProgressionCenti, current);
    assert.equal(view.lifetimeXpCenti, 8000);
  });
}

test('Thursday is not complete at 23:59:59; its first decay is visible at Friday midnight', () => {
  const state = api.recordSession(start(), session());
  const thursday = { timestamp: at(5) - 1000, localDate: date(4), timeZone: 'UTC' };
  assert.equal(api.getProgressSnapshot(state, thursday).currentProgressionCenti, 8000);
  assert.equal(snapshot(state, 5).currentProgressionCenti, 7920);
});

test('A returning Thursday practice protects Thursday before it becomes complete', () => {
  let state = api.recordSession(start(), session());
  state = api.recordSession(state, session({ day: 4, hour: 23 }));
  assert.equal(state.currentProgressionCenti, state.lifetimeXpCenti);
  assert.equal(snapshot(state, 5).currentProgressionCenti, state.lifetimeXpCenti);
});

test('Subminimum practice does not stop an inactivity run', () => {
  let state = api.recordSession(start(), session());
  state = api.recordSession(state, session({ day: 4, minutes: 2 }));
  assert.equal(snapshot(state, 5).currentProgressionCenti, 7920);
  assert.equal(snapshot(state, 5).inactivity.lastQualifyingDate, date(1));
});

test('Daily decay chooses the smaller percentage or absolute loss', () => {
  assert.equal(decayOneDay(8000, 8000, api.PROGRESSION_V1), 7920);
  assert.equal(decayOneDay(320000, 320000, api.PROGRESSION_V1), 318400);
  assert.equal(decayOneDay(160000, 160000, api.PROGRESSION_V1), 158400);
});

test('Floor rounds upward and decay cannot pass through it', () => {
  assert.equal(protectedFloor(101, api.PROGRESSION_V1), 26);
  assert.equal(decayOneDay(2001, 8000, api.PROGRESSION_V1), 2000);
  assert.equal(decayOneDay(2000, 8000, api.PROGRESSION_V1), 2000);
});

test('A multi-year break preserves lifetime XP and eventually reaches the protected floor', () => {
  const state = api.recordSession(start(), session());
  const view = snapshot(state, 3000);
  assert.equal(view.lifetimeXpCenti, 8000);
  assert.equal(view.currentProgressionCenti, 2000);
});

test('Returning earns the ordinary award, with no debt, and restarts the grace period', () => {
  let state = api.recordSession(start(), session());
  const beforeReturn = snapshot(state, 5);
  state = api.recordSession(state, session({ day: 5 }));
  const reward = state.awards.at(-1).xpCenti;
  assert.equal(reward, 8457);
  assert.equal(state.currentProgressionCenti, beforeReturn.currentProgressionCenti + reward);
  assert.equal(snapshot(state, 8).currentProgressionCenti, state.currentProgressionCenti);
  assert.ok(snapshot(state, 9).currentProgressionCenti < state.currentProgressionCenti);
});

test('No practice history produces no fictitious inactivity penalties', () => {
  const view = snapshot(start(), 100);
  assert.equal(view.currentProgressionCenti, 0);
  assert.equal(view.inactivity.lastQualifyingDate, null);
  assert.equal(view.inactivity.completeInactiveDays, 0);
});

test('Nearby qualifying sessions across midnight share reward day, bonus, and frequency weight', () => {
  const first = session({ startedAt: at(2) - 20 * 60_000 });
  let state = api.recordSession(start(), first);
  state = api.recordSession(state, session({ startedAt: at(2) + 10 * 60_000 }));
  assert.equal(state.occasions.length, 1);
  assert.equal(state.lifetimeXpCenti, 10000);
  assert.deepEqual(state.awards.map((a) => a.xpCenti), [8000, 2000]);
  assert.equal(state.awards[1].rewardDate, date(1));
  assert.equal(state.awards[1].localDate, date(2));
  assert.equal(snapshot(state, 2, 12).totalQualifyingPracticeDays, 2);
  assert.equal(snapshot(state, 2, 12).consistency.precedingActiveDays, 1);
});

test('At least 90 minutes across midnight starts a new day’s first occasion', () => {
  let state = api.recordSession(start(), session({ startedAt: at(2) - 60 * 60_000 }));
  state = api.recordSession(state, session({ startedAt: at(2) + 40 * 60_000 }));
  assert.equal(state.occasions.length, 2);
  assert.equal(state.occasions[1].ordinalInDay, 1);
  assert.equal(state.awards[1].xpCenti, 8457);
});

test('Travel never reassigns a historical local date', () => {
  // Jan 6 UTC, but still Jan 5 in New York. Later view is in Tokyo on Jan 7.
  const historical = session({ startedAt: at(2, 2), localDate: date(1), timeZone: 'America/New_York' });
  const state = api.recordSession(start(), historical);
  const view = api.getProgressSnapshot(state, { timestamp: at(2, 18), localDate: date(3), timeZone: 'Asia/Tokyo' });
  assert.equal(state.sessions[0].session.localDate, date(1));
  assert.equal(view.inactivity.lastQualifyingDate, date(1));
  assert.equal(view.consistency.precedingActiveDays, 1);
});

test('Grouping uses elapsed UTC timestamps across a daylight-saving jump', () => {
  // New York jumps from 01:59 to 03:00, but the actual gap is only 30 minutes.
  const first = session({ startedAt: Date.parse('2026-03-08T06:40:00Z'), localDate: '2026-03-08', timeZone: 'America/New_York' });
  let state = api.recordSession(start(), first);
  state = api.recordSession(state, session({ startedAt: Date.parse('2026-03-08T07:20:00Z'), localDate: '2026-03-08', timeZone: 'America/New_York' }));
  assert.equal(state.occasions.length, 1);
  assert.equal(state.lifetimeXpCenti, 10000);
});

test('A westward date change never refunds previously settled decay', () => {
  let state = api.recordSession(start(), session());
  state = api.advanceProgression(state, context(5));
  const west = { timestamp: at(5, 1), localDate: date(4), timeZone: 'America/Los_Angeles' };
  const view = api.getProgressSnapshot(state, west);
  assert.equal(view.currentProgressionCenti, 7920);
  const resumed = api.recordSession(state, session({ startedAt: at(5, 1), localDate: date(4), timeZone: west.timeZone }));
  assert.equal(resumed.currentProgressionCenti, 7920 + resumed.awards.at(-1).xpCenti);
});

test('Local calendar dates work across month, year and leap-day boundaries', () => {
  for (const [practiceDate, practiceInstant, asOfDate, asOfInstant] of [
    ['2026-12-31', '2026-12-31T09:00:00Z', '2027-01-04', '2027-01-04T00:00:00Z'],
    ['2028-02-28', '2028-02-28T09:00:00Z', '2028-03-03', '2028-03-03T00:00:00Z'],
  ]) {
    const state = api.recordSession(start(), session({ startedAt: Date.parse(practiceInstant), localDate: practiceDate }));
    assert.equal(api.getProgressSnapshot(state, { timestamp: Date.parse(asOfInstant), localDate: asOfDate, timeZone: 'UTC' }).currentProgressionCenti, 7920);
  }
});
