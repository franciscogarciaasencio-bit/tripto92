import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { PROGRESSION_V7 } from '@/domain/progression';
import { PaperBackdrop } from './coastal-scene';
import { ConsistencyBar } from './consistency-bar';
import { consistencyLevel, consistencyRounds, CONSISTENCY_STEPS, ROUND_COLORS } from './consistency-rounds';
import { colors, Header, Screen, serifFont, Type } from './primitives';

const LINE = 'rgba(20,20,20,0.16)';
const MAXIMUM = 1 + PROGRESSION_V7.maximumConsistencyBonusBasisPoints / 10_000;
const WEEKS = (PROGRESSION_V7.continuousConsistency as { targetContributions: number }).targetContributions / 7;
const times = (value: number) => `×${Number.isInteger(value) ? value : value.toFixed(1)}`;
/** The multiplier where each level begins: the bar's milestones sit on the same curve as the bonus. */
const LEVEL_STARTS = Array.from({ length: CONSISTENCY_STEPS }, (_, index) => 1 + (MAXIMUM - 1) * index / CONSISTENCY_STEPS);

/**
 * Opened from Home's Consistency (owner, 2026-10-17): why Ona rewards coming back, what the bar and
 * its five coloured levels mean, and what this person's practice earns now.
 */
export function ConsistencyScreen() {
  const { snapshot } = useOna();
  const consistency = snapshot?.consistency;
  const fraction = consistency?.indicatorFraction ?? 0, multiplier = consistency?.multiplier ?? 1;
  const full = consistencyRounds(fraction).completed === CONSISTENCY_STEPS, level = consistencyLevel(fraction);
  return <PaperBackdrop><Screen scroll={false} style={{ paddingBottom: 0, backgroundColor: 'transparent' }}>
    <Header back={() => router.back()} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
      <Type role="title">Consistency</Type>
      <View style={styles.now}>
        <ConsistencyBar fraction={fraction} scale={1.6} />
        <Type style={styles.level}>{full ? 'Full Consistency' : `Level ${level} of ${CONSISTENCY_STEPS}`}</Type>
        <Type role="secondary">{`Each practice now earns ${times(Math.round(multiplier * 10) / 10)} its Ripples.`}</Type>
      </View>

      <View style={styles.section}>
        <Type style={styles.lead}>Coming back is the hard part.</Type>
        <Type>Meditating itself is simple. Returning to it, day after day, is the only part that is truly difficult, and the part that matters most.</Type>
        <Type>So Ona rewards consistency. The more regularly you practise, the more Ripples every practice earns, up to {MAXIMUM} times as many.</Type>
        <Type role="secondary">Many people find that meditation starts to feel different once it has been part of their days for a while. That is what Ona wants to reward.</Type>
      </View>

      <View style={styles.section}>
        <Type style={styles.heading}>How it grows</Type>
        <Type role="secondary">{`Every practice of three minutes or more fills the bar. A second practice, at least six hours after the first ends, fills it again. It grows fastest at the start: about ${WEEKS} weeks of daily practice reach full, or ${WEEKS / 2} weeks practising twice a day.`}</Type>
        <Type role="secondary">Each time the bar fills, you reach a new level of Consistency: one of the small bars beneath it is kept, the bar takes on a new colour and begins again.</Type>
        <View style={styles.levels}>
          {LEVEL_STARTS.map((start, index) => <View key={index} accessible accessibilityLabel={`Level ${index + 1}, from ${times(Math.round(start * 10) / 10)}`} style={styles.levelItem}>
            <View style={[styles.swatch, { backgroundColor: ROUND_COLORS[index] }]} />
            <Type style={styles.levelName}>{`Level ${index + 1}`}</Type>
            <Type role="secondary" style={styles.levelValue}>{`from ${times(Math.round(start * 10) / 10)}`}</Type>
          </View>)}
        </View>
        <Type role="secondary">{`Full Consistency: ${times(MAXIMUM)}.`}</Type>
      </View>

      <View style={styles.section}>
        <Type style={styles.heading}>Time away</Type>
        <Type role="secondary">Each day without practice lets Consistency fade a little. After a week away about half of it remains; after a month, almost none. It begins to grow again with your next practice, and your level and the Ripples you have earned stay yours.</Type>
      </View>
    </ScrollView>
  </Screen></PaperBackdrop>;
}

const styles = StyleSheet.create({
  now: { gap: 10, paddingTop: 22, paddingBottom: 26 },
  level: { fontFamily: serifFont, fontSize: 24, lineHeight: 32, marginTop: 6, color: colors.ink },
  section: { gap: 12, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  lead: { fontFamily: serifFont, fontSize: 26, lineHeight: 34, color: colors.ink },
  heading: { fontFamily: serifFont, fontSize: 21, lineHeight: 28, color: colors.ink },
  levels: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  levelItem: { flex: 1, gap: 4 },
  swatch: { height: 6, borderRadius: 3 },
  levelName: { fontSize: 13, lineHeight: 18 },
  levelValue: { fontSize: 12, lineHeight: 16 },
});
