import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { HabitRewardReceipt, LifetimeJourney } from '@/domain/progression';
import { canAnimateReward, rewardSteps, playRewardSteps, type RewardStage } from './reward-sequence';
import { useMotionPreference } from './reduced-motion';
import { useForeground } from './use-foreground';
import { UI_MOTION } from './motion';
import { consistencyRounds, CONSISTENCY_STEPS } from './consistency-rounds';

/** A completed Consistency round (owner, 2026-10-17): hold the full bar, light the new small bar, empty gently. */
export const ROUND_MOTION = { hold: 380, flourishIn: 320, flourishOut: 700, drain: 560, refill: 520 } as const;

/** CompletionContent is keyed by session ID; its immutable receipt/endpoints are captured once. */
export function usePremiumReward(savedReceipt: HabitRewardReceipt | null, journey: LifetimeJourney, active: boolean, finalConsistency: number,
  finalIndicator: number, savedIndicator: { readonly before: number; readonly after: number }) {
  const [source] = useState(() => ({ receipt: savedReceipt, indicator: { ...savedIndicator } }));
  const { receipt, indicator } = source;
  const motion = useMotionPreference(), reduced = motion !== false, foreground = useForeground();
  const applicable = canAnimateReward(receipt, journey, finalConsistency, finalIndicator, indicator.after);
  const first = applicable && motion !== true ? receipt?.baseProgress.segments[0] : undefined;
  const fill = useSharedValue(first?.from ?? journey.fraction), consistency = useSharedValue(first ? indicator.before : finalIndicator);
  // drain ≥ 0 overrides the big bar while a completed round empties; flourish lights its new small bar.
  const drain = useSharedValue(-1), flourish = useSharedValue(0);
  const levelOpacity = useSharedValue(1), levelHighlight = useSharedValue(0), consistencyHighlight = useSharedValue(0);
  const [stage, setStage] = useState<RewardStage>(first ? 'base' : 'done'), [level, setLevel] = useState(first?.level ?? journey.level.number);
  const started = useRef(false), finished = useRef(!first);
  const renderedLevel = useRef(level), pendingLevelCommit = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    renderedLevel.current = level;
    const reveal = pendingLevelCommit.current;
    pendingLevelCommit.current = null;
    reveal?.();
  }, [level]);
  useEffect(() => {
    let disposed = false, cancelSequence = () => {};
    const animate = (value: typeof fill, to: number, duration: number, complete: () => void) => {
      if (disposed || finished.current) return;
      if (duration === 0) { value.set(to); complete(); return; }
      // A successful native callback may already be queued when cleanup cancels its sequence.
      const deliver = () => { if (!disposed && !finished.current) complete(); };
      value.set(withTiming(to, { duration, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never },
        (completed) => { if (completed) scheduleOnRN(deliver); }));
    };
    const settle = () => {
      finished.current = true; fill.set(journey.fraction); consistency.set(finalIndicator); drain.set(-1); flourish.set(0); levelOpacity.set(1);
      pendingLevelCommit.current = null;
      const duration = active && foreground && !reduced && AppState.currentState === 'active' ? 300 : 0;
      levelHighlight.set(withTiming(0, { duration }));
      consistencyHighlight.set(withTiming(0, { duration }));
      if (!disposed) { setLevel(journey.level.number); setStage('done'); }
    };
    const lifecycle = AppState.addEventListener('change', (state) => {
      if (state === 'active' || !started.current) return;
      cancelSequence();
      for (const value of [fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, drain, flourish]) cancelAnimation(value);
      settle();
    });
    // Defer orchestration until the route/accessibility preference has resolved.
    const launch = setTimeout(() => {
      if (disposed) return;
      if (motion === null) return;
      if (!receipt || !applicable || reduced || finished.current || started.current) { settle(); return; }
      if (!active || !foreground) return;
      started.current = true;
      cancelSequence = playRewardSteps(rewardSteps(receipt, indicator), (step, complete) => {
        if (disposed) return;
        const next = () => { if (!disposed) complete(); };
        setStage(step.stage);
        if (step.stage === 'consistency') {
          if (step.duration) consistencyHighlight.set(withTiming(1, { duration: 180 }));
          const finishStep = () => { consistencyHighlight.set(withTiming(0, { duration: 400 })); next(); };
          const before = consistencyRounds(step.from).completed, after = consistencyRounds(step.to).completed;
          if (!step.duration || after <= before || step.to < step.from) { animate(consistency, step.to, step.duration, finishStep); return; }
          // Fill to the brim, keep the round, light its small bar, empty the big bar softly, then refill.
          const boundary = (before + 1) / CONSISTENCY_STEPS;
          const share = (boundary - step.from) / Math.max(1e-9, step.to - step.from);
          animate(consistency, boundary - 1e-6, Math.max(420, Math.round(step.duration * share)), () => {
            drain.set(1); consistency.set(boundary);
            flourish.set(withSequence(withTiming(1, { duration: ROUND_MOTION.flourishIn, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
              withDelay(ROUND_MOTION.hold, withTiming(0, { duration: ROUND_MOTION.flourishOut, reduceMotion: ReduceMotion.Never }))));
            drain.set(withDelay(ROUND_MOTION.flourishIn + ROUND_MOTION.hold, withTiming(0, { duration: ROUND_MOTION.drain,
              easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never }, (done) => { if (done) scheduleOnRN(refill); })));
          });
          const refill = () => {
            if (disposed || finished.current) return;
            drain.set(-1);
            animate(consistency, step.to, step.to > boundary ? ROUND_MOTION.refill : 0, finishStep);
          };
        } else {
          const fillLevel = () => {
            if (disposed) return;
            fill.set(step.from);
            if (step.duration) levelHighlight.set(withTiming(1, { duration: 180 }));
            animate(fill, step.to, step.duration, () => { levelHighlight.set(withTiming(0, { duration: 400 })); next(); });
          };
          if (renderedLevel.current !== step.level) {
            animate(levelOpacity, 0, step.crossingDuration, () => {
              // Wait for React to commit the new label while the complete group is hidden.
              pendingLevelCommit.current = () => {
                if (disposed) return;
                fill.set(step.from);
                animate(levelOpacity, 1, step.crossingDuration, fillLevel);
              };
              setLevel(step.level);
            });
          } else fillLevel();
        }
      }, settle);
    }, active && foreground && !reduced ? UI_MOTION.rewardHold : 0);
    return () => {
      disposed = true; clearTimeout(launch); cancelSequence(); lifecycle.remove();
      pendingLevelCommit.current = null;
      for (const value of [fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, drain, flourish]) cancelAnimation(value);
    };
  }, [receipt, applicable, journey.fraction, journey.level.number, active, foreground, reduced, motion, finalIndicator, indicator,
    fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, drain, flourish]);
  const levelStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const levelContainerStyle = useAnimatedStyle(() => ({ opacity: levelOpacity.value }));
  // Fixed decimals: a native color parser must never see exponent notation (1e-7) mid-animation.
  const levelGlow = useAnimatedStyle(() => ({ backgroundColor: `rgba(163,139,99,${Math.max(0, Math.min(1, levelHighlight.value * .16)).toFixed(4)})` }));
  const consistencyGlow = useAnimatedStyle(() => ({ backgroundColor: `rgba(163,139,99,${Math.max(0, Math.min(1, consistencyHighlight.value * .16)).toFixed(4)})` }));
  return { level, stage, levelStyle, levelContainerStyle, consistencyProgress: consistency, consistencyDrain: drain, consistencyFlourish: flourish,
    levelGlow, consistencyGlow };
}
