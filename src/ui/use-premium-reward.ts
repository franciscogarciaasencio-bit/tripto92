import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { HabitRewardReceipt, LifetimeJourney } from '@/domain/progression';
import { canAnimateReward, rewardSteps, playRewardSteps, REWARD_MOTION, type RewardStage } from './reward-sequence';
import { useMotionPreference } from './reduced-motion';
import { useForeground } from './use-foreground';
import { UI_MOTION } from './motion';

/** CompletionContent is keyed by session ID; its immutable receipt/endpoints are captured once. */
export function usePremiumReward(savedReceipt: HabitRewardReceipt | null, journey: LifetimeJourney, active: boolean, finalConsistency: number,
  finalIndicator: number, savedIndicator: { readonly before: number; readonly after: number }) {
  const [source] = useState(() => ({ receipt: savedReceipt, indicator: { ...savedIndicator } }));
  const { receipt, indicator } = source;
  const motion = useMotionPreference(), reduced = motion !== false, foreground = useForeground();
  const applicable = canAnimateReward(receipt, journey, finalConsistency, finalIndicator, indicator.after);
  const first = applicable && motion !== true ? receipt?.baseProgress.segments[0] : undefined;
  const fill = useSharedValue(first?.from ?? journey.fraction), consistency = useSharedValue(first ? indicator.before : finalIndicator);
  const levelOpacity = useSharedValue(1), levelHighlight = useSharedValue(0), consistencyHighlight = useSharedValue(0), bonusOpacity = useSharedValue(first ? 0 : 1);
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
      finished.current = true; fill.set(journey.fraction); consistency.set(finalIndicator); levelOpacity.set(1); bonusOpacity.set(1);
      pendingLevelCommit.current = null;
      const duration = active && foreground && !reduced && AppState.currentState === 'active' ? 300 : 0;
      levelHighlight.set(withTiming(0, { duration }));
      consistencyHighlight.set(withTiming(0, { duration }));
      if (!disposed) { setLevel(journey.level.number); setStage('done'); }
    };
    const lifecycle = AppState.addEventListener('change', (state) => {
      if (state === 'active' || !started.current) return;
      cancelSequence();
      for (const value of [fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, bonusOpacity]) cancelAnimation(value);
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
        if (step.stage === 'bonus') bonusOpacity.set(withTiming(1, { duration: REWARD_MOTION.revealMilliseconds }));
        if (step.stage === 'consistency') {
          if (step.duration) consistencyHighlight.set(withTiming(1, { duration: 180 }));
          animate(consistency, step.to, step.duration, () => {
            consistencyHighlight.set(withTiming(0, { duration: 400 })); next();
          });
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
      for (const value of [fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, bonusOpacity]) cancelAnimation(value);
    };
  }, [receipt, applicable, journey.fraction, journey.level.number, active, foreground, reduced, motion, finalIndicator, indicator,
    fill, consistency, levelOpacity, levelHighlight, consistencyHighlight, bonusOpacity]);
  const levelStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const levelContainerStyle = useAnimatedStyle(() => ({ opacity: levelOpacity.value }));
  const levelGlow = useAnimatedStyle(() => ({ backgroundColor: `rgba(163,139,99,${levelHighlight.value * .16})` }));
  const consistencyGlow = useAnimatedStyle(() => ({ backgroundColor: `rgba(163,139,99,${consistencyHighlight.value * .16})` }));
  const bonusStyle = useAnimatedStyle(() => ({ opacity: bonusOpacity.value }));
  const baseEarningsStyle = useAnimatedStyle(() => ({ opacity: 1 - bonusOpacity.value }));
  return { level, stage, levelStyle, levelContainerStyle, consistencyProgress: consistency,
    levelGlow, consistencyGlow, bonusStyle, baseEarningsStyle };
}
