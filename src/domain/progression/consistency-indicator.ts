import { sameSession, validateSession, type MeditationSession } from '../meditation/session';
import { dayNumber, validateContext, type CalendarContext } from './calendar';
import { CONTINUOUS_CONSISTENCY } from './consistency';
import { PRACTICE_CREDIT_RULES } from './journey';
import { freeze, multiplyRatio } from './numeric';

/** Read-only display policy. Never used to calculate an award, bonus or level. */
export const CONSISTENCY_INDICATOR_V1 = freeze({
  version: 'ona_consistency_indicator_v1',
  targetPracticeDays: 14,
  unitsPerPracticeDay: 1_000_000,
  inactiveRetentionMillionths: CONTINUOUS_CONSISTENCY.inactiveRetentionMillionths,
});

/** One small increase per captured qualifying day. Reconstructible from history, without another stored balance. */
export function getConsistencyIndicator(sessions: readonly MeditationSession[], asOf: CalendarContext) {
  validateContext(asOf);
  const unique = new Map<string, MeditationSession>();
  for (const session of sessions) {
    validateSession(session);
    if (session.endedAt > asOf.timestamp) throw new RangeError('Consistency indicator contains future practice');
    const previous = unique.get(session.id);
    if (previous && !sameSession(previous, session)) throw new RangeError('Conflicting consistency session ID');
    unique.set(session.id, session);
  }
  const ordered = [...unique.values()].sort((a, b) => a.startedAt - b.startedAt || a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const capacity = CONSISTENCY_INDICATOR_V1.targetPracticeDays * CONSISTENCY_INDICATOR_V1.unitsPerPracticeDay;
  let units = 0, cursor: number | null = null;
  const practiced = new Set<number>();
  const decayUntil = (day: number) => {
    if (cursor === null) return;
    for (let inactive = cursor + 1; inactive < day && units > 0; ++inactive) {
      const next = multiplyRatio(units, CONSISTENCY_INDICATOR_V1.inactiveRetentionMillionths, CONTINUOUS_CONSISTENCY.scale);
      if (next === units) break; // Fixed-point rounding has settled; distant dates need no repeated work.
      units = next;
    }
  };
  for (const session of ordered) {
    if (session.status !== 'completed' || session.activeDurationSeconds < PRACTICE_CREDIT_RULES.minimumActiveSeconds) continue;
    const day = dayNumber(session.localDate);
    decayUntil(day);
    cursor = Math.max(cursor ?? day, day);
    if (practiced.has(day)) continue;
    practiced.add(day);
    units = Math.min(capacity, units + CONSISTENCY_INDICATOR_V1.unitsPerPracticeDay);
  }
  decayUntil(dayNumber(asOf.localDate));
  return units / capacity;
}
