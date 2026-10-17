import { StyleSheet, View } from 'react-native';
import { INTERVAL_MINUTES } from '@/data';
import { colors, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';

/** Off, then every offered length (1–60 minutes), stepped with − and +. */
const INTERVALS: readonly (number | null)[] = [null, ...INTERVAL_MINUTES.map((minutes) => minutes * 60)];
export const intervalLabel = (seconds: number | null) => seconds === null ? 'Off' : `Every ${seconds / 60} min`;

/** The interval bell choice, chosen before each practice (owner, 2026-10-17: moved from Settings). */
export function IntervalStepper({ value, onChange }: { value: number | null; onChange: (seconds: number | null) => void }) {
  const at = Math.max(0, INTERVALS.indexOf(value));
  const step = (by: number) => onChange(INTERVALS[Math.min(INTERVALS.length - 1, Math.max(0, at + by))] ?? null);
  return <View style={styles.stepper}>
    <QuietPressable accessibilityRole="button" accessibilityLabel="Shorter interval" disabled={at === 0} disabledOpacity={.3}
      onPress={() => step(-1)} style={styles.stepButton}><Type style={styles.stepSign}>−</Type></QuietPressable>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Interval bell" accessibilityValue={{ text: intervalLabel(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)} style={styles.stepValue}>
      <Type role={value === null ? 'secondary' : 'label'}>{intervalLabel(value)}</Type>
    </View>
    <QuietPressable accessibilityRole="button" accessibilityLabel="Longer interval" disabled={at === INTERVALS.length - 1} disabledOpacity={.3}
      onPress={() => step(1)} style={styles.stepButton}><Type style={styles.stepSign}>+</Type></QuietPressable>
  </View>;
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 22, lineHeight: 26 },
  stepValue: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
});
