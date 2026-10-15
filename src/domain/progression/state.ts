import { sameSession, validateSession, type MeditationSession } from '../meditation/session';
import { dateFromDay, dayNumber, forwardOnly, validateContext, type CalendarContext } from './calendar';
import { decayOneDay, protectedFloor } from './decay';
import { isRewardEligible, occasionEarnings } from './earnings';
import { freeze, multiplyRatio, safeAdd } from './numeric';
import { occasionForSession, qualifyingDates } from './occasions';
import { rankForProgress } from './ranks';
import { captureRules, PROGRESSION_V1, rulesForVersion } from './rules';
import type { ProgressionAward, ProgressionRules, ProgressionState } from './types';
import { isLinearConsistency, progressionConsistency, sessionConsistency } from './consistency';

export function createProgressionState(asOf: CalendarContext, rules: ProgressionRules = PROGRESSION_V1): ProgressionState {
  validateContext(asOf);
  const captured = captureRules(rules);
  return freeze({
    schemaVersion: 1,
    asOf: { ...asOf },
    settledThroughDate: dateFromDay(dayNumber(asOf.localDate) - 1),
    activeRulesVersion: captured.version,
    ruleSets: [captured],
    sessions: [], occasions: [], awards: [],
    lifetimeXpCenti: 0, currentProgressionCenti: 0, totalMeditationSeconds: 0,
    highestRankAchieved: { rank: captured.ranks[0]!, rulesVersion: captured.version, achievedAt: asOf.timestamp },
    ...(captured.continuousConsistency && isLinearConsistency(captured.continuousConsistency) ? {
      consistencyActivations: [{ rulesVersion: captured.version, previousRulesVersion: null,
        asOf: { ...asOf }, sessionCount: 0, awardCount: 0, score: 0 }],
    } : {}),
  });
}

/** Settle only dates strictly BEFORE asOf.localDate. No wall-clock or local-zone access. */
export function advanceProgression(state: ProgressionState, requested: CalendarContext): ProgressionState {
  validateContext(requested);
  const asOf = forwardOnly(state.asOf, requested);
  const rules = rulesForVersion(state);
  const through = Math.max(dayNumber(state.settledThroughDate), dayNumber(asOf.localDate) - 1);
  const activeDays = qualifyingDates(state).map(dayNumber).sort((a, b) => a - b);
  let position = 0;
  let lastActive: number | undefined;
  let current = state.currentProgressionCenti;
  for (let day = dayNumber(state.settledThroughDate) + 1; day <= through; day++) {
    while (position < activeDays.length && activeDays[position]! <= day) {
      lastActive = activeDays[position];
      position++;
    }
    if (lastActive !== undefined && day - lastActive > rules.inactivityGraceDays) {
      current = decayOneDay(current, state.lifetimeXpCenti, rules);
    }
  }
  return freeze({ ...state, asOf: { ...asOf }, settledThroughDate: dateFromDay(through), currentProgressionCenti: current });
}

function updateBest(state: ProgressionState): ProgressionState {
  const rules = rulesForVersion(state);
  const rank = rankForProgress(state.currentProgressionCenti, rules.ranks);
  if (rank.thresholdCentiXp <= state.highestRankAchieved.rank.thresholdCentiXp) return state;
  return {
    ...state,
    highestRankAchieved: { rank, rulesVersion: rules.version, achievedAt: state.asOf.timestamp },
  };
}

/**
 * A practice may end slightly before the settlement cursor when the device clock is behind the
 * moment Ona last settled (clock correction, or a checkpoint synced from a phone running ahead).
 * It is recorded truthfully when its date is at most one day before the settled calendar (as for
 * westward travel) and nothing in the progression is dated after its end, so the award is exactly
 * what replaying history up to that practice reproduces. Anything older remains a rewind.
 */
function acceptsLateEnding(state: ProgressionState, session: MeditationSession) {
  return dayNumber(session.localDate) >= dayNumber(state.asOf.localDate) - 1 &&
    (state.consistencyActivations ?? []).every((anchor) => anchor.asOf.timestamp <= session.endedAt) &&
    state.highestRankAchieved.achievedAt <= session.endedAt;
}

