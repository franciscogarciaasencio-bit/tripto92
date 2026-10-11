# Ona game system

Ona encourages a meditation habit through logged practice. XP, credits and levels are product
mechanics; they do not measure brain adaptation, mental health, automatic behaviour or meditation skill.
All game logic is plain TypeScript, with explicit timestamps/dates and no React, Expo or SQLite imports.

## Code map and public API

Import from `src/domain/progression/index.ts`.

| File | Responsibility |
| --- | --- |
| meditation/session.ts, meditation/timer.ts | Validated finished sessions and pure count-up/pause cursors |
| progression/rules.ts | Frozen historical V1 and prospective V2 earning/decay configurations |
| progression/earnings.ts, occasions.ts | Duration reward, exact consistency ratio and incremental occasion awards |
| progression/state.ts, decay.ts | Immutable transitions, version changes and legacy decay |
| progression/snapshot.ts | Actual earning consistency and legacy balance projection |
| progression/journey.ts | 25 categories, 125 thresholds, credits and permanent lifetime projection |
| progression/ranks.ts, levels.ts | Released legacy rank/100-level definitions; no longer the visible level system |

Core APIs: `createProgressionState`, `recordSession`, `advanceProgression`,
`getProgressSnapshot`, `changeProgressionRules`, `practiceCredits`,
`getLifetimeJourney`, `getJourneyFromState`, `journeyLabel`.
The old `getLevelProgress` remains for historical compatibility and tests only.

## Permanent practice and recent consistency

- **Lifetime XP** is the exact sum of immutable award receipts, never a decaying balance.
- **Practice credits** and **distinct real practice dates** are reconstructed from reliable saved sessions.
- **Lifetime level** needs all three requirements. Persist the highest legitimately unlocked new level.
- **Recent consistency** is the actual multiplier used for new XP; it can fall after missed dates.
- **Legacy current progression/highest rank** remain stored and validated, without a competing visible level.
- **Meditation time** is active seconds, separate from every game score.

Level 100 completes Ona's habit-building journey. Levels 101–125 strengthen and sustain practice.
This is a product milestone, not scientific proof that someone has established a habit.

## Qualification, credits and date attribution

Prospective `progression_v2` requires **180 active seconds** in one completed session.
2:59 earns zero XP/credits and does not contribute to consistency. Paused time is excluded.
Short completed sessions remain valid history and still count as completed practices.

Per frozen completion date: no qualifying completed session = 0 credits; any = 1;
a valid separately saved pair = **2 credits total**, never more. The later **start** must be
at least six absolute elapsed hours after the earlier **end**; equality qualifies.
Inspect all eligible pairs, not just the first two sessions. Both need 180 active seconds,
completed status and the same recorded date. A paused/resumed cursor is one session.
Two credits are one real date, including for consistency and the maximum's 365-date gate.

Capture UTC Unix milliseconds, completion-local YYYY-MM-DD and an explicit IANA zone.
A session spanning midnight belongs to its **completion** date. Historical dates/zones never move
after travel. Different zones with the same captured date share that date's credit cap; different
date labels do not form a pair. Six hours and the final year are absolute elapsed time, unaffected by DST.
No implicit device time zone is used in the engine. Live Finish captures its observed zone; recovery
of an already-finished cursor retains it. Legacy unattended timed expiry uses the saved practice zone.
Invalid/missing historical dates, zones or durations fail explicitly, rather than guessing/backfilling.

## Versioned XP and consistency

V1 retains its 300-second minimum and original historical qualification flags. V2 lowers eligibility
without rebasing the duration reference. Both evaluate:

`Q(m) = 60 + 20 * log2(min(m, 60) / 5)`

| Active minutes | Base XP without a bonus |
| --- | --- |
| 3 (V2 only) | 45.26 |
| 5 | 60.00 |
| 10 | 80.00 |
| 20 | 100.00 |
| 30 | 111.70 |
| 60 or more | 131.70 |

Qualifying runs less than 90 minutes apart, end-to-start in UTC, extend one occasion.
Exactly 90 minutes starts another. Sum qualifying active seconds, then award only the incremental
change in the cumulative reward. Two nearby 10-minute practices earn 80 then 20 XP, not 180.
Subminimum runs cannot be pooled or bridge occasions. This works across midnight and travel.
First/second/third occasions on a reward date receive 100% / 75% / 25%; later occasions receive zero.
Zero-XP eligible occasions still count for credits, time and consistency.

