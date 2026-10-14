import type { Intention } from '../data/preferences';

const COPY: Record<Intention, { readonly label: string; readonly line: string }> = {
  calm: { label: 'Calm', line: 'Settle into calm' },
  focus: { label: 'Focus', line: 'Rest your attention' },
  rest: { label: 'Rest', line: 'Let the body rest' },
  gratitude: { label: 'Gratitude', line: 'Notice what is good' },
  kindness: { label: 'Kindness', line: 'Be kind to yourself' },
};

export const intentionLabel = (intention: Intention) => COPY[intention].label;
/** The quiet line under the timer during a practice. */
export const sessionLine = (intention: Intention | null, paused: boolean) =>
  paused ? 'Take your time' : intention ? COPY[intention].line : 'Just be here';
