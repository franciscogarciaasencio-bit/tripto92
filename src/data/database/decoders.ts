import { validateSession } from '../../domain/meditation/session';
import { createProgressionState, PROGRESSION_V1, PROGRESSION_V2, PROGRESSION_V3, PROGRESSION_V4, PROGRESSION_V5, PROGRESSION_V6, PROGRESSION_V7, PROGRESSION_V8 } from '../../domain/progression';
import type { CalendarContext, MeditationSession, ProgressionAward, ProgressionRules, ProgressionState, RankDefinition, ConsistencyActivation } from '../../domain/progression';
import { PersistenceError } from './errors';
import { array, canonical, integer, json, localDate, object, requireData, text, timestamp, timeZone } from './validation';

export function decodeContext(value: unknown): CalendarContext {
  const row = object(value);
  return { timestamp: timestamp(row.timestamp), localDate: localDate(row.localDate), timeZone: timeZone(row.timeZone) };
}

export function decodeSession(value: unknown): MeditationSession {
  const row = object(value);
  const status = row.status;
  requireData(status === 'completed' || status === 'ended_early', 'Session must be finished');
  const session: MeditationSession = {
    id: text(row.id), startedAt: timestamp(row.startedAt), endedAt: timestamp(row.endedAt),
    activeDurationSeconds: integer(row.activeDurationSeconds), pausedDurationSeconds: integer(row.pausedDurationSeconds),
    status, localDate: localDate(row.localDate), timeZone: timeZone(row.timeZone),
  };
  try { validateSession(session); }
  catch (cause) { throw new PersistenceError('INVALID_DATA', 'Invalid meditation session', { cause }); }
  return session;
}

export interface StoredMeditationSession { readonly session: MeditationSession; readonly createdAt: number }
export function decodeSessionRow(value: unknown) {
  const row = object(value);
  requireData(row.qualified === 0 || row.qualified === 1, 'Invalid historical qualification flag');
  const session = decodeSession({
    id: row.id, startedAt: row.started_at, endedAt: row.ended_at,
    activeDurationSeconds: row.active_seconds, pausedDurationSeconds: row.paused_seconds,
    status: row.status, localDate: row.local_date, timeZone: row.time_zone,
  });
  const createdAt = timestamp(row.created_at);
  requireData(createdAt >= session.endedAt, 'Session creation precedes completion');
  return {
    session, createdAt, sequence: integer(row.sequence, 1),
    qualified: row.qualified === 1, qualificationRulesVersion: text(row.qualification_rules_version),
  };
}

export function decodeAwardRow(value: unknown): ProgressionAward {
  const row = object(value);
  const b = object(json(row.breakdown_json));
  return {
    id: text(row.id), sessionId: text(row.session_id), occasionId: text(row.occasion_id),
    rulesVersion: text(row.rules_version), awardedAt: timestamp(row.awarded_at),
    localDate: localDate(row.local_date), rewardDate: localDate(row.reward_date), xpCenti: integer(row.xp_centi),
    breakdown: {
      occasionActiveSeconds: integer(b.occasionActiveSeconds), baseCentiXp: integer(b.baseCentiXp),
      weightBasisPoints: integer(b.weightBasisPoints), precedingActiveDays: integer(b.precedingActiveDays),
      consistencyNumerator: integer(b.consistencyNumerator, 1), consistencyDenominator: integer(b.consistencyDenominator, 1),
      previousOccasionCentiXp: integer(b.previousOccasionCentiXp), cumulativeOccasionCentiXp: integer(b.cumulativeOccasionCentiXp),
      ...(b.incrementalBaseCentiXp !== undefined ? { incrementalBaseCentiXp: integer(b.incrementalBaseCentiXp),
        bonusCentiXp: integer(b.bonusCentiXp), continuousConsistencyScore: integer(b.continuousConsistencyScore),
        continuousConsistencyDate: localDate(b.continuousConsistencyDate) } : {}),
    },
  };
}

