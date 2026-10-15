import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HomeIcon } from './home-icons';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { Action, colors, Type } from './primitives';
import { AMBIENCES } from '@/audio/assets';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

/** A quiet − / + step control (5%) with a thin level line between, so volume reads at a glance. */
export function VolumeControl({ value, onChange, disabled = false, label = 'volume' }: { value: number; onChange: (value: number) => void; disabled?: boolean; label?: string }) {
  const change = (direction: number) => onChange(Math.min(1, Math.max(0, Math.round((value + direction * 0.05) * 100) / 100)));
  const reduced = useReducedMotion(), level = useSharedValue(value);
  useEffect(() => {
    level.set(withTiming(value, { duration: reduced ? 0 : UI_MOTION.expand, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(level);
  }, [level, reduced, value]);
  const fill = useAnimatedStyle(() => ({ width: `${level.value * 100}%` }));
  const percent = Math.round(value * 100);
  const step = (direction: -1 | 1) => <QuietPressable accessibilityRole="button" accessibilityLabel={`${direction < 0 ? 'Decrease' : 'Increase'} ${label}`}
    accessibilityState={{ disabled: disabled || value === (direction < 0 ? 0 : 1) }} disabled={disabled || value === (direction < 0 ? 0 : 1)}
    onPress={() => change(direction)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={16} height={16} viewBox="0 0 16 16" accessible={false}>
      <Path d={direction < 0 ? 'M3 8h10' : 'M3 8h10M8 3v10'} stroke={colors.ink} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  </QuietPressable>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: -14 }}>
    {step(-1)}
    <View style={{ flex: 1, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(20,20,20,0.12)', overflow: 'hidden' }}>
      <Animated.View style={[fill, { height: '100%', borderRadius: 1.5, backgroundColor: colors.ink }]} />
    </View>
    {step(1)}
    <Type role="secondary" accessibilityLabel={`${label}, ${percent} percent`}
      style={{ width: 44, textAlign: 'right', marginRight: 14, fontVariant: ['tabular-nums'] }}>{`${percent}%`}</Type>
  </View>;
}
export function SessionSound({ compact = false }: { compact?: boolean }) {
  const { width } = useWindowDimensions();
  const app = useOna();
  const audio = useOnaAudio();
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion(), accessibility = reduced ? ReduceMotion.Always : ReduceMotion.Never;
  const prefs = app.audioPreferences;
  if (!prefs) return null;
  const controls = <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {AMBIENCES.map(sound => <QuietPressable key={sound.id} accessibilityRole="radio" accessibilityLabel={sound.name}
          accessibilityState={{ checked: prefs.sessionSound === sound.id, disabled: app.busy }} aria-checked={prefs.sessionSound === sound.id} disabled={app.busy}
          style={{ width: '50%', minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', opacity: app.busy ? .4 : 1 }}
          onPress={() => { void app.saveAudioPreferences({ ...prefs,sessionSound: sound.id }).then(saved => { if (saved && audio.notice && sound.id !== 'silence') audio.retry(); }); }}>
          <Type role={prefs.sessionSound === sound.id ? 'label' : 'secondary'} style={{ fontSize: 14 }}>{sound.name}</Type>
        </QuietPressable>)}
      </View>
      <VolumeControl value={prefs.sessionVolume} disabled={app.busy} onChange={(sessionVolume) => { void app.saveAudioPreferences({ ...prefs, sessionVolume }); }} />
    </>;
  // Native touch handling needs the popup inside its ancestors' bounds, even when the controls are visually compact.
  return <View pointerEvents="box-none" style={compact ? { alignItems: 'flex-start', zIndex: 10, width: 280, height: 280 } : { alignItems: 'center', width: '100%', maxWidth: 320 }}>
    {compact ? <QuietPressable accessibilityRole="button" accessibilityLabel="Meditation sound settings" accessibilityState={{ expanded }}
      onPress={() => { if (audio.notice) audio.retry(); setExpanded(!expanded); }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <HomeIcon name="speaker" selected={prefs.sessionSound !== 'silence' && prefs.sessionVolume > 0} size={19} color="#898579" />
    </QuietPressable> : <Action quiet label="Meditation sound settings" onPress={() => { if (audio.notice) audio.retry(); setExpanded(!expanded); }}>{`Sound · ${AMBIENCES.find(sound => sound.id === prefs.sessionSound)?.name}`}</Action>}
    {expanded && <Animated.View entering={FadeIn.duration(UI_MOTION.reveal).reduceMotion(accessibility)}
      exiting={FadeOut.duration(120).reduceMotion(accessibility)} style={compact ? { position: 'absolute', top: 50, left: 0, width: 280, backgroundColor: '#F6EEDF', borderRadius: 16,
      borderWidth: 1, borderColor: '#DCD0BC', overflow: 'hidden' } : undefined}>
      {compact ? <ScrollView style={{ maxHeight: Math.min(220,width/390*280-70) }} contentContainerStyle={{ padding: 12 }}>
        {controls}
      </ScrollView> : controls}
    </Animated.View>}
  </View>;
}
