# Meditation progression V1

This is a game about logged practice. XP and ranks do not measure brain adaptation,
mental health, mindfulness ability, or meditation skill. The engine is plain
TypeScript: no React, Expo, database, audio, device clock, or implicit time zone.

## Concepts and code map

- **Lifetime XP:** the sum of immutable award receipts. It never decreases.
- **Current progression:** earned XP minus settled inactivity decay; determines current rank.
- **Highest rank achieved:** a permanent copy of the highest-threshold rank actually reached,
  with its original rules version and achievement time. Later renaming does not rewrite it.
- **Meditation time:** actual active seconds, including short runs and occasions that earn zero XP.

Progression imports should come from `src/domain/progression/index.ts`. The separate pure timer API lives in
`src/domain/meditation/timer.ts`; its durable lifecycle is documented in ARCHITECTURE.md.

| File | Responsibility |
| --- | --- |
| `meditation/session.ts` | Finished-session contract and validation |
| `progression/rules.ts` | Central `PROGRESSION_V1` configuration and version validation |
| `progression/ranks.ts` | V1 rank data and threshold lookup |
| `progression/occasions.ts` | Frequency grouping and original occasion terms |
| `progression/earnings.ts` | Duration curve, exact consistency ratio, cumulative reward |
| `progression/decay.ts` | Daily loss and protected floor |
| `progression/state.ts` | Pure state transitions and append-only award receipts |
| `progression/snapshot.ts` | UI-ready projection |
| `progression/calendar.ts`, `numeric.ts` | Explicit calendar arithmetic and fixed precision |

## Qualification and earning

Each completed or early-ended timer run must independently contain **300 active
seconds** to qualify. Paused seconds are recorded separately and never earn credit.
Active and paused time must fit inside UTC start/end timestamps. Subminimum runs
remain in history but cannot be pooled into qualification, create an occasion,
increase consistency, or reset inactivity. Early stops of at least five active
minutes qualify normally; planned duration does not affect rewards.

For an occasion containing `m` qualifying active minutes:

`Q(m) = 60 + 20 * log2(min(m, 60) / 5)`

The first, second, and third occasions on a reward date receive weights of 100%,
75%, and 25%. Further occasions earn zero XP while retaining time/history and
qualifying-day credit. Ordering is chronological; longer-first ordering can earn
slightly more. No separate daily cap is needed beyond these weights and the
duration ceiling.

Consistency is `1 + 0.40 * (active preceding days / 7)`. Only the **seven preceding
recorded local calendar dates** count. Today is excluded, and multiple sessions on
one date count once. Losing a bonus affects future earnings only.

## Occasions and incremental awards

Qualifying sessions with an end-to-next-start gap **less than 90 minutes** belong
to one occasion. Exactly 90 minutes starts another. UTC timestamps control this,
including across midnight, daylight saving changes, and travel. Short runs cannot
bridge the gap between qualifying sessions.

An occasion keeps the first session's reward date, frequency ordinal, consistency
bonus, separation rule, and earnings rules version. Each qualifying extension
recomputes its cumulative reward and awards only the difference from its previous
total. It does not re-award the full occasion reward. Each increment has its own
receipt linked to the session and stable occasion ID.

Qualifying sessions on either side of midnight count toward **their own captured
practice dates**, even when they share one occasion. The occasion's reward date
stays on the first date. A later separate occasion on the new date starts that
date's frequency allowance. This deliberately distinguishes daily practice from
spaced frequency rewards.

## Precision

All balances, thresholds, and receipts are integer **centi-XP** (100 = 1 XP).
Durations use whole active/paused seconds. Rates and weights use integer basis
points (10,000 = 100%). Balances must remain safe integers.

1. Round the logarithmic duration reward to the nearest centi-XP, half upward.
2. Apply the occasion weight and exact rational consistency bonus together; round
   the cumulative target once, half upward. Compute the increment by subtraction.
3. Round each daily percentage loss to centi-XP, half upward; apply the 16 XP cap.
4. Round the protected floor **upward**, so rounding never undercuts 25%.

Integer products/division use BigInt internally to avoid intermediate overflow;
persisted state contains only JSON-compatible numbers and data. The logarithm is
the only floating-point earning step. Once recorded, receipts are never
reconstructed from floating-point calculations. The snapshot's display multiplier
and rank-progress fraction are ordinary numbers, never used as persisted XP.

## Calendar, inactivity, and travel

The caller supplies UTC Unix milliseconds, a `YYYY-MM-DD` local date, and an IANA
time-zone label. Capture a session's date/zone **at completion**. The engine trusts
this association; it checks date syntax/validity but does not perform IANA zone
conversion. No `Date.now()`, local Date getters, or device time-zone lookup occurs.

Only dates **strictly before** `asOf.localDate` are complete. If the last qualifying
practice is Monday, Tuesday and Wednesday are protected. Thursday's first decay
becomes observable at **Friday 00:00 local time**, once Thursday is complete.
A qualifying Thursday session prevents that loss. Fourteen complete inactive days
therefore produce twelve daily decay applications.

For each eligible inactive day:

`current = max(ceil(0.25 * lifetime), current - min(round(0.01 * current), 1600))`

