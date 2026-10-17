# Milestone notes

Owner request (2026-10-17): when a practice reaches a new stage (Levels 5, 10, 15 … 120), the habit (Level
100) or the end of the journey (Level 125), show a rewarding moment and a short note for that part of
the way. Later the same day: "it's not a snippet, it's a guide": each is a title and three or four
paragraphs, grounded in how meditation guides describe each phase; the first guide (Level 5) says Ona
will guide every step from here. Levels 5 and 10 are written in full and await the owner's review;
the others are still one paragraph until approved. The texts live in `src/ui/milestones.ts`; the moment in `src/ui/milestone-moment.tsx`. Notes
never name a stage (sealed stages stay a surprise) and never use numbers or promises.

## Arc

The order follows what meditation guides commonly describe as a practice grows, mapped to how soon
each stage arrives under rules V7 (daily ten-minute practice reaches a new stage every couple of days
at first, then every few weeks):

1. First days: doubt about doing it right; "is it working?" Benefits arrive quietly; showing up is
   the task.
2. First weeks: the usual visitors (restlessness, sleepiness, mind-wandering, boredom) and the
   attitude of returning kindly: each return is the practice; no need to chase calm.
3. Making it a habit: small changes noticed in the day; anchoring practice to a time or an existing
   routine; a missed day does not undo a habit; practise on days you don't feel like it.
4. Deeper: feelings that surface (with a gentle safety line: open your eyes, pause, talk with someone
   you trust), self-kindness, steadier attention, progress that is not a straight line.
5. Into life: practice beyond the cushion, keeping the thread in busy weeks, patience.
6. Level 100: the habit is established, the purpose of Ona. Beyond: keeping it alive, beginner's mind,
   practice everywhere, less effort, trusting what you have learned. Level 125: the practice has no
   last level.

## Sources

- First week, day by day (busy mind as the first thing noticed, resistance and "no time", small changes
  outside practice, consistency over perfection, tying practice to an existing routine):
  Declutter The Mind, "First Week of Meditation: What to Expect Day by Day".
- Why people quit early (expecting a quick fix; early frustration), effects arriving gradually:
  Mindworks, "How Long Does Meditation Take to Work?".
- "There's no way to do it wrong"; many first-timers quit feeling they failed: Tricycle, "Meditation
  101: Less is more".

- Common beginner difficulties and responses (doubt, restlessness, irritation, sleepiness, wanting):
  Mindful.org, "Overcome These Five Obstacles to Your Mindfulness Practice".
- "Doing it wrong", boredom, constant thinking, impatience, self-criticism, emotions:
  Headspace, "Trouble meditating" (meditation-101).
- Stages of attention training (establishing a practice; mind-wandering; forgetting and dullness;
  strong distractions and emotions): Culadasa, *The Mind Illuminated* (summary notes).
- Attitudes of practice (non-judging, patience, beginner's mind, trust, non-striving, acceptance,
  letting go): Jon Kabat-Zinn, as summarised by Trvst, "7 Attitudes of Mindfulness".
- Habit formation: Lally et al. (2009/2010), European Journal of Social Psychology; automaticity
  plateaued after about 66 days on average (range 18–254), and missing a single opportunity did not
  reduce the chance of forming the habit (summarised by PsyBlog).
- Unpleasant experiences: Schlosser et al. (2019), PLOS ONE: about a quarter of regular meditators
  reported a particularly unpleasant meditation-related experience, hence the gentle safety line.

These numbers inform the arc only; the app never shows them.
