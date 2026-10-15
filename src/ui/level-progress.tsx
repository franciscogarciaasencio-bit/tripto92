import { View } from 'react-native';
import type { LifetimeJourney } from '@/domain/progression';
import { getJourneyPresentationLabel } from './category-presentation';
import { colors, Type } from './primitives';

function Bar({ fraction, label }: { fraction: number; label: string }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.floor(fraction * 100) }}
    style={{ width: '100%', height: 2, backgroundColor: colors.line }}>
    <View style={{ height: 2, width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: colors.ink }} />
  </View>;
}
export function LevelProgress({ journey, compact = false }: { journey: LifetimeJourney; compact?: boolean }) {
  return <View style={{ width: '100%', maxWidth: 340, gap: 8 }}>
    <Type role="secondary">Current journey</Type>
    <Type role={compact ? 'secondary' : 'label'}>{getJourneyPresentationLabel(journey.level)}</Type>
    <Bar fraction={journey.fraction} label="Current journey progress to next level" />
    <Type role="secondary">{journey.next ? `Toward Level ${journey.next.number}${compact ? '' : ' · Keep returning to your practice.'}` : 'Level 125 reached. Your practice continues.'}</Type>
  </View>;
}