This expression uses centi-XP. Lifetime XP is unchanged. A returning session adds
its normal award and begins a new grace period; there is no debt or recovery
currency. With no qualifying history, inactivity starts at zero.

Historical date labels never move after travel. V1 compares those recorded labels
as Gregorian dates. Crossing time zones can skip/repeat a label. A settlement
cursor never moves backward: westward travel cannot refund already settled decay
or reopen a closed day. New practice still retains its captured date, and UTC gaps
still determine grouping. This is a deliberate simple policy, not a complete
international-date-line or clock-tampering solution.

## Ranks and future versions

Rank identity is a stable string ID, never array position. Definitions are ordered
by strictly increasing centi-XP thresholds beginning at zero. V1's ten thresholds
in XP are 0, 200, 650, 1500, 3000, 5500, 9000, 14000, 21000, and 30000. Current rank
may decrease. The highest-rank record is compared by its achieved threshold and
preserved independently of today's definitions. Reordering the meaning of ranks
across versions would require an explicit achievement-migration policy.

`ProgressionState` is a serializable checkpoint plus session history, occasions,
award receipts, and captured rulesets. There is no general-purpose event bus or
event-sourcing framework. Persist the returned state **atomically** in a future
storage adapter; never separately increment an XP counter on the UI side.

Every award stores its amount, session/occasion IDs, rules version, time, practice
and reward dates, and calculation breakdown. Qualification decisions also retain
their version. Snapshot reads project existing balances and settle missing decay;
they do **not** recalculate past earnings using the latest rules.

`changeProgressionRules` is an explicit boundary. It settles all previously
complete days under the old rules, captures the new rules, and applies them to new
qualifications and new occasions. An open occasion continues its original earning
terms for all top-ups. The active version governs future complete-day decay and
current rank lookup; a partial day is governed by the version active when settled.
Reusing a version ID with changed data is rejected. Raising a floor above current
progression requires an explicit migration rather than silently granting points.

For V2 balancing changes, supply a new versioned configuration. For a genuinely
different formula, add a new algorithm discriminator and implementation while
retaining the old evaluator for still-open historical occasions. Never replace the
V1 algorithm in place or rebuild lifetime XP under the new formula.

All balancing values are configurable through one ruleset: qualification,
duration base/reference/growth/cap, separation, frequency weights, consistency
window/bonus, grace period, daily decay rate/cap, floor, and rank definitions.
Precision, completion-day assignment, and settlement semantics are V1 contracts;
changing those requires an explicit schema/behavior migration.

## Public API and input discipline

- `createProgressionState(asOf, rules?)`: create an empty state, usually once.
- `recordSession(state, session)`: append a finished run, settle earlier complete
  dates, and create any incremental award. Returns a new immutable state.
- `advanceProgression(state, asOf)`: materialize a decay checkpoint for persistence.
- `getProgressSnapshot(state, asOf)`: read a projection without mutating state.
- `changeProgressionRules(state, rules, asOf)`: activate a new rules version explicitly.

Also exported: rules, centi-XP scale, and the input/output types. A future screen
can render snapshot ranks, progress to next rank, totals, consistency, and
inactivity directly. It does not need internal calculation helpers.

Append sessions in UTC order without overlap. An exact duplicate ID/payload is a
no-op, even after a version change; conflicting duplicates fail. Rewinding the
checkpoint or backdating a new completed session fails rather than changing
settled awards. Collect pending completed sessions before advancing/persisting a
checkpoint beyond them. Imports, edits, deletion, and corrected clocks need an
explicit reconciliation flow later.

Public functions accept typed state produced by this API (or its unchanged JSON
round-trip). A future persistence adapter must validate untrusted/corrupt stored
data and schema versions before passing it in. State is fully in memory for now;
history indexing and validated loading belong to that next integration layer.

## Worked examples (starting without a consistency bonus)

- One 10-minute meditation earns **80 XP**.
- Two 10-minute meditations separated by at least 90 minutes earn **80 + 60 = 140 XP**.
- Two nearby 10-minute meditations earn **80**, then a **20 XP** top-up: **100 XP** total.
- After 14 daily 10-minute meditations, the balance is about **1,440 XP**.
  Missing one day costs no accumulated progress; the returning session earns
  approximately **107.43 XP**, with six preceding active dates.
- Missing three complete days after that same history applies one approximately
  **14.40 XP** loss. The returning session earns **98.29 XP** normally.
- After 30 daily 10-minute meditations, lifetime XP is about **3,232**. Fourteen
  complete inactive dates reduce current progression by **192 XP** to about **3,040**.
  After 180 daily sessions, the same break leaves about **19,840** of **20,032 XP**.

## Verification

Run `npm test`, `npm run test:coverage`, `npx tsc --noEmit`, and `npx expo lint`.
Tests use the existing TypeScript compiler and Node's built-in test runner; no
testing dependency is installed. A separate strict compilation uses only ES2022
libraries and no ambient framework/Node types, enforcing the domain boundary.
Compiled test artifacts use a unique temporary directory and are cleaned up.

Regression tests cover all approved A-K patterns, exact daily-decay counts,
boundaries, receipt conservation, duplicates, input mutation, JSON round trips,
rules changes, calendar transitions, and identical results under different host
time zones. Rounded simulation values have a small explicit centi-XP tolerance;
monetary invariants and award increments use exact integer assertions.