function decodeRank(value: unknown): RankDefinition {
  const row = object(value);
  return { id: text(row.id), name: text(row.name), thresholdCentiXp: integer(row.thresholdCentiXp), theme: text(row.theme) };
}
function decodeOccasion(value: unknown): ProgressionState['occasions'][number] {
  const row = object(value);
  return {
    id: text(row.id), sessionIds: array(row.sessionIds, text), startedAt: timestamp(row.startedAt), endedAt: timestamp(row.endedAt),
    rewardDate: localDate(row.rewardDate), activeDurationSeconds: integer(row.activeDurationSeconds),
    rulesVersion: text(row.rulesVersion), ordinalInDay: integer(row.ordinalInDay, 1),
    weightBasisPoints: integer(row.weightBasisPoints), precedingActiveDays: integer(row.precedingActiveDays),
    awardedCentiXp: integer(row.awardedCentiXp),
    ...(row.awardedBaseCentiXp !== undefined ? { awardedBaseCentiXp: integer(row.awardedBaseCentiXp) } : {}),
  };
}

export type CheckpointMetadata = Pick<ProgressionState,
  'schemaVersion' | 'asOf' | 'settledThroughDate' | 'activeRulesVersion' | 'occasions' | 'highestRankAchieved'> & {
    readonly sessionCount: number; readonly awardCount: number; readonly ruleSetCount: number; readonly consistencyActivationCount: number;
  };

export function checkpointMetadata(state: ProgressionState): CheckpointMetadata {
  return {
    schemaVersion: state.schemaVersion, asOf: state.asOf, settledThroughDate: state.settledThroughDate,
    activeRulesVersion: state.activeRulesVersion, occasions: state.occasions, highestRankAchieved: state.highestRankAchieved,
    sessionCount: state.sessions.length, awardCount: state.awards.length, ruleSetCount: state.ruleSets.length,
    consistencyActivationCount: state.consistencyActivations?.length ?? 0,
  };
}
export function decodeCheckpoint(value: unknown): CheckpointMetadata & { readonly currentProgressionCenti: number } {
  const row = object(value);
  const meta = object(json(row.metadata_json));
  if (meta.schemaVersion !== 1) throw new PersistenceError('UNSUPPORTED_SCHEMA', 'Unsupported progression checkpoint format');
  const best = object(meta.highestRankAchieved);
  return {
    schemaVersion: 1, currentProgressionCenti: integer(row.current_progression_centi),
    asOf: decodeContext(meta.asOf), settledThroughDate: localDate(meta.settledThroughDate),
    activeRulesVersion: text(meta.activeRulesVersion), occasions: array(meta.occasions, decodeOccasion),
    highestRankAchieved: { rank: decodeRank(best.rank), rulesVersion: text(best.rulesVersion), achievedAt: timestamp(best.achievedAt) },
    sessionCount: integer(meta.sessionCount), awardCount: integer(meta.awardCount), ruleSetCount: integer(meta.ruleSetCount, 1),
    consistencyActivationCount: meta.consistencyActivationCount === undefined ? 0 : integer(meta.consistencyActivationCount),
  };
}

export function decodeConsistencyActivation(value: unknown): ConsistencyActivation {
  const row = object(value);
  return { rulesVersion: text(row.rulesVersion), asOf: decodeContext(row.asOf),
    previousRulesVersion: row.previousRulesVersion === null ? null : text(row.previousRulesVersion),
    sessionCount: integer(row.sessionCount), awardCount: integer(row.awardCount), score: integer(row.score) };
}

/** Explicit allowlist. New releases register new versions AND retain historical definitions. */
export function createRulesRegistry(supported: readonly ProgressionRules[] = [PROGRESSION_V1]) {
  const registry = new Map<string, ProgressionRules>();
  for (const rules of [PROGRESSION_V1, PROGRESSION_V2, PROGRESSION_V3, PROGRESSION_V4, PROGRESSION_V5, PROGRESSION_V6, PROGRESSION_V7, PROGRESSION_V8, ...supported]) {
    const captured = createProgressionState({ timestamp: 0, localDate: '1970-01-01', timeZone: 'UTC' }, rules).ruleSets[0]!;
    const existing = registry.get(captured.version);
    if (existing && canonical(existing) !== canonical(captured)) throw new Error('Conflicting registered rules version');
    registry.set(captured.version, captured);
  }
  function get(version: string): ProgressionRules {
    const rules = registry.get(version);
    if (!rules) throw new PersistenceError('UNSUPPORTED_RULES', `Unsupported progression rules: ${version}`);
    return rules;
  }
  function decode(value: unknown): ProgressionRules {
    const stored = object(json(value));
    const known = get(text(stored.version));
    requireData(canonical(stored) === canonical(known), 'Stored rules differ from their registered version');
    return known;
  }
  return { get, decode };
}
export type RulesRegistry = ReturnType<typeof createRulesRegistry>;
