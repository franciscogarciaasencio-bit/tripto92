import { sameSession, validateSession, type MeditationSession } from '../meditation/session';
import { assertNonnegativeInteger, freeze, safeAdd } from './numeric';
import type { ProgressionState } from './types';

export const JOURNEY_VERSION = 'ona_journey_v3';
export const LEGACY_JOURNEY_VERSION = 'ona_journey_v2';
export const HABIT_JOURNEY_VERSION = 'ona_habit_levels_v1';
export const PRACTICE_CREDIT_RULES = freeze({ minimumActiveSeconds: 180, doubleGapMilliseconds: 6 * 3_600_000,
  maximumCreditsPerDate: 2, maximumLevel: 125, finalElapsedDays: 365, millisecondsPerDay: 86_400_000 });
const categoryDefinitions = [
  ['monkey_mind', 'Monkey Mind'], ['first_pause', 'First Pause'], ['awakening_attention', 'Awakening Attention'],
  ['finding_the_breath', 'Finding the Breath'], ['learning_to_return', 'Learning to Return'],
  ['gathering_focus', 'Gathering Focus'], ['settling_mind', 'Settling Mind'], ['finding_rhythm', 'Finding Rhythm'],
  ['growing_roots', 'Growing Roots'], ['steady_practice', 'Steady Practice'], ['sustained_attention', 'Sustained Attention'],
  ['quiet_focus', 'Quiet Focus'], ['deepening_stillness', 'Deepening Stillness'], ['clear_awareness', 'Clear Awareness'],
  ['grounded_presence', 'Grounded Presence'], ['patient_attention', 'Patient Attention'], ['widening_awareness', 'Widening Awareness'],
  ['steady_clarity', 'Steady Clarity'], ['quiet_depth', 'Quiet Depth'], ['habit_established', 'Habit Established'],
  ['rooted_habit', 'Rooted Habit'], ['integrated_practice', 'Integrated Practice'], ['everyday_presence', 'Everyday Presence'],
  ['natural_stillness', 'Natural Stillness'], ['steady_presence', 'Steady Presence'],
] as const;
export interface JourneyCategory { readonly id: string; readonly name: string; readonly firstLevel: number; readonly lastLevel: number; readonly iconId: string }
export const JOURNEY_CATEGORIES: readonly JourneyCategory[] = freeze(categoryDefinitions.map(([id, name], index) => {
  return { id, name, iconId: id, firstLevel: index * 5 + 1, lastLevel: index * 5 + 5 };
}));
export interface JourneyLevel {
  readonly number: number; readonly category: JourneyCategory; readonly categoryStep: number;
  readonly xpCenti: number; readonly credits: number; readonly realDays: number; readonly elapsedDays: number;
}
/** Balancing constants live here. Three nonlinear curves distribute the time gates throughout the journey. */
const pacing = freeze({ finalXpCenti: 3_000_000, finalCredits: 365, finalRealDays: 365,
  xpExponent: 1.75, creditExponent: 1.4, dayExponent: 1.8 });
export const LEGACY_JOURNEY_LEVELS: readonly JourneyLevel[] = freeze(Array.from({ length: PRACTICE_CREDIT_RULES.maximumLevel }, (_, index) => {
  const ratio = index / (PRACTICE_CREDIT_RULES.maximumLevel - 1);
  return { number: index + 1, category: JOURNEY_CATEGORIES[Math.floor(index / 5)]!, categoryStep: index % 5 + 1,
    xpCenti: Math.round(pacing.finalXpCenti * ratio ** pacing.xpExponent),
    credits: Math.ceil(pacing.finalCredits * ratio ** pacing.creditExponent),
    realDays: Math.ceil(pacing.finalRealDays * ratio ** pacing.dayExponent),
    elapsedDays: index === PRACTICE_CREDIT_RULES.maximumLevel - 1 ? PRACTICE_CREDIT_RULES.finalElapsedDays : 0 };
}));

/** V3 changes levels only. Released Ripple rewards and V2 thresholds stay frozen. */
export const JOURNEY_PACING = freeze({ firstXpCenti: 12_000, linearXpCenti: 1_400_000,
  curvedXpCenti: 1_588_000, exponent: 1.75 });
