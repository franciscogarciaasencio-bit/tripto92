/**
 * Milestones (owner, 2026-10-17): entering a new stage (Levels 5, 10, 15 …), establishing the habit at
 * Level 100 and completing the journey at 125 open a moment of their own after the practice, with a
 * guide of a few paragraphs for that part of the way. Pure presentation: nothing here changes Ripples or levels.
 *
 * The notes follow what meditation teachers and guides commonly describe as a practice grows: doubt
 * and "is it working?" at first, then restlessness, sleepiness, mind-wandering, boredom and striving,
 * missed days and feelings that surface, then patience, practice in daily life and less effort (see
 * docs/MILESTONES.md for sources). They are written without numbers or promises: no timelines,
 * multipliers or claims of what meditation will do (owner: the habit, not the maths).
 */
/** A guide for one milestone: a title and a few paragraphs (owner: "it's not a snippet, it's a guide"). */
export interface MilestoneNote { readonly title: string; readonly paragraphs: readonly string[] }
export type MilestoneKind = 'stage' | 'habit' | 'complete';
export interface Milestone {
  readonly kind: MilestoneKind;
  /** The level reached by the practice. */
  readonly level: number;
  /** For a new stage: the level before the practice, whose stage is left behind. */
  readonly previousLevel: number;
  readonly note: MilestoneNote;
}

/** Stage (1–25) of a level: Level 0 begins the first, and a new one begins at every multiple of five. */
export const stageOf = (level: number) => Math.min(25, Math.floor(Math.max(0, level) / 5) + 1);
/** True when a practice carried the journey into a stage it had not reached before. */
export const reachesNewStage = (before: number | undefined, after: number | undefined, highestBefore: number) =>
  before !== undefined && after !== undefined && stageOf(after) > stageOf(Math.max(before, highestBefore));

/** One guide per stage, keyed by the level that begins it (5, 10, … 120; Level 100 is the habit). */
export const STAGE_NOTES: Readonly<Record<number, MilestoneNote>> = Object.freeze({
  5: { title: 'Wondering if you’re doing it right?', paragraphs: [
    'Congratulations on reaching Level 5. You have sat down, again and again, and that is the hardest part of meditation. Right now it is completely normal to wonder whether you are doing it right, or whether anything is happening at all. Almost everyone who starts goes through this, and many people stop here: not because they failed, but because they expected to feel calm straight away.',
    'Here is what is usually happening. In the first days, most people don’t feel peaceful; they notice how busy their mind is. Plans, small worries, a song, the urge to check the time. That is not a sign that meditation isn’t working. It is the first thing meditation shows you: your mind as it has always been, seen clearly for perhaps the first time.',
    'There is no perfect way to do this. If your mind wandered and, at some point, you noticed and came back to the breath, you meditated well. Each return is the practice itself. Doubt is just another thought: when it appears, notice it, let it be, and begin counting again at one. Short practices that happen every day do more than long ones that happen rarely, and a regular moment, right after something you already do each day, makes returning easier.',
    'From here on, Ona will guide you through every step. Every five levels you will reach a new stage, and with it a guide like this one: what people commonly experience at that point of their practice, and how to meet it. For now, just keep coming back.',
  ] },
  10: { title: 'Not sure it’s working yet?', paragraphs: [
    'Level 10. You have kept coming back, and you may be asking yourself whether this is really doing anything. That question is normal, and it tends to arrive right about now: the novelty of the first days has worn off, and the change you hoped for has not clearly shown up.',
    'What meditation changes tends to arrive quietly. It rarely comes as a big moment of calm in the middle of a practice. More often people notice it outside the practice, and only afterwards: a pause before reacting to something irritating, noticing the breath while waiting in line, a slightly easier evening. Some practices will feel settled and others will race from start to finish. Both count just as much.',
    'This is also when many people quietly stop, usually with a reasonable voice saying there is no time today. Expect that voice, and don’t argue with it: keep the practice small instead. A few minutes at the same time each day keeps the thread unbroken, and the thread is what becomes a habit. If you are curious, notice how you feel just before and just after a practice. The difference is often small, and it is real.',
    'For now, showing up is the whole task. You don’t need to feel anything special for a practice to count. Keep going: at Level 15, Ona will be here with the next guide.',
  ] },
  15: { title: 'Restless?', paragraphs: [
    'An itch, an urge to check the time, a body that wants to move: restlessness visits most practices. You don’t need to fight it. Notice where you feel it, let it be there, and let it pass in its own time.',
  ] },
  20: { title: 'Sleepy?', paragraphs: [
    'Drowsiness is one of the most common visitors. Sit a little more upright, let in some fresh air or light, or try practising at a more awake time of day. If you are simply tired, that is worth noticing too.',
  ] },
  25: { title: 'Every return counts', paragraphs: [
    'Your mind will wander many times in a single practice. Each time you notice and gently come back, you are doing the practice, not failing at it. Come back kindly, without scolding yourself.',
  ] },
  30: { title: 'Some days you won’t feel like it', paragraphs: [
    'Those are the days that build a habit. A short practice still counts, and a few quiet minutes on a difficult day are worth more than a perfect practice you skip.',
  ] },
  35: { title: 'Bored?', paragraphs: [
    'Boredom often means we have stopped looking closely. Try meeting the next breath as if it were your first: where does it begin, where does it turn, how does it end? No two are quite the same.',
  ] },
  40: { title: 'No need to chase calm', paragraphs: [
    'Some practices are calm and some are busy. Both count. Trying hard to feel peaceful usually gets in the way. Let each practice be what it is, and simply keep returning.',
  ] },
  45: { title: 'Small changes', paragraphs: [
    'You might notice a brief pause before reacting, or a moment of awareness of your breath in the middle of the day. These moments are easy to miss, and worth noticing when they come.',
  ] },
  50: { title: 'Part of your day', paragraphs: [
    'Practising at the same time, or right after something you already do each day, makes returning easier. The fewer decisions it takes, the more naturally it happens.',
  ] },
  55: { title: 'If you miss a day', paragraphs: [
    'Missing a day does not undo a habit. What matters is coming back the next day, without guilt and without trying to make up for it. Just begin again.',
  ] },
  60: { title: 'When feelings come up', paragraphs: [
    'Sitting quietly sometimes lets feelings rise: sadness, irritation, old memories. Meet them with kindness and let them move through. If something feels like too much, open your eyes, take a break, and talk with someone you trust.',
  ] },
  65: { title: 'Be kind to yourself', paragraphs: [
    'Notice how you speak to yourself when a practice doesn’t go the way you wanted. Try speaking as you would to a good friend who is learning something new.',
  ] },
  70: { title: 'Attention that stays', paragraphs: [
    'You may find your attention resting on the breath for longer stretches. Enjoy it lightly, without holding on. When it slips away, you already know what to do: come back.',
  ] },
  75: { title: 'Not a straight line', paragraphs: [
    'Some practices will feel like going backwards. That is part of every path. What you are building is not one good practice, but the habit of returning.',
  ] },
  80: { title: 'Beyond the practice', paragraphs: [
    'Try bringing the same attention to one ordinary moment each day: a few breaths before you start work, the warmth of a cup, the feeling of your steps. Meditation doesn’t end when the practice does.',
  ] },
  85: { title: 'When life gets busy', paragraphs: [
    'Busy weeks are when habits are tested. On those days, keep the smallest version: a few minutes, wherever you are. Keeping the thread matters more than the length.',
  ] },
  90: { title: 'Patience', paragraphs: [
    'Things unfold at their own pace, in meditation and outside it. Some people notice they have become a little more patient, with others and with themselves. It grows the way your practice did: slowly, by returning.',
  ] },
  95: { title: 'Almost a habit', paragraphs: [
    'Meditation is becoming part of who you are, not only something you do. Trust the practice you have built, and keep going.',
  ] },
  105: { title: 'Beginner’s mind', paragraphs: [
    'After many practices it is easy to sit on autopilot. Try sitting as if for the very first time: curious, open, not knowing what this practice will bring.',
  ] },
  110: { title: 'Everywhere', paragraphs: [
    'Waiting in line, walking, listening to someone you love: each can be a moment of practice. The quiet you have been building goes with you.',
  ] },
  115: { title: 'Less effort', paragraphs: [
    'With time, practice asks for less effort. Notice what happens when you stop trying to make anything happen and simply let the breath breathe itself.',
  ] },
  120: { title: 'Your own teacher', paragraphs: [
    'You know your practice now: what helps, what gets in the way, how to come back. Trust what you have learned, and share it if someone asks.',
  ] },
});
/** Level 100: the habit-building journey Ona was made for. */
export const HABIT_NOTE: MilestoneNote = Object.freeze({ title: 'Your habit is established', paragraphs: [
  'Meditation has become part of your life. This is what Ona was made for: not a perfect practice, but a lasting one, built one return at a time. Well done.',
  'Even a well-established habit needs a little care. Keep the practice simple and steady, and let it change with you as your life changes.',
] });
/** Level 125: the end of the levels, not of the practice. */
export const COMPLETE_NOTE: MilestoneNote = Object.freeze({ title: 'The whole journey', paragraphs: [
  'You have walked every stage of Ona’s journey. The practice itself has no last level. Keep returning, for its own sake.',
] });

