import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Action, ChoiceRow, colors, Header, Screen, styles, Type } from '@/ui/primitives';
import { Wave } from '@/ui/wave';
export default function Practice() {
  const { snapshot } = useOna();
  const [details, setDetails] = useState(false);
  if (!snapshot) return <Screen />;
  const next = snapshot.progressToNextRank;
  return <Screen><Header title="Your practice" back={() => router.dismissTo('/')} />
    <View style={[styles.center, { flex: 1, minHeight: 340, paddingVertical: 40 }]}>
      <Wave rankId={snapshot.currentRank.id} /><Type role="heading" style={{ textAlign: 'center' }}>{snapshot.currentRank.name}</Type>
      <Type role="secondary" style={{ textAlign: 'center', maxWidth: 290 }}>{snapshot.currentRank.theme}</Type>
      {next.nextRank ? <View style={{ width: '100%', maxWidth: 280, gap: 12, marginTop: 24 }}>
        <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(next.fraction * 100) }} style={{ height: 2, backgroundColor: colors.line }}>
          <View style={{ height: 2, backgroundColor: colors.ink, width: `${next.fraction * 100}%` }} /></View>
        <Type role="secondary" style={{ textAlign: 'center' }}>{`${Math.round(next.fraction * 100)}% of this step · ${next.nextRank.name}`}</Type>
      </View> : <Type role="secondary">All current ranks reached</Type>}
      {snapshot.highestRankAchieved.rank.id !== snapshot.currentRank.id && <Type role="secondary" style={{ textAlign: 'center' }}>{`Highest reached · ${snapshot.highestRankAchieved.rank.name}`}</Type>}
    </View>
    {details && <View><ChoiceRow label="Lifetime XP" value={(snapshot.lifetimeXpCenti / 100).toFixed(0)} />
      <ChoiceRow label="Current progression" value={(snapshot.currentProgressionCenti / 100).toFixed(0)} />
      <ChoiceRow label="Practice days" value={String(snapshot.totalQualifyingPracticeDays)} /><ChoiceRow label="Meditation minutes" value={String(Math.floor(snapshot.totalMeditationMinutes))} />
      <ChoiceRow label="Active preceding days" value={`${snapshot.consistency.precedingActiveDays} of 7`} />
      <Type role="secondary" style={{ paddingTop: 20 }}>Progress stays with you. After two complete inactive days, current progression gradually softens. Lifetime XP and your highest reached rank are kept.</Type></View>}
    <View style={styles.footer}><Action quiet onPress={() => setDetails(!details)}>{details ? 'Close details' : 'Details'}</Action><Action quiet onPress={() => router.push('/history')}>History</Action></View>
  </Screen>;
}
