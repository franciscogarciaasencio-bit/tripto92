import { sameSession, validateSession, type MeditationSession } from '../meditation/session';
import { dayNumber, dateFromDay, validateContext, type CalendarContext } from './calendar';
import { PRACTICE_CREDIT_RULES, practiceCredits } from './journey';
import { assertNonnegativeInteger, freeze, multiplyRatio } from './numeric';
import type { ConsistencyActivation, ConsistencyConfiguration, LinearContributionConsistency, ProgressionState } from './types';

export const CONTINUOUS_CONSISTENCY = freeze({ scale: 1_000_000, growthBasisPoints: 1500,
  inactiveRetentionMillionths: 840_896, halfLifeDays: 4 });

/** V5 has one score for both the bar and bonus; sixty exact contributions reach full. */
export const LINEAR_CONSISTENCY_V1: LinearContributionConsistency = freeze({
  algorithm: 'linear_contributions_v1', scale: 60_000_000, contributionUnits: 1_000_000,
  targetContributions: 60, inactiveRetentionMillionths: 840_896, halfLifeDays: 4,
});
/** V7 (owner, 2026-10-17): full after 42 contributions, six weeks daily or three weeks twice a day. */
export const LINEAR_CONSISTENCY_V2: LinearContributionConsistency = freeze({
  algorithm: 'linear_contributions_v1', scale: 42_000_000, contributionUnits: 1_000_000,
  targetContributions: 42, inactiveRetentionMillionths: 840_896, halfLifeDays: 4,
});
const RETENTION_SCALE = 1_000_000;

export function isLinearConsistency(config: ConsistencyConfiguration): config is LinearContributionConsistency {
  return 'algorithm' in config && config.algorithm === 'linear_contributions_v1';
}
function increase(score: number, config: ConsistencyConfiguration) {
  return isLinearConsistency(config) ? Math.min(config.scale, score + config.contributionUnits)
    : score + multiplyRatio(config.scale - score, config.growthBasisPoints, 10_000);
}
function inactiveDay(score: number, config: ConsistencyConfiguration) {
  return multiplyRatio(score, config.inactiveRetentionMillionths, RETENTION_SCALE);
}

