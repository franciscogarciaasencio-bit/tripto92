import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import specification from '../../assets/ona/wave-spec.json';
import { colors } from './primitives';

const waveFor = (id: string) => specification.ranks.find((rank) => rank.id === id);
function coordinates(id: string) { return waveFor(id)?.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number); }
function path(points: readonly number[]) {
  return `M ${points.slice(0, 2).join(' ')} C ${points.slice(2, 8).join(' ')} C ${points.slice(8, 14).join(' ')} C ${points.slice(14).join(' ')}`;
}
export function Wave({ rankId, previousId, animate = false }: { rankId: string; previousId?: string; animate?: boolean }) {
  const [shape, setShape] = useState(waveFor(animate && previousId ? previousId : rankId)?.path ?? '');
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let disposed = false;
    const from = previousId ? coordinates(previousId) : null;
    const to = coordinates(rankId);
    let listener: string | undefined;
    async function run() {
      const reduced = await AccessibilityInfo.isReduceMotionEnabled();
      if (disposed) return;
      if (!animate || reduced || !from || !to) { setShape(waveFor(rankId)?.path ?? ''); return; }
      setShape(path(from));
      progress.setValue(0);
      listener = progress.addListener(({ value }) => setShape(path(to.map((target, index) => (from[index] ?? target) + (target - (from[index] ?? target)) * value))));
      Animated.sequence([Animated.delay(250), Animated.timing(progress, { toValue: 1, duration: 800,
        easing: Easing.out(Easing.cubic), useNativeDriver: false })]).start();
    }
    void run();
    return () => { disposed = true; progress.stopAnimation(); if (listener) progress.removeListener(listener); };
  }, [rankId, previousId, animate, progress]);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: '100%', maxWidth: 300, height: 128 }}>
    <Svg width="100%" height={128} viewBox="0 0 300 128"><Path d={shape} stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" /></Svg>
  </View>;
}
