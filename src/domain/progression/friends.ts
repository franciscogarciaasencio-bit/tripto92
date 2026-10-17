import { dateFromDay, dayNumber, type LocalDate } from './calendar';
import { habitStageIndex, JOURNEY_CATEGORIES, type JourneyCategory } from './journey';
import { practiceStreaks } from './streaks';
import type { MeditationSession } from '../meditation/session';

/**
 * What friends see of each other (presentation rules: nothing here changes Ripples or levels).
 * Only a level and weeks in a row are shared, never practice, dates or times.
 */
export const FRIEND_RULES = Object.freeze({ version: 'ona_friends_v1', maximumLevel: 125 });

/**
 * Weeks in a row as shared with friends: the count today, and the last day it still holds if no
 * more practice arrives. Friends' apps show it until then, so it lapses exactly when the sharer's
 * own calendar would show it lapse, without sharing which days were practised.
 */
export interface SharedStreak { readonly weeks: number; readonly until: LocalDate }

export function sharedStreak(sessions: readonly Pick<MeditationSession, 'status' | 'activeDurationSeconds' | 'localDate'>[],
  today: LocalDate): SharedStreak {
  const weeks = practiceStreaks(sessions, today).weeks.current;
  let until = today;
  // Without new practice the count can only fall, at the latest during the following week.
  if (weeks > 0) {
    for (let day = dayNumber(today) + 1; day <= dayNumber(today) + 14; day++) {
      if (practiceStreaks(sessions, dateFromDay(day)).weeks.current < weeks) break;
      until = dateFromDay(day);
    }
  }
  return Object.freeze({ weeks, until });
}

/** A friend's weeks in a row on `today` (the viewer's date), from what they last shared. */
export function sharedWeeksInARow(shared: SharedStreak | null, today: LocalDate): number {
  return shared && today <= shared.until ? shared.weeks : 0;
}

/** The stage a shared level belongs to (current stages: a new one every five levels from Level 0). */
export function stageOfLevel(level: number): JourneyCategory {
  if (!Number.isSafeInteger(level) || level < 0 || level > FRIEND_RULES.maximumLevel) throw new RangeError('level must be 0–125');
  return JOURNEY_CATEGORIES[habitStageIndex(level)]!;
}

/**
 * Stages ahead stay undiscovered (Journey shows only the stage you are in), so a friend's stage is
 * shown only once you have reached it yourself. The first stage is everyone's starting point.
 */
export function stageDiscovered(friendLevel: number, ownHighestLevel: number): boolean {
  stageOfLevel(friendLevel);
  return habitStageIndex(friendLevel) <= habitStageIndex(Math.max(0, ownHighestLevel));
}
