# Ona game system

Ona supports a lasting meditation habit. Ripples and levels are game metaphors,
not measurements of mental health, brain adaptation, meditation skill or proven habit
formation. UI shows whole Ripples, never internal XP, credit requirements or multipliers.

## Current rules: progression_v7 / ona_habit_levels_v1 (thresholds re-paced 2026-10-17)

All rules use plain TypeScript, explicit absolute timestamps and captured calendar
contexts. Import the public API from src/domain/progression/index.ts.

| Code | Authority |
| --- | --- |
| meditation/session.ts, timer.ts | Validated sessions and pure running/paused/finished cursors |
| progression/rules.ts | Frozen earning configurations V1–V7 |
| earnings.ts, occasions.ts | Duration, weighting and incremental awards |
| consistency.ts | Continuous Consistency and immutable calendar anchors |
| habit.ts | Current effective progress, protected levels and reward plans |
| journey.ts | Stable category IDs, current/historical level definitions and entry gates |
| state.ts, snapshot.ts, decay.ts | Versioned transitions and compatibility projections |

### V7 (owner, 2026-10-17): what changed

Activated prospectively when the database opens (store.ts; default `progression_v7`). V1–V6 receipts
stay exactly as earned. Simulated with the owner before building (tests/domain/progression-v7.test.cjs).

- **Length** (`linear_logarithmic_v2`): 16 Ripples a minute up to 15 minutes, then +80 per doubling
  up to 400 at 60 minutes, rounded to 5: 3 min 50 · 5 min 80 · 10 min 160 · 15 min 240 · 20 min 275 ·
  30 min 320 · 45 min 365 · 60+ min 400. Under three minutes: nothing.
- **Same day**: 100%, 75%, then **50%** (was 25%), then nothing; 90-minute occasions as before.
- **Consistency**: full after **42** contributions (six weeks daily, three weeks twice a day; a second
  contribution still needs six hours after the first ends). Bonus up to **+700%** (×8), eased out:
  share = 1 − (1 − C)² (`consistencyCurve: 'ease_out_v1'`, exact millionths), so 1 contribution is
  +33%, 7 are +214%, 21 are +525%. The bar uses the same curve. Decay unchanged (half in 4 days).
  Activation carries the V6 fraction over in proportion.
- **Levels** (journey.ts `HABIT_LEVELS`): 1–49 unchanged; from 50 each level costs progressively more
  (`steepXpCenti` 9,297,500 on a square curve that continues to 125, so every level costs a little more
  than the last: Level 100 about 3,900 Ripples, 101 about 3,980, 125 about 5,700). Level 125 has **no**
  calendar gate any more. Nobody had reached Level 50.
- Daily 10 minutes: Level 10 on day 5, 50 on day 19, 100 on day 105, 125 on day 200. 20 minutes twice
  a day: Level 100 on day 37, 125 on day 69. The owner prefers adding levels after 125 to making these harder.
- In-app text never shows these numbers (ONA_UI.md "Writing rule").
- Each award keeps its split (`incrementalBaseCentiXp` + `bonusCentiXp`); practice details show it.

The sections below describe the released V5/V6 behaviour that V7 builds on.

### Sessions and earnings

Timer modes (meditation/timer.ts): open-ended (Finish completes), fixed (a chosen length that
ends by itself; finishing earlier is still `completed`) and legacy timed cursors (finishing
before the target was `ended_early`). Only the timer differs; earning rules are unchanged.

Completed practice with **180 active seconds** qualifies for Consistency and qualifying
dates. Pauses never count. **V6 (2026-10-16, owner: "below three minutes just doesn't count"):**
shorter practices stay in history but earn nothing (`minimumEarningSeconds: 180`); everything else
is V5. It is activated prospectively when the database opens (store.ts release path; default
`progression_v6` in database.ts). Short-run receipts earned under V3–V5 stay exactly as released;
the calendar no longer marks short practices, and completion shows a quiet note instead of panels.

For qualifying active minutes m:

~~~text
Q(m) = 60 + 20 × log2(min(m, 60) / 5)
~~~

Three minutes earns 45.26 base Ripples. Below three minutes the reward scales linearly
from that rounded fixed-point value. Duration growth stops at 60 minutes.
Occasion weights per captured occasion date are 100%, 75%, 25%, then zero.
Qualifying sessions with less than 90 minutes from previous end to next start extend
one occasion, even across midnight; 90 minutes exactly starts another occasion.
Its first session fixes the occasion's date/weight. Short sessions do not pool into
qualifying occasions. Extensions award only the new difference, never the whole total
again. Zero-reward qualifying sessions still count as practice and meditation time.