Consistency: `1 + 0.40 * (active preceding dates / 7)`, maximum **1.40×**.
The seven preceding captured calendar dates count; today never counts toward itself.
V2 uses completed sessions with 180 active seconds, including reliable historical 3–5-minute
records, for **future** consistency/decay only. This resolves the old V1 flag incompatibility.
Historical V1 eligibility, awards and captured multipliers remain unchanged. A double day counts once.
The Home bar uses that same domain snapshot, with fraction active preceding dates / 7.

An occasion freezes its first reward date, ordinal, multiplier, separation and rules version.
An open V1 occasion keeps V1 terms for a qualifying V2 top-up; all receipts remain attributable.
The six-hour credit rule adds no extra XP multiplier. Qualifying sessions across midnight each
count toward their own practice date even if their occasion shares the earlier reward date.

## Historical guarantees, precision and legacy decay

Append-only receipts record XP, session/occasion IDs, earning version, timestamp, dates and breakdown.
Never recalculate lifetime XP on startup. Register old versions; activate new rules explicitly.
The V4 application release recovers already-finished cursors and settles old decay before activating V2.
Historical 3–5-minute sessions can backfill **credits only**, never retroactive XP.
Old highest named ranks remain separate: XP or practice count cannot reveal missing dates,
fine-grained former level peaks or eligibility for the new maximum.

All XP/thresholds/receipts use integer centi-XP (100 = 1 XP). Duration/log reward rounds half upward
to centi-XP; apply occasion weights and the exact rational consistency ratio together, round the
cumulative target once, then subtract prior receipts. BigInt arithmetic protects integer products.
The UI rounds only for display. Historical receipts never change on reconstruction.

Legacy current progression still decays after two complete inactive dates. Only dates strictly before
asOf.localDate are complete. After Monday practice, Tuesday/Wednesday are protected; Thursday's
first loss appears Friday 00:00, unless Thursday contains qualifying practice.
Each loss is min(rounded 1% of current, 16 XP), with floor ceil(25% of lifetime XP).
Lifetime XP, credits, real dates and lifetime level never decay. A returning practice earns normally,
without debt. Settlement cursors never rewind across travel or repeated reopening.

## Lifetime thresholds and pacing

Released display version: **ona_journey_v2**. Stable category IDs/icons are central in journey.ts.
For level index i = level − 1, r = i / 124:

- XP centi = round(3,000,000 × r^1.75), strictly increasing.
- Credits = ceil(365 × r^1.4), nondecreasing.
- Real dates = ceil(365 × r^1.8), nondecreasing and distributed throughout the journey.

These curves front-load rewards and gradually lengthen level intervals. The stronger credit gate
gives double sessions an intermediate advantage; the real-date curve prevents rushing to a final wait.
The lifetime bar is the **minimum** progress across XP, credit, real-date and applicable elapsed gates,
measured between current/next requirements. Every unmet requirement is shown, never a full misleading bar.

Level 125 additionally requires **365 elapsed 24-hour days since the first qualifying completion**,
365 distinct qualifying dates, 365 credits and 30,000 XP. A daily same-time routine first meets the
elapsed requirement on calendar day 366. On that day its extra practice date is incidental; the
condition remains 365 dates plus 365 elapsed days. Days need not be consecutive.

Never edit released thresholds/version meaning in place. A future display version must migrate and
retain the previous legitimately achieved peak with its original terms, without granting unmet new
maximum gates. The stored version/peak currently fails closed on unexpected/corrupt data.
Earning parameters remain in rules.ts; credit/pacing parameters are in journey.ts.

### Actual engine simulations

Calendar day 1 is the first practice; single sessions occur at 09:00 UTC. Doubles at 07:00/15:00
meet the end-to-start gap. Five-date routine starts Monday and skips weekends. Break skips dates
15–28, then returns. These results include actual weights, caps, rounding and consistency, not
a constant assumed daily award. Run `node scripts/simulate-journey.cjs` to reproduce; regression
tests assert the first date each target is available. Ten-minute daily Level 100 is ~8.8 months;
30,000 final XP is compatible because sustained-date requirements also govern progression.