/** Validation for persistence adapters, without a storage dependency or implicit clock. */
export function validateConsistencyActivation(anchor: ConsistencyActivation, state?: ProgressionState): void {
  if (typeof anchor.rulesVersion !== 'string' || !anchor.rulesVersion.trim()) throw new RangeError('Consistency activation rules version is required');
  if (anchor.previousRulesVersion !== null && (typeof anchor.previousRulesVersion !== 'string' ||
      !anchor.previousRulesVersion.trim() || anchor.previousRulesVersion === anchor.rulesVersion)) {
    throw new RangeError('Consistency activation requires a different source rules version');
  }
  validateContext(anchor.asOf);
  for (const name of ['sessionCount', 'awardCount', 'score'] as const) assertNonnegativeInteger(anchor[name], `Consistency activation ${name}`);
  if (!state) return;
  const config = state.ruleSets.find(rule => rule.version === anchor.rulesVersion)?.continuousConsistency;
  if (!config || !isLinearConsistency(config)) throw new RangeError('Consistency activation requires linear rules');
  if (state.consistencyActivations?.filter(entry => entry.rulesVersion === anchor.rulesVersion).length !== 1) {
    throw new RangeError('Consistency activation must have exactly one immutable version boundary');
  }
  if (anchor.score > config.scale || anchor.sessionCount > state.sessions.length || anchor.awardCount > state.awards.length) {
    throw new RangeError('Consistency activation exceeds its history or score bounds');
  }
  if (anchor.asOf.timestamp > state.asOf.timestamp || dayNumber(anchor.asOf.localDate) >
      Math.max(dayNumber(state.asOf.localDate), dayNumber(state.settledThroughDate) + 1)) {
    throw new RangeError('Consistency activation is ahead of current context');
  }
  const prefix = new Set(state.sessions.slice(0, anchor.sessionCount).map(entry => entry.session.id));
  if (state.sessions.slice(0, anchor.sessionCount).some(entry => entry.session.endedAt > anchor.asOf.timestamp) ||
      state.awards.slice(0, anchor.awardCount).some(award => !prefix.has(award.sessionId) || award.awardedAt > anchor.asOf.timestamp) ||
      state.sessions.slice(anchor.sessionCount).some(entry => entry.session.endedAt < anchor.asOf.timestamp) ||
      state.awards.slice(anchor.awardCount).some(award => award.awardedAt < anchor.asOf.timestamp)) {
    throw new RangeError('Consistency activation does not match its history prefix');
  }
  if (anchor.previousRulesVersion === null) {
    if (anchor.score || anchor.sessionCount || anchor.awardCount) throw new RangeError('New consistency activation must begin empty');
    return;
  }
  const previousRules = state.ruleSets.find(rule => rule.version === anchor.previousRulesVersion);
  if (!previousRules) throw new RangeError('Consistency activation source rules are missing');
  const previousConfig = previousRules.continuousConsistency;
  if (previousConfig && isLinearConsistency(previousConfig)) {
    const index = state.consistencyActivations?.findIndex(entry => entry.rulesVersion === anchor.rulesVersion) ?? -1;
    const previousIndex = state.consistencyActivations?.findIndex(entry => entry.rulesVersion === anchor.previousRulesVersion) ?? -1;
    if (previousIndex < 0 || previousIndex >= index) throw new RangeError('Consistency activation source must precede its target');
  }
  const prefixState: ProgressionState = { ...state, activeRulesVersion: anchor.previousRulesVersion,
    asOf: anchor.asOf, settledThroughDate: dateFromDay(dayNumber(anchor.asOf.localDate) - 1),
    sessions: state.sessions.slice(0, anchor.sessionCount), awards: state.awards.slice(0, anchor.awardCount),
    consistencyActivations: state.consistencyActivations?.filter(entry => entry.rulesVersion !== anchor.rulesVersion &&
      entry.asOf.timestamp <= anchor.asOf.timestamp && entry.sessionCount <= anchor.sessionCount && entry.awardCount <= anchor.awardCount) ?? [] };
  const source = previousConfig ? progressionConsistency(prefixState, previousConfig) : null;
  const expected = source && previousConfig ? multiplyRatio(source.score, config.scale, previousConfig.scale) : 0;
  if (anchor.score !== expected) throw new RangeError('Consistency activation score differs from its settled source');
}

/** Single-formula simulation from empty history. Live/migrated state uses progressionConsistency's receipts/anchors. */
export function continuousConsistency(sessions: readonly MeditationSession[], asOf: CalendarContext,
  config: ConsistencyConfiguration = CONTINUOUS_CONSISTENCY) {
  validateContext(asOf);
  let score = 0, cursor: number | null = null, lastQualifyingDate: string | null = null;
  const dates = new Map<string, { count: number; earliestEnd: number }>();
  const unique = new Map<string, MeditationSession>();
  for (const session of sessions) {
    validateSession(session);
    const existing = unique.get(session.id);
    if (existing) { if (!sameSession(existing, session)) throw new RangeError('Conflicting consistency session ID'); else continue; }
    unique.set(session.id, session);
    if (session.endedAt > asOf.timestamp) throw new RangeError('Consistency contains future practice');
  }
  const ordered = [...unique.values()];
  if (isLinearConsistency(config)) ordered.sort((a, b) => a.startedAt - b.startedAt || a.endedAt - b.endedAt ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const session of ordered) {
    if (session.status !== 'completed' || session.activeDurationSeconds < PRACTICE_CREDIT_RULES.minimumActiveSeconds) continue;
    const day = dayNumber(session.localDate);
    if (cursor !== null) for (let inactive = cursor + 1; inactive < day; inactive++) {
      score = inactiveDay(score, config);
    }
    cursor = Math.max(cursor ?? day, day);
    if (lastQualifyingDate === null || session.localDate > lastQualifyingDate) lastQualifyingDate = session.localDate;
    const previous = dates.get(session.localDate);
    const eligible = !previous || (previous.count === 1 &&
      session.startedAt - previous.earliestEnd >= PRACTICE_CREDIT_RULES.doubleGapMilliseconds);
    if (eligible) score = increase(score, config);
    dates.set(session.localDate, { count: (previous?.count ?? 0) + (eligible ? 1 : 0),
      earliestEnd: Math.min(previous?.earliestEnd ?? session.endedAt, session.endedAt) });
  }
  if (cursor !== null) for (let day = cursor + 1; day < dayNumber(asOf.localDate); day++) {
    const next = inactiveDay(score, config);
    if (next === score) break;
    score = next;
  }
  return freeze({ score, fraction: score / config.scale, lastQualifyingDate });
}

