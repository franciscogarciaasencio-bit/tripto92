import type { HabitRewardReceipt, JourneyProgressSegment, LifetimeJourney } from '../domain/progression';
export type RewardStage = 'base' | 'consistency' | 'bonus' | 'done';
export interface RewardStep {
  readonly stage: RewardStage; readonly level: number; readonly from: number; readonly to: number;
  readonly duration: number; readonly crossingDuration: number;
}
/**
 * About twice the earlier pace (owner, 2026-10-17: the Ripples and level-up animations felt "way too fast…
 * rushed"): each fill can be followed by eye, with a short rest between the practice, Consistency and bonus.
 */
export const REWARD_MOTION = { minimumFillMilliseconds: 1000, distanceFillMilliseconds: 1700,
  consistencyMilliseconds: 2200, crossingMilliseconds: 360, revealMilliseconds: 600, stageBudgetMilliseconds: 6500,
  restMilliseconds: 450 } as const;
/** A historical receipt can animate only when its endpoints still describe the current display. */
export function canAnimateReward(receipt: HabitRewardReceipt | null, journey: LifetimeJourney,
  consistency: number, finalIndicator: number, indicatorAfter: number): boolean {
  const last = receipt?.bonusProgress.segments.at(-1);
  return !!receipt && !!last && receipt.baseProgress.version === journey.version && receipt.bonusProgress.version === journey.version
    && receipt.bonusProgress.afterLevel === journey.level.number && last.level === journey.level.number && Math.abs(last.to - journey.fraction) < 1e-8
    && Math.abs(receipt.consistencyAfter - consistency) < 1e-8 && Math.abs(indicatorAfter - finalIndicator) < 1e-8;
}
/** Presentation plan only. The controller consumes animation completions, never guessed wall-clock delays. */
export function rewardSteps(receipt: HabitRewardReceipt, indicator: { readonly before: number; readonly after: number } = {
  before: receipt.consistencyBefore, after: receipt.consistencyAfter,
}): readonly RewardStep[] {
  const levelSteps = (stage: 'base' | 'bonus', segments: readonly JourneyProgressSegment[]) => {
    const raw = segments.map((segment, index) => ({ stage, ...segment,
      duration: segment.from === segment.to ? 0 : Math.round(REWARD_MOTION.minimumFillMilliseconds +
        REWARD_MOTION.distanceFillMilliseconds * Math.sqrt(Math.abs(segment.to - segment.from))),
      crossingDuration: index > 0 && segments[index - 1]?.level !== segment.level ? REWARD_MOTION.crossingMilliseconds : 0 }));
    // Bound unusual multi-level receipts without skipping levels or inventing progress.
    const total = raw.reduce((sum, step) => sum + step.duration + 2 * step.crossingDuration, 0);
    const pace = Math.min(1, REWARD_MOTION.stageBudgetMilliseconds / (total || 1));
    return raw.map(step => ({ ...step, duration: Math.floor(step.duration * pace), crossingDuration: Math.floor(step.crossingDuration * pace) }));
  };
  return [...levelSteps('base', receipt.baseProgress.segments),
    { stage: 'consistency', level: receipt.baseProgress.afterLevel, from: indicator.before, to: indicator.after,
      duration: indicator.before === indicator.after ? 0 : REWARD_MOTION.consistencyMilliseconds, crossingDuration: 0 },
    ...levelSteps('bonus', receipt.bonusProgress.segments)];
}
/** Tiny cancellation boundary, independently testable without React/Reanimated. */
export function playRewardSteps(steps: readonly RewardStep[], animate: (step: RewardStep, complete: () => void) => void, done: () => void) {
  let cancelled = false, position = 0;
  const next = () => {
    if (cancelled) return;
    const step = steps[position++];
    if (step) { let delivered = false; animate(step, () => { if (!delivered) { delivered = true; next(); } }); }
    else done();
  };
  next();
  return () => { cancelled = true; };
}
