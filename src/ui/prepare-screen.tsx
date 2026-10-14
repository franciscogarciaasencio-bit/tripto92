import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { AMBIENCES } from '@/audio/assets';
import { DEFAULT_AUDIO_PREFERENCES, DEFAULT_PREFERENCES, FIXED_DURATIONS, INTENTIONS, type AudioPreferences, type Intention } from '@/data';
import { Action, colors, Header, Notice, Screen, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { intentionLabel } from './intentions';

/** One quiet choice in an even grid; the chosen one is underlined, as elsewhere in Ona. */
function Option({ label, accessibilityLabel, selected, onPress, columns }: { label: string; accessibilityLabel?: string; selected: boolean;
  onPress: () => void; columns: number }) {
  return <View style={{ width: `${100 / columns}%`, paddingHorizontal: 4 }}>
    <QuietPressable accessibilityRole="radio" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ checked: selected }}
      aria-checked={selected} onPress={onPress} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center',
        borderBottomWidth: 1.25, borderColor: selected ? colors.ink : 'transparent' }}>
      <Type role={selected ? 'label' : 'secondary'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Type>
    </QuietPressable>
  </View>;
}
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <View style={{ gap: 6, paddingTop: 20, borderTopWidth: 1, borderColor: colors.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Type role="label">{title}</Type>
      {note && <Type role="secondary" style={{ fontSize: 12 }}>{note}</Type>}
    </View>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 4 }}>{children}</View>
  </View>;
}

/** Before a practice: an optional intention, the sound and open or fixed length. Remembered for next time. */
export function PrepareScreen() {
  const app = useOna(), audio = useOnaAudio();
  const prefs = app.preferences ?? DEFAULT_PREFERENCES;
  const sounds = app.audioPreferences ?? DEFAULT_AUDIO_PREFERENCES;
  const [intention, setIntention] = useState<Intention | null>(prefs.intention);
  const [sound, setSound] = useState<AudioPreferences['sessionSound']>(sounds.sessionSound);
  const [minutes, setMinutes] = useState<number | null>(prefs.durationMode === 'fixed'
    ? Math.round(prefs.defaultDurationSeconds / 60) : null);
  const back = useCallback(() => { if (!app.busy && !audio.starting) router.back(); }, [app.busy, audio.starting]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  }, [back]));

  const begin = async () => {
    // Remember the choices; a failed save never blocks the practice itself.
    const nextPrefs = { ...prefs, intention, durationMode: minutes === null ? 'open' as const : 'fixed' as const,
      defaultDurationSeconds: minutes === null ? prefs.defaultDurationSeconds : minutes * 60 };
    if (nextPrefs.intention !== prefs.intention || nextPrefs.durationMode !== prefs.durationMode ||
      nextPrefs.defaultDurationSeconds !== prefs.defaultDurationSeconds) await app.savePreferences(nextPrefs);
    if (app.audioPreferences && sound !== app.audioPreferences.sessionSound) await app.saveAudioPreferences({ ...app.audioPreferences, sessionSound: sound });
    await audio.begin(minutes === null ? { mode: 'open' } : { mode: 'fixed', seconds: minutes * 60 });
  };
  const summary = `${minutes === null ? 'Open-ended' : `${minutes} minutes`} · ${AMBIENCES.find((entry) => entry.id === sound)?.name ?? ''}`;
  const disabled = app.busy || audio.starting || app.draft !== null;

  return <Screen scroll={false} style={{ paddingBottom: 0 }}>
    <Header title="Your practice" back={back} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 20, paddingTop: 20, paddingBottom: 24 }}>
      <Section title="Intention" note="Optional">
        <Option columns={3} label="None" accessibilityLabel="No intention" selected={intention === null} onPress={() => setIntention(null)} />
        {INTENTIONS.map((id) => <Option columns={3} key={id} label={intentionLabel(id)} selected={intention === id} onPress={() => setIntention(id)} />)}
      </Section>
      <Section title="Sound">
        {AMBIENCES.map((entry) => <Option columns={3} key={entry.id} label={entry.name} selected={sound === entry.id} onPress={() => setSound(entry.id)} />)}
      </Section>
      <Section title="Length" note="minutes">
        <Option columns={4} label="Open" accessibilityLabel="Open-ended: stop when you choose" selected={minutes === null} onPress={() => setMinutes(null)} />
        {FIXED_DURATIONS.map((value) => <Option columns={4} key={value} label={`${value}`} accessibilityLabel={`${value} minutes`}
          selected={minutes === value} onPress={() => setMinutes(value)} />)}
      </Section>
      <Type role="secondary">{minutes === null
        ? 'Open-ended is recommended: stop when you choose. Every practice of three active minutes counts.'
        : `A bell ends the practice after ${minutes} minutes of meditation. Pauses don’t count, and finishing earlier still counts.`}</Type>
    </ScrollView>
    <View style={{ alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderColor: colors.line }}>
      <Notice>{app.error ? 'Your practice could not begin. Please try again.' : null}</Notice>
      <Type role="secondary" style={{ fontSize: 12 }}>{summary}</Type>
      <Action disabled={disabled} onPress={() => { void begin(); }}>{audio.starting ? 'Beginning…' : 'Begin'}</Action>
    </View>
  </Screen>;
}
