# Ona native interface

## Design and code map

The approved source remains the portable study at
`C:/Users/fga31/.codex/visualizations/2026/10/01/01a0f891-1387-7610-8f16-c6add45aff15/ona-design/`:
HANDOFF.md, screen/storyboard SVGs and wave-spec.json. This refinement applies the user's
explicit changes: warmer sand, open-ended practice, numbered progression and flowing wordmark.

`src/ui/primitives.tsx` centralizes #F6F1E7 surfaces, #141414 monochrome ink, Manrope
Regular/Medium, outlined actions and safe-area/reflowing layouts. No tabs, cards, gradients
or competitive decorations. The unchanged bundled Manrope 4.505 files retain their SIL license.

`assets/ona/wave-spec.json` retains the original ten contours and stable stage IDs.
`Wave` animates only the session's curve: a 14-second continuous phase with at most 2.4
viewBox units of movement, preserving tangent continuity. Reanimated shared values/animated
SVG props run on the UI thread on native, independently of timer calculations or React frame
updates. Pause/resume ease the displacement over 1.1 seconds. Other waves are static.
Reduced Motion starts static and responds to changes during practice.

The editable `wordmark.svg` and its native coordinate source `wordmark.json` contain the same
three medium-stroke letter outlines. Edit both together; a test prevents divergence.
Intro shows **Ona / Build your meditation habit**, takes 1.2 seconds, can be skipped,
omits itself for screen readers and uses a short fade for Reduced Motion.
It mounts once per process, never on background resume. Interface text remains Manrope.

## Working flow

- `/`: Meditate persists a new UUID open cursor immediately and opens the session.
  No setup or target selection. Returning users see completed-history count, current
  numbered level and a quiet progress line; tapping opens Your practice.
- `/session`: active time counts UP. Tap time to hide/show without changing the cursor.
  Pause / Resume and Finish are accessible; paused practice also offers deliberate discard
  confirmation. Finish is a normal completed session; discard creates no history or XP.
- `/completion`: successful content appears only after the atomic save commits.
  **Well done. / You made time for yourself.** Active duration, saved practice count,
  actual fixed-point award, current level and next-level progress. A short count dissolve
  and actual before→after level acknowledgement support multiple-level jumps. Zero XP stays zero.
  Home acknowledges the durable summary before navigating away. Failed saves retain the exact
  finished payload and offer Retry; uncertain commit/rollback failures reopen the database
  on Retry and restore durable truth rather than rerunning a stale cursor.
- `/practice`: numeric level, existing named stage/wave, precise XP remaining,
  current progression, lifetime XP and permanent highest **stage**. At 100: “Your practice continues.”
- `/preferences`: ambience choice, gong interval, volumes and explicit Done/save.
  These are future audio preferences; this version remains silent. The legacy default-duration
  field survives unchanged in storage but is unused by open-ended practice.
- `/history`: paginated actual records, captured local days, active durations and statuses.
  Old timed/early-ended records remain readable.

## Persistence and interpretation

See ARCHITECTURE.md for V3 migration, atomic completion, pending-summary acknowledgement
and clock/zone policies. Practice count is derived from saved `status='completed'` sessions,
including short zero-XP practice. Legacy `ended_early` remains history and can retain XP under
the unchanged earning rules, but does not count as a completed practice. Discarded drafts do neither.

A running cursor includes wall-clock time while locked/backgrounded/closed; only Pause stops
active accrual. An open practice has no expiry. Paused drafts remain paused. Finishing captures
the explicit observed completion zone/date. A finished payload already saved keeps that capture.
Legacy timed drafts recover their calculated deadlines using their captured practice zone.
Clock rollback fails explicitly; there is no guessed repair.

A pending saved summary is a continuation of the same completion, including after a crash.
It does not replay earnings. Once Home is acknowledged, later launches do not replay it.
No fabricated presentation receipts are backfilled for pre-V3 history.

## Verification

`npm test`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform all`.
Pure domain tests and real Node SQLite tests cover timing, all 100 level boundaries,
counting, migrations, receipt preservation, transactions, retries and reopen recovery.

The exported React Native web app is exercised at iPhone dimensions against browser SQLite:
immediate start, time hide/show, moving curve, pause/resume/reload, Finish, zero-XP saved summary,
acknowledgement/reopen, history/count, discard and saved preferences. Browser checks also cover
a qualifying completion using a simulated wall-clock advance, actual multi-level acknowledgement and Reduced Motion.
They are not physical iOS/Android tests. Export success is not a signed native build.

On iPhone test lock/unlock, force-close running/paused/pending completion, multiple pauses,
larger text, VoiceOver, Reduce Motion and preferences/history after restart. Native splash
uses sand in a newly built binary; Expo Go controls its own host launch screen.

```powershell
cd C:\Users\fga31\Documents\MeditationApp
npx expo start --clear --go --offline --port 8090
```

Keep computer/iPhone on the same Wi-Fi and scan the terminal QR with Camera.
Offline disables CLI cloud requests, retaining local Wi-Fi. Choose another port if occupied.
Audio assets and playback remain outside this milestone.
