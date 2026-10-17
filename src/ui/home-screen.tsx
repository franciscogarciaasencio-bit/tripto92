import { router } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useVerticalPage } from './vertical-page';
import { JourneyPullHint } from './journey-pull-hint';
import { useJourneyPullHint } from '@/application/journey-hint';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { useFriends } from '@/application/friends-provider';
import { CategoryIcon } from './category-icon';
import { HomeIcon } from './home-icons';
import { HomeNavigation } from './home-navigation';
import { Notice, serifFont as serif } from './primitives';
import { CoastalScene, CoastalTexture, coastalComposition, coastalInk as ink, coastalQuiet as quiet } from './coastal-scene';
import { QuietPressable } from './quiet-pressable';
import { ConsistencyBar } from './consistency-bar';
import { getLevelCategoryPresentation } from './category-presentation';
import { getForestStage } from '@/domain/forest/growth';

export function HomeScreen({ scrollGesture, scrollOffsetRef, rememberScroll = false, animateWave = true }: {
  scrollGesture?: NativeGesture; scrollOffsetRef: { current: number } | null;
  rememberScroll?: boolean; animateWave?: boolean;
}) {
  const app = useOna(), audio = useOnaAudio();
  const { list } = useFriends(), friends = { requests: (list?.requests.length ?? 0) > 0 };
  const scroll = useRef<ScrollView>(null);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const composition = useMemo(() => coastalComposition(width, height, fontScale, insets.bottom), [width, height, fontScale, insets.bottom]);
  const { canvasWidth, scale, contentHeight, progressionTop, sunDiameter, sunLeft, sunTop, haloCenterY } = composition;
  const headerTop = Math.max(insets.top + 8 * scale, height * .084);
  // The wordmark, MEDITATE and the arrow form one stack centred in the sun (slightly above centre,
  // where the horizon leaves the disc most open), instead of the wordmark resting on its rim.
  const wordmarkTop = haloCenterY - 72 * scale, labelTop = haloCenterY - 12 * scale;

  // Pull up past the end of Home to rise into Journey (its route slides in from below).
  const atBottom = useSharedValue(true), measure = useRef({ offset: 0, layout: 0, content: 0 });
  const updateEdge = () => { const m = measure.current; atBottom.set(m.offset + m.layout >= m.content - 2); };
  const opening = useRef(false), hint = useJourneyPullHint(), usedHint = hint.used;
  const openJourney = useCallback(() => {
    if (opening.current) return;
    opening.current = true;
    router.push({ pathname: '/practice', params: { view: 'calendar' } });
    setTimeout(() => { opening.current = false; }, 800);
  }, []);
  const pulledToJourney = useCallback(() => { usedHint(); openJourney(); }, [usedHint, openJourney]);
  const page = useVerticalPage({ direction: 'up', atEdge: atBottom, onTurn: pulledToJourney, simultaneous: scrollGesture,
    enabled: !!scrollGesture && !app.busy && !app.draft && !app.completion && !audio.starting });

  const journey = app.journey, consistency = app.snapshot?.consistency;
  const categoryName = journey ? getLevelCategoryPresentation(journey.level).name : 'Monkey Mind';
  const forest = getForestStage({ highestLevel: app.habit?.highestLevel ?? 0, currentLevel: journey?.level.number ?? 0 });
  const atPrelude = journey?.level.number === 0;
  const content = <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} bounces={false}
    onLayout={(event) => { measure.current.layout = event.nativeEvent.layout.height; updateEdge();
      if (scrollOffsetRef) scroll.current?.scrollTo({ y: scrollOffsetRef.current, animated: false }); }}
    onContentSizeChange={(_, contentHeight) => { measure.current.content = contentHeight; updateEdge(); }}
    onScroll={event => { measure.current.offset = event.nativeEvent.contentOffset.y; updateEdge();
      if (rememberScroll && scrollOffsetRef) scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
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
        {/* Friends (owner, 2026-10-17) replaces the forest's button; the forest is still a swipe left away. */}
        <QuietPressable accessibilityRole="button" accessibilityLabel={friends.requests ? 'Friends, someone added you' : 'Friends'}
          accessibilityHint="Your friends’ levels and weeks in a row"
          accessibilityState={{ disabled: app.busy || audio.starting }} disabled={app.busy || audio.starting} onPress={() => router.push('/friends')}
          style={{ width: 46 * scale, height: 48 * scale, alignItems: 'center', justifyContent: 'center' }}>
          <View>
            <HomeIcon name="friends" size={21 * scale} color="#8D897A" />
            {/* Someone added you: one small ink dot, nothing more. */}
            {friends.requests && <View style={{ position: 'absolute', top: -3 * scale, right: -6 * scale, width: 6 * scale, height: 6 * scale,
              borderRadius: 3 * scale, backgroundColor: '#343C37' }} />}
          </View>
        </QuietPressable>
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ position: 'absolute', top: wordmarkTop, left: sunLeft, width: sunDiameter, textAlign: 'center',
        fontFamily: serif, fontSize: 34 * scale, lineHeight: 40 * scale, color: '#121813' }}>Ona</Text>
      <QuietPressable accessibilityRole="button" accessibilityLabel={audio.starting ? 'Beginning meditation' : 'Meditate'} accessibilityHint="Choose a sound, length and interval bell, then begin" accessibilityState={{ disabled: app.busy || audio.starting }}
        disabled={app.busy || audio.starting} disabledOpacity={.62} onPress={() => router.push('/prepare')}
        style={{ position: 'absolute', left: sunLeft, top: sunTop, width: sunDiameter, height: sunDiameter, borderRadius: sunDiameter / 2, alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: labelTop - sunTop, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'ManropeRegular', color: '#676B62', fontSize: 13 * scale, lineHeight: 20 * scale, letterSpacing: 5.7 * scale, marginLeft: 5.7 * scale }}>
          {audio.starting ? 'BEGINNING' : 'MEDITATE'}
        </Text>
        <View style={{ marginTop: 22 * scale }}><HomeIcon name="arrow" size={31 * scale} color="#343C37" /></View>
        </View>
      </QuietPressable>
      <View style={{ position: 'absolute', top: haloCenterY + 94 * scale, left: 30 * scale, right: 30 * scale }}>
        <Notice>{app.error ? 'Practice could not start. Please try again.'
          : app.practiceSetAside ? 'Your last practice overlapped one already saved, perhaps on another phone. It was kept safely aside.' : null}</Notice>
      </View>
      {journey && consistency && <View style={{ position: 'absolute', top: progressionTop, left: 34 * scale, right: 29 * scale, flexDirection: 'row', minHeight: 115 * scale }}>
        {/* Two matching columns: a serif title row, its bar directly beneath, then quiet captions. */}
        <QuietPressable accessibilityRole="button" accessibilityLabel={`View Journey. Level ${journey.level.number}, ${categoryName}, ${atPrelude ? 'starting point before your first qualifying practice' : `${journey.level.categoryStep} of 5`}`}
          onPress={() => router.push({ pathname: '/practice', params: { view: 'levels' } })} style={{ width: '49%', paddingRight: 24 * scale }}>
          <View style={[styles.titleRow, { height: 32 * scale, gap: 7 * scale }]}>
            <View style={{ opacity: 0.92 }}><CategoryIcon category={journey.level.category} level={journey.level.number} size={30 * scale} /></View>
            <Text style={{ fontFamily: serif, fontSize: 22 * scale, lineHeight: 28 * scale, color: ink }}>{`Level ${journey.level.number}`}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={journey.next ? `Progress toward Level ${journey.next.number}` : 'Journey complete'}
            accessibilityValue={{ min: 0, max: 100, now: Math.floor(journey.fraction * 100) }}
            style={{ height: 6 * scale, borderRadius: 3 * scale, backgroundColor: '#DDD1BD', marginTop: 10 * scale, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${journey.fraction * 100}%`, borderRadius: 3 * scale, backgroundColor: '#1C231B' }} />
          </View>
          <Text numberOfLines={2} style={[styles.caption, { fontSize: 13 * scale, lineHeight: 18 * scale, marginTop: 9 * scale }]}>{categoryName}</Text>
          <Text style={[styles.caption, { fontSize: 12 * scale, lineHeight: 17 * scale }]}>{atPrelude ? 'Starting point' : `${journey.level.categoryStep} of 5`}</Text>
        </QuietPressable>
        <View style={{ width: '51%', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#D7CCBA', paddingLeft: 29 * scale,
          alignSelf: 'flex-start', minHeight: 92 * scale }}>
          <View style={[styles.titleRow, { height: 32 * scale }]}>
            <Text style={{ fontFamily: serif, fontSize: 22 * scale, lineHeight: 28 * scale, color: ink }}>Consistency</Text>
          </View>
          <View style={{ marginTop: 10 * scale }}><ConsistencyBar fraction={consistency.indicatorFraction} scale={scale} /></View>
        </View>
      </View>}
      {/* A faint chevron in the gap above the tabs, until the pull into Journey has been used a few times. */}
      {scrollGesture && <JourneyPullHint visible={hint.visible} top={contentHeight - 9 * scale} scale={scale} onPress={openJourney} />}
    </View>
  </ScrollView>;
  return <View style={styles.screen}><CoastalTexture width={width} height={height} />
    {scrollGesture ? <GestureDetector gesture={page.gesture}><Animated.View style={[{ flex: 1 }, page.style]}>
      <GestureDetector gesture={scrollGesture}>{content}</GestureDetector>
    </Animated.View></GestureDetector> : content}
    <View style={{ width: canvasWidth, alignSelf: 'center' }}>
    <HomeNavigation active="home" scale={scale} />
  </View></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F4EBDD' }, caption: { fontFamily: 'ManropeRegular', letterSpacing: .6, color: quiet },
  titleRow: { flexDirection: 'row', alignItems: 'center' } });
