import { memo, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { activeElapsedSeconds, type TimerDraft } from '@/domain/meditation/timer';
import { coastalInk, coastalSerif } from './coastal-scene';
import { formatTime } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { startSessionClock } from './session-clock';
import { useForeground } from './use-foreground';

/** Only the time display ticks. Artwork, audio controls and the screen remain untouched. */
export const SessionTime = memo(function SessionTime({ draft, scale, active }: {
  draft: TimerDraft; scale: number; active: boolean;
}) {
  const foreground = useForeground();
  const [hidden, setHidden] = useState(false);
  const [seconds, setSeconds] = useState(() => activeElapsedSeconds(draft, Math.max(Date.now(), draft.changedAt)));
  useEffect(() => {
    if (!active || !foreground || hidden) return;
    return startSessionClock(draft, {
      now: Date.now,
      schedule(callback, delay) { const task = setTimeout(callback, delay); return () => clearTimeout(task); },
    }, setSeconds);
  }, [draft, active, foreground, hidden]);
  const elapsed = draft.phase === 'running' ? Math.max(seconds, activeElapsedSeconds(draft, draft.changedAt))
    : activeElapsedSeconds(draft, draft.changedAt);
  return <QuietPressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show elapsed meditation time' : 'Hide elapsed meditation time'}
    accessibilityValue={{ text: hidden ? 'Time hidden' : formatTime(elapsed) + ' active meditation time' }}
    accessibilityHint="Meditation continues while the time is hidden" onPress={() => setHidden(value => !value)}
    style={{ alignItems: 'center', minHeight: 90 * scale, justifyContent: 'center', minWidth: 184 }}>
    <Text style={{ fontFamily: hidden ? 'ManropeRegular' : coastalSerif, fontVariant: ['tabular-nums'], fontSize: (hidden ? 16 : 64) * scale,
      lineHeight: 82 * scale, color: coastalInk }}>{hidden ? 'Show time' : formatTime(elapsed).padStart(5, '0')}</Text>
  </QuietPressable>;
});