/**
 * The first stage has no moment of its own (it is where everyone starts), so its guide lives in Journey,
 * where every reached stage can be revisited with its guide (owner, 2026-10-17).
 */
export const FIRST_STAGE_NOTE: MilestoneNote = Object.freeze({ title: 'Where everyone begins', paragraphs: [
  'Welcome to the first stage of your journey. If your mind feels restless the moment you sit down, jumping from one thought to the next, you are exactly where every meditator begins. Teachers have long compared the untrained mind to a monkey swinging from branch to branch. Nothing is wrong with yours.',
  'The practice for now is simple. Sit comfortably, let the breath move on its own, and count each out-breath from one up to ten. When you notice that you have drifted away, and you will, many times, gently begin again at one. Noticing is not a failure: it is the moment of meditation.',
  'Keep your practices short and easy to repeat, at a similar moment each day. What you are building now is not calm, but the habit of returning. With every new stage, Ona will open a guide like this one.',
] });
/** First and last level of a stage (1–25): Levels 0–4, 5–9 … 115–119, and 120–125 for the last. */
export const stageLevels = (stage: number) => ({ first: (stage - 1) * 5, last: stage >= 25 ? 125 : stage * 5 - 1 });
/** The stages reached so far, in order: the first through the stage of the highest level. */
export const reachedStages = (highestLevel: number) => Array.from({ length: stageOf(highestLevel) }, (_, index) => index + 1);
/**
 * The guides that belong to a stage, as Journey shows them when the stage is revisited: the guide that
 * opened it (the habit's for the stage that begins at Level 100) and, once reached, the journey's end.
 */
export function stageGuides(stage: number, highestLevel: number): readonly MilestoneNote[] {
  if (stage <= 1) return [FIRST_STAGE_NOTE];
  const { first } = stageLevels(stage);
  const opening = first === 100 ? HABIT_NOTE : STAGE_NOTES[first];
  return [...(opening ? [opening] : []), ...(stage === 25 && highestLevel >= 125 ? [COMPLETE_NOTE] : [])];
}

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
  const note = STAGE_NOTES[(stageOf(after) - 1) * 5];
  return note ? { kind: 'stage', level: after, previousLevel: before, note } : null;
}