### Consistency

C starts at zero and uses 60,000,000 integer units. Each eligible qualifying completion
adds 1,000,000 units (1/60), capped at full. First qualifying practice on a captured date
earns one contribution; a second requires six absolute hours after an earlier qualifying
end on that date. At most two contributions per date, which remain one distinct date.
Daily practice reaches full in 60 days, twice daily in 30. Each complete inactive date
retains 0.840896 of C using a separate million-unit ratio (a four-day half-life).
Qualifying dates protect momentum even when reward/contribution caps are reached.

New incremental frequency-weighted base receives a bonus of round(base × 0.40 × C)
in centi-Ripples, using the updated C. Existing earnings never change when C changes;
nearby extensions receive the current bonus only on new base. Receipts anchor the
score and logical date, and monotonic settlement prevents travel rewinding decay.
UI displays Consistency, one continuous thin bar and five dots at 20/40/60/80/100% of C.
Dots fill/soften with the same animated score; percentages and multipliers are not shown.

V5's bar uses the same score as the bonus. The released V1–V4 visible bar remains
a separate read-only projection (`consistency-indicator.ts`,
ona_consistency_indicator_v1). Each captured day with completed practice of at least
180 active seconds adds 1/14 of its capacity, capped at full. Extra sessions on the
same date do not accelerate this display. Fourteen consecutive qualifying dates fill
it; short practices and pauses do not. Each complete inactive date retains 0.840896
of its current fill; returning adds the normal daily step, without a streak reset.
The open/current date is not a complete inactive date. Captured dates remain stable
after travel, and the settlement cursor prevents clock/date rewind on snapshot reads.

ProgressSnapshot.consistency.indicatorFraction equals fraction under V5; legacy versions
retain the fourteen-day projection. V5 completion endpoints come from the immutable
habit receipt, including zero-active sessions without an award. Cosmetic animation never saves.

V4's frozen bonus algorithm remains C += 15% of remaining capacity in millionths. V5
activation carries settled bonus momentum forward without changing historical earnings.
An immutable ConsistencyActivation captures source/target versions, logical asOf, history
prefix counts and score. Migration 10 stores it separately; a new V5 state has a zero
anchor. Existing users may consequently begin V5 with retained momentum rather than zero.

### Lifetime, current progress and levels

- Lifetime Ripples is the immutable sum of actual rewards; it never decays.
- Effective progress P determines current level and can decay.
- Highest achieved level H is permanent until explicit full practice reset.
- Total active meditation time is independent of Ripples.

Level 0 is Monkey Mind. Levels 1–125 use stable category IDs, not display names as
identity. Current thresholds in journey.ts are versioned as ona_habit_levels_v1:

~~~text
r = (L − 1) / 124
threshold(L) = round(12000 + 1400000r + 2688000r^1.75) centi-Ripples
~~~

Level 1 also requires qualifying practice. (Until 2026-10-17 Level 125 also required 365 distinct
qualifying dates and 365 elapsed days; that gate was removed with V7.) Intermediate levels follow effective Ripples
after the initial entry gate. Daily ten-minute V5 simulations reach Level 100 on
day 272 and Level 125 on day 375. Level 100 is Ona's habit-building milestone;
101–125 represent continued practice, not a scientific certification.
The bar measures effective progress between thresholds; a short practice can advance
Level 0 without unlocking Level 1. Historical legitimate achievements are preserved
through a documented migration seed, not an invented Ripple award.

### Inactivity and protected levels

Protected level = ceil(H / 2); floor F is that level's current threshold (or zero).
Three **complete** inactive calendar dates protect P. Each further complete inactive
date applies P = F + round((P − F) × 0.981099), in centi-Ripples.
Highest level and lifetime rewards are preserved. Returning earns normally, without debt.
Short sessions never restart grace; before any qualifying practice, the first saved
practice starts the inactivity clock. Repeated opening at the same context is stable.

After Monday practice, Tuesday/Wednesday/Thursday protect levels; if Friday contains
no qualifying practice, its first loss appears Saturday at 00:00. Consistency declines
after each complete inactive date, including those protected for level progression.

## Worked examples (new V5 practice)

- First three-minute practice: 45.26 base + 0.30 bonus = 45.56 Ripples (46 displayed),
  1/60 Consistency and Level 0. A short practice advances progress modestly.
