import type { MeditationSession } from '../meditation/session';
import { precedingActiveDays } from './calendar';
import { isRewardEligible } from './earnings';
import { isLinearConsistency } from './consistency';
import { safeAdd } from './numeric';
import { occasionWeight, rulesForVersion } from './rules';
import type { PracticeOccasion, ProgressionState } from './types';

export function qualifyingDates(state: ProgressionState): readonly string[] {
  const rules = rulesForVersion(state);
  return [...new Set(state.sessions.filter((entry) => rules.practiceDayEligibility === 'completed_minimum'
    ? entry.session.status === 'completed' && entry.session.activeDurationSeconds >= rules.minimumActiveSeconds
    : entry.qualified).map((entry) => entry.session.localDate))];
}

/** V3 pools all reward-eligible active time. Historical V1/V2 still exclude their subminimum runs. */
export function occasionForSession(state: ProgressionState, session: MeditationSession): PracticeOccasion {
  const rules = rulesForVersion(state);
  const last = state.occasions[state.occasions.length - 1];
  if (last) {
    const originalRules = rulesForVersion(state, last.rulesVersion);
    // Preserve released V1/V2 replay behaviour. Under V3, short/early-ended runs cannot enter
    // an older occasion whose frozen formula did not permit them; they consume the next daily slot.
    const linearBoundary = rules.version !== originalRules.version &&
      ((rules.continuousConsistency && isLinearConsistency(rules.continuousConsistency)) ||
        (originalRules.continuousConsistency && isLinearConsistency(originalRules.continuousConsistency)));
    const compatible = !linearBoundary && (rules.continuousConsistency ? !!originalRules.continuousConsistency : true) &&
      (rules.earningsAlgorithm === 'logarithmic_v1' || isRewardEligible(session, originalRules));
    if (compatible && session.startedAt - last.endedAt < originalRules.occasionSeparationSeconds * 1000) {
      return {
        ...last,
        sessionIds: [...last.sessionIds, session.id],
        endedAt: session.endedAt,
        activeDurationSeconds: safeAdd(last.activeDurationSeconds, session.activeDurationSeconds),
      };
    }
  }
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
    weightBasisPoints: occasionWeight(rules, ordinalInDay),
    precedingActiveDays: precedingActiveDays(qualifyingDates(state), session.localDate, rules.consistencyWindowDays),
    awardedCentiXp: 0,
  };
}
