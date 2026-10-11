import { sameSession, validateSession, type MeditationSession } from '../meditation/session';
import { assertNonnegativeInteger, freeze, safeAdd } from './numeric';
import type { ProgressionState } from './types';

export const JOURNEY_VERSION = 'ona_journey_v2';
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
export const JOURNEY_LEVELS: readonly JourneyLevel[] = freeze(Array.from({ length: PRACTICE_CREDIT_RULES.maximumLevel }, (_, index) => {
  const ratio = index / (PRACTICE_CREDIT_RULES.maximumLevel - 1);
  return { number: index + 1, category: JOURNEY_CATEGORIES[Math.floor(index / 5)]!, categoryStep: index % 5 + 1,
    xpCenti: Math.round(pacing.finalXpCenti * ratio ** pacing.xpExponent),
    credits: Math.ceil(pacing.finalCredits * ratio ** pacing.creditExponent),
    realDays: Math.ceil(pacing.finalRealDays * ratio ** pacing.dayExponent),
    elapsedDays: index === PRACTICE_CREDIT_RULES.maximumLevel - 1 ? PRACTICE_CREDIT_RULES.finalElapsedDays : 0 };
}));

export interface JourneyMetrics {
  readonly lifetimeXpCenti: number; readonly credits: number; readonly realDays: number;
  readonly firstPracticeAt: number | null; readonly asOf: number;
}
export interface JourneyAchievement { readonly version: string; readonly level: number; readonly achievedAt: number }
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
function remaining(metrics: JourneyMetrics, level: JourneyLevel) {
  const elapsed = metrics.firstPracticeAt === null ? 0 : Math.max(0, (metrics.asOf - metrics.firstPracticeAt) / PRACTICE_CREDIT_RULES.millisecondsPerDay);
  return { xpCenti: Math.max(0, level.xpCenti - metrics.lifetimeXpCenti), credits: Math.max(0, level.credits - metrics.credits),
    realDays: Math.max(0, level.realDays - metrics.realDays), elapsedDays: Math.max(0, level.elapsedDays - elapsed) };
}
export function getLifetimeJourney(metrics: JourneyMetrics, highest: JourneyAchievement | null = null) {
  for (const name of ['lifetimeXpCenti', 'credits', 'realDays', 'asOf'] as const) assertNonnegativeInteger(metrics[name], name);
  if (metrics.firstPracticeAt !== null) assertNonnegativeInteger(metrics.firstPracticeAt, 'firstPracticeAt');
  if (metrics.firstPracticeAt !== null && metrics.firstPracticeAt > metrics.asOf) throw new RangeError('Practice is in the future');
  let level = JOURNEY_LEVELS[0]!;
  for (const candidate of JOURNEY_LEVELS) {
    if (Object.values(remaining(metrics, candidate)).some((n) => n > 0)) break;
    level = candidate;
  }
  if (highest) {
    if (highest.version !== JOURNEY_VERSION || !Number.isSafeInteger(highest.level) || highest.level < 1 || highest.level > 125 ||
      !Number.isSafeInteger(highest.achievedAt) || highest.achievedAt < 0 || highest.achievedAt > metrics.asOf) throw new RangeError('Invalid journey achievement');
    level = JOURNEY_LEVELS[Math.max(level.number, highest.level) - 1]!;
  }
  const next = JOURNEY_LEVELS[level.number] ?? null;
  const missing = next ? remaining(metrics, next) : { xpCenti: 0, credits: 0, realDays: 0, elapsedDays: 0 };
  const segment = (value: number, lower: number, upper: number) => upper <= lower ? 1 : Math.max(0, Math.min(1, (value - lower) / (upper - lower)));
  const elapsed = metrics.firstPracticeAt === null ? 0 : (metrics.asOf - metrics.firstPracticeAt) / PRACTICE_CREDIT_RULES.millisecondsPerDay;
  const fraction = next ? Math.min(segment(metrics.lifetimeXpCenti, level.xpCenti, next.xpCenti),
    segment(metrics.credits, level.credits, next.credits), segment(metrics.realDays, level.realDays, next.realDays),
    next.elapsedDays > 0 ? segment(elapsed, level.elapsedDays, next.elapsedDays) : 1) : 1;
  return freeze({ version: JOURNEY_VERSION, level, next, missing, fraction, metrics: { ...metrics } });
}
export type LifetimeJourney = ReturnType<typeof getLifetimeJourney>;
export function getJourneyFromState(state: ProgressionState, highest: JourneyAchievement | null = null) {
  const credit = practiceCredits(state.sessions.map((entry) => entry.session));
  return getLifetimeJourney({ lifetimeXpCenti: state.lifetimeXpCenti, credits: credit.credits, realDays: credit.realDays,
    firstPracticeAt: credit.firstPracticeAt, asOf: state.asOf.timestamp }, highest);
}
export function journeyLabel(level: JourneyLevel): string {
  return `Level ${level.number} · ${level.category.name} · ${level.categoryStep} of 5`;
}
