import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { JourneyLevel } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { getLevelCategoryPresentation } from './category-presentation';
import { coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { useReducedMotion } from './reduced-motion';

/** Stage (five-level category) of a level; Level 0 shares Monkey Mind with Levels 1–5. */
export const stageOf = (level: number) => Math.max(1, Math.ceil(level / 5));
/** True when a practice carried the journey into a stage it had not reached before. */
export const reachesNewStage = (before: number | undefined, after: number | undefined, highestBefore: number) =>
  before !== undefined && after !== undefined && stageOf(after) > stageOf(Math.max(before, highestBefore));

/**
 * The first sight of a new stage: its symbol draws in, then its name. Shown once, after the level
 * animation has finished, so the name is never glimpsed early.
 */
export function StageReveal({ level, scale }: { level: JourneyLevel; scale: number }) {
  const reduced = useReducedMotion();
  const symbol = useSharedValue(reduced ? 1 : 0), words = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { symbol.set(1); words.set(1); return; }
    const ease = Easing.bezier(0.22, 0.61, 0.36, 1);
    symbol.set(withTiming(1, { duration: 900, easing: ease, reduceMotion: ReduceMotion.Never }));
    words.set(withDelay(500, withTiming(1, { duration: 700, easing: ease, reduceMotion: ReduceMotion.Never })));
    return () => { cancelAnimation(symbol); cancelAnimation(words); };
  }, [reduced, symbol, words]);
  const symbolStyle = useAnimatedStyle(() => ({ opacity: symbol.value, transform: [{ scale: 0.82 + 0.18 * symbol.value }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: 6 * (1 - words.value) }] }));
  const presentation = getLevelCategoryPresentation(level);
  return <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`A new stage: ${presentation.name}. ${presentation.theme}`}
    style={{ alignItems: 'center', paddingTop: 14 * scale, gap: 4 * scale }}>
    <Animated.View style={[symbolStyle, { width: 104 * scale, height: 104 * scale, borderRadius: 52 * scale, borderWidth: 1, borderColor: '#D8CEBC',
      alignItems: 'center', justifyContent: 'center', marginBottom: 6 * scale }]}>
      <CategoryIcon category={level.category} level={level.number} size={84 * scale} />
    </Animated.View>
    <Animated.View style={[wordsStyle, { alignItems: 'center', gap: 2 * scale }]}>
      <Text style={{ fontFamily: 'ManropeRegular', fontSize: 10 * scale, lineHeight: 16 * scale, letterSpacing: 2 * scale, color: coastalQuiet }}>A NEW STAGE</Text>
      <Text style={{ fontFamily: coastalSerif, fontSize: 24 * scale, lineHeight: 30 * scale, color: coastalInk, textAlign: 'center' }}>{presentation.name}</Text>
      <Text style={{ fontFamily: 'ManropeRegular', fontSize: 12 * scale, lineHeight: 18 * scale, color: coastalQuiet, textAlign: 'center' }}>{presentation.theme}</Text>
    </Animated.View>
  </View>;
}
