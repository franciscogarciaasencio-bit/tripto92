import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { colors, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

const QUESTIONS = [
  { id: 'thoughts', question: 'What if my mind won’t settle?', answer: 'Having thoughts is normal. Notice that your attention wandered, then gently return to your natural breath. Counting out-breaths from one to ten can help; when you lose count, begin again at one. You can return as many times as you need.' },
  { id: 'short', question: 'Is a short practice worthwhile?', answer: 'Three quiet minutes are enough. A practice counts toward Ripples, Consistency and your calendar from three active minutes; shorter ones stay in your history. There is no need to rush.' },
  { id: 'return', question: 'What if I miss a day?', answer: 'Come back when you can. One missed day does not reset your journey. Time away gently softens Consistency; after a longer pause, current level progress can ease back while part of your achievement stays protected.' },
  { id: 'time', question: 'Can I meditate without watching time?', answer: 'Tap the time during meditation to hide it. Tap “Show time” to bring it back. Your practice keeps running, and Pause and Finish stay available. If you choose a length before you begin, the practice ends by itself when that time is reached.' },
  { id: 'silence', question: 'Can I practice in silence?', answer: 'Before you begin, choose Silence under Sound and leave the interval bell off. In Settings you can also turn off the starting and ending bells. Your choices are remembered for your next practice.' },
] as const;

/** Secondary practical help. One answer at a time, with no effect on timer, sound or progression. */
export function PracticeQuestions() {
  const [open, setOpen] = useState<string | null>(null);
  const reduced = useReducedMotion(), accessibility = reduced ? ReduceMotion.Always : ReduceMotion.Never;
  return <View>
    {QUESTIONS.map(({ id, question, answer }) => <View key={id} style={{ borderBottomWidth: 1, borderColor: colors.line }}>
      <QuietPressable accessibilityRole="button" accessibilityLabel={question} accessibilityState={{ expanded: open === id }} aria-expanded={open === id}
        onPress={() => setOpen(current => current === id ? null : id)} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 }}>
        <Type style={{ flex: 1 }}>{question}</Type>
        <Type role="secondary" accessible={false} importantForAccessibility="no">{open === id ? '−' : '+'}</Type>
      </QuietPressable>
      {open === id && <Animated.View entering={FadeIn.duration(UI_MOTION.reveal).reduceMotion(accessibility)}
        style={{ paddingBottom: 20, paddingRight: 22 }}>
        <Type role="secondary">{answer}</Type>
      </Animated.View>}
    </View>)}
  </View>;
}
