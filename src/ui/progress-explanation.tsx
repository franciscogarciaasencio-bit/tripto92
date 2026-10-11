import { router } from 'expo-router';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import { Action, Header, Notice, Screen, styles, Type } from './primitives';

export function ProgressExplanation({ firstUse = false }: { firstUse?: boolean }) {
  const app = useOna();
  const dismiss = () => { void app.dismissExplanation(); };
  return <Screen><Header title={firstUse ? 'Welcome to Ona' : 'How progress works'} back={firstUse ? undefined : () => router.back()} />
    <View style={{ gap: 20, paddingTop: 28, paddingBottom: 16 }}>
      <Type>Ona helps you build a meditation habit, one practice at a time.</Type>
      <Type>Level 100 marks the completion of your habit-building journey. Levels 101–125 help you strengthen and sustain it.</Type>
      <Type>Practise for at least 3 active minutes to earn practice credit. Two sessions on the same day count as a double-session day when each lasts at least 3 active minutes and the second starts at least 6 hours after the first ends. A double-session day earns 2 practice credits.</Type>
      <Type>Your lifetime level stays with you. Your consistency multiplier reflects recent practice.</Type>
      {!firstUse && <>
        <Type role="secondary">For example: finish at 08:00, start again at 14:00 → 2 credits. Start at 13:59:59 → 1 credit. Both practices must be saved and have at least 3 active minutes. Two credits still represent one real practice date.</Type>
        <Type role="secondary">XP has separate rules: nearby qualifying sessions form one occasion; a 90-minute end-to-start gap starts another. Daily occasion weights are 100%, 75%, 25%, then zero. The consistency bonus uses the seven preceding practice dates, excludes today, and reaches 1.40×.</Type>
        <Type role="secondary">Each lifetime level needs its XP, credit and real-date requirements. Level 125 also needs 365 real practice dates and 365 elapsed days since your first qualifying completion. Missing dates never resets lifetime practice. These are Ona’s product milestones, not a measure of meditation ability.</Type>
      </>}
    </View>
    {firstUse && <View style={styles.footer}><Notice>{app.error ? 'Your choice could not be saved. Please try again.' : null}</Notice>
      <Action disabled={app.busy} onPress={dismiss}>Start practising</Action><Action quiet disabled={app.busy} onPress={dismiss}>Skip</Action>
    </View>}
  </Screen>;
}
