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

/** Released V4's millionth-based asymptotic growth. Its stored shape stays unchanged. */
export interface RemainingCapacityConsistency {
  readonly scale: number;
  readonly growthBasisPoints: number;
  readonly inactiveRetentionMillionths: number;
  readonly halfLifeDays: number;
}

/** Exact, equal contributions: sixty units of one million make the full score. */
export interface LinearContributionConsistency {
  readonly algorithm: 'linear_contributions_v1';
  readonly scale: number;
  readonly contributionUnits: number;
  readonly targetContributions: number;
  readonly inactiveRetentionMillionths: number;
  readonly halfLifeDays: number;
}
export type ConsistencyConfiguration = RemainingCapacityConsistency | LinearContributionConsistency;

/** Immutable prospective boundary. Old sessions are gates/history, never newly recalculated rewards. */
export interface ConsistencyActivation {
  readonly rulesVersion: string;
  /** Null only for a genuinely empty new state; otherwise the frozen source formula. */
  readonly previousRulesVersion: string | null;
  /** Absolute activation time with its monotonic logical calendar date. */
  readonly asOf: CalendarContext;
  readonly sessionCount: number;
  readonly awardCount: number;
  /** Fixed integer units in the activated configuration's scale. */
  readonly score: number;
}

export interface ProgressionRules {
  readonly version: string;
  readonly earningsAlgorithm: 'logarithmic_v1' | 'linear_short_logarithmic_v1';
  readonly decayAlgorithm: 'capped_daily_v1';
  readonly minimumActiveSeconds: number;
  /** V6+: practices shorter than this earn nothing at all (V3–V5 paid short runs linearly). */
  readonly minimumEarningSeconds?: number;
  /** Omitted in released V1: its historical qualification flags define practice days. */
  readonly practiceDayEligibility?: 'completed_minimum';
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
  readonly continuousConsistency?: ConsistencyConfiguration;
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
  readonly awardedBaseCentiXp?: CentiXp;
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
  readonly incrementalBaseCentiXp?: CentiXp;
  readonly bonusCentiXp?: CentiXp;
  readonly continuousConsistencyScore?: number;
  readonly continuousConsistencyDate?: LocalDate;
}

/** An append-only receipt. Reward-eligible events also receive a receipt when capped at zero XP. */
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
  /** Additive V5 continuation anchors. Absent in released V1–V4 checkpoints. */
  readonly consistencyActivations?: readonly ConsistencyActivation[];
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
    readonly fraction: number;
    /** V5: the same score used for bonuses. Released V1–V4 retain their independent display projection. */
    readonly indicatorFraction: number;
    readonly precedingActiveDays: number;
    readonly windowDays: number;
    readonly multiplier: number;
    readonly maximumMultiplier: number;
  };
  readonly inactivity: {
    readonly lastQualifyingDate: LocalDate | null;
    readonly completeInactiveDays: number;
    readonly graceDays: number;
  };
}
