const path = require('node:path');
const assert = require('node:assert/strict');

const domain = (file) => require(path.join(process.env.DOMAIN_BUILD_DIR, file));
const api = domain('progression/index.js');
const DAY = 86_400_000;
const MONDAY = Date.parse('2026-01-05T00:00:00Z');
const at = (day, hour = 0) => MONDAY + (day - 1) * DAY + hour * 3_600_000;
const date = (day) => new Date(at(day)).toISOString().slice(0, 10);
const context = (day, hour = 0) => ({ timestamp: at(day, hour), localDate: date(day), timeZone: 'UTC' });

function session(options = {}) {
  const startedAt = options.startedAt ?? at(options.day ?? 1, options.hour ?? 9);
  const activeDurationSeconds = options.activeSeconds ?? (options.minutes ?? 10) * 60;
  const pausedDurationSeconds = options.pausedSeconds ?? 0;
  const endedAt = options.endedAt ?? startedAt + (activeDurationSeconds + pausedDurationSeconds) * 1000;
  return {
    id: options.id ?? `session-${startedAt}`,
    startedAt, endedAt, activeDurationSeconds, pausedDurationSeconds,
    status: options.status ?? 'completed',
    localDate: options.localDate ?? new Date(endedAt).toISOString().slice(0, 10),
    timeZone: options.timeZone ?? 'UTC',
  };
}

function start(rules = api.PROGRESSION_V1) {
  return api.createProgressionState(context(1), rules);
}

function daily(days, minutes = 10, hours = [9], skip = () => false) {
  let state = start();
  for (let day = 1; day <= days; day++) {
    if (skip(day)) continue;
    for (const hour of hours) state = api.recordSession(state, session({ day, hour, minutes }));
  }
  return state;
}

const snapshot = (state, day, hour = 0) => api.getProgressSnapshot(state, context(day, hour));
function nearXp(centiXp, expectedXp, toleranceXp = 0.15) {
  assert.ok(Math.abs(centiXp / 100 - expectedXp) <= toleranceXp,
    `Expected ${expectedXp} ± ${toleranceXp} XP, received ${centiXp / 100}`);
}

module.exports = { assert, api, domain, DAY, at, date, context, session, start, daily, snapshot, nearXp };
