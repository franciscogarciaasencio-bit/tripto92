/**
 * Milestones (owner, 2026-10-17): entering a new stage (every five levels), establishing the habit at
 * Level 100 and completing the journey at 125 open a moment of their own after the practice, with a
 * short note for that part of the way. Pure presentation: nothing here changes Ripples or levels.
 *
 * The notes follow what meditation teachers and guides commonly describe as a practice grows: doubt
 * and "is it working?" at first, then restlessness, sleepiness, mind-wandering, boredom and striving,
 * missed days and feelings that surface, then patience, practice in daily life and less effort (see
 * docs/MILESTONES.md for sources). They are written without numbers or promises: no timelines,
 * multipliers or claims of what meditation will do (owner: the habit, not the maths).
 */
export interface MilestoneNote { readonly title: string; readonly body: string }
export type MilestoneKind = 'stage' | 'habit' | 'complete';
export interface Milestone {
  readonly kind: MilestoneKind;
  /** The level reached by the practice. */
  readonly level: number;
  /** For a new stage: the level before the practice, whose stage is left behind. */
  readonly previousLevel: number;
  readonly note: MilestoneNote;
}

/** Stage (five-level category) of a level; Level 0 shares the first stage with Levels 1–5. */
export const stageOf = (level: number) => Math.max(1, Math.ceil(level / 5));
/** True when a practice carried the journey into a stage it had not reached before. */
export const reachesNewStage = (before: number | undefined, after: number | undefined, highestBefore: number) =>
  before !== undefined && after !== undefined && stageOf(after) > stageOf(Math.max(before, highestBefore));

