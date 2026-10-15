import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PracticeCompletion } from '@/data';
import { JOURNEY_LEVELS, HABIT_LEVELS, HABIT_JOURNEY_VERSION, JOURNEY_PRELUDE, type LifetimeJourney, type ProgressSnapshot } from '@/domain/progression';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { HomeIcon } from './home-icons';
import { formatRipples } from './format-ripples';
import { formatTime, Notice } from './primitives';
import { useReducedMotion } from './reduced-motion';
import { usePremiumReward } from './use-premium-reward';
import { QuietPressable } from './quiet-pressable';
import { UI_MOTION } from './motion';
import { ConsistencyBar } from './consistency-bar';
import { getLevelCategoryPresentation } from './category-presentation';
import { reachesNewStage, StageReveal, stageOf } from './stage-reveal';

export function CompletionContent({ completion, journey, snapshot, scale, busy, error, onContinue, active }: {
  completion: PracticeCompletion; journey: LifetimeJourney; snapshot: ProgressSnapshot; scale: number;
  busy: boolean; error: string | null; onContinue: () => void; active: boolean;
}) {
  const receipt = completion.habitReward, reduced = useReducedMotion();
  const currentConsistency = snapshot.consistency.fraction;
  const indicator = snapshot.consistency.indicatorFraction;
  const motion = usePremiumReward(receipt, journey, active, currentConsistency, indicator, completion.consistencyIndicator);
  const reveal = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    reveal.set(withTiming(1, { duration: reduced ? 0 : UI_MOTION.completionEntrance, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(reveal);
  }, [reveal, reduced, active]);
  const entrance = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: (1 - reveal.value) * 6 }] }));
  const levels = journey.version === HABIT_JOURNEY_VERSION ? HABIT_LEVELS : JOURNEY_LEVELS;
  const displayLevel = motion.level === 0 ? JOURNEY_PRELUDE : levels[motion.level - 1]!;
  const next = levels[displayLevel.number] ?? null;
  const base = receipt?.baseCentiXp ?? completion.baseXpCenti;
  const total = receipt?.totalCentiXp ?? completion.awardedXpCenti;
  const showTotal = motion.stage === 'bonus' || motion.stage === 'done';
  const duration = formatTime(completion.session.activeDurationSeconds).padStart(5, '0');
  // Whole-number allocation keeps the displayed sum truthful; receipts retain exact centi-Ripples.
  const displayedBonus = Math.round(total / 100) - Math.round(base / 100);
  const beforeLevel = receipt?.baseProgress.beforeLevel, afterLevel = receipt?.bonusProgress.afterLevel;
  // A stage never reached before is revealed only after the level animation has settled.
  const newStage = reachesNewStage(beforeLevel, afterLevel, receipt?.beforeCheckpoint.highestLevel ?? 0);
  const veiled = newStage && motion.stage !== 'done' && stageOf(displayLevel.number) > stageOf(beforeLevel ?? 0);
  const panel = { backgroundColor: 'rgba(228,210,182,0.22)', borderRadius: 17 * scale };
  const earningsText = { fontFamily: coastalSerif, fontSize: 31 * scale, lineHeight: 42 * scale, color: coastalInk };
  const explanation = receipt?.explanation === 'short' ? 'Consistency grows with practices of at least 3 minutes.'
    : receipt?.explanation === 'too_close' || receipt?.explanation === 'daily_cap' ? 'A quiet return still matters.' : null;
  return <Animated.View style={[entrance, { width: '100%' }]}>
    <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, fontSize: 47 * scale, lineHeight: 55 * scale, textAlign: 'center', color: coastalInk }}>Well done.</Text>
    <Text style={{ fontFamily: 'ManropeRegular', fontSize: 16 * scale, lineHeight: 24 * scale, textAlign: 'center', color: coastalQuiet }}>A moment for yourself.</Text>
    <Text accessibilityLabel={'Active meditation duration: ' + duration} style={{ fontFamily: coastalSerif, fontVariant: ['tabular-nums'], fontSize: 40 * scale,
      lineHeight: 50 * scale, textAlign: 'center', color: coastalInk, marginTop: 12 * scale }}>{duration}</Text>
    <Text style={{ fontFamily: 'ManropeRegular', fontSize: 14 * scale, lineHeight: 21 * scale, textAlign: 'center', color: coastalQuiet }}>{completion.session.status === 'completed' ? 'Meditation completed' : 'Meditation saved'}</Text>
    <View style={[panel, { marginTop: 17 * scale, padding: 14 * scale }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 * scale }}>
        <HomeIcon name="wave" size={36 * scale} color={coastalInk} />
        <View accessible accessibilityLabel={`${formatRipples(showTotal ? total : base)} Ripples ${showTotal ? 'earned' : 'from practice'}`}>
          <Animated.Text accessible={false} aria-hidden importantForAccessibility="no"
            style={[earningsText, motion.bonusStyle]}>{`+${formatRipples(total)} Ripples`}</Animated.Text>
          <Animated.Text accessible={false} aria-hidden importantForAccessibility="no"
            style={[earningsText, motion.baseEarningsStyle, { position: 'absolute', alignSelf: 'center' }]}>{`+${formatRipples(base)} Ripples`}</Animated.Text>
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 20 * scale, textAlign: 'center', color: coastalQuiet }}>
        {showTotal ? 'Total earned' : motion.stage === 'consistency' && completion.consistencyIndicator.after > completion.consistencyIndicator.before ? 'Your Consistency grows' : 'From your practice'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 * scale, gap: 4 }}>
        <Text style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 18 * scale, color: coastalQuiet }}>{`Base · ${formatRipples(base)} Ripples`}</Text>
        {displayedBonus > 0 && <Animated.Text accessibilityElementsHidden={!showTotal} aria-hidden={!showTotal}
          importantForAccessibility={showTotal ? 'auto' : 'no-hide-descendants'}
          style={[motion.bonusStyle, { fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 18 * scale, color: coastalQuiet }]}>
          {`Consistency · +${displayedBonus} Ripples`}
        </Animated.Text>}
      </View>
      <View style={{ height: 1, backgroundColor: '#D8CEBC', marginVertical: 10 * scale }} />
      <Animated.View style={motion.levelContainerStyle}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 }}>
        <Text style={{ fontFamily: 'ManropeRegular', fontSize: 13 * scale, lineHeight: 19 * scale, color: coastalQuiet }}>
          <Text style={{ color: coastalInk }}>{`Level ${displayLevel.number}`}</Text>{veiled ? ' · A new stage' : ` · ${getLevelCategoryPresentation(displayLevel).name}`}
        </Text>
        <Text style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 19 * scale, color: coastalQuiet }}>{next ? `Toward Level ${next.number}` : 'Journey complete'}</Text>
      </View>
      <Animated.View style={[motion.levelGlow, { paddingVertical: 7 * scale, marginTop: 3 * scale, borderRadius: 8 }]}>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Level progress"
          accessibilityValue={{ min: 0, max: 100, now: Math.floor(journey.fraction * 100), text: `Saved Level ${journey.level.number}` }}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(journey.fraction * 100)} aria-valuetext={`Saved Level ${journey.level.number}`}
          style={{ height: 9 * scale, borderRadius: 8, overflow: 'hidden', backgroundColor: '#D8CBB6' }}>
          <Animated.View style={[motion.levelStyle, { height: '100%', borderRadius: 8, backgroundColor: '#1C231B' }]} />
        </View>
      </Animated.View>
      </Animated.View>
      <Text style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 17 * scale, color: coastalQuiet, marginTop: 3 * scale }}>
        {beforeLevel !== undefined && afterLevel !== undefined && afterLevel > beforeLevel ? `Level ${beforeLevel} → Level ${afterLevel}` : 'One return at a time.'}
      </Text>
      {newStage && motion.stage === 'done' && afterLevel !== undefined && <StageReveal level={levels[afterLevel - 1]!} scale={scale} />}
    </View>
    <View style={[panel, { padding: 14 * scale, marginTop: 12 * scale }]}>
      <Animated.View pointerEvents="none" style={[motion.consistencyGlow, { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 17 * scale }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 * scale }}><HomeIcon name="wave" size={20 * scale} color={coastalInk} />
        <Text style={{ fontFamily: 'ManropeRegular', fontSize: 13 * scale, lineHeight: 20 * scale, color: coastalInk }}>Consistency</Text>
      </View>
      <View style={{ marginTop: 8 * scale }}><ConsistencyBar fraction={indicator} progress={motion.consistencyProgress} scale={scale} label="Consistency progress" /></View>
      <Text style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 17 * scale, color: coastalQuiet, marginTop: 9 * scale }}>
        {explanation ?? 'A gentle rhythm of returning.'}
      </Text>
    </View>
    <Notice>{error ? 'Your practice is saved. Returning could not be confirmed. Please retry.' : null}</Notice>
    <QuietPressable accessibilityRole="button" accessibilityLabel={busy ? 'Returning' : 'Continue'} accessibilityState={{ disabled: busy }} disabled={busy}
      disabledOpacity={.65} pressedOpacity={.8} onPress={onContinue} style={{ minHeight: Math.max(56 * scale, 48), backgroundColor: '#1C211A', borderRadius: 28 * scale,
        alignItems: 'center', justifyContent: 'center', marginTop: 14 * scale }}>
      <Text style={{ fontFamily: 'ManropeMedium', fontSize: 17 * scale, lineHeight: 24 * scale, color: '#F7F0E3' }}>{busy ? 'Returning…' : 'Continue'}</Text>
    </QuietPressable>
  </Animated.View>;
}
