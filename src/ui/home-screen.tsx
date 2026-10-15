import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { CategoryIcon } from './category-icon';
import { HomeIcon } from './home-icons';
import { HomeNavigation } from './home-navigation';
import { Notice, serifFont as serif } from './primitives';
import { CoastalScene, CoastalTexture, coastalComposition, coastalInk as ink, coastalQuiet as quiet } from './coastal-scene';
import { QuietPressable } from './quiet-pressable';
import { ConsistencyBar } from './consistency-bar';
import { getLevelCategoryPresentation } from './category-presentation';
import { getForestStage } from '@/domain/forest/growth';

export function HomeScreen({ openForest, scrollGesture, scrollOffsetRef, rememberScroll = false, animateWave = true }: {
  openForest: () => void; scrollGesture?: NativeGesture; scrollOffsetRef: { current: number } | null;
  rememberScroll?: boolean; animateWave?: boolean;
}) {
  const app = useOna(), audio = useOnaAudio();
  const scroll = useRef<ScrollView>(null);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const composition = useMemo(() => coastalComposition(width, height, fontScale, insets.bottom), [width, height, fontScale, insets.bottom]);
  const { canvasWidth, scale, contentHeight, progressionTop, sunDiameter, sunLeft, sunTop, haloCenterY } = composition;
  const headerTop = Math.max(insets.top + 8 * scale, height * .084);
  const labelTop = haloCenterY - 32 * scale;

  const journey = app.journey, consistency = app.snapshot?.consistency;
  const categoryName = journey ? getLevelCategoryPresentation(journey.level).name : 'Monkey Mind';
  const forest = getForestStage({ highestLevel: app.habit?.highestLevel ?? 0, currentLevel: journey?.level.number ?? 0 });
  const atPrelude = journey?.level.number === 0;
  const content = <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} bounces={false}
    onLayout={() => { if (scrollOffsetRef) scroll.current?.scrollTo({ y: scrollOffsetRef.current, animated: false }); }}
    onScroll={rememberScroll ? event => { if (scrollOffsetRef) scrollOffsetRef.current = event.nativeEvent.contentOffset.y; } : undefined}
    scrollEventThrottle={32}>
    <View style={{ height: contentHeight, width: canvasWidth, alignSelf: 'center', overflow: 'hidden' }}>
      <CoastalScene composition={composition} stageId={forest.id} animateWave={animateWave} />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: headerTop, left: 25 * scale, right: 25 * scale, height: 60 * scale, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <QuietPressable hitSlop={4} accessibilityRole="button" accessibilityLabel={app.audioPreferences?.homeEnabled ? 'Mute Home ambience' : 'Unmute Home ambience'}
          accessibilityState={{ disabled: app.busy || !app.audioPreferences, selected: app.audioPreferences?.homeEnabled }}
          disabled={app.busy || !app.audioPreferences} onPress={() => {
            const prefs = app.audioPreferences;
            if (prefs) void app.saveAudioPreferences({ ...prefs, homeEnabled: !prefs.homeEnabled }).then(saved => { if (saved && audio.notice && !prefs.homeEnabled) audio.retry(); });
          }} style={{ width: 46 * scale, height: 48 * scale, alignItems: 'center', justifyContent: 'center' }}>
          <HomeIcon name="speaker" selected={app.audioPreferences?.homeEnabled} size={18 * scale} color="#8D897A" />
        </QuietPressable>
        <Text accessibilityRole="header" style={{ position: 'absolute', left: 63 * scale, right: 60 * scale, textAlign: 'center', fontFamily: serif, fontSize: 40 * scale, lineHeight: 52 * scale, color: '#121813' }}>Ona</Text>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Open your forest" accessibilityHint="You can also swipe left from Home"
          accessibilityState={{ disabled: app.busy || audio.starting }} disabled={app.busy || audio.starting} onPress={openForest}
          style={{ width: 46 * scale, height: 48 * scale, alignItems: 'center', justifyContent: 'center' }}>
          <HomeIcon name="sprout" size={20 * scale} color="#8D897A" />
        </QuietPressable>
      </View>
      <QuietPressable accessibilityRole="button" accessibilityLabel={audio.starting ? 'Beginning meditation' : 'Meditate'} accessibilityHint="Choose an intention, sound and length, then begin" accessibilityState={{ disabled: app.busy || audio.starting }}
        disabled={app.busy || audio.starting} disabledOpacity={.62} onPress={() => router.push('/prepare')}
        style={{ position: 'absolute', left: sunLeft, top: sunTop, width: sunDiameter, height: sunDiameter, borderRadius: sunDiameter / 2, alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: labelTop - sunTop, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'ManropeRegular', color: '#676B62', fontSize: 13 * scale, lineHeight: 20 * scale, letterSpacing: 5.7 * scale, marginLeft: 5.7 * scale }}>
          {audio.starting ? 'BEGINNING' : 'MEDITATE'}
        </Text>
        <View style={{ marginTop: 22 * scale }}><HomeIcon name="arrow" size={31 * scale} color="#343C37" /></View>
        </View>
      </QuietPressable>
      <View style={{ position: 'absolute', top: labelTop + 126 * scale, left: 30 * scale, right: 30 * scale }}>
        <Notice>{app.error ? 'Practice could not start. Please try again.'
          : app.practiceSetAside ? 'Your last practice overlapped one already saved, perhaps on another phone. It was kept safely aside.' : null}</Notice>
      </View>
      {journey && consistency && <View style={{ position: 'absolute', top: progressionTop, left: 34 * scale, right: 29 * scale, flexDirection: 'row', minHeight: 115 * scale }}>
        <QuietPressable accessibilityRole="button" accessibilityLabel={`View Journey. Level ${journey.level.number}, ${categoryName}, ${atPrelude ? 'starting point before your first qualifying practice' : `${journey.level.categoryStep} of 5`}`}
          onPress={() => router.push({ pathname: '/practice', params: { view: 'levels' } })} style={{ width: '49%', paddingRight: 24 * scale }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * scale, marginLeft: -6 * scale, marginTop: 2 * scale }}>
            <CategoryIcon category={journey.level.category} level={journey.level.number} size={46 * scale} />
            <Text style={{ fontFamily: serif, fontSize: 22 * scale, lineHeight: 28 * scale, color: ink }}>{`Level ${journey.level.number}`}</Text>
          </View>
          <Text numberOfLines={2} style={[styles.caption, { fontSize: 13 * scale, lineHeight: 18 * scale, marginTop: 2 * scale }]}>{categoryName}</Text>
          <View accessibilityRole="progressbar" accessibilityLabel={journey.next ? `Progress toward Level ${journey.next.number}` : 'Journey complete'}
            accessibilityValue={{ min: 0, max: 100, now: Math.floor(journey.fraction * 100) }}
            style={{ height: 6 * scale, width: 114 * scale, maxWidth: '100%', borderRadius: 6, backgroundColor: '#DCD0BC', marginTop: 9 * scale, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${journey.fraction * 100}%`, borderRadius: 6, backgroundColor: '#1A211B' }} />
          </View>
          <Text style={[styles.caption, { fontSize: 12 * scale, lineHeight: 19 * scale, marginTop: 10 * scale }]}>{atPrelude ? 'Starting point' : `${journey.level.categoryStep} of 5`}</Text>
        </QuietPressable>
        <View style={{ width: '51%', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#D7CCBA', paddingLeft: 29 * scale }}>
          <Text style={{ fontFamily: serif, fontSize: 22 * scale, lineHeight: 28 * scale, color: ink, marginTop: 24 * scale }}>Consistency</Text>
          <View style={{ height: 19 * scale }} />
          <View style={{ marginTop: 4 * scale }}><ConsistencyBar fraction={consistency.indicatorFraction} scale={scale} /></View>
        </View>
      </View>}
    </View>
  </ScrollView>;
  return <View style={styles.screen}><CoastalTexture width={width} height={height} />
    {scrollGesture ? <GestureDetector gesture={scrollGesture}>{content}</GestureDetector> : content}
    <View style={{ width: canvasWidth, alignSelf: 'center' }}>
    <HomeNavigation active="home" scale={scale} />
  </View></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F4EBDD' }, caption: { fontFamily: 'ManropeRegular', letterSpacing: .6, color: quiet } });