- First ten-minute practice: 80 base + 0.53 bonus = 80.53 Ripples; C becomes 1/60.
- Second ten-minute practice on the same date, at least six hours after the first end:
  60 weighted base + 0.80 bonus = 60.80; C becomes 2/60. This is still one practice date.
- Nearby ten + ten minutes: one 20-minute occasion with 100 total base. Only the
  20-base extension is awarded later; no duplicate 80-base reward or Consistency credit.
- Miss one complete day: lifetime and effective progress remain; C declines modestly.
- Miss three complete days: level progress is still protected; C declines each day.
  Further complete inactive days gently reduce effective progress toward its floor.

## Calendar streaks: ona_streaks_v1 (presentation only)

`src/domain/progression/streaks.ts`. Streaks never change Ripples, levels, Consistency or credits.

- **Active day**: at least one completed practice of 180+ active seconds (the practice-credit test).
  Shorter practices stay visible in the calendar (dot) but do not count.
- **Active week**: Monday–Sunday with at least three active days.
- **Full month**: every week that belongs to the month is active. A week belongs to the month holding
  its Thursday (most of its days), so each week belongs to exactly one month (4 or 5 per month).
- **Current streak**: counted back from today. A day, week or month still in progress never breaks a
  streak; it breaks only once that period can no longer count (a week is missed as soon as its
  remaining days cannot reach three). **Best** is the longest run so far.
- Dates are the saved local dates of practice; nothing is reinterpreted in today's time zone.

## Precision, history and calendar

Persist/domain XP values are integer centi-Ripples (100 = one Ripple). Round at earning
and decay boundaries; never rewrite history from UI-rounded values. Completion display
allocates rounded base/bonus inside the rounded total so displayed parts sum correctly.

Session IDs are stable opaque unique IDs. Absolute times are safe-integer UTC Unix
milliseconds; session durations are integer seconds. Each session stores its historical
local date and IANA zone. Travel never reassigns old dates; actual timestamps govern
occasion separation and six-hour gaps. Every time-dependent operation accepts asOf;
overlapping sessions fail explicitly.

Clocks that step back (2026-10-15): settlement is forward-only. A requested moment earlier than the
stored `asOf` settles at the stored moment itself, date included (`forwardOnly`; reads and snapshots
use it as `readingContext`), so every replay of history reproduces it exactly. A practice ending
before the stored moment is recorded with its true times when its date is at most one day before the
settled calendar and no consistency activation or rank achievement is dated after its end; then its
award is exactly what the integrity replay reproduces. Older backdated practices still fail as a
rewind, and resets refuse a moment before the settlement. For every request at or after the stored
moment these functions are the identity, so released V1–V5 histories and receipts are unchanged.

Awards are append-only incremental receipts with session/occasion references, amount,
breakdown, timestamp and frozen rules version. Retrying an identical session is a no-op;
conflicting content fails. Future formula changes must create a new rules version and
affect new awards only. Existing V1–V3 receipts/configurations remain validated unchanged.
An explicit version change closes the previous open occasion rather than mixing formulas.

V1 named ranks, levels.ts's earlier 100-level system, older journey curves and capped
balance decay remain **historical compatibility**, not current UI rules. ProgressSnapshot
still exposes that compatibility balance/rank. App code uses the repository's
getCurrentPracticeProgress().journey and .habit for current/highest levels.

Reset All Practice Data is the only user-requested deletion: all practices, achievements,
reward receipts, timer/completion caches and calendar activity are removed atomically;
preferences remain. See [Architecture](ARCHITECTURE.md) for that persistence contract.

Central current definitions: PROGRESSION_V5, LINEAR_CONSISTENCY_V1,
PRACTICE_CREDIT_RULES, HABIT_RULES and HABIT_LEVEL_PACING. Released versions are immutable;
future balancing requires new versioned definitions and explicit migration/activation.
Run npm run test:domain and node scripts/simulate-progression-v5.cjs after current
progression changes. simulate-habit.cjs retains V4 evidence. Research/model alternatives
and full scenario results are in [V5 evidence](evidence/progression-v5/README.md).

Category IDs and released level metadata remain stable. UI category-presentation.ts
resolves the current 25 names/icons from original vector sources in assets/ona/categories.json.
Level 0 remains Monkey Mind; numbered Levels 1–5 display Early Steps. Level 100 retains
Habit Established. Renaming presentation never edits saved achievements or formulas.