export const JOURNEY_LEVELS: readonly JourneyLevel[] = freeze(LEGACY_JOURNEY_LEVELS.map((level, index) => {
  const ratio = index / (PRACTICE_CREDIT_RULES.maximumLevel - 1);
  return { ...level, xpCenti: Math.round(JOURNEY_PACING.firstXpCenti + JOURNEY_PACING.linearXpCenti * ratio +
    JOURNEY_PACING.curvedXpCenti * ratio ** JOURNEY_PACING.exponent) };
}));
/**
 * Current habit levels follow effective Ripples alone. Owner, 2026-10-17 (with the V7 rewards): levels
 * 1–49 keep their thresholds; from Level 50 each level costs progressively more (the demanding part),
 * and the same curve continues to 125 (owner, later the same day: every level a little more than the
 * last). Level 125 no longer has a one-year calendar gate. Nobody had reached Level 50.
 */
export const HABIT_LEVEL_PACING = freeze({ firstXpCenti: 12_000, linearXpCenti: 1_400_000, curvedXpCenti: 2_688_000, exponent: 1.75,
  steepFromLevel: 50, steepToLevel: 100, steepXpCenti: 9_297_500 });
const gentleHabitXp = (index: number) => {
  const ratio = index / (PRACTICE_CREDIT_RULES.maximumLevel - 1);
  return Math.round(HABIT_LEVEL_PACING.firstXpCenti + HABIT_LEVEL_PACING.linearXpCenti * ratio +
    HABIT_LEVEL_PACING.curvedXpCenti * ratio ** HABIT_LEVEL_PACING.exponent);
};
const habitXp: readonly number[] = (() => {
  const { steepFromLevel: from, steepToLevel: to, steepXpCenti } = HABIT_LEVEL_PACING;
  const xp = Array.from({ length: from - 1 }, (_, index) => gentleHabitXp(index));
  const last = xp[from - 2]!, step = last - xp[from - 3]!;
  // The same curve continues past Level 100, so every level to 125 costs a little more than the last.
  for (let level = from; level <= PRACTICE_CREDIT_RULES.maximumLevel; level++) {
    const climb = (level - from + 1) / (to - from + 1);
    xp.push(Math.round(last + step * (level - from + 1) + steepXpCenti * climb ** 2));
  }
  return xp;
})();
/**
 * Current stages (owner, 2026-10-17: "it must be round numbers"): Level 0 begins the first stage and a
 * new stage begins at every multiple of five (5, 10 … 120); the last stage also holds Level 125.
 * Category IDs are unchanged; only which levels belong to them. Released journey versions keep theirs.
 */
export function habitStageIndex(level: number) {
  return Math.min(JOURNEY_CATEGORIES.length - 1, Math.floor(Math.max(0, level) / 5));
}
export const HABIT_LEVELS: readonly JourneyLevel[] = freeze(JOURNEY_LEVELS.map((level, index) => {
  const stage = habitStageIndex(level.number);
  return { ...level, category: JOURNEY_CATEGORIES[stage]!, categoryStep: Math.min(5, level.number - stage * 5 + 1),
    xpCenti: habitXp[index]!, credits: 1, realDays: 1, elapsedDays: 0 };
}));

/** Starting state outside the numbered table; stable 1–125 identities and categories remain unchanged. */
export const JOURNEY_PRELUDE: JourneyLevel = freeze({ number: 0, category: JOURNEY_CATEGORIES[0]!, categoryStep: 0,
  xpCenti: 0, credits: 0, realDays: 0, elapsedDays: 0 });

