import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { PaperBackdrop } from './coastal-scene';
import { ConsistencyBar } from './consistency-bar';
import { colors, Header, Screen, serifFont, Type } from './primitives';

const LINE = 'rgba(20,20,20,0.16)';

/**
 * Opened from Home's Consistency (owner, 2026-10-17): why Ona rewards coming back and what the bar
 * means. Deliberately without numbers (no multipliers, rates or timelines): the habit, not the maths.
 */
export function ConsistencyScreen() {
  const { snapshot } = useOna();
  return <PaperBackdrop><Screen scroll={false} style={{ paddingBottom: 0, backgroundColor: 'transparent' }}>
    <Header back={() => router.back()} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
      <Type role="title">Consistency</Type>
      <View style={styles.now}><ConsistencyBar fraction={snapshot?.consistency.indicatorFraction ?? 0} scale={1.6} /></View>

      <View style={styles.section}>
        <Type style={styles.lead}>Coming back is the hard part.</Type>
        <Type>Meditating itself is simple. Returning to it, day after day, is the only part that is truly difficult, and the part that matters most.</Type>
        <Type>So Ona rewards consistency, generously. The more regularly you practise, the more Ripples every practice earns.</Type>
        <Type role="secondary">Many people find that meditation starts to feel different once it has been part of their days for a while. That is what Ona wants to reward.</Type>
      </View>

      <View style={styles.section}>
        <Type style={styles.heading}>How it grows</Type>
        <Type role="secondary">Every practice of three minutes or more fills the bar, and a second practice at least six hours after the first fills it again. It grows fastest at the beginning.</Type>
        <Type role="secondary">Each time the bar fills, one of the small bars beneath it is kept and the bar begins again in a new colour.</Type>
      </View>

      <View style={styles.section}>
        <Type style={styles.heading}>Time away</Type>
        <Type role="secondary">Each day without practice lets Consistency fade a little; a long break lets it fade almost completely. It grows again with your next practice, and the Ripples you have earned stay yours.</Type>
      </View>
    </ScrollView>
  </Screen></PaperBackdrop>;
}

const styles = StyleSheet.create({
  now: { paddingTop: 26, paddingBottom: 30 },
  section: { gap: 12, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  lead: { fontFamily: serifFont, fontSize: 26, lineHeight: 34, color: colors.ink },
  heading: { fontFamily: serifFont, fontSize: 21, lineHeight: 28, color: colors.ink },
});
