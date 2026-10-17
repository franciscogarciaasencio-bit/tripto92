import { Text, View, useWindowDimensions } from 'react-native';
import { CoastalTexture, coastalInk, coastalQuiet, coastalSerif } from '@/ui/coastal-scene';
import { HomeNavigation } from '@/ui/home-navigation';
import { Screen, Type } from '@/ui/primitives';
import { QuietPressable } from '@/ui/quiet-pressable';
import { PracticeQuestions } from '@/ui/practice-questions';
import { router } from 'expo-router';

export default function Guide() {
  const { width, height } = useWindowDimensions();
  return <View style={{ flex: 1, backgroundColor: '#F4EBDD' }}>
    <CoastalTexture width={width} height={height} />
    <Screen style={{ backgroundColor: 'transparent', paddingBottom: 24 }}>
      <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 40, lineHeight: 48, textAlign: 'center', marginTop: 32 }}>Ona</Text>
      <View style={{ gap: 20, paddingTop: 36, maxWidth: 390, alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 32, lineHeight: 40 }}>Why Ona?</Text>
        <Type>Ona helps you build a lasting meditation habit through simple practice and gentle progression.</Type>
        <Type style={{ color: coastalQuiet }}>Thoughts come and go like waves. Meditation is regularly returning to the present, patiently and without needing a perfect practice.</Type>
        <QuietPressable accessibilityRole="button" accessibilityLabel="Open the short guide to meditating" onPress={() => router.push('/introduction')}
          style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Type role="label">A short guide to meditating →</Type>
          <Type role="secondary" style={{ fontSize: 13 }}>Five short pages, with a minute of counting breaths.</Type>
        </QuietPressable>
        <View style={{ height: 1, backgroundColor: '#D8CEBC', marginVertical: 8 }} />
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 32, lineHeight: 40 }}>How to Meditate</Text>
        <Type>Find a comfortable seat. Let your back be naturally upright and your shoulders soften. Close your eyes or lower your gaze.</Type>
        <Type style={{ color: coastalQuiet }}>Notice your breath as it is. Feel the air moving, or your chest and belly gently rising and falling. You do not need to change it.</Type>
        <Type>Count each out-breath, from one to ten, then begin again at one. When you lose count, your mind has wandered: notice it without judgment and start again at one. That return is the practice.</Type>
        <Type role="secondary">Thoughts are normal. You do not need to empty your mind. Begin with what feels manageable.</Type>
        <View style={{ height: 1, backgroundColor: '#D8CEBC', marginVertical: 8 }} />
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 32, lineHeight: 40 }}>Your rhythm</Text>
        <Type>A practice counts from three active minutes: it earns Ripples and builds Consistency. Consistency multiplies the Ripples of every practice, up to eight times. Five milestones mark a rhythm that grows over about six weeks of daily practice: the bar fills once for each, takes on a new colour, and begins again.</Type>
        <Type role="secondary">A second practice, at least six hours after the first ends, helps that rhythm grow a little faster. Returning twice a day can reach the final milestone in about three weeks. Your calendar marks those days in indigo.</Type>
        <Type role="secondary">Time away gradually softens your rhythm. Regular practice brings extra Ripples automatically; come back whenever you can.</Type>
        <View style={{ height: 1, backgroundColor: '#D8CEBC', marginVertical: 8 }} />
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 32, lineHeight: 40 }}>Your journey</Text>
        <Type role="secondary">Level 100 completes Ona’s designed habit-building journey. Levels 101–125 invite you to sustain and deepen your practice.</Type>
        <Type role="secondary">After prolonged inactivity, your current level can gently ease back while part of your achievement stays protected. Levels recognize regular practice, not meditation skill or scientifically proven habit formation.</Type>
        <View style={{ height: 1, backgroundColor: '#D8CEBC', marginVertical: 8 }} />
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 32, lineHeight: 40 }}>A few gentle answers</Text>
        <PracticeQuestions />
      </View>
    </Screen>
    <HomeNavigation active="info" />
  </View>;
}