export interface JourneyMetrics {
  readonly effectiveXpCenti?: number;
  readonly lifetimeXpCenti: number; readonly credits: number; readonly realDays: number;
  readonly firstPracticeAt: number | null; readonly asOf: number;
}
export interface JourneyAchievement { readonly version: string; readonly level: number; readonly achievedAt: number }
/** Legacy mode exists only to validate already-stored summaries made before the Level 0 prelude. */
export interface JourneyProjectionOptions { readonly legacyLevelOneStart?: boolean; readonly version?: string }
export function practiceCreditOutcome(session: MeditationSession, creditsAdded: number, dateCredits: number) {
  validateSession(session);
  assertNonnegativeInteger(creditsAdded, 'creditsAdded'); assertNonnegativeInteger(dateCredits, 'dateCredits');
  if (creditsAdded > 1 || dateCredits > PRACTICE_CREDIT_RULES.maximumCreditsPerDate || creditsAdded > dateCredits) throw new RangeError('Invalid credit event');
  if (session.status !== 'completed' || session.activeDurationSeconds < PRACTICE_CREDIT_RULES.minimumActiveSeconds) {
    if (creditsAdded !== 0) throw new RangeError('An ineligible session cannot add credit');
    return session.status !== 'completed' ? 'not_completed' : 'too_short';
  }
  if (creditsAdded === 1) return dateCredits === 2 ? 'double_day' : 'ordinary';
  if (dateCredits === 2) return 'already_capped';
  if (dateCredits === 1) return 'already_credited';
  throw new RangeError('A qualifying saved session must have date credit');
}
export function practiceCredits(sessions: readonly MeditationSession[]) {
  const unique = new Map<string, MeditationSession>();
  for (const session of sessions) {
    validateSession(session);
    const previous = unique.get(session.id);
    if (previous && !sameSession(previous, session)) throw new Error('Conflicting credit session ID');
    unique.set(session.id, session);
  }
  const byDate = new Map<string, MeditationSession[]>();
  let firstPracticeAt: number | null = null;
  for (const session of unique.values()) {
    if (session.status !== 'completed' || session.activeDurationSeconds < PRACTICE_CREDIT_RULES.minimumActiveSeconds) continue;
    byDate.set(session.localDate, [...(byDate.get(session.localDate) ?? []), session]);
    firstPracticeAt = Math.min(firstPracticeAt ?? session.endedAt, session.endedAt);
  }
  const dates = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([localDate, entries]) => {
    let earliestEnd = Infinity;
    let double = false;
    for (const session of entries.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))) {
      if (session.startedAt - earliestEnd >= PRACTICE_CREDIT_RULES.doubleGapMilliseconds) double = true;
      earliestEnd = Math.min(earliestEnd, session.endedAt);
    }
    return { localDate, credits: double ? 2 : 1 };
  });
  return freeze({ dates, credits: dates.reduce((n, day) => safeAdd(n, day.credits), 0), realDays: dates.length, firstPracticeAt });
}
function remaining(metrics: JourneyMetrics, level: JourneyLevel, legacyLevelOneStart = false) {
  const elapsed = metrics.firstPracticeAt === null ? 0 : Math.max(0, (metrics.asOf - metrics.firstPracticeAt) / PRACTICE_CREDIT_RULES.millisecondsPerDay);
  const preludeGate = level.number === 1 && !legacyLevelOneStart;
  return { xpCenti: Math.max(0, level.xpCenti - (metrics.effectiveXpCenti ?? metrics.lifetimeXpCenti)),
    credits: Math.max(0, (preludeGate ? 1 : level.credits) - metrics.credits),
    realDays: Math.max(preludeGate && metrics.firstPracticeAt === null ? 1 : 0,
      (preludeGate ? 1 : level.realDays) - metrics.realDays), elapsedDays: Math.max(0, level.elapsedDays - elapsed) };
}
export function getLifetimeJourney(metrics: JourneyMetrics, highest: JourneyAchievement | null = null, options: JourneyProjectionOptions = {}) {
  for (const name of ['lifetimeXpCenti', 'credits', 'realDays', 'asOf'] as const) assertNonnegativeInteger(metrics[name], name);
  if (metrics.effectiveXpCenti !== undefined) assertNonnegativeInteger(metrics.effectiveXpCenti, 'effectiveXpCenti');
  if (metrics.firstPracticeAt !== null) assertNonnegativeInteger(metrics.firstPracticeAt, 'firstPracticeAt');
  if (metrics.firstPracticeAt !== null && metrics.firstPracticeAt > metrics.asOf) throw new RangeError('Practice is in the future');
  const legacyLevelOneStart = options.legacyLevelOneStart === true;
  const version = options.version ?? JOURNEY_VERSION;
  if (![JOURNEY_VERSION, LEGACY_JOURNEY_VERSION, HABIT_JOURNEY_VERSION].includes(version)) throw new RangeError('Unsupported journey version');
  const levels = version === HABIT_JOURNEY_VERSION ? HABIT_LEVELS : version === LEGACY_JOURNEY_VERSION ? LEGACY_JOURNEY_LEVELS : JOURNEY_LEVELS;
  let level = legacyLevelOneStart ? levels[0]! : JOURNEY_PRELUDE;
  for (const candidate of levels) {
    if (Object.values(remaining(metrics, candidate, legacyLevelOneStart)).some((n) => n > 0)) break;
    level = candidate;
  }
  if (highest) {
    if (![JOURNEY_VERSION, LEGACY_JOURNEY_VERSION, HABIT_JOURNEY_VERSION].includes(highest.version) || !Number.isSafeInteger(highest.level) || highest.level < 0 || highest.level > 125 ||
      !Number.isSafeInteger(highest.achievedAt) || highest.achievedAt < 0 || highest.achievedAt > metrics.asOf) throw new RangeError('Invalid journey achievement');
    const retainedLevel = Math.max(level.number, highest.level);
    level = retainedLevel === 0 ? JOURNEY_PRELUDE : levels[retainedLevel - 1]!;
  }
  const next = levels[level.number] ?? null;
  const missing = next ? remaining(metrics, next, legacyLevelOneStart) : { xpCenti: 0, credits: 0, realDays: 0, elapsedDays: 0 };
  const segment = (value: number, lower: number, upper: number) => upper <= lower ? 1 : Math.max(0, Math.min(1, (value - lower) / (upper - lower)));
  const elapsed = metrics.firstPracticeAt === null ? 0 : (metrics.asOf - metrics.firstPracticeAt) / PRACTICE_CREDIT_RULES.millisecondsPerDay;
  const enteringJourney = next?.number === 1 && !legacyLevelOneStart;
  const fraction = next ? version === HABIT_JOURNEY_VERSION ? segment(metrics.effectiveXpCenti ?? metrics.lifetimeXpCenti, level.xpCenti, next.xpCenti) : Math.min(segment(metrics.effectiveXpCenti ?? metrics.lifetimeXpCenti, level.xpCenti, next.xpCenti),
    segment(metrics.credits, level.credits, enteringJourney ? 1 : next.credits),
    metrics.firstPracticeAt === null && enteringJourney ? 0 : segment(metrics.realDays, level.realDays, enteringJourney ? 1 : next.realDays),
    next.elapsedDays > 0 ? segment(elapsed, level.elapsedDays, next.elapsedDays) : 1) : 1;
  return freeze({ version, level, next, missing, fraction, metrics: { ...metrics } });
}
export type LifetimeJourney = ReturnType<typeof getLifetimeJourney>;
export interface JourneyProgressSegment { readonly level: number; readonly from: number; readonly to: number }
export interface JourneyProgressTransition {
  readonly version: string; readonly beforeLevel: number; readonly afterLevel: number;
  readonly segments: readonly JourneyProgressSegment[];
}
/** A cosmetic plan from actual projections. Running it never mutates progression. */
export function getJourneyProgressTransition(before: LifetimeJourney, after: LifetimeJourney): JourneyProgressTransition {
  if (before.version !== after.version || after.level.number < before.level.number) throw new RangeError('Invalid journey transition');
  const segments: JourneyProgressSegment[] = [];
  for (let level = before.level.number; level <= after.level.number; level++) {
    segments.push({ level, from: level === before.level.number ? before.fraction : 0,
      to: level === after.level.number ? after.fraction : 1 });
  }
  return freeze({ version: after.version, beforeLevel: before.level.number, afterLevel: after.level.number, segments });
}
export function getJourneyFromState(state: ProgressionState, highest: JourneyAchievement | null = null, options: JourneyProjectionOptions = {}) {
  const credit = practiceCredits(state.sessions.map((entry) => entry.session));
  return getLifetimeJourney({ lifetimeXpCenti: state.lifetimeXpCenti, credits: credit.credits, realDays: credit.realDays,
    firstPracticeAt: credit.firstPracticeAt, asOf: state.asOf.timestamp }, highest, options);
}
export function journeyLabel(level: JourneyLevel): string {
  if (level.number === 0) return `Level 0 · ${level.category.name}`;
  return `Level ${level.number} · ${level.category.name} · ${level.categoryStep} of 5`;
}
