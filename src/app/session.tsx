import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { coastalComposition, CoastalScene, coastalInk, coastalQuiet, coastalSerif } from '@/ui/coastal-scene';
import { getForestStage } from '@/domain/forest/growth';
import { HomeIcon } from '@/ui/home-icons';
import { SessionSound } from '@/ui/session-sound';
import { Action, Notice, Screen, Type } from '@/ui/primitives';
import { SessionTime } from '@/ui/session-time';
import { QuietPressable } from '@/ui/quiet-pressable';
import { sessionLine } from '@/ui/intentions';

export default function Session() {
  const app = useOna(), audio = useOnaAudio();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const composition = useMemo(() => coastalComposition(width, height, fontScale, insets.bottom), [width, height, fontScale, insets.bottom]);
  const { canvasWidth, scale, haloCenterY } = composition;
  const sceneHeight = Math.max(height, composition.contentHeight, fontScale > 1.3 ? 900 * scale : 650 * scale);
  const sceneComposition = useMemo(() => ({ ...composition, contentHeight: sceneHeight }), [composition, sceneHeight]);
  const [focused, setFocused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [visibleDraft, setVisibleDraft] = useState(app.draft);
  // Retain the outgoing scene until native navigation finishes; this is never a save source.
  if (app.draft && app.draft !== visibleDraft) setVisibleDraft(app.draft);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useFocusEffect(useCallback(() => {
    if (!app.completion && !app.draft && !app.busy) router.replace('/');
  }, [app.draft, app.completion, app.busy]));
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirming) { if (!app.busy) setConfirming(false); return true; }
      if (!app.busy && app.draft?.phase === 'running') void app.pause();
      return true;
    });
    return () => listener.remove();
  }, [app, confirming]));
  const draft = app.draft ?? visibleDraft;
  if (!draft) return <Screen />;
  const paused = draft.phase === 'paused';
  const controlsDisabled = app.busy || !app.draft || draft.phase === 'finished';
  const controlsBottom = Math.max(insets.bottom + 14, 20 * scale);
  return <ScrollView style={{ flex: 1, backgroundColor: '#F4EBDD' }} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
    <View style={{ width: canvasWidth, height: sceneHeight, alignSelf: 'center' }}>
      <CoastalScene composition={sceneComposition} stageId={getForestStage({ highestLevel: app.habit?.highestLevel ?? 0,
        currentLevel: app.journey?.level.number ?? 0 }).id} />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: Math.max(insets.top + 8 * scale, height * .084), left: 25 * scale, right: 25 * scale,
        height: 280 * scale, flexDirection: 'row', alignItems: 'flex-start', zIndex: 10 }}>
        <View pointerEvents="box-none" style={{ marginTop: 6 * scale }}><SessionSound compact /></View>
      </View>
      {/* As on Home, the wordmark sits inside the sun at the top of one centred stack. */}
      <View style={{ position: 'absolute', top: haloCenterY - 96 * scale, left: 24 * scale, right: 24 * scale, alignItems: 'center' }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ fontFamily: coastalSerif, fontSize: 30 * scale, lineHeight: 36 * scale,
          color: coastalInk, marginBottom: 6 * scale, opacity: confirming ? 0 : 1 }}>Ona</Text>
        {confirming ? <><Type role="heading" style={{ textAlign: 'center' }}>Discard this practice?</Type>
          <Type role="secondary" style={{ textAlign: 'center', maxWidth: 280, marginTop: 16 }}>This practice will not be saved or earn Ripples.</Type></> : <>
          <Text style={{ fontFamily: 'ManropeRegular', color: coastalQuiet, fontSize: 12 * scale, lineHeight: 20 * scale, letterSpacing: 4 * scale }}>{paused ? 'PAUSED' : 'MEDITATING'}</Text>
          <SessionTime draft={draft} scale={scale} active={focused} />
          <View style={{ width: 5 * scale, height: 5 * scale, borderRadius: 5, backgroundColor: '#BDAE94', marginTop: 5 * scale }} />
          {/* In the wordmark's serif, small and quiet: an invitation to put the phone away, not an instruction. */}
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: coastalSerif, fontSize: 16 * scale, letterSpacing: .2 * scale, lineHeight: 22 * scale,
            color: coastalQuiet, marginTop: 12 * scale, textAlign: 'center' }}>{sessionLine(null, paused)}</Text>
        </>}
      </View>
      <View style={{ position: 'absolute', bottom: controlsBottom, left: 24 * scale, right: 24 * scale, alignItems: 'center', gap: 4 }}>
        <Notice>{app.error ? 'Your practice could not be updated. Please try again.' : null}</Notice>
        {confirming ? <>
          <Action disabled={controlsDisabled} onPress={() => setConfirming(false)}>Keep practice</Action>
          <Action quiet disabled={controlsDisabled} onPress={() => { void app.discard().then((saved) => { if (saved) router.dismissTo('/'); }); }}>Discard practice</Action>
        </> : <>
          <QuietPressable accessibilityRole="button" accessibilityLabel={paused ? 'Resume' : 'Pause'} disabled={controlsDisabled}
            accessibilityState={{ disabled: controlsDisabled }} onPress={() => { if (paused) audio.retry(); void (paused ? app.resume() : app.pause()); }}
            style={{ width: 94 * scale, height: 94 * scale, borderRadius: 47 * scale, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(222,202,170,0.23)' }}>
            <HomeIcon name={paused ? 'play' : 'pause'} size={27 * scale} color={coastalInk} />
          </QuietPressable>
          <Action quiet textRole="label" disabled={controlsDisabled} onPress={() => { void app.end(); }}>Finish</Action>
          {paused && <Action quiet disabled={controlsDisabled} onPress={() => setConfirming(true)}>Discard practice</Action>}
        </>}
      </View>
    </View>
  </ScrollView>;
}
