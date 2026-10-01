import type { MeditationSession } from '../meditation/session';
import type { CalendarContext, LocalDate } from './calendar';

/** Integer hundredths of XP, never minutes. All public boundaries validate numeric inputs. */
export type CentiXp = number;

export interface RankDefinition {
  readonly id: string;
  readonly name: string;
  readonly thresholdCentiXp: CentiXp;
  readonly theme: string;
}

export interface ProgressionRules {
  readonly version: string;
  readonly earningsAlgorithm: 'logarithmic_v1';
  readonly decayAlgorithm: 'capped_daily_v1';
  readonly minimumActiveSeconds: number;
  readonly duration: {
    readonly baseCentiXp: CentiXp;
    readonly referenceSeconds: number;
    readonly doublingCentiXp: CentiXp;
    readonly capSeconds: number;
  };
  readonly occasionSeparationSeconds: number;
  readonly occasionWeightsBasisPoints: readonly number[];
  readonly consistencyWindowDays: number;
  readonly maximumConsistencyBonusBasisPoints: number;
  readonly inactivityGraceDays: number;
  readonly dailyDecayBasisPoints: number;
  readonly dailyDecayCapCentiXp: CentiXp;
  readonly protectedFloorBasisPoints: number;
  readonly ranks: readonly RankDefinition[];
}

export interface RecordedSession {
  readonly session: MeditationSession;
  readonly qualified: boolean;
  readonly qualificationRulesVersion: string;
}

export interface PracticeOccasion {
  readonly id: string;
  readonly sessionIds: readonly string[];
  readonly startedAt: number;
  readonly endedAt: number;
  /** Reward day belongs to the first session, even when an extension crosses midnight. */
  readonly rewardDate: LocalDate;
  readonly activeDurationSeconds: number;
  readonly rulesVersion: string;
  readonly ordinalInDay: number;
  readonly weightBasisPoints: number;
  readonly precedingActiveDays: number;
  readonly awardedCentiXp: CentiXp;
}

export interface AwardBreakdown {
  readonly occasionActiveSeconds: number;
  readonly baseCentiXp: CentiXp;
  readonly weightBasisPoints: number;
  readonly precedingActiveDays: number;
  readonly consistencyNumerator: number;
  readonly consistencyDenominator: number;
  readonly previousOccasionCentiXp: CentiXp;
  readonly cumulativeOccasionCentiXp: CentiXp;
}

/** An append-only receipt. Zero-XP qualifying events also have receipts. */
export interface ProgressionAward {
  readonly id: string;
  readonly sessionId: string;
  readonly occasionId: string;
  readonly rulesVersion: string;
  readonly awardedAt: number;
  readonly localDate: LocalDate;
  readonly rewardDate: LocalDate;
  readonly xpCenti: CentiXp;
  readonly breakdown: AwardBreakdown;
}

export interface RankAchievement {
  readonly rank: RankDefinition;
  readonly rulesVersion: string;
  readonly achievedAt: number;
}

/** Serializable checkpoint + history. Write the returned state atomically in a future adapter. */
export interface ProgressionState {
  readonly schemaVersion: 1;
  readonly asOf: CalendarContext;
  readonly settledThroughDate: LocalDate;
  readonly activeRulesVersion: string;
  readonly ruleSets: readonly ProgressionRules[];
  readonly sessions: readonly RecordedSession[];
  readonly occasions: readonly PracticeOccasion[];
  readonly awards: readonly ProgressionAward[];
  readonly lifetimeXpCenti: CentiXp;
  readonly currentProgressionCenti: CentiXp;
  readonly totalMeditationSeconds: number;
  readonly highestRankAchieved: RankAchievement;
}

export interface ProgressSnapshot {
  readonly asOf: CalendarContext;
  readonly rulesVersion: string;
  readonly lifetimeXpCenti: CentiXp;
  readonly currentProgressionCenti: CentiXp;
  readonly currentRank: RankDefinition;
  readonly highestRankAchieved: RankAchievement;
  readonly progressToNextRank: {
    readonly nextRank: RankDefinition | null;
    readonly earnedCentiXp: CentiXp;
    readonly requiredCentiXp: CentiXp;
    readonly remainingCentiXp: CentiXp;
    readonly fraction: number;
  };
  readonly totalQualifyingPracticeDays: number;
  readonly totalMeditationSeconds: number;
  readonly totalMeditationMinutes: number;
  readonly consistency: {
    readonly precedingActiveDays: number;
    readonly windowDays: number;
    readonly multiplier: number;
  };
  readonly inactivity: {
    readonly lastQualifyingDate: LocalDate | null;
    readonly completeInactiveDays: number;
    readonly graceDays: number;
  };
}