/** One note per stage, keyed by the stage's first level (6, 11, … 121). */
export const STAGE_NOTES: Readonly<Record<number, MilestoneNote>> = Object.freeze({
  6: { title: 'Wondering if you’re doing it right?',
    body: 'Almost everyone does at this point, and it is a normal part of the process. There is no perfect meditation: if your mind wandered and you noticed, you were doing it right. Doubt is just another thought. Notice it, and come back to the breath.' },
  11: { title: 'Not sure it’s working yet?',
    body: 'That is normal too. What meditation changes tends to arrive quietly, and rarely this early. For now, showing up is the whole task. Keep going: Ona will be here with a note at each new stage.' },
  16: { title: 'Restless?',
    body: 'An itch, an urge to check the time, a body that wants to move: restlessness visits most practices. You don’t need to fight it. Notice where you feel it, let it be there, and let it pass in its own time.' },
  21: { title: 'Sleepy?',
    body: 'Drowsiness is one of the most common visitors. Sit a little more upright, let in some fresh air or light, or try practising at a more awake time of day. If you are simply tired, that is worth noticing too.' },
  26: { title: 'Every return counts',
    body: 'Your mind will wander many times in a single practice. Each time you notice and gently come back, you are doing the practice, not failing at it. Come back kindly, without scolding yourself.' },
  31: { title: 'Some days you won’t feel like it',
    body: 'Those are the days that build a habit. A short practice still counts, and a few quiet minutes on a difficult day are worth more than a perfect practice you skip.' },
  36: { title: 'Bored?',
    body: 'Boredom often means we have stopped looking closely. Try meeting the next breath as if it were your first: where does it begin, where does it turn, how does it end? No two are quite the same.' },
  41: { title: 'No need to chase calm',
    body: 'Some practices are calm and some are busy. Both count. Trying hard to feel peaceful usually gets in the way. Let each practice be what it is, and simply keep returning.' },
  46: { title: 'Small changes',
    body: 'You might notice a brief pause before reacting, or a moment of awareness of your breath in the middle of the day. These moments are easy to miss, and worth noticing when they come.' },
  51: { title: 'Part of your day',
    body: 'Practising at the same time, or right after something you already do each day, makes returning easier. The fewer decisions it takes, the more naturally it happens.' },
  56: { title: 'If you miss a day',
    body: 'Missing a day does not undo a habit. What matters is coming back the next day, without guilt and without trying to make up for it. Just begin again.' },
  61: { title: 'When feelings come up',
    body: 'Sitting quietly sometimes lets feelings rise: sadness, irritation, old memories. Meet them with kindness and let them move through. If something feels like too much, open your eyes, take a break, and talk with someone you trust.' },
  66: { title: 'Be kind to yourself',
    body: 'Notice how you speak to yourself when a practice doesn’t go the way you wanted. Try speaking as you would to a good friend who is learning something new.' },
  71: { title: 'Attention that stays',
    body: 'You may find your attention resting on the breath for longer stretches. Enjoy it lightly, without holding on. When it slips away, you already know what to do: come back.' },
  76: { title: 'Not a straight line',
    body: 'Some practices will feel like going backwards. That is part of every path. What you are building is not one good practice, but the habit of returning.' },
  81: { title: 'Beyond the practice',
    body: 'Try bringing the same attention to one ordinary moment each day: a few breaths before you start work, the warmth of a cup, the feeling of your steps. Meditation doesn’t end when the practice does.' },
  86: { title: 'When life gets busy',
    body: 'Busy weeks are when habits are tested. On those days, keep the smallest version: a few minutes, wherever you are. Keeping the thread matters more than the length.' },
  91: { title: 'Patience',
    body: 'Things unfold at their own pace, in meditation and outside it. Some people notice they have become a little more patient, with others and with themselves. It grows the way your practice did: slowly, by returning.' },
  96: { title: 'Almost a habit',
    body: 'Meditation is becoming part of who you are, not only something you do. Trust the practice you have built, and keep going.' },
  101: { title: 'Keeping it alive',
    body: 'Even a well-established habit needs a little care. Keep the practice simple and steady, and let it change with you as your life changes.' },
  106: { title: 'Beginner’s mind',
    body: 'After many practices it is easy to sit on autopilot. Try sitting as if for the very first time: curious, open, not knowing what this practice will bring.' },
  111: { title: 'Everywhere',
    body: 'Waiting in line, walking, listening to someone you love: each can be a moment of practice. The quiet you have been building goes with you.' },
  116: { title: 'Less effort',
    body: 'With time, practice asks for less effort. Notice what happens when you stop trying to make anything happen and simply let the breath breathe itself.' },
  121: { title: 'Your own teacher',
    body: 'You know your practice now: what helps, what gets in the way, how to come back. Trust what you have learned, and share it if someone asks.' },
});
/** Level 100: the habit-building journey Ona was made for. */
export const HABIT_NOTE: MilestoneNote = Object.freeze({ title: 'Your habit is established',
  body: 'Meditation has become part of your life. This is what Ona was made for: not a perfect practice, but a lasting one, built one return at a time. Well done.' });
/** Level 125: the end of the levels, not of the practice. */
export const COMPLETE_NOTE: MilestoneNote = Object.freeze({ title: 'The whole journey',
  body: 'You have walked every stage of Ona’s journey. The practice itself has no last level. Keep returning, for its own sake.' });

/**
 * The one milestone a practice reached, if any (the most significant when several were crossed at once):
 * the journey's end, then the habit, then a new stage. `highestBefore` keeps each one to the first time.
 */
export function milestoneOf(before: number | undefined, after: number | undefined, highestBefore: number): Milestone | null {
  if (before === undefined || after === undefined || after <= before) return null;
  const highest = Math.max(before, highestBefore);
  if (after >= 125 && highest < 125) return { kind: 'complete', level: after, previousLevel: before, note: COMPLETE_NOTE };
  if (after >= 100 && highest < 100) return { kind: 'habit', level: after, previousLevel: before, note: HABIT_NOTE };
  if (!reachesNewStage(before, after, highestBefore)) return null;
  const note = STAGE_NOTES[(stageOf(after) - 1) * 5 + 1];
  return note ? { kind: 'stage', level: after, previousLevel: before, note } : null;
}