/** Append in timestamp order. Replays are no-ops; conflicting IDs and backdated edits fail loudly. */
export function recordSession(state: ProgressionState, session: MeditationSession): ProgressionState {
  validateSession(session);
  const duplicate = state.sessions.find((entry) => entry.session.id === session.id);
  if (duplicate) {
    if (!sameSession(duplicate.session, session)) throw new Error(`Conflicting session ID: ${session.id}`);
    return freeze(state);
  }
  const previous = state.sessions[state.sessions.length - 1];
  if (previous && session.startedAt < previous.session.endedAt) {
    throw new RangeError('Sessions must be appended in order without overlaps');
  }
  if (session.endedAt < state.asOf.timestamp && !acceptsLateEnding(state, session)) throw new RangeError('Cannot rewind progression time');
  const settled = advanceProgression(state, {
    timestamp: session.endedAt, localDate: session.localDate, timeZone: session.timeZone,
  });
  const rules = rulesForVersion(settled);
  const qualified = session.activeDurationSeconds >= rules.minimumActiveSeconds &&
    (rules.practiceDayEligibility !== 'completed_minimum' || session.status === 'completed');
  const withHistory: ProgressionState = {
    ...settled,
    sessions: [...settled.sessions, { session: { ...session }, qualified, qualificationRulesVersion: rules.version }],
    totalMeditationSeconds: safeAdd(settled.totalMeditationSeconds, session.activeDurationSeconds),
  };
  if (!isRewardEligible(session, rules)) return freeze(withHistory);

  // Use pre-append history: today's record must not influence its own bonus.
  const occasion = occasionForSession(settled, session);
  const originalRules = rulesForVersion(settled, occasion.rulesVersion);
  const consistency = originalRules.continuousConsistency ? sessionConsistency(settled, withHistory, originalRules.continuousConsistency) : null;
  const breakdown = { ...occasionEarnings(occasion, originalRules, consistency?.score ?? 0),
    ...(consistency ? { continuousConsistencyDate: consistency.localDate } : {}) };
  const increment = breakdown.cumulativeOccasionCentiXp - breakdown.previousOccasionCentiXp;
  const updatedOccasion = { ...occasion, awardedCentiXp: breakdown.cumulativeOccasionCentiXp,
    ...(breakdown.incrementalBaseCentiXp !== undefined ? { awardedBaseCentiXp: (occasion.awardedBaseCentiXp ?? 0) + breakdown.incrementalBaseCentiXp } : {}) };
  const replacesLast = settled.occasions[settled.occasions.length - 1]?.id === occasion.id;
  const award: ProgressionAward = {
    id: `award:${session.id}`, sessionId: session.id, occasionId: occasion.id,
    rulesVersion: originalRules.version, awardedAt: session.endedAt,
    localDate: session.localDate, rewardDate: occasion.rewardDate, xpCenti: increment, breakdown,
  };
  return freeze(updateBest({
    ...withHistory,
    occasions: [...(replacesLast ? settled.occasions.slice(0, -1) : settled.occasions), updatedOccasion],
    awards: [...settled.awards, award],
    lifetimeXpCenti: safeAdd(settled.lifetimeXpCenti, increment),
    currentProgressionCenti: safeAdd(settled.currentProgressionCenti, increment),
  }));
}

/** Explicit version boundary: past rewards and already settled decay are never replayed. */
export function changeProgressionRules(state: ProgressionState, rules: ProgressionRules, asOf: CalendarContext): ProgressionState {
  const captured = captureRules(rules);
  const existing = state.ruleSets.find((item) => item.version === captured.version);
  if (existing && JSON.stringify(existing) !== JSON.stringify(captured)) {
    throw new Error('A rules version cannot be reused for different configuration');
  }
  const settled = advanceProgression(state, asOf);
  if (settled.activeRulesVersion === captured.version) return settled;
  const previousConfig = rulesForVersion(settled).continuousConsistency;
  if (previousConfig && isLinearConsistency(previousConfig) &&
      (!captured.continuousConsistency || !isLinearConsistency(captured.continuousConsistency))) {
    throw new RangeError('Linear consistency cannot downgrade to legacy rules; use a new explicit continuation version');
  }
  if (protectedFloor(settled.lifetimeXpCenti, captured) > settled.currentProgressionCenti) {
    throw new Error('Raising the floor above current progression requires an explicit migration');
  }
  const config = captured.continuousConsistency;
  const activation = config && isLinearConsistency(config) ? (() => {
    if (settled.consistencyActivations?.some(anchor => anchor.rulesVersion === captured.version)) {
      throw new RangeError('A linear consistency version cannot be reactivated; use a new rules version');
    }
    const previous = rulesForVersion(settled).continuousConsistency;
    const carry = previous ? progressionConsistency(settled, previous) : null;
    return { rulesVersion: captured.version, previousRulesVersion: settled.activeRulesVersion, asOf: { ...settled.asOf,
      localDate: carry?.localDate ?? dateFromDay(Math.max(dayNumber(settled.asOf.localDate), dayNumber(settled.settledThroughDate) + 1)) },
      sessionCount: settled.sessions.length, awardCount: settled.awards.length,
      score: carry && previous ? multiplyRatio(carry.score, config.scale, previous.scale) : 0 };
  })() : null;
  return freeze(updateBest({
    ...settled,
    activeRulesVersion: captured.version,
    ruleSets: existing ? settled.ruleSets : [...settled.ruleSets, captured],
    ...(activation ? { consistencyActivations: [...(settled.consistencyActivations ?? []), activation] } : {}),
  }));
}
