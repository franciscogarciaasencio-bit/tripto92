import { dateFromDay, dayNumber, type LocalDate } from './calendar';
import { PRACTICE_CREDIT_RULES } from './journey';
import type { MeditationSession } from '../meditation/session';

/**
 * Calendar streaks (presentation rules, not earning rules: nothing here changes Ripples or levels).
 *
 * - An active day holds at least one qualifying practice: completed, at least three active minutes
 *   (the same test as practice credits). Short practices stay visible in the calendar but do not count.
 * - Weeks run Monday to Sunday. A week is active with at least three active days.
 * - A week belongs to the month that holds most of its days (its Thursday, as in ISO 8601), so every
 *   week belongs to exactly one month. A month counts only when all of its weeks are active.
 * - A streak is never broken by a day, week or month that can still count. It breaks only once a
 *   period can no longer be completed.
 */
export const STREAK_RULES = Object.freeze({
  version: 'ona_streaks_v1',
  minimumActiveSeconds: PRACTICE_CREDIT_RULES.minimumActiveSeconds,
  activeDaysPerWeek: 3,
});

/** active: counts. open: in progress and still possible. missed: can no longer count. future: not begun. */
export type PeriodState = 'active' | 'open' | 'missed' | 'future';
export interface StreakCount { readonly current: number; readonly best: number }
export interface WeekStatus {
  readonly start: LocalDate;
  readonly activeDays: number;
  readonly state: PeriodState;
  /** The month (YYYY-MM) this week belongs to. */
  readonly month: string;
}
export interface MonthStatus {
  readonly month: string;
  readonly weeks: readonly WeekStatus[];
  readonly state: PeriodState;
}
export interface PracticeStreaks {
  readonly version: typeof STREAK_RULES.version;
  readonly today: LocalDate;
  readonly days: StreakCount;
  readonly weeks: StreakCount;
  readonly months: StreakCount;
  isActiveDay(date: LocalDate): boolean;
  week(date: LocalDate): WeekStatus;
  month(month: string): MonthStatus;
}

export function qualifiesForStreak(session: Pick<MeditationSession, 'status' | 'activeDurationSeconds'>) {
  return session.status === 'completed' && session.activeDurationSeconds >= STREAK_RULES.minimumActiveSeconds;
}

/** Day number of the Monday that starts the week containing `day`. 1970-01-01 was a Thursday. */
const mondayOf = (day: number) => day - ((day % 7) + 10) % 7;
const monthOfWeek = (monday: number) => dateFromDay(monday + 3).slice(0, 7);

function monthWeeks(month: string): number[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new RangeError('month must be YYYY-MM');
  const first = dayNumber(`${month}-01`);
  const weeks: number[] = [];
  // The first week whose Thursday is in this month starts within three days before the 1st.
  for (let monday = mondayOf(first - 3) ; ; monday += 7) {
    if (monday + 3 < first) continue;
    if (monthOfWeek(monday) !== month) break;
    weeks.push(monday);
  }
  return weeks;
}

function addMonths(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (value - 1) + offset;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Count back from the current period: open periods are skipped, active ones count, the first missed one stops. */
function count(states: readonly PeriodState[]): StreakCount {
  let best = 0, run = 0;
  for (const state of states) {
    if (state === 'active') best = Math.max(best, ++run);
    else if (state === 'missed') run = 0;
  }
  let current = 0;
  for (let index = states.length - 1; index >= 0; index--) {
    const state = states[index];
    if (state === 'active') current++;
    else if (state === 'missed') break;
    else if (state === 'open' && index === states.length - 1) continue;
    else break;
  }
  return { current, best };
}

/**
 * Streaks as of `today` (the device's current local date) from saved practice. Practice dated after
 * `today` (another time zone) is still an active day; it simply has not been reached yet.
 */
export function practiceStreaks(sessions: Iterable<Pick<MeditationSession, 'status' | 'activeDurationSeconds' | 'localDate'>>,
  today: LocalDate): PracticeStreaks {
  const todayNumber = dayNumber(today);
  const active = new Set<number>();
  for (const session of sessions) if (qualifiesForStreak(session)) active.add(dayNumber(session.localDate));

  const weekCache = new Map<number, WeekStatus>();
  function weekAt(monday: number): WeekStatus {
    const cached = weekCache.get(monday);
    if (cached) return cached;
    let activeDays = 0;
    for (let day = monday; day < monday + 7; day++) if (active.has(day)) activeDays++;
    const needed = STREAK_RULES.activeDaysPerWeek;
    let state: PeriodState;
    if (activeDays >= needed) state = 'active';
    else if (monday > todayNumber) state = 'future';
    else if (monday + 6 < todayNumber) state = 'missed';
    else {
      // Days still available this week: the rest of the week, plus today if it is not active yet.
      const remaining = monday + 6 - todayNumber + (active.has(todayNumber) ? 0 : 1);
      state = activeDays + remaining >= needed ? 'open' : 'missed';
    }
    const status = Object.freeze({ start: dateFromDay(monday), activeDays, state, month: monthOfWeek(monday) });
    weekCache.set(monday, status);
    return status;
  }
  function monthAt(month: string): MonthStatus {
    const weeks = monthWeeks(month).map(weekAt);
    const state: PeriodState = weeks.every((week) => week.state === 'active') ? 'active'
      : weeks.some((week) => week.state === 'missed') ? 'missed'
        : weeks.every((week) => week.state === 'future') ? 'future' : 'open';
    return Object.freeze({ month, weeks: Object.freeze(weeks), state });
  }

  const first = active.size ? Math.min(...active) : todayNumber;
  // Days: today counts if active; an inactive today is still open.
  const dayStates: PeriodState[] = [];
  for (let day = first; day <= todayNumber; day++) {
    dayStates.push(active.has(day) ? 'active' : day === todayNumber ? 'open' : 'missed');
  }
  const weekStates: PeriodState[] = [];
  for (let monday = mondayOf(first); monday <= mondayOf(todayNumber); monday += 7) weekStates.push(weekAt(monday).state);
  const monthStates: PeriodState[] = [];
  const lastMonth = monthOfWeek(mondayOf(todayNumber));
  for (let month = monthOfWeek(mondayOf(first)); month <= lastMonth; month = addMonths(month, 1)) {
    const state = monthAt(month).state;
    monthStates.push(state === 'future' ? 'open' : state);
  }

  return Object.freeze({
    version: STREAK_RULES.version,
    today,
    days: Object.freeze(count(dayStates)),
    weeks: Object.freeze(count(weekStates)),
    months: Object.freeze(count(monthStates)),
    isActiveDay: (date: LocalDate) => active.has(dayNumber(date)),
    week: (date: LocalDate) => weekAt(mondayOf(dayNumber(date))),
    month: monthAt,
  });
}
