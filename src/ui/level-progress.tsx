import { View } from 'react-native';
import { getLevelProgress } from '@/domain/progression';
import { colors, Type } from './primitives';

export function LevelProgress({ progressionCenti, compact = false }: { progressionCenti: number; compact?: boolean }) {
  const progress = getLevelProgress(progressionCenti);
  if (!progress.nextLevel) return <Type role="secondary" style={{ textAlign: 'center' }}>Your practice continues.</Type>;
  return <View style={{ width: '100%', maxWidth: 280, gap: 12 }}>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Progress towards Level ${progress.nextLevel.number}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.floor(progress.fraction * 100) }}
      style={{ height: 2, backgroundColor: colors.line }}>
      <View style={{ height: 2, backgroundColor: colors.ink, width: `${progress.fraction * 100}%` }} />
    </View>
    {!compact && <Type role="secondary" style={{ textAlign: 'center' }}>
      {`${(progress.remainingCenti / 100).toFixed(2)} XP to Level ${progress.nextLevel.number}`}
    </Type>}
  </View>;
}
