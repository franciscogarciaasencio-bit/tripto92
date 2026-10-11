import { View } from 'react-native';
import { journeyLabel, type LifetimeJourney, type ProgressSnapshot } from '@/domain/progression';
import { colors, Type } from './primitives';

function Bar({ fraction, label }: { fraction: number; label: string }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.floor(fraction * 100) }}
    style={{ width: '100%', height: 2, backgroundColor: colors.line }}>
    <View style={{ height: 2, width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: colors.ink }} />
  </View>;
}
export function LevelProgress({ journey, compact = false }: { journey: LifetimeJourney; compact?: boolean }) {
  const missing = journey.missing;
  const requirements = [missing.xpCenti > 0 ? `${(missing.xpCenti / 100).toFixed(2)} XP` : null,
    missing.credits > 0 ? `${missing.credits} ${missing.credits === 1 ? 'credit' : 'credits'}` : null,
    missing.realDays > 0 ? `${missing.realDays} real ${missing.realDays === 1 ? 'date' : 'dates'}` : null,
    missing.elapsedDays > 0 ? `${Math.ceil(missing.elapsedDays)} elapsed ${Math.ceil(missing.elapsedDays) === 1 ? 'day' : 'days'}` : null].filter(Boolean);
  return <View style={{ width: '100%', maxWidth: 340, gap: 8 }}>
    <Type role="secondary">Lifetime practice</Type>
    <Type role={compact ? 'secondary' : 'label'}>{journeyLabel(journey.level)}</Type>
    <Bar fraction={journey.fraction} label="Lifetime practice progress to next level" />
    <Type role="secondary">{journey.next ? compact ? `Toward Level ${journey.next.number}` : `To Level ${journey.next.number}: ${requirements.join(' · ')} remaining` : 'Level 125 · Steady Presence. Your practice continues.'}</Type>
  </View>;
}
export function ConsistencyProgress({ snapshot, compact = false }: { snapshot: ProgressSnapshot; compact?: boolean }) {
  return <View style={{ width: '100%', maxWidth: 340, gap: 8 }}>
    <Type role="secondary">{compact ? 'Recent consistency' : `Recent consistency · ${snapshot.consistency.multiplier.toFixed(2)}×`}</Type>
    <Bar fraction={snapshot.consistency.precedingActiveDays / snapshot.consistency.windowDays} label="Recent consistency toward maximum" />
    {!compact && <Type role="secondary">{`${snapshot.consistency.precedingActiveDays} of ${snapshot.consistency.windowDays} preceding dates · maximum ${snapshot.consistency.maximumMultiplier.toFixed(2)}×`}</Type>}
  </View>;
}