/** Stored after-session scores are immutable anchors; opening/travel never rewinds their settled calendar. */
export function progressionConsistency(state: ProgressionState, config: ConsistencyConfiguration =
  state.ruleSets.find(rule => rule.version === state.activeRulesVersion)?.continuousConsistency ?? CONTINUOUS_CONSISTENCY) {
  const logicalDay = Math.max(dayNumber(state.asOf.localDate), dayNumber(state.settledThroughDate) + 1);
  const localDate = dateFromDay(logicalDay);
  const activation = isLinearConsistency(config)
    ? state.consistencyActivations?.find(entry => entry.rulesVersion === state.activeRulesVersion) : undefined;
  if (isLinearConsistency(config) && !activation) throw new RangeError('Linear consistency requires an immutable activation anchor');
  if (activation) validateConsistencyActivation(activation, state);
  const anchor = state.awards.slice(activation?.awardCount ?? 0).filter((award) =>
    award.breakdown.continuousConsistencyScore !== undefined && (!activation || award.rulesVersion === activation.rulesVersion)).at(-1);
  if (!anchor && !activation) return { ...continuousConsistency(state.sessions.map((entry) => entry.session), { ...state.asOf, localDate }, config), localDate };
  let score = anchor?.breakdown.continuousConsistencyScore ?? activation!.score;
  assertNonnegativeInteger(score, 'Consistency anchor score');
  if (score > config.scale) throw new RangeError('Consistency anchor score exceeds scale');
  const active = new Set(practiceCredits(state.sessions.map((entry) => entry.session)).dates.map((date) => dayNumber(date.localDate)));
  const sessions = new Map(state.sessions.map((entry) => [entry.session.id, entry.session]));
  for (const award of state.awards) {
    const session = sessions.get(award.sessionId)!;
    if (award.breakdown.continuousConsistencyDate && session.status === 'completed' && session.activeDurationSeconds >= 180)
      active.add(dayNumber(award.breakdown.continuousConsistencyDate));
  }
  for (let day = dayNumber(anchor?.breakdown.continuousConsistencyDate ?? activation!.asOf.localDate); day < logicalDay; day++) {
    if (!active.has(day)) {
      const next = inactiveDay(score, config);
      if (next === score) break;
      score = next;
    }
  }
  return { score, fraction: score / config.scale, localDate };
}
export function sessionConsistency(before: ProgressionState, afterHistory: ProgressionState, config: ConsistencyConfiguration =
  afterHistory.ruleSets.find(rule => rule.version === afterHistory.activeRulesVersion)?.continuousConsistency ?? CONTINUOUS_CONSISTENCY) {
  const previous = progressionConsistency(before, config);
  const eligible = practiceCredits(afterHistory.sessions.map((entry) => entry.session)).credits >
    practiceCredits(before.sessions.map((entry) => entry.session)).credits;
  const score = eligible ? increase(previous.score, config) : previous.score;
  return { ...previous, score, fraction: score / config.scale };
}
