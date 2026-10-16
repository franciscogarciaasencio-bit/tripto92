import { practiceCredits, type MeditationSession } from '../domain/progression';

/**
 * Days practised twice for the calendar: the same rule that earns two practice credits (two practices
 * of at least three active minutes on one date, the later starting six hours or more after the earlier
 * ends). Presentation only; never recomputes or changes saved rewards.
 */
export function doubleDays(sessions: readonly MeditationSession[]): ReadonlySet<string> {
  try {
    return new Set(practiceCredits(sessions).dates.filter((day) => day.credits === 2).map((day) => day.localDate));
  } catch {
    return new Set(); // Unreadable history never breaks the calendar; it simply shows no twice-a-day marks.
  }
}

/** The same, as it was before the practice `id` was saved (for the celebration's arriving mark). */
export function doubleDaysBefore(sessions: readonly MeditationSession[], id: string) {
  return doubleDays(sessions.filter((session) => session.id !== id));
}
