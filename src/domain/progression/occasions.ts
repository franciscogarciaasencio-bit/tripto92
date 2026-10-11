import type { MeditationSession } from '../meditation/session';
import { precedingActiveDays } from './calendar';
import { safeAdd } from './numeric';
import { rulesForVersion } from './rules';
import type { PracticeOccasion, ProgressionState } from './types';

export function qualifyingDates(state: ProgressionState): readonly string[] {
  const rules = rulesForVersion(state);
  return [...new Set(state.sessions.filter((entry) => rules.practiceDayEligibility === 'completed_minimum'
    ? entry.session.status === 'completed' && entry.session.activeDurationSeconds >= rules.minimumActiveSeconds
    : entry.qualified).map((entry) => entry.session.localDate))];
}

/** The last qualifying session's end controls grouping; short runs cannot bridge occasions. */
export function occasionForSession(state: ProgressionState, session: MeditationSession): PracticeOccasion {
  const last = state.occasions[state.occasions.length - 1];
  if (last) {
    const originalRules = rulesForVersion(state, last.rulesVersion);
    if (session.startedAt - last.endedAt < originalRules.occasionSeparationSeconds * 1000) {
      return {
        ...last,
        sessionIds: [...last.sessionIds, session.id],
        endedAt: session.endedAt,
        activeDurationSeconds: safeAdd(last.activeDurationSeconds, session.activeDurationSeconds),
      };
    }
  }
  const rules = rulesForVersion(state);
  const ordinalInDay = state.occasions.filter((occasion) => occasion.rewardDate === session.localDate).length + 1;
  return {
    id: `occasion:${session.id}`,
    sessionIds: [session.id],
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    rewardDate: session.localDate,
    activeDurationSeconds: session.activeDurationSeconds,
    rulesVersion: rules.version,
    ordinalInDay,
    weightBasisPoints: rules.occasionWeightsBasisPoints[ordinalInDay - 1] ?? 0,
    precedingActiveDays: precedingActiveDays(qualifyingDates(state), session.localDate, rules.consistencyWindowDays),
    awardedCentiXp: 0,
  };
}
