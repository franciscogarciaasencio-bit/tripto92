/** The intended entry point for app and persistence code. No framework or device dependencies. */
export { PROGRESSION_V1, PROGRESSION_V2, PROGRESSION_V3, PROGRESSION_V4, PROGRESSION_V5 } from './rules';
export { continuousConsistency, progressionConsistency, sessionConsistency, CONTINUOUS_CONSISTENCY,
  LINEAR_CONSISTENCY_V1, isLinearConsistency, validateConsistencyActivation } from './consistency';
export { getConsistencyIndicator, CONSISTENCY_INDICATOR_V1 } from './consistency-indicator';
export { HABIT_RULES, createHabitCheckpoint, validateHabit, advanceHabit, habitJourney, recordHabitReward, protectedHabitLevel } from './habit';
export type { HabitCheckpoint, HabitRewardReceipt } from './habit';
export { isRewardEligible } from './earnings';
export { createProgressionState, recordSession, advanceProgression, changeProgressionRules, appendability } from './state';
export type { Appendability } from './state';
export { getProgressSnapshot } from './snapshot';
export { CENTI_XP_PER_XP } from './numeric';
export type { CalendarContext, LocalDate } from './calendar';
export { forwardOnly, readingContext } from './calendar';
export { STREAK_RULES, practiceStreaks, qualifiesForStreak, streakMoment } from './streaks';
export type { PracticeStreaks, StreakCount, WeekStatus, MonthStatus, PeriodState, StreakMoment, StreakMomentKind } from './streaks';
export type { MeditationSession } from '../meditation/session';
export type {
  CentiXp, ProgressionRules, ProgressionState, ProgressionAward, ProgressSnapshot,
  RankDefinition, RankAchievement,
  ConsistencyConfiguration, ConsistencyActivation, LinearContributionConsistency,
} from './types';
export { ONA_LEVELS, LEVELS_VERSION, getLevelProgress } from './levels';
export type { LevelDefinition } from './levels';
export { JOURNEY_VERSION, LEGACY_JOURNEY_VERSION, LEGACY_JOURNEY_LEVELS, JOURNEY_PACING, JOURNEY_CATEGORIES, JOURNEY_LEVELS, JOURNEY_PRELUDE, PRACTICE_CREDIT_RULES,
  practiceCredits, practiceCreditOutcome, getLifetimeJourney, getJourneyFromState, getJourneyProgressTransition, journeyLabel } from './journey';
export type { JourneyProgressTransition, JourneyProgressSegment } from './journey';
export { HABIT_JOURNEY_VERSION, HABIT_LEVEL_PACING, HABIT_LEVELS } from './journey';
export type { JourneyLevel, JourneyCategory, JourneyMetrics, LifetimeJourney, JourneyAchievement, JourneyProjectionOptions } from './journey';