| Routine | L5 | L25 | L50 | L75 | L100 | L125 |
| --- | --- | --- | --- | --- | --- | --- |
| 3 minutes daily | 3 | 37 | 100 | 193 | 321 | 475 |
| 10 minutes daily | 3 | 37 | 100 | 178 | 267 | 366 |
| 20 minutes daily | 3 | 37 | 100 | 178 | 267 | 366 |
| 30 minutes daily | 3 | 37 | 100 | 178 | 267 | 366 |
| Two 10-minute sessions daily (07:00 and 15:00) | 2 | 19 | 69 | 145 | 244 | 366 |
| 10 minutes on five dates per week (Monday–Friday) | 3 | 51 | 138 | 248 | 373 | 509 |
| 10 minutes daily, 14-date break after date 14 | 3 | 51 | 114 | 192 | 281 | 379 |

### Complete released threshold table

All requirements are cumulative inclusive lower bounds. Level 125 also has the elapsed-time gate above.

| Level | Category | Step | Lifetime XP | Credits | Real dates |
| --- | --- | --- | --- | --- | --- |
| 1 | Monkey Mind | 1/5 | 0.00 | 0 | 0 |
| 2 | Monkey Mind | 2/5 | 6.51 | 1 | 1 |
| 3 | Monkey Mind | 3/5 | 21.90 | 2 | 1 |
| 4 | Monkey Mind | 4/5 | 44.52 | 2 | 1 |
| 5 | Monkey Mind | 5/5 | 73.66 | 3 | 1 |
| 6 | First Pause | 1/5 | 108.85 | 5 | 2 |
| 7 | First Pause | 2/5 | 149.76 | 6 | 2 |
| 8 | First Pause | 3/5 | 196.13 | 7 | 3 |
| 9 | First Pause | 4/5 | 247.77 | 8 | 3 |
| 10 | First Pause | 5/5 | 304.48 | 10 | 4 |
| 11 | Awakening Attention | 1/5 | 366.13 | 11 | 4 |
| 12 | Awakening Attention | 2/5 | 432.58 | 13 | 5 |
| 13 | Awakening Attention | 3/5 | 503.73 | 14 | 6 |
| 14 | Awakening Attention | 4/5 | 579.47 | 16 | 7 |
| 15 | Awakening Attention | 5/5 | 659.72 | 18 | 8 |
| 16 | Finding the Breath | 1/5 | 744.38 | 19 | 9 |
| 17 | Finding the Breath | 2/5 | 833.38 | 21 | 10 |
| 18 | Finding the Breath | 3/5 | 926.66 | 23 | 11 |
| 19 | Finding the Breath | 4/5 | 1024.14 | 25 | 12 |
| 20 | Finding the Breath | 5/5 | 1125.78 | 27 | 13 |
| 21 | Learning to Return | 1/5 | 1231.50 | 29 | 14 |
| 22 | Learning to Return | 2/5 | 1341.27 | 31 | 15 |
| 23 | Learning to Return | 3/5 | 1455.03 | 33 | 17 |
| 24 | Learning to Return | 4/5 | 1572.74 | 35 | 18 |
| 25 | Learning to Return | 5/5 | 1694.35 | 37 | 19 |
| 26 | Gathering Focus | 1/5 | 1819.82 | 39 | 21 |
| 27 | Gathering Focus | 2/5 | 1949.11 | 41 | 22 |
| 28 | Gathering Focus | 3/5 | 2082.19 | 44 | 24 |
| 29 | Gathering Focus | 4/5 | 2219.01 | 46 | 26 |
| 30 | Gathering Focus | 5/5 | 2359.55 | 48 | 27 |
| 31 | Settling Mind | 1/5 | 2503.78 | 51 | 29 |
| 32 | Settling Mind | 2/5 | 2651.65 | 53 | 31 |
| 33 | Settling Mind | 3/5 | 2803.15 | 55 | 32 |
| 34 | Settling Mind | 4/5 | 2958.24 | 58 | 34 |
| 35 | Settling Mind | 5/5 | 3116.89 | 60 | 36 |
| 36 | Finding Rhythm | 1/5 | 3279.08 | 63 | 38 |
| 37 | Finding Rhythm | 2/5 | 3444.79 | 65 | 40 |
| 38 | Finding Rhythm | 3/5 | 3613.98 | 68 | 42 |
| 39 | Finding Rhythm | 4/5 | 3786.65 | 70 | 44 |
| 40 | Finding Rhythm | 5/5 | 3962.75 | 73 | 46 |
| 41 | Growing Roots | 1/5 | 4142.27 | 75 | 48 |
| 42 | Growing Roots | 2/5 | 4325.19 | 78 | 50 |
| 43 | Growing Roots | 3/5 | 4511.49 | 81 | 52 |
| 44 | Growing Roots | 4/5 | 4701.14 | 83 | 55 |
| 45 | Growing Roots | 5/5 | 4894.13 | 86 | 57 |
| 46 | Steady Practice | 1/5 | 5090.44 | 89 | 59 |
| 47 | Steady Practice | 2/5 | 5290.05 | 92 | 62 |
| 48 | Steady Practice | 3/5 | 5492.94 | 94 | 64 |
| 49 | Steady Practice | 4/5 | 5699.09 | 97 | 67 |
| 50 | Steady Practice | 5/5 | 5908.49 | 100 | 69 |
| 51 | Sustained Attention | 1/5 | 6121.12 | 103 | 72 |
| 52 | Sustained Attention | 2/5 | 6336.96 | 106 | 74 |
| 53 | Sustained Attention | 3/5 | 6556.00 | 109 | 77 |
| 54 | Sustained Attention | 4/5 | 6778.23 | 112 | 80 |
| 55 | Sustained Attention | 5/5 | 7003.62 | 114 | 82 |
| 56 | Quiet Focus | 1/5 | 7232.16 | 117 | 85 |
| 57 | Quiet Focus | 2/5 | 7463.84 | 120 | 88 |
| 58 | Quiet Focus | 3/5 | 7698.65 | 123 | 91 |
| 59 | Quiet Focus | 4/5 | 7936.56 | 126 | 93 |
| 60 | Quiet Focus | 5/5 | 8177.57 | 130 | 96 |
| 61 | Deepening Stillness | 1/5 | 8421.67 | 133 | 99 |
| 62 | Deepening Stillness | 2/5 | 8668.83 | 136 | 102 |
| 63 | Deepening Stillness | 3/5 | 8919.05 | 139 | 105 |
| 64 | Deepening Stillness | 4/5 | 9172.32 | 142 | 108 |
| 65 | Deepening Stillness | 5/5 | 9428.62 | 145 | 111 |
| 66 | Clear Awareness | 1/5 | 9687.95 | 148 | 115 |
| 67 | Clear Awareness | 2/5 | 9950.28 | 151 | 118 |
| 68 | Clear Awareness | 3/5 | 10215.61 | 155 | 121 |
| 69 | Clear Awareness | 4/5 | 10483.92 | 158 | 124 |
| 70 | Clear Awareness | 5/5 | 10755.22 | 161 | 128 |
| 71 | Grounded Presence | 1/5 | 11029.48 | 164 | 131 |
| 72 | Grounded Presence | 2/5 | 11306.69 | 168 | 134 |
| 73 | Grounded Presence | 3/5 | 11586.84 | 171 | 138 |
| 74 | Grounded Presence | 4/5 | 11869.93 | 174 | 141 |
| 75 | Grounded Presence | 5/5 | 12155.95 | 178 | 145 |
| 76 | Patient Attention | 1/5 | 12444.87 | 181 | 148 |
| 77 | Patient Attention | 2/5 | 12736.71 | 184 | 152 |
| 78 | Patient Attention | 3/5 | 13031.43 | 188 | 155 |
| 79 | Patient Attention | 4/5 | 13329.04 | 191 | 159 |
| 80 | Patient Attention | 5/5 | 13629.52 | 195 | 163 |
| 81 | Widening Awareness | 1/5 | 13932.88 | 198 | 166 |
| 82 | Widening Awareness | 2/5 | 14239.09 | 202 | 170 |
| 83 | Widening Awareness | 3/5 | 14548.14 | 205 | 174 |
| 84 | Widening Awareness | 4/5 | 14860.04 | 209 | 178 |
| 85 | Widening Awareness | 5/5 | 15174.77 | 212 | 182 |
| 86 | Steady Clarity | 1/5 | 15492.32 | 216 | 185 |
| 87 | Steady Clarity | 2/5 | 15812.68 | 219 | 189 |
| 88 | Steady Clarity | 3/5 | 16135.86 | 223 | 193 |
| 89 | Steady Clarity | 4/5 | 16461.83 | 226 | 197 |
| 90 | Steady Clarity | 5/5 | 16790.58 | 230 | 201 |
| 91 | Quiet Depth | 1/5 | 17122.13 | 234 | 206 |
| 92 | Quiet Depth | 2/5 | 17456.44 | 237 | 210 |
| 93 | Quiet Depth | 3/5 | 17793.53 | 241 | 214 |
| 94 | Quiet Depth | 4/5 | 18133.37 | 244 | 218 |
| 95 | Quiet Depth | 5/5 | 18475.96 | 248 | 222 |
| 96 | Habit Established | 1/5 | 18821.30 | 252 | 226 |
| 97 | Habit Established | 2/5 | 19169.38 | 256 | 231 |
| 98 | Habit Established | 3/5 | 19520.18 | 259 | 235 |
| 99 | Habit Established | 4/5 | 19873.71 | 263 | 239 |
| 100 | Habit Established | 5/5 | 20229.95 | 267 | 244 |
| 101 | Rooted Habit | 1/5 | 20588.91 | 271 | 248 |
| 102 | Rooted Habit | 2/5 | 20950.56 | 274 | 253 |
| 103 | Rooted Habit | 3/5 | 21314.92 | 278 | 257 |
| 104 | Rooted Habit | 4/5 | 21681.96 | 282 | 262 |
| 105 | Rooted Habit | 5/5 | 22051.68 | 286 | 266 |
| 106 | Integrated Practice | 1/5 | 22424.08 | 290 | 271 |
| 107 | Integrated Practice | 2/5 | 22799.15 | 294 | 276 |
| 108 | Integrated Practice | 3/5 | 23176.88 | 297 | 280 |
| 109 | Integrated Practice | 4/5 | 23557.27 | 301 | 285 |
| 110 | Integrated Practice | 5/5 | 23940.30 | 305 | 290 |
| 111 | Everyday Presence | 1/5 | 24325.99 | 309 | 295 |
| 112 | Everyday Presence | 2/5 | 24714.31 | 313 | 300 |
| 113 | Everyday Presence | 3/5 | 25105.27 | 317 | 304 |
| 114 | Everyday Presence | 4/5 | 25498.85 | 321 | 309 |
| 115 | Everyday Presence | 5/5 | 25895.05 | 325 | 314 |
| 116 | Natural Stillness | 1/5 | 26293.87 | 329 | 319 |
| 117 | Natural Stillness | 2/5 | 26695.30 | 333 | 324 |
| 118 | Natural Stillness | 3/5 | 27099.33 | 337 | 329 |
| 119 | Natural Stillness | 4/5 | 27505.96 | 341 | 334 |
| 120 | Natural Stillness | 5/5 | 27915.18 | 345 | 339 |
| 121 | Steady Presence | 1/5 | 28326.99 | 349 | 345 |
| 122 | Steady Presence | 2/5 | 28741.39 | 353 | 350 |
| 123 | Steady Presence | 3/5 | 29158.35 | 357 | 355 |
| 124 | Steady Presence | 4/5 | 29577.89 | 361 | 360 |
| 125 | Steady Presence | 5/5 | 30000.00 | 365 | 365 |

## Worked examples

- First 10-minute practice: 80 XP, one credit/date, Level 2. The next gates visibly explain what remains.
- Two 10-minute practices with a six-hour end-to-start gap on the same date: 80 + 60 XP before
  consistency, two credits, **one** real date. A mere 90-minute gap earns the same spaced XP but one credit.
- Two nearby 10-minute practices: one 20-minute XP occasion (100 XP total), one credit/date.
- Miss one date after two weeks: lifetime level/XP/credits stay; future bonus reflects six preceding dates.
- Miss three complete dates: one legacy decay application, no lifetime loss; normal earnings on return.

## Input discipline and verification

Append sessions chronologically without overlap. Exact duplicate IDs/payloads are no-ops; conflicts,
backdated new sessions and clock rollback fail. Submit pending completions before advancing past them.
No automatic historical edits/import reconciliation or clock-tampering repair is implemented.
Use explicit asOf contexts. Run npm test, npx tsc --noEmit, npm run lint and native exports.
See ARCHITECTURE.md for atomic persistence and ONA_UI.md for visual/device verification limits.
