import { StyleSheet, View } from 'react-native';
import type { MeditationSession } from '@/domain/progression';
import { colors, formatDuration, formatTime, Type } from './primitives';
import { practiceClockLabel } from './practice-history';
import { QuietPressable } from './quiet-pressable';

/** The device's zone, read once; a practice saved elsewhere names its own zone. */
function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null; } catch { return null; }
}

/**
 * One saved practice in History and the calendar: duration first, then when it began and any
 * pause on the same line, all inside one divider so nothing reads as part of the next entry.
 */
export function PracticeRow({ session, onPress }: { session: MeditationSession; onPress: () => void }) {
  const clock = practiceClockLabel(session.startedAt, session.timeZone);
  const elsewhere = session.timeZone !== deviceTimeZone() ? session.timeZone.split('/').pop()?.replace(/_/g, ' ') : null;
  const detail = [clock && (elsewhere ? `${clock} ${elsewhere}` : clock),
    session.pausedDurationSeconds > 0 ? `paused ${formatTime(session.pausedDurationSeconds)}` : null].filter(Boolean).join(' · ');
  const status = session.status === 'completed' ? 'Complete' : 'Ended early';
  return <QuietPressable accessibilityRole="button" onPress={onPress}
    accessibilityLabel={`View saved practice, ${formatDuration(session.activeDurationSeconds)}${clock ? `, began ${clock}` : ''}, ${status}`}
    accessibilityHint="Opens duration, pauses and saved Ripples" style={styles.row}>
    <View style={styles.main}>
      <Type>{formatDuration(session.activeDurationSeconds)}</Type>
      {detail ? <Type role="secondary">{detail.charAt(0).toUpperCase() + detail.slice(1)}</Type> : null}
    </View>
    <Type role="secondary">{status}</Type>
  </QuietPressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 68, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.line },
  main: { flex: 1, gap: 2 },
});
