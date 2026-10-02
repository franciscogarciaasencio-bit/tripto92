import { router } from 'expo-router';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { getLevelProgress } from '@/domain/progression';
import { ChoiceRow, Header, Screen, styles, Type } from '@/ui/primitives';
import { LevelProgress } from '@/ui/level-progress';
import { Wave } from '@/ui/wave';
export default function Practice() {
  const { snapshot, completedPractices } = useOna();
  if (!snapshot) return <Screen />;
  const progress = getLevelProgress(snapshot.currentProgressionCenti);
  return <Screen><Header title="Your practice" back={() => router.dismissTo('/')} />
    <View style={[styles.center, { paddingVertical: 32 }]}>
      <Wave rankId={progress.level.stage.id} /><Type role="title">{`Level ${progress.level.number}`}</Type>
      <Type role="heading" style={{ textAlign: 'center' }}>{progress.level.stage.name}</Type>
      <Type role="secondary" style={{ textAlign: 'center', maxWidth: 290 }}>{progress.level.stage.theme}</Type>
      <LevelProgress progressionCenti={snapshot.currentProgressionCenti} />
    </View>
    <ChoiceRow label="Completed practices" value={String(completedPractices)} />
    <ChoiceRow label="Current progression" value={`${(snapshot.currentProgressionCenti / 100).toFixed(2)} XP`} />
    <ChoiceRow label="Lifetime XP" value={(snapshot.lifetimeXpCenti / 100).toFixed(2)} />
    <ChoiceRow label="Highest stage reached" value={snapshot.highestRankAchieved.rank.name} />
    <Type role="secondary" style={{ paddingTop: 20, paddingBottom: 24 }}>Current progression shapes your level. Lifetime XP and your highest stage stay with you. Levels mark logged practice, not meditation ability.</Type>
  </Screen>;
}
