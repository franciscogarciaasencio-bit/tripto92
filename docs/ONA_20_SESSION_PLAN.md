# Ona — 20-session development program

## Resume here

Development moved from Codex on the owner's Windows PC to Claude on 2026-10-14. The
repository now lives on GitHub (`franciscogarciaasencio-bit/tripto92`, branch `main`);
commit `e5c3b17` is the first complete snapshot of Sessions 1–11. Claude works in a
cloud Linux checkout and pushes after every session; the owner pulls on Windows.
Only one agent edits at a time: pull before starting, push before handing over.

**All 20 sessions and the pre-meditation screen are complete (2026-10-15).** Since then the owner
directs small batches in chat; each batch is logged at the end of this file. State on 2026-10-17:

- Phones: Android 1.2.0 (3) APK and an unsigned iPhone 1.2.0 (1) sideloaded with AltStore (free Apple
  ID, 7-day refresh; IOS_SIDELOAD.md). JavaScript/asset changes ship over the air to both
  (`--platform all`, UPDATES.md); native changes need a new runtime, APK and iPhone build.
- Rules V6 (practices under three minutes earn nothing), calendar after every counted practice, Home ⇅
  Journey pull, Consistency in rounds, level-up and round moments (ONA_UI.md "After a session").
- Friends (FRIENDS.md, 2026-10-17): needs the friends SQL run once in Supabase and each friend added
  as a Google test user (or the Google app published).
- On hold by the owner: forest work, until the owner improves the images.
- Open: physical checks of the latest batch (interval loops on a locked phone, pull gesture feel,
  round/level moments), cloud history compaction (SYNC.md) and store publishing before a wider release,
  the owner-supplied interval gong's licence (AUDIO.md), and the Android crash log if the completion
  crash returns.

Read AGENTS.md first. Never claim device/listening results the owner has not reported.

## Mission and acceptance contract

Ona helps build and maintain a meditation habit. Preserve warm supplied coastal artwork,
central sun, editorial typography, negative space, whole-number Ripples, understated sound
and motion. No scientific claims, mandatory account, notification clutter or dashboards.

- 125 numbered levels, starting Level 0 — Monkey Mind. Level 100 around 8–9 months of
  ten-minute daily practice; Level 125 at least 365 distinct qualifying dates **and** 365
  elapsed days. Positive short completions can earn modest Ripples; 180 active seconds
  qualifies. Pauses excluded. Two sessions are never two distinct practice dates.
- Replace current Consistency with one continuous bar and **five milestone dots**;
  one qualifying contribution/day reaches full around 60 days, two/day around 30.
  Second contribution: at least 180 active seconds, starts six elapsed hours after an
  earlier qualifying end, maximum two/date. About four complete missed dates halves
  momentum; return rebuilds immediately. Maximum automatic bonus approximately 40%.
  No displayed multiplier. Simulate before choosing a new versioned model.
- Effective levels: three complete inactive dates protected, decay from fourth; after
  a year approach half the highest legitimate level, with at least half permanently
  protected. Highest achievement and lifetime receipts remain separate and permanent.
- Review all 25 five-level category names and create 25 cohesive original vector icons.
  Stable IDs/history must survive presentation changes. Level 100: Habit Established.
- Forest: supplied sparse `0.png` plus growth `1.png`–`5.png`; highest achieved level
  controls vegetation by default. Stable image alignment, gentle source transitions,
  offline bundled assets, native left swipe Home → Forest and right swipe back, accessible
  alternative controls. Dedicated closer scene; later stages added through configuration.
- Wave: mission supersedes the previous timing request with a **12-second** cycle;
  preserve working native geometry, calm amplitude, phase continuity and accessibility.
- Signature completion: actual persisted base Ripples → Consistency/dots → bonus Ripples,
  continuous level crossings, subtle glow, coordinated gentle audio. Animation never saves.
- Replace all three current procedural bells: research/compare authentic acoustic CC0/public
  domain recordings first; reject uncertain/attribution/royalty/restricted rights. Retain
  provenance and generation/processing scripts. Original quality alternative only if needed.
  Listen/refine, not just create files. Preserve ambience/preferences/interval timing and tails.
- Android: real installable signed APK, reproducible build, Android back/safe-area/timer/audio/
  recovery checks. Export alone is not an APK or device verification.
- Optional Google sign-in and secure offline-first cloud saving: history, immutable awards,
  rules/continuation/current/highest levels, consistency, forest, settings. Handle first
  import, offline outbox, retries, concurrent devices, conflicts, account switching/sign-out,
  reset/deletion tombstones and interrupted sync. Never leak another account's data or
  fabricate credentials. Guest meditation remains fully functional.

## Roadmap (reallocate if evidence warrants it)

| Session | Implementation focus | Acceptance / dependency |
| --- | --- | --- |
| 1 | Baseline audit, supplied forest assets/configuration, functional Forest route/gestures; early build/auth investigation | Tests unchanged; forest derives from real highest level, original files preserved; explicit prerequisite inventory |
| 2 | Progression research and deterministic simulations; model new 60/30-day Consistency and bonus/level pacing | Cited primary evidence, daily/double/short/missed/travel/year scenarios, chosen versioned formulas; no historical rewrite |
| 3 | New pure domain rules/continuation and historical version boundaries | Fixed precision; 180s/six-hour/two-date gates; cap/decay; comprehensive regression/property scenarios |
| 4 | Safe additive activation migration, repositories and five-dot Consistency presentation | Old receipts/checkpoints validated; prospective awards; reset/reopen/transaction tests; actual completion endpoints |
| 5 | Category presentation and 25 original icon collection; Journey clarity | Stable IDs/achievements, native small-size silhouettes and SVG parity; restrained names including Level 100 |
| 6 | Forest refinement, image alignment/transitions and interactive native swipe continuity | Real device drag/back/vertical-scroll/accessibility; younger stages never show mature artwork; asset expansion test |
| 7 | Premium three-stage completion coordination and level crossings | Actual receipts, cancellation/reduced-motion/background/replay cases; no duplicate rewards |
| 8 | Native navigation, startup/restore, responsiveness and motion profiling | No flashes/resets; wave shared phase; reliable touches and native back/interrupt behavior |
| 9 | Acoustic bell research, comparative listening, rights proof and mastering | Multiple candidates reviewed; quiet attacks, headroom, natural tails; no current bell reused |
| 10 | Replace start/end/interval assets and sparse timelines; native audio lifecycle | Local offline playback, previews/preferences preserved, interval active-time seeks, natural end tail, listening review |
| 11 | First reproducible standalone Android APK build | Stable app identifier, signing/EAS or local Gradle prerequisites, genuine APK with installation instructions |
| 12 | Android device/emulator compatibility and background/audio/recovery fixes | Native navigation/timing/save/reopen/wave/audio/settings; known limits logged |
| 13 | Sync ownership/ledger/reset design and local durable outbox | Guest/account namespaces, migration plan, authoritative merge policy; no generic checkpoint upload or XP LWW |
| 14 | Backend schema/functions, account isolation and import contracts | RLS/grants + two-account/unauthenticated tests; atomic idempotent import and immutable rule/award validation |
| 15 | Google auth, secure token storage, optional sign-in UI/development builds | Real configured credentials/redirects; cancellation/expiry/sign-out/switch tests; no secrets bundled |
| 16 | Upload/retry/reconnect synchronization | Outbox acknowledgement/crash windows, duplicate sessions/awards, independent device imports |
| 17 | Download/merge, cross-device resets/deletions and account switching | Account isolation, deletion wins/no resurrection, versioned deterministic continuation, conflicting stable IDs explicit |
| 18 | Integrated cloud/reinstall/offline/device recovery testing | Restore all required state/preferences/forest; interrupted sync and no-network meditation; real auth when configured |
| 19 | Product/accessibility/performance polish and release candidate | Physical iOS/Android, large type/reduced motion, memory/frame/audio checks; concise truthful documentation |
| 20 | Final acceptance audit and APK build, critical fixes only | Completed/partial/blocked/unverified matrix, actual artifact or precise blocker; no false completion claims |

## Starting baseline and ongoing risks

- SDK 57 / RN 0.86.3 / Router 57 / Reanimated 4.5.1. Node 24, npm lockfile;
  no native folders (CNG). `npm run check`: baseline **774 passing tests**, TypeScript/lint
  pass (469 domain + 305 data/audio/presentation). No dependencies changed for Session 1.
- Rules `progression_v4`, `ona_habit_v1`, `ona_habit_levels_v1` and migrations 1–9 are
  released. Current displayed Consistency is a separate fourteen-day historical projection;
  bonus score approached full exponentially. Sessions 2–4 introduce V5 and migration 10 to
  meet the 60/30-day targets prospectively. Never edit old receipts, redefine V4 or replay XP.
- Level timing and protected-floor logic already exist; verify against the **new** consistency
  model before assuming existing daily 265/368-day simulations still meet targets.
- Progression/habit checkpoints are authoritative continuation, not disposable caches.
  Cross-device merging requires a specified authoritative ledger/settlement algorithm;
  uploading checkpoints with last-write-wins or recomputing old XP is unacceptable.
- Current reset permanently deletes local history; cloud needs durable deletion/account
  boundaries first, so deleted sessions cannot return from another device or old outbox.
- Audio uses owned controllers; sparse interval assets stop at six active hours. Current bells
  are original procedural recordings, legally uncomplicated but user rejected their sound.
  Preserve generators/provenance while replacing runtime assets in Sessions 9–10.
- No physical iOS renderer available here. Web screenshots and exports are honest adapter/
  rendering checks; real native gestures/frame pacing/background audio still need device tests.

## Forest decisions and expansion

`src/domain/forest/growth.ts` defines `ona_forest_growth_v1`, stable stage IDs and configurable
highest/current basis. Initial thresholds: Level 0, 1, 20, 40, 65, 100. These are **visual**
milestones, not earning rules; review in Session 6. Highest-based vegetation survives decay;
explicit Reset All Practice Data returns the existing highest achievement to zero and forest
to `coast_0`. No extra database balance, cache or migration is required.

Original PNGs are in assets/ona/forest (stage 1 reuses design3/coastal-background.png).
src/ui/forest-artwork.json holds source dimensions, hashes, halo anchors and the reference crop.
forest-assets.ts holds static Metro requires; forest-geometry.ts holds pure alignment/crop
and gesture release policy; forest-swipe.tsx owns the native recognizer; forest-screen.tsx
renders actual native UI via /forest. Add a stage by extending growth config, metadata and
static assets; algorithms stay unchanged. Stage 2 is 863×1822; all others 853×1844.

Only one closer forest reference was supplied, with a mature canopy and baked header/dots.
Following the user's Session 2–5 steering, six dedicated stream-garden scenes now derive
from this reference, with baked UI removed and progressively earned near-bank foliage.
Original supplied coast/reference PNGs remain unchanged; generation prompts and source
provenance are retained. Runtime uses native headings/back/dots above the six entry PNGs,
uniform horizontal centering and top alignment. Younger stages no longer zoom into the coast.
Native pans now move the outgoing/incoming scenes with the finger, settle or cancel, then
commit Router once without an extra stack slide. Native gesture/frame-pacing verification
remains a device task; browser interaction evidence is not substituted for it.

## Android / Google prerequisites (checked Session 1)

- app.json lacks android.package, ios.bundleIdentifier and EAS projectId. Choose stable,
  user-owned identifiers **before** registering OAuth/signing; don't invent ownership.
- eas.json now contains a standalone `preview` APK profile (internal distribution,
  android.buildType apk). It doesn't claim an APK was built and doesn't add dev-client.
- Java/adb/Gradle/EAS absent from PATH, but Java exists at
  `C:\Program Files\Android\Android Studio\jbr\bin\java.exe` (OpenJDK 25.0.3).
  Android SDK exists at `C:\Users\fga31\AppData\Local\Android\Sdk` with build-tools 36.0.0
  and platform android-37.0. Matching SDK 57 compileSdk 36 platform and suitable JDK/Gradle
  compatibility need checking/installing before a local build. First sandboxed adb inventory
  could not start its daemon; the approved outside-sandbox retry succeeded, with **no device
  or emulator attached**. Do not confuse tools being installed with device verification.
- Local Expo auth state exists; remote EAS identity/project/credentials not yet verified.
  Windows EAS `--local` is not officially supported; choose EAS hosted APK or ordinary
  local Android Gradle/CNG in the designated Android sessions. Never hand-edit native folders.
- Suggested backend: Supabase Auth + PostgreSQL transactions/RLS, keeping owned SQLite and
  an explicit outbox. Firebase/Firestore remains an alternative, but replacing local storage
  with its own offline/LWW model would not resolve immutable receipts or concurrent awards.
  Final provider selection and conflict/security design occur in Session 13, before SDKs.
- Required user-controlled setup: backend project URL/public publishable key; Google Cloud
  consent screen and Web OAuth ID/secret configured **server-side** at provider; authorized
  provider callback and exact app redirects. Native sign-in additionally needs Android package
  + signing SHA-1(s), iOS bundle ID/client ID/URL scheme and a development/standalone build.
  Never store Google client secret or Supabase service-role key in Expo public environment.
  Current repo has no OAuth/backend/env configuration. No account/service created or purchase made.
- Native Google libraries cannot run in Expo Go. Later choose supported Credential Manager
  integration or secure browser PKCE based on SDK compatibility; don't assume older Android
  Google Sign-In APIs are the preferred solution. Test real redirect/token lifecycle.

Verified official references (recheck when implementing):
[SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Google native prerequisites](https://docs.expo.dev/guides/google-authentication/),
[APK profiles](https://docs.expo.dev/build-reference/apk/),
[local build limitations](https://docs.expo.dev/build-reference/local-builds/),
[Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google),
[row isolation](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Firestore offline behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Session log

### 1 — Complete (2026-10-12)

Implementation: supplied original forest sources, highest-level growth selector, functional
Home/Forest swipe routes with accessible controls, alignment and offline source transitions,
same stage on meditation/completion, mission's 12-second wave cycle, standalone APK profile.
Verification: baseline 774 tests; final **785 pass** (475 domain + 310 data/audio/presentation),
TypeScript/lint pass and iOS/Android/web exports pass (14 routes). Eleven focused additions
cover stage boundaries, highest/current policy, expansion/invalid inputs, original PNG hashes,
uniform halo alignment and reference crops, directional release thresholds and real on-disk
save/reopen/decay/reset integration. Existing Ripple/Consistency formulas, migrations 1–9,
audio controllers/assets and dependency files are unchanged. No user database was accessed
or reset; the starting uncommitted work was preserved. No commit was requested or created.

Actual React Native web screenshots/checks at 390×844, 320×568 and 430×932 cover Home,
sparse Forest, two-way Gesture Handler pan adapter, accessible entry/back controls, Guide,
pause/finish, the original 48-Ripple three-minute award and reopening. Visual iteration fixed
a hard scene boundary cutting younger tree crowns; younger art now extends continuously
behind the native header/footer. The five richer asset mappings/hashes/geometry are tested,
but mature close-view composition and every stage transition still need visual/device review.
Ignored evidence/logs: `.expo/program-session-1/`. Web pans are **not** native swipe proof.

Remaining: finger-following native scene continuity, mature crop seams, full text-scaling and
real iOS/Android frame pacing/gesture validation in Session 6/8/12/19. The Forest view is a
functional first foundation, not a finished 125-artwork collection. Google/backend credentials,
stable app identifiers/EAS project/signing and matching Android build tooling remain external
or build setup work; no APK/auth/cloud capability is claimed. All current bells remain until
their dedicated quality replacement sessions.

### 2 — Complete (2026-10-13): research, modeling and reproducible balance simulations

Research from the original Lally study and Gardner/Rebar/Lally methodological review,
plus official Headspace/Calm practice descriptions, informed manageable repeats and gentle
return semantics. Product pacing is explicitly not a scientific habit measurement.
Compared exponential/dual-score models with an exact contribution model; chose one
60-contribution score with five dots and existing four-day momentum half-life.
scripts/simulate-progression-v5.cjs runs shipped domain functions; full reproducible outputs
and rationale live in docs/evidence/progression-v5/. Ten minutes daily reaches Level 100
on day 272 and 125 on day 375; doubles reach full C day30, daily day60. Nearby, short,
skipped-Sunday, longer and one-year-break scenarios run too. Level thresholds need no change.

### 3 — Complete (2026-10-13): versioned V5 domain and historical guarantees

PROGRESSION_V5 / LINEAR_CONSISTENCY_V1 use integer 60-million score units, exact one-million
increments, 180-active-second qualification, max two contributions/date and six-hour gap.
Same score drives current bar and automatic maximum40% bonus. Three protected inactive
dates / effective-level decay / half-highest floor stay unchanged. Semantic activation
validation rejects wrong carried momentum, corrupt prefixes, future/cyclic boundaries and
legacy scale downgrade. V1–V4 formulas/receipts stay unchanged. Thirty-three focused new
domain tests; 511 domain tests currently pass including strengthened icon parity tests.

### 4 — Complete (2026-10-13): additive activation migration and real milestone presentation

Migration10 adds immutable per-generation progression_consistency_activations. Checkpoint
counts and exact source-score validation detect missing/tampered anchors. App activation
settles old completed timers/decay first; an unfinished timer's later completion is a new
prospective V5 award. Prefix-boundary separation accommodates that valid case without
allowing arbitrary nearby duplicate occasions. Zero-active completion reads captured rule
algorithm and real habit endpoints, not the legacy fourteen-day bar. Same-time future rule
activations restore in registry order. Full reset/archival generations preserve their
contracts. Fourteen new realSQLite tests cover migration/history, faults/rollback, idempotency,
reopen/decay, timers, reset/preferences, corruption and future-version ordering.

One reusable native ConsistencyBar animates its continuous fill and five dots using shared
values; Home/Completion/onboarding reuse it. Completion's actual base→C→bonus sequence
remains authoritative-receipt driven. Guide/explanations describe the new rhythm; illustrative
onboarding steps explicitly represent milestones over many practices, never saves.

### 5 — Complete (2026-10-13): category presentation, original vectors and Forest refinement

Twenty-five original distinct1.35-stroke icons and names are versioned presentation over
stable IDs. Level0 remains Monkey Mind; Levels1–5 display Early Steps; Level100 remains
Habit Established. One editable categories.json exports SVG/native metadata with parity
tests. Home, Journey, completion and level labels use the level-aware adapter; saved names,
achievements and formulas are intact. Seven focused presentation tests and small-size
SVG visual review supplement the domain parity checks.

Extra user-directed Forest refinement: six local stream-entry variants now closely match
the supplied entry's sea opening, stepping stones, foreground trees and warm watercolor
identity, with growth from saplings to canopy. Actual saved one-hour test practices reached
every stage (1/20/40/65/100); mature stage persisted after reopen. Short-phone review found
center-cover canopy overlap; top-aligned overflow retains the clear upper heading area.
Redundant footer copy over detailed stream artwork was removed, retaining native page dots.
Native finger-following transition refinement remains Session6; no claim it is completed.

Final batch verification: **840 automated tests pass** (511 domain + 329 data), together
with TypeScript, lint and iOS/Android/web exports. Actual React Native web flows at
390×844, 320×568 and 430×932 verify the V5 first three-minute 46-Ripple save, rounded 2%
Consistency, reopening, Guide/onboarding/category labels and forest navigation. Saved
test practices selected every forest stage, including mature-stage persistence on reopen.
The final short-phone capture confirms the heading remains clear above the canopy.
These are browser adapter/rendering checks, not physical-device proof. Logs and screenshots
are in ignored `.expo/program-sessions-2-5/`. Diff and pre-edit hash review passed: no
dependencies upgraded, audio assets/controllers changed, user database touched or earlier
Git work discarded. No commit was requested or created.

Next after Session 7: Session 8 — native navigation, restore and motion profiling.
Android APK and Google/cloud blockers remain as documented above; bells remain scheduled9–10.

### 6 — Complete (2026-10-13): interactive Forest continuity

Replaced release-only navigation with native Gesture Handler/Reanimated page displacement,
bounded to the viewport, restrained settling and reversible cancellation. Accessible sprout,
back/page-dot controls and Android Back share the same transition. Router switches once after
settling, with no second native-stack slide. Direct Forest links return to Home correctly.
Native vertical Home scrolling has an explicit simultaneous relationship with the horizontal
pan; its position survives Forest visits. Incoming views are inert and accessibility-hidden.
Lifecycle tokens cancel stale releases on resize, blur/background, unmount and Reduced Motion
changes. Multi-touch cancels the active drag. There are no per-frame React state updates.
Hidden waves stop rendering and resume at the provider's shared phase during return previews.

Visual inspection found an initial image fade restarting at the preview-to-route handoff.
First loads now display immediately; earned growth still crossfades and reset clears old art
immediately. Existing uniformly scaled sources and all six original/generated stages remain
unchanged. Three new geometry tests cover finger tracking/bounds/reversal, invalid dimensions
and restrained settle durations. Existing expansion/asset identity/alignment/reset tests remain.
Actual browser checks at 390×844, 320×568 and 430×932 cover held-drag displacement, reversal,
vertical rejection, double taps, reverse swipe, Reduced Motion, viewport interruption, restored
scroll position and subsequent meditation. Screenshots are in `.expo/program-session-6/`.

Final verification: **843 tests pass** (511 domain + 332 data), TypeScript/lint pass, and
iOS/Android/web exports pass. Three viewport flows pass, including direct Forest links and
accessibility exclusion of incoming controls. Final diff/starting-hash review passed; earlier
dirty work was preserved. The sandbox blocked Hermes temporary-file writes; the authorized
outside-sandbox export passed. Logs and actual rendered screenshots are in the directory above.
Native iOS/Android gesture arbitration, hardware Back, VoiceOver/TalkBack, safe areas and
physical frame pacing remain explicitly unverified. No progression, persistence, audio, asset,
package or lockfile changes were needed. No commit was requested or created.

### 7 — Complete (2026-10-13): completion coordination and level crossings

Immutable receipt/endpoints are captured once per session-keyed CompletionContent. A prop
refresh or interrupted effect cannot restart its reward sequence. Applicability also checks
journey versions and exact final endpoints; old/decayed mismatches show the saved current
projection immediately. Label, track and fill fade as one group at a crossing. The next label
commits in React while hidden before the bar resets/reveals, eliminating the old label/bar
mismatch. Large real receipts retain every crossing within a restrained stage time budget.
The base amount crossfades to the actual total at bonus arrival; no +0 rounded bonus line is
shown. Existing base→five-dot Consistency→bonus glow remains quiet. Removed one unused
duplicate Consistency style worklet; the existing bar consumes its shared progress directly.

Continue and Android Back share one guarded durable acknowledgement; rapid duplicate exits
cannot race or reveal the already-finished timer. Early exit, live Reduced Motion and lifecycle
interruption settle final presentation without awarding anything. The existing ending bell
remains owned by AudioProvider; its tail spans completion with no extra cue/player.
Queued native completions are checked again on the JavaScript thread against disposal and
settlement, so a cancelled level handoff cannot later rewind its label or reset the final bar.

Seven focused tests use actual V5 receipts, including 100 short saved practices followed by
qualification (a legitimate multi-level crossing), exact stages/endpoints, bounded pacing,
zero reward, duplicate callbacks and cancellation in each phase. Actual React Native web
checks verify 45→Consistency→46 Ripples, a real Level1→2 hidden-label crossing, the twelfth
contribution's first dot, resize without replay, early Continue/one saved practice/reopen,
live Reduced Motion toggles, interruption during a level handoff, short-phone layout and
zero reward. Headless Chrome does not
hide its old tab, so the background/foreground check explicitly simulates document visibility
through the web AppState adapter; it is not native lifecycle proof. Evidence/logs are in
`.expo/program-session-7/`. Native frame pacing, hardware Back, accessibility and ending-bell
listening still require physical iOS/Android validation.

Final verification: **850 tests pass** (511 domain + 339 data), TypeScript/lint pass without
warnings, and iOS/Android/web exports pass. Eight actual-browser flow checks pass, with the
simulated lifecycle limitation above. Screenshots were visually reviewed; final diff and
pre-edit hash checks passed. No progression formula, persistence schema/receipts, audio
asset/controller, dependency or source-art changes were needed; earlier Git work was preserved.
No commit was requested or created. Next is Session 8; no later milestone was begun.

### 8 — Complete (2026-10-13): recovery routing and lifecycle responsiveness

Root Router coordination now prioritizes the durable timer/pending completion across all
routes, including incoming Guide/Settings/History links. Previously only Home/Forest guarded
recovery. The cold opening waits for the recovered destination before revealing it. Removed
duplicate Home/Forest and session redirects; an outgoing unfocused completion can no longer
issue redirects against newer state. Settings Back blocks during saves and closes reset
confirmation first; session Back closes discard confirmation first, otherwise retaining the
existing pause behavior. Tab selection/disabled state now also reaches the web ARIA adapter.

Removed the application-wide 500ms timer poll. The small plain application helper
practice-lifecycle.ts schedules one deadline only for a running legacy timed cursor. Idle,
paused and current open-ended sessions schedule no expiry work. Cancellation suppresses queued
callbacks; resume uses remaining active time; foreground/unlock catches up once at the exact
deadline and retains the captured zone for overdue recovery. Durable completion still uses
the existing provider lock and atomic repositories. Foreground progression refresh waits
through busy operations and pending timer/summary resolution instead of being dropped.
SessionTime remains the only ticking React display; the shared native wave is unchanged.

Nine regression tests cover route precedence, zero idle/open-ended polling, exact deadlines,
paused fractional time, late/cancelled/duplicate callbacks, overdue time zones, unlock catch-up,
clock rollback and real SQLite running→paused→finished recovery/acknowledgement without a
second history entry. Final checks: **859 tests pass** (511 domain + 348 data), TypeScript and
lint pass; iOS/Android Hermes and web static exports pass. The sandbox denied Hermes temp
writes; the approved outside-sandbox export succeeded. No dependency or native-config changes.

Actual React Native web acceptance checks passed: running recovery via Guide, paused recovery
via Settings with an hour excluded, pending completion via History, acknowledgement and normal
deep links, twelve consecutive tab transitions, reset cancellation, second-session/discard
flows, cold reopen, visible SVG deformation and a 320×568 Reduced Motion session. Browser tab
selection responses measured 30–88ms in this run; this is adapter evidence, not native frame
pacing. No page errors or application 500ms poll were observed. Screenshots were reviewed;
logs/evidence are in `.expo/program-session-8/`. Pre-edit hashes confirm domain, persistence,
audio, artwork and package files were preserved. Earlier dirty work remains; no commit made.

Physical iPhone/Android frame profiling, hardware Back, OS interruption, native restoration and
accessibility remain device verification tasks; browser automation does not establish those.
No APK was built (Sessions 11–12). Next is Session 9: acoustic bell research/listening and
rights verification. No later milestone was started.

### 9 — Prepared (2026-10-13): acoustic sources and mastered bell candidates

Researched authentic struck/rubbed bowls and acquired four original mono 48 kHz WAVs
from Joseph SARDIN / BigSoundBank through the publisher's normal download flow. Each
source explicitly declares CC0; publisher terms permit commercial editing/redistribution
with no mandatory credit, fee, account or permission. Original bytes, SHA-256 hashes,
source URLs, retrieval date and rights summary are retained in scripts/audio-sources/bells.
Freesound/Monkay #48325 was also researched but not acquired (login download, lower
sample rate and reported abrupt tail). No uncertain-license sound or current bell was reused.

Selected #2553 for Start (13.24s), #1110 for the lower/longer End (29.92s), #2554 for
Interval (9.06s). #2555 remains a source comparison. master-acoustic-bells.py applies
gentle filtering, half-cosine attacks/quiet-tail fades and constant RMS-matched gains;
preserves pitch, acoustic resonance and full natural tails. No compressor, reverb or
synthesized layers. A second analytical refinement softened End/Interval upper partials
and lengthened End's attack; ending peak reduced 0.174→0.161 at unchanged opening RMS.
Interval opening RMS is 61% of Start. Three mono PCM16/24 kHz masters total 2.51 MB;
original sources total 8.00 MB. The bank is staged in assets/audio/bells-v2 and is not
referenced by Metro, so app size/playback behavior have not changed.

Seven focused tests check original hashes/provenance references, actual PCM formats,
headroom/DC/endpoints, measured levels, interval restraint and retained long decay.
Rerendered masters are byte-identical using recorded NumPy/FFmpeg versions. The developer
audition page reads analysis.json for matched-energy source comparisons, uses one player,
starts at effective gain 0.09 and stops on source change/Stop/page hiding. Browser checks
loaded all seven clips with correct durations and no media errors, and Stop cleared media.
This demonstrates browser decoding/control only, **not subjective listening**.

Final checks: **866 tests pass** (511 domain + 355 data), TypeScript/lint pass, and
iOS/Android/web exports pass. Sandbox restrictions on Hermes temp writes and localhost
were resolved by authorized outside-sandbox verification. Logs and first-pass/reproduction
evidence are in .expo/program-session-9. Pre-edit hashes confirm all app source, live
assets, preferences, domain, persistence, package/lockfile and previous dirty work were
preserved. Only audio documentation/this log plus new staged assets, source evidence,
mastering script and seven tests changed. No commit or dependency change.

**Acceptance still pending:** this environment did not provide reliable subjective audio
listening or physical iPhone/Android audition. Naturalness, comfort and relative audibility
over ambience must be listened to, not inferred from signal metrics. Session 10 starts
with that review/refinement, then replaces live clips and regenerates all interval timelines
together. Existing procedural generators/provenance must remain; controller ownership,
preferences, active-time intervals and completion tails must survive integration. Session 10
was not begun. Do not count browser playback/export as native listening or lifecycle proof.

### 10 — Implemented (2026-10-13): acoustic playback and matching interval tracks

The catalogue now uses the three mastered CC0 acoustic clips for live Start/End/Interval
and Settings previews. Generated all three 5/10/15-minute sparse six-hour AAC tracks from
the exact new Interval PCM, with the released 12-second final-tail window. timelines.json
ties encoded hashes to the source hash. First/second/final strikes are actually decoded,
with >0.9999 waveform correlation, quiet lead-ins, complete tails and restrained peaks.
The verification script can recheck without encoding. No old procedural bell is in the
runtime graph; six obsolete clips/tracks were removed. Original generators remain and
now write ignored legacy outputs instead of overwriting live assets. Ambience, Choir,
original acoustic sources, stored preferences and gain settings remain byte-identical.
The current meditation collection is 39.56 MB (previously about 42 MB), including 19.33 MB
of sparse timelines; original acoustic source masters are outside Metro's asset graph.

Fixed the demonstrated ending-tail integration problem: the old 25-second cleanup would
truncate the 29.92-second End. Sample-verified bell-timing.ts ceilings plus a one-second
margin bound cleanup; the deadline begins on actual playback, not player creation. Native
end events still release immediately. Late-load deadlines remain unchanged. Added token/
ownership guards and avoided a stale load watchdog when subscribe reports playing
synchronously. Provider ownership, active-time seeks, mute/previews, pause/recovery,
interruption policy, completion/Home tail and timer/reward independence are preserved.
Corrected the in-app sound description and documentation to distinguish acoustic CC0
bells from original procedural ambience; no mandatory attribution screen was introduced.

Eight new focused tests cover natural ending release, accepted delayed loading with a
full tail, synchronous initial status, exclusive full-length previews, six-hour cutoff,
and three timeline source/hash/timing contracts. Existing tests now validate new PCM
watchdog durations and retain the original 45 MB complete-collection size gate. Full
verification: **874 tests pass** (511 domain + 363 data), TypeScript/lint pass, and
iOS/Android Hermes plus web exports pass. New master rerenders remain byte-identical;
all four ambience files match the prior hashes. Diff check and pre-edit hash review pass;
earlier unrelated work is preserved. No dependency/configuration/migration changes or commit.

Actual exported React Native web checks exercised all three bell previews, saved Silence/
five-minute preferences, live Begin, pause/reload recovery/resume, saved completion and
one history entry (1:21 active, 0:35 paused, 20 Ripples), plus preference retention after
reload. Network responses resolve to the new acoustic WAVs and interval-5m AAC; no browser
console errors were observed. This is browser/adapter evidence, not listening approval.
Logs/reproduction evidence are in .expo/program-session-10. Expo's web development server
hit an expo-sqlite worker-chunk serialization error; the successful exported web build
was served with COOP/COEP for these checks. No SDK upgrade or unrelated storage workaround
was applied. Native exports pass; the web development-server issue remains technical debt.

**Pending device acceptance:** no subjective headphone/speaker or physical iPhone/Android
listening was possible. Check acoustic comfort/audibility over every ambience, full End
tail across Completion/Continue, locked-screen intervals, six-hour end, calls/audio focus,
background recovery and native cleanup on a rebuilt binary. Expo Go does not apply native
background config. Session 9 listening and Session 10 native acceptance remain unverified,
even though integration is implemented. Session 11 was not started automatically.

### 11 — Complete (2026-10-14): standalone Android APK

The user chose com.meditation.ona and explicitly approved source/runtime-asset upload
to Expo EAS plus generation/storage of the Android signing key. Linked the existing
personal tripto92 account to EAS project 3ec57447-1b2b-428b-a9cf-dd0216e351b5.
app.json now records package/versionCode 1/owner/project; app.config.ts preserves them.
The preview profile pins Node 24.21.0 and builds an internally distributed release APK.
.easignore excludes local evidence, source masters and credentials; Git ignores artifacts
and signing material. Domain, persistence, audio, screens and supplied artwork were preserved.

Build **f3b6fe07-c3fe-4f88-aed3-74dd43c8e3d3**:
https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/f3b6fe07-c3fe-4f88-aed3-74dd43c8e3d3
Submitted with npx eas-cli@latest build --platform android --profile preview --no-wait;
the signing key was generated remotely with user approval. Source archive 94.9 MB;
the actual dirty working tree was uploaded, not just Git HEAD 9e910bf. Fingerprint
b892d58e5a6b8992931c121d160207defd508983 identifies this source/configuration.
The first job waited about 20 minutes, then failed during resource linking: drawable/
splashscreen_logo was absent. Expo's splash plugin referenced the resource without an image;
app.config.ts also discarded extra splash options. Added a one-pixel transparent Android
splash source to keep the warm blank launch canvas, and preserved plugin options while
applying the theme. Expo prebuild generated all density drawables. Its incidental package
script edits were restored byte-for-byte; generated Android output was moved into ignored
verification evidence. Native project contents were never edited manually.

Retry **37530f47-9acd-4eff-b7a3-dffcb8452730** reused the same signing key and completed:
https://expo.dev/accounts/tripto92/projects/MeditationApp/builds/37530f47-9acd-4eff-b7a3-dffcb8452730
Source fingerprint: 72eafe8605d004ec797694f1ad80496057f8366a.
APK: artifacts/android/ona-preview.apk, 205,288,874 bytes (universal, offline assets).
Download: https://expo.dev/artifacts/eas/p2jNw-l8qcUSo_NpuSiXdxU1P6CORWmXcT-vlKKqtZs.apk
SHA-256: 9386728b724ae5be9b46571376f141accc6ac35d95d8844a3a7dfa33b06ae2a0.
Signing certificate SHA-256: 15fccec1f10e5788cbfc12612184df2bc997872d761715c25031c4e2bd48bce7.

Four regression tests guard native identity, preserved splash options, transparent launch
resource and unrelated plugin configuration. **878 tests pass** (511 domain + 367 data),
TypeScript/lint and iOS/Android/web exports pass after the fix. The earlier export retry
was temporarily blocked by approval-review usage limits; it subsequently passed.
docs/ANDROID_BUILD.md contains build/signing/installation/data-sandbox instructions;
scripts/verify-android-apk.py verified the actual APK using apksigner, aapt2 and zipalign.
Checks passed: signed non-debuggable release, package/version 1.0.0 (1), minSdk 24/target
36, bundled Hermes payload/arm64 libraries, eleven byte-identical runtime audio files,
background media-service permissions, no microphone permission, and 16 KB native ZIP
alignment. Report/manifest are beside the ignored artifact; logs/baseline are in
.expo/program-session-11. ZIP alignment is not proof of ELF segment alignment or device
runtime. The APK retains Expo's default legacy storage/overlay declarations; review them
during native acceptance before public distribution. No actual device was installed/tested.

Source/hash/diff review confirms existing app logic, data, sounds/artwork and package/lockfile
were preserved. No paid purchase, SDK/dependency upgrade, destructive migration or commit.
No adb device/emulator was attached. Session 12 must install/launch this existing APK,
test hardware Back/safe areas/wave/timer/recovery/SQLite/audio/settings/offline behavior,
and inspect native permissions/16 KB compatibility. Expo Go data is a separate sandbox;
the new standalone app does not automatically import it. Session 12 was not begun.

### 12 — Complete (2026-10-14): compatibility checks, handoff and owner device acceptance

Inspected the current dirty tree, roadmap, native configuration and integration. No app
source/dependency/user-data/signing changes. ADB found no connected device. Started the
existing Medium_Phone_API_37.0 AVD headlessly; it exited before boot because the Android
Emulator hypervisor driver is missing. The owner confirmed no Android phone is available.
No system-driver installation or virtualization/reboot change attempted. Consequently
installation, startup, navigation/gestures, timing/recovery, native SQLite and audio
acceptance remain pending; this is not a completed native Session 12.

Reverified the same signed release APK and public certificate SHA-1 for handoff. Expanded
verify-android-apk.py to inspect all bundled 64-bit ELF PT_LOAD segment alignments, with
explicit validation of ELF class/endian/version/header/table. All ARM64/x86_64 libraries
pass 16 KB segment alignment/congruence; existing signature/ZIP/Hermes/offline-audio gates
pass. Seven Python fixture tests cover compatible headers, truncated/malformed inputs,
unsupported tables, missing load segments and bad alignments. This is static compatibility,
not proof of runtime on a 16 KB device. Legacy storage/overlay declarations remain a
future pre-release review item; no unnecessary rebuild/configuration change was made.

npm run check passes **878 tests** (511 domain + 367 data), TypeScript/lint. Seven separate
Python verifier tests pass. Runtime graph/configuration remains unchanged from the Session
11 passing all-platform exports. Evidence: .expo/program-session-12 and ignored
artifacts/android/verification-session-12.json. ANDROID_ACCEPTANCE.md records the concrete
native acceptance checklist; CLAUDE_HANDOFF.md captures chat-only approvals, EAS/key/build
identity, safe credential retrieval, machine tools, external service gaps and user steering.
No private signing material exported, new account, purchase, Git commit or Session 13 work.
The owner intends to continue with Claude after this milestone; native acceptance is the
first unfinished prerequisite rather than something that may be silently marked complete.

**Completed by Claude (2026-10-14).** The owner reports the Session 11 APK installed and
working on their own physical Android phone; they test there directly. Per-row results of
the ANDROID_ACCEPTANCE.md table were not individually reported, so rows remain listed for
targeted follow-up when an issue is noticed rather than as claimed passes. The pre-release
review item is resolved in configuration: app.json `android.blockedPermissions` removes
READ/WRITE_EXTERNAL_STORAGE and SYSTEM_ALERT_WINDOW. A disposable `expo prebuild` copy
(outside the repository) confirmed the generated manifest marks all three
`tools:node="remove"`, retaining INTERNET, VIBRATE, MODIFY_AUDIO_SETTINGS and media
foreground-service permissions; no microphone permission. The existing APK still contains
the old declarations until the next build (Session 20). A regression test guards the list.
Verification: **879 tests** (511 domain + 368 data), TypeScript and lint pass.

### 13 — Complete (2026-10-14): sync design, ledger export/import and durable local outbox

Owner decisions: Supabase backend, guided owner-created accounts. docs/SYNC.md specifies
the model: the device's validated ledger stays the unit of truth; the cloud keeps a linear,
multi-version revision history with compare-and-swap pushes and idempotent push IDs; local
changes are *derived* by diffing an export against the last synced manifest, so the outbox
cannot lose events. Fast-forward merges keep remote history untouched; only an interleaved
post-fork window is replayed; latest reset wins with no resurrection; overlapping practices
are set aside, never dropped. Per-account ledger files prevent cross-account leaks.

Implementation: migration 11 (`optional_account_sync`) adds sync_state (random device ID,
account binding enforced by an SQL trigger, synced revision, one in-flight push), sync_manifest,
sync_document_clocks and immutable sync_set_aside_sessions (deleted by confirmed reset).
database/ledger.ts: fixed 15-table ledger with stable keys, dependency-free SHA-256 row hashes,
deterministic export, untrusted-row decoding (table/column allowlists, scalar values, recomputed
keys), diff/apply, and `replaceLedger`, which swaps the ledger in one transaction, refuses while a
practice or unacknowledged completion exists, marks imported completions acknowledged and runs
full startup validation; any inconsistency rolls back. Continuation singletons alone are not
"significant" changes, so ordinary reopening never causes pushes or merges. Reset's deletion
guards became shared helpers. Preference saves record monotonic edit clocks.
sync-repository.ts exposes bind, export, localChanges, begin/complete/abandon push, applyRemote.

Verification: **896 tests** (511 domain + 385 data): seventeen new ledger/sync tests cover
SHA-256 against Node crypto, unique device IDs, V10→V11 upgrade, account binding (including raw
SQL), exact cross-device round trip (history/details/progress/next earning identical, no
completion screen), four tampered-ledger rejections with unchanged device and restored guards,
untrusted row validation, import refusal states, diff/apply equivalence, durable in-flight push
across restart, abandoned pushes, reset removals and preference clocks. Existing migration tests
were updated only for the new migration count/V10 fixtures. TypeScript, lint and all-platform
export pass. No network code, dependency or UI change yet.

### 14 — Complete (2026-10-14): Supabase schema, isolation and import contracts

supabase/migrations/20261014120000_ona_sync.sql: per-user ledger heads, an append-only
revision log (unique push IDs), multi-version ledger rows (added/removed revisions with a
partial unique index allowing one live version per key, table allowlist, hash/size checks)
and settings documents. RLS on all four tables (select own rows only); Supabase's broad default
grants are explicitly revoked, so clients cannot insert/update/delete directly. Writes go
through `security definer` functions with an empty search_path: `ona_push_ledger` (validated,
size-limited, atomic compare-and-swap; a retried push ID returns its original revision even
after the head moves; any bad removal/addition rolls back everything), `ona_ledger_changes`
(security invoker; exact diff between any two revisions, or a full state from 0),
`ona_save_setting` (newest edit wins, deterministic device tie-break) and
`ona_delete_my_cloud_data`. Anonymous callers have no table or function access.

Verification uses @electric-sql/pglite 0.5.8 (exact, dev-only; real Postgres in WebAssembly)
with a Supabase stub (anon/authenticated roles, broad default privileges, auth.uid()). Eight
tests: anon denial, direct-write denial, two-account isolation (rows/heads/revisions/settings/
cross-account removal/deletion), CAS/idempotency/rollback/constraint failures, size limit,
real device ledgers through JSONB into a second device (identical rows/state), every
historical state and every from→to diff across practice, reset and later practice, and
settings ordering. **904 tests** (511 domain + 393 data), TypeScript/lint pass. Lockfile
changes are only the new dev dependency (installed with npm 11 to match the owner's).
No Supabase project exists yet; the owner creates it with guidance in Session 15.

### 15 — Complete (2026-10-14): Google sign-in, secure tokens and per-account ledgers

Added @supabase/auth-js 2.117.2 (exact, auth only; no realtime/storage bundle) and the SDK 57
modules expo-auth-session ~57.0.13, expo-web-browser ~57.0.3, expo-secure-store ~57.0.4
(versions read from expo/bundledNativeModules.json because `expo install` cannot reach Expo's
API from this environment; all published at least two weeks ago). src/cloud: `parseCloudConfig`
(origin-only https URL, refuses secret/service-role keys; cloud stays off when unset), chunked
secure-store session storage (count written last, so an interrupted write never yields a
truncated token; unreadable keystore values after an Android restore read as signed out),
PKCE callback parsing (codes or errors only; implicit tokens rejected), `createCloudAuth`
(Google via Supabase in the system browser, `meditationapp://auth-callback`, auto-refresh only
while active, local sign-out), and a Supabase RPC client with classified failures
(offline/signed_out/server/rejected). The expo-secure-store config plugin is deliberately not
added: its backup rules would stop Android Auto Backup from covering Ona's SQLite files.

Provider: remembers the active account in secure storage, opens that account's own ledger file
(`databaseNameFor`, opaque hashed names; guest keeps meditation.db) and binds it, switches only
between practices without unmounting screens, and refreshes history views. New Account screen
(Preferences → Account, shown only when configured): optional sign-in copy, signed-in address,
confirmed sign-out returning to the phone's own practice. docs/SUPABASE_SETUP.md is the owner's
step-by-step guide (Supabase project, SQL, Google OAuth client, redirect URLs, public values).

Verification: **912 tests** (511 domain + 401 data); eight new tests cover config validation and
secret-key refusal, secure storage chunking/shrinking/removal/interrupted writes/unreadable
restores, callback parsing, namespace naming, RPC request shape and failure classification.
TypeScript, lint and iOS/Android/web exports pass. Real Google sign-in needs the owner's
Supabase project and a rebuilt binary (Expo Go works via `exp://**`); not yet exercised.

### 16 — Complete (2026-10-14): upload/download engine, retries and settings sync

Design refinement found while building: a practice made offline on another phone can predate
the settlement time of the cloud's newest state, so replaying onto that state would be
"backdated". Each cloud revision now records its settlement time (`as_of`) and
`ona_ledger_revision_before(time, max)` finds a safe earlier base (used by Session 17 merges).
Migration 12 keeps the synced base rows' content locally (no re-downloading history) and
adds preference acknowledgement clocks. A ledger recording no practice adopts the cloud.

src/application/sync-engine.ts (plain TypeScript, injected cloud/clock/IDs): bounded cycle that
resends a durable in-flight push (idempotent push ID), pulls the diff since the synced revision,
refuses newer ledger formats (`SyncUpgradeRequired`), re-downloads a missing base once, pushes
significant local changes with compare-and-swap, adopts the cloud when local changes are only
re-settled time, never imports while a practice or unacknowledged completion is open, and hands
true two-sided changes to a merge hook. Preferences sync per document, newest edit winning on
server and phone; the Guide dismissal is one-way. The provider runs sync when a signed-in ledger
opens, on return to the app, every 15 minutes while active, after a saved practice is acknowledged,
after preference saves and after reset, outside the operation lock (meditation is never blocked),
refreshing progress/history/preferences after downloads. The Account screen shows one calm status
line (saved time, offline, sign in again, update needed) and "Save now".

Verification: **923 tests** (511 domain + 412 data). Ten engine tests run two real SQLite phones
against the real Supabase SQL on PGlite: guest no-op, first upload and idle confirmation, second
phone download plus incremental follow-up both ways, lost push response resent exactly once, offline
retry, time-only adoption, waiting during an open practice, newer-format refusal, preference
ordering across phones, and base re-download. TypeScript, lint and all-platform exports pass.
Merging two phones that both practiced offline is Session 17.

### 17 — Complete (2026-10-14): merging phones, resets, deletion and account switching

database/ledger-merge.ts: pure `planMerge` (fast-forward when local-only practice starts at or
after the cloud state's settlement and there is no local reset; latest reset across both sides)
and a transactional `applyMerge`: start from the chosen cloud revision (or a fresh ledger built
like a new install), apply the winning reset, replay newer practices from both sides in time
order through the normal completion path, set aside overlaps with full data, carry set-aside
practices, settle to now, mark completions acknowledged and validate like startup. The sync
repository's `mergeRemote` refuses (returns false) if the phone saved anything after planning.
The engine picks the replay start with `ona_ledger_revision_before`, reusing the local base or
downloading one revision, and pushes the result as kind `merge`.

Found and fixed: a deleted and re-created cloud copy reuses revision numbers, so an old phone
could have pushed onto the wrong history. Cloud ledgers now carry an identity (`ledger_id`,
regenerated on deletion); pushes name it and receive `replaced` on mismatch; changes report it;
migration 13 stores it on the phone (`SyncCloudReplaced`, Account status "deleted from another
device"). Account screen: optional copy of this phone's guest practice into an empty account
after the first sync, "Save this phone's practice to the account" after a replacement
(`forgetCloud`), "Remove this account from this phone", and "Delete this account's practice"
(cloud + this phone's file, then sign-out). Account files are deleted only after their store
closes; the guest file can never be deleted this way.

Verification: **934 tests** (511 domain + 423 data). Eight merge scenarios on real SQLite phones
and the real Supabase SQL: fast-forward without touching synced awards, late offline practice
replayed from an early revision (only that window reweighted), a fresh start without an invented
reset, overlap set aside on both phones, remote and local resets winning with no resurrection,
three phones converging to identical history and progress, and stale-plan refusal. Plus ledger
identity on the server, deleted-copy refusal and re-save, and first sign-in guest copy.
TypeScript, lint and iOS/Android/web exports pass. Real Google/Supabase use still awaits the
owner's project; the SQL file is final for this program.

### 18 — Complete (2026-10-14): integrated cloud, reinstall, offline and recovery testing

Phones in tests can now be file-backed and restarted (process death/relaunch). Eight integrated
scenarios against the real Supabase SQL: (1) reinstall on a new phone restores 40 days of
history, awards, current/highest level, Consistency, forest stage, practice details and all three
preference documents exactly, and the restored phone then earns identically; (2) process death
between recording a push and hearing back resends it once after relaunch; (3) a failure in the
middle of importing cloud practice rolls back completely with guards restored, and the next sync
merges; (4) three weeks offline keep every practice and upload in one push; (5) a phone opened
days later settles decay to the same values as the practicing phone; (6) practice captured in
another time zone keeps its date/zone everywhere; (7) a year of daily practice uploads and
restores (≈1.4 MB, upload 0.6 s, restore 4.3 s in the in-process database: evidence, not a device
benchmark); (8) sign-out/in reopens the same account file from disk and keeps syncing.

Capacity finding: the progression checkpoint lists every occasion (~130 KB after a year) and the
cloud keeps every version, so storage grows ~25 MB per person-year. Fine for the owner and a small
group on the free plan; documented in SYNC.md with the compaction design needed before wider
release. Not changed now, deliberately, to avoid risky retention logic without real usage data.

Verification: **942 tests** (511 domain + 431 data), TypeScript and lint pass (full check re-run
after the owner's interruptions, exit 0). No app source
changes in this session beyond test helpers and documentation. Real Google sign-in and a hosted
Supabase project remain owner setup; device sync remains to be exercised with real credentials.

Resolved (2026-10-15, owner acceptance confirmed): localhost diagnosed using Auth logs, live redirect probes
and Supabase's validator source. Google login succeeds; non-loopback numeric IP callbacks
are rejected before allow-list matching. Expo Go must use `npx expo start --clear --tunnel`.
The live `.exp.direct` callback is accepted. Added web-only token persistence and a same-tab
PKCE callback (native SecureStore/browser unchanged), with every RPC bound to the ledger's
account to prevent cross-tab account mixing. Web Google → Account email → Save now verified.
Verification: `npm run check` passed (962 tests, TypeScript and lint); iOS/Android/web exports
passed. Four existing Windows test cleanup hooks now close stores before deleting files.
Owner confirmed the physical iPhone Expo Go tunnel test: "My email appears and Save now
completes." Native browser return, PKCE exchange and authenticated sync are therefore
verified on that phone; this Google sign-in item is closed. Full evidence and
verification status: [AUTH_DEBUG.md](AUTH_DEBUG.md).

### Pre-meditation screen — Complete (2026-10-14), inserted before Sessions 19–20 by the owner

Home's Meditate opens /prepare ("Your practice"): an optional intention (None, Calm, Focus, Rest,
Gratitude, Kindness), the meditation sound (all six ambiences) and Length: Open (recommended
default) or 5/10/15/20/30/45/60 minutes, as even underlined radio grids, with a one-line summary
above Begin. Choices are remembered in the meditation preferences document (new optional fields
`durationMode`, `intention`; older documents decode as open/none, so no migration; synced with the
account like other preferences); the sound choice updates audio preferences.

Timer domain: new `fixed` mode (`startFixedTimer`), which ends by itself exactly at its active
target (deadline watcher and unattended recovery already target-generic) and where finishing earlier
is `completed`, so a person's shortened practice still qualifies. Legacy `timed` cursors keep
`ended_early`. Earning rules untouched. Session screen counts down for a fixed length and shows the
intention's quiet line ("Settle into calm") instead of "Just be here".

Audio: a native ending timeline (one hour of silence + the exact End master, 0.86 MB, built and
verified by scripts/build-ending-timeline.py, correlation 0.99994) is aligned to active time so the
End bell rings at the target even on a locked phone; never a second End bell when it already rang;
early finish uses the ordinary End clip; none when the ending bell is off/muted.

Verification: **955 tests** (515 domain + 440 data): four fixed-timer domain tests (deadline,
early-finish qualification, pauses, validation/legacy) and nine fixed-practice tests (timeline
alignment, pause/resume re-alignment, single bell at target including the locked-phone case,
early finish, bell off, background ownership in Silence, asset hash/size/limits, preference decoding
and persistence, intention copy). Real web flow screenshots at 390×844 and 320×568: Home → Prepare →
choose Calm/Rain/10 → Begin → Session showing 09:57 counting down with "Settle into calm"; no page
errors. TypeScript, lint and all-platform exports pass. Not verified: locked-screen bell on a physical
phone (owner check), listening balance of a coincident interval + End bell.

### 19 — Complete (2026-10-15): accessibility, performance and release-candidate polish

Owner direction (2026-10-15): **no further APK builds** in this program; Session 20 audits only.

Accessibility: every `Type` with the title/heading role is announced as a header (screen-reader
navigation by heading), the Journey month figures are read with their labels ("12 practice days"),
the Prepare screen labels each choice group and switches to two/three wider columns with large
system text (or very narrow screens) so words stay whole. Copy: the fixed-length line no longer
promises a bell when the ending bell is off; the Guide answers mention choosing a length and
choosing Silence before beginning.

Performance: each background sync used to hash the whole ledger twice in pure JS (about 0.9 s of
blocked JavaScript per sync after a year, measured with JIT disabled). Hashes are now remembered
per process (computation only, bounded), the stored base reuses its saved hashes, and long exports
yield every 200 rows: later syncs take about 0.05 s. Sync no longer touches React state while a
practice is open, so the session screen is not re-rendered by the 15-minute sync timer.

Dependency audit (`npm audit`, 30 advisories, all transitive from Expo tooling): `braces`,
`node-forge`, `uuid` are build-time only (Metro/config plugins/code signing) and never ship in the
app. `decode-uri-component@0.2.2` ships through expo-router's `query-string` (deep-link parsing);
its advisory is slow decoding of malformed percent-encoding (a crafted link could make Ona pause
briefly; no data exposure). The fixed 0.5.0 is ESM-only under a different API generation, so an
override is riskier than the issue; accepted and to be revisited with the next Expo SDK upgrade.
`npm audit fix --force` would install Expo 44 and must never be run.

Verification: **957 tests** (515 domain + 442 data; new: wrong/malformed stored base hashes, hash
memo exactness), TypeScript, lint, all-platform export; web flow screenshots at 390×844, 320×568 and
280×640 (two-column layout), no page errors. Not verified: TalkBack/VoiceOver reading order and
large-font rendering on a physical phone; Hermes timing (estimated from jitless V8).


### 20 — Complete (2026-10-15): final acceptance audit (no APK, by owner decision)

The owner asked for no further APK in this program, so the "APK build" half of Session 20 is
**not done by decision**, not blocked. Critical-fix scope: the audit found none requiring code
changes beyond Session 19. Checks run for this audit: full `npm run check` (957 tests), all-platform
export, both progression simulations (rerun below), tracked-file secret/artifact scan (no secrets,
no APK/keystore files), web flow screenshots.

Simulations rerun (`scripts/simulate-progression-v5.cjs`, `scripts/simulate-habit.cjs`): ten minutes
daily reaches full Consistency on day **60**, twice daily on day **30**, one-minute practice never
qualifies; ten minutes daily reaches Level 100 on day **265** (≈8.7 months) and Level 125 on day
**368**; after a year away a daily practitioner keeps level 63 of 125 protected.

#### Acceptance matrix

Status key: **Done** = implemented and verified here; **Done (owner)** = owner reported on a device;
**Partial**; **Unverified** = implemented, needs a physical phone; **Blocked** = cannot finish as is;
**Not done** = by decision.

| Area | Status | Evidence / what is missing |
| --- | --- | --- |
| 125 levels, 25 categories, Level 0 start, Level 100 "Habit Established" | Done | domain tests; simulation day 265/368 |
| Level 125 needs 365 dates **and** 365 days | Done | domain tests |
| 180 s qualification, pauses excluded, six-hour second session, max two/date | Done | domain + data tests |
| Consistency: bar + five dots, 60/30 days, decay/return, ~40% bonus, no multiplier shown | Done | simulation; V5 tests |
| Permanent highest level, protected current level, versioned history V1–V5 | Done | migration/progression tests |
| 25 original category icons; Journey, calendar, history, Guide | Done | Session 5 tests; web screenshots |
| Forest: six stages from highest level, swipe Home ⇄ Forest, no planting UI | Done / Unverified | native gesture feel and frame pacing need a phone |
| Wave: 12 s organic cycle, settles on pause, Reduced Motion | Done / Unverified | native frame pacing |
| Completion: Ripples → Consistency → bonus, level crossings, no duplicate rewards | Done | completion/receipt tests |
| Pre-meditation: intention, sound, open or 5–60 min, remembered | Done | tests + screenshots |
| Fixed length ends by itself; End bell on a locked phone | Unverified | needs a native build; Expo Go ignores background audio config |
| Acoustic CC0 bells (Start/End/Interval), provenance kept | Done / Unverified | rights + signal tests; subjective listening owner-only |
| Ambiences, volumes, intervals, session sound switching | Done (owner) | owner reports the Session 11 APK works on their phone |
| Android APK (Session 11), signing, identifiers | Done (owner) | installed on owner's phone; contains Sessions 1–12 only |
| New APK with Sessions 13–20 | Not done | owner decision 2026-10-15; next build must raise `versionCode` |
| Accessibility: headers, labels, large text, Reduced Motion | Done / Unverified | TalkBack/VoiceOver and real large-font rendering |
| Sync engine: outbox, retries, merge, resets, deletion, account isolation | Done | sync data tests against the real Supabase SQL (PGlite) |
| Supabase project, RLS, functions | Done (owner) | owner ran the SQL; configured project `zmebgjgcmptmivwqumxg` |
| Google sign-in end to end | **Done — web + owner iPhone Expo Go** | Web email + Save now verified; owner confirmed the same physical iPhone flow using the Expo tunnel (2026-10-15). See AUTH_DEBUG.md. |
| Real multi-phone sync with real accounts | Unverified | requires a second physical device and a multi-device sync exercise |
| Cloud storage growth (~25 MB/person-year) | Partial | fine for owner; compaction needed before wider release (SYNC.md) |
| Dependency advisories | Partial | build-time only except `decode-uri-component` (low impact, accepted; see Session 19) |
| Google app publishing (privacy policy, homepage) | Not done | needed only to let other people sign in |

#### What the owner can check on a phone (no new build needed, Expo Go)

1. Prepare screen: choose a length, let it finish, confirm the End bell and the completion screen.
2. Listen once to Start/End/Interval bells over two ambiences.
3. Large system text and TalkBack/VoiceOver on Home, Prepare, Session, Journey.
4. Sign-in retry: report the full `localhost…` address and the grey development line.

## After the program

### Calendar streaks and level path — Complete (2026-10-15), requested by the owner

Owner request: day and week streaks in the calendar (a week is active with at least three active
days), monthly streaks only when every week of the month was active, visually evident; and a rework
of the levels section, which "looked too much like a list with numbers".

Decisions taken (owner may revise): an active day uses the existing 3-minute practice test; weeks
run Monday–Sunday; a week belongs to the month holding most of its days; a period in progress never
breaks a streak. Pure domain module `streaks.ts` (`ona_streaks_v1`, presentation only, no storage,
no migration); calendar rows, discs, bands, month line and legend; the level list replaced by a
tappable path (LevelPath). Rules in GAME_SYSTEM.md, visuals in ONA_UI.md.

Verification: nine new domain tests (day/week/month states, Thursday ownership incl. year boundary,
in-progress periods, short/early practice, travel dates, a year of practice); TypeScript, lint and
full test suite. Web build: fourteen real practices driven through the app with a controlled clock,
then calendar and level-path screenshots at 390×844, no page errors. Not verified on a phone.

### Streak hierarchy and motion — Complete (2026-10-15), requested by the owner

Owner: build smooth animations and a better representation of streaks, and adopt the idea of showing
week and month numbers more prominently than the day number. Weeks are now the hero (with this
week's three pebbles and the last eight weeks), months second (last six months), days a quiet line.
Runs of counting days are single capsules that grow like a brush stroke; week bands unfold; months
slide in from their direction; the selection eases in. Domain: `recentWeeks`/`recentMonths` on
practice streaks. Pure geometry/timings in src/ui/streak-geometry.ts (tested: runs, capsule
geometry, settle ≤ 1.1 s). Verified with web frame captures during the entrance, month slide,
selection and with Reduced Motion emulated (drawn instantly). Not verified: native frame pacing.

### Consistency bar, current-level Journey and sealed stages — Complete (2026-10-15), owner request

Owner requests: a consistency bar like a single bar with small dots beneath (reference: a game health
bar, in Ona colours); Journey shows only the current level, with the button explaining the purpose
(Level 100 ends habit formation); new names and icons for Levels 6–100, unknown to the owner so they
are discovered by playing; Monkey Mind for Levels 1–5.

Done: ConsistencyBar is one bar with five milestone segments beneath. Journey shows the current stage
only plus "Toward Level 100" and the purpose. Stages 2–20 are **sealed**: names, themes and icons live
base64-encoded (assets/ona/categories-sealed.json + runtime mirror), edited only via
scripts/sealed-categories.cjs (counts-only output), never exported as SVG, guarded by
tests/domain/sealed-stages.test.cjs (fails if any sealed text appears in plain files; reports IDs only).
The completion screen veils a new stage during the level animation and then reveals its symbol and
name once (stage-reveal.tsx). The content was designed by a helper agent out of the owner's view in
three rounds (names; icons for stages 2–10; icons 11–20), each rendered and reviewed visually by that
agent, verified and committed here without the contents ever being printed. Stable category IDs,
achievements and history are unchanged (presentation v3 only).

Open: Levels 101–125 remain visible (owner was asked whether to seal them too). Not verified on a phone.

### Watercolour stage paintings — Complete (2026-10-15), owner request

Owner supplied a watercolour Monkey Mind and asked for all stage icons to be redesigned to match
Ona. Monkey Mind is the owner's painting (cut out with soft, fringe-free edges); the five visible
stages (Levels 101–125) were painted here and shown to the owner; the 19 sealed stages were painted
by the helper agent out of view in two rounds (stages 2–10, 11–20), each with several render/review
passes and a final whole-family review, sealed as veiled PNG plus veiled scene source. Painter,
cutout, contact sheets and style guide in scripts/watercolor. Tests: visible paintings wired and
384 px RGBA; no sealed painting file exists; every sealed stage has veiled art and scene; veil round
trip is byte-exact; leak guard. Android bundle 7.3 MB after adding the paintings. Not verified on a
phone (rendering of data-URI paintings is standard RN Image behaviour on iOS/Android).

### Clock skew — Fixed (2026-10-15)

Defect found while testing: progression and the habit checkpoint refused to settle at a moment
earlier than their stored one, and the timer refused a clock behind its cursor. A phone whose clock
ran even a minute behind another phone's (after a sync pull), or a clock set back by hand, could not
open its practice ("Your practice could not be opened") until the clock caught up; a practice ending
slightly before the stored moment could not be saved.

Fix (no rule version or migration: identical results for every request at or after the stored
moment, so V1–V5 histories and receipts are unchanged): settlement is forward-only (`forwardOnly`:
an earlier request settles at the stored moment itself, date included, so every replay reproduces
it); reads, startup and snapshots use it as `readingContext`; the timer holds its cursor until the
clock catches up and the deadline watcher keeps one pending callback; a practice ending before the
stored moment is recorded with its true times when its date is at most a day before the settled
calendar and no rules activation or rank achievement is dated after its end (so the integrity
replay reproduces its award); resets still refuse a moment before the settlement.

Verification: domain tests (late ending equals the unskewed award, older late endings and post-
upgrade late endings refused, reads/habit never rewind and replay deterministically, timer holds),
data tests (two phones 2 minutes apart through real Supabase SQL: pull, read, save, reopen, sync back;
cross-midnight save and revalidated reopen; clock set back two days; reset refused), and a seeded
60-day stress test with random backward steps up to an hour and six reopenings: 83 practices saved,
0 refused, every reopen validated. 988 tests in total.

### Unplaceable practice is set aside — Complete (2026-10-15)

Follow-up found while fixing clock skew: a finished practice that could never join history (overlapping
a practice pulled from another phone, or impossible to place in time) failed on every save retry, and
at the next launch startup recovery failed too, so the app could not open. Now one domain check
(`appendability`: duplicate / overlap / rewind / ok) drives both `recordSession` and the save path;
unplaceable practice is stored whole in the existing synced set-aside record (reason `overlap`, no
schema change), the timer is cleared, nothing is earned, and Home shows one calm line. A practice begun
before a confirmed reset is still refused (deletion wins). Tests: placement outcomes; two phones through
real Supabase SQL (overlap set aside, survives restart, syncs to the other phone); startup recovery of an
unplaceable finished timer; backdated save kept aside atomically. 992 tests.

### Typography and layout polish — Complete (2026-10-15)

Owner request: "keep improving the app, font sizes, positioning of letters, make it smooth and
beautiful". Compared five OFL serifs on the real screens (Newsreader, EB Garamond, Cormorant,
Libre Caslon, the platform serif); bundled Newsreader Regular (screen-tuned, lining and tabular
figures, balanced metrics) so the serif is identical on iOS, Android and web. Titles and headings are
serif; small sentence text raised to at least 12 pt; back arrow header; Home level/consistency columns
aligned; calendar month row with chevrons and Today; one practice row for History and calendar (fixes
the pause line that sat under the next divider); − / + volume control; Journey view crossfade.
No rules, migrations or stored data changed. Verified: web screenshots at 390 and 320 wide, npm run
check (534 domain + 458 data tests), export for all platforms (fonts present in both native bundles).
Not verified on a phone: Android line-box rendering of Newsreader and native fade timing.

### Owner review of the typography pass — Complete (2026-10-15)

Owner feedback: wordmark sat on the sun's rim; "Consistency" too far from its bar; Settings repeated
the ambience choice already on Prepare; the monkey felt intrusive. Done: "Ona" moved inside the sun
(smaller, centred stack) on Home and the meditation screen; Home's columns rebuilt as title → bar →
captions so each title sits on its bar; stage symbol smaller on Home (30 pt, softened) and Journey
(96 pt); Settings reduced to bells, Home ambience volume, haptics, Account, About and Reset, saving
only its own fields (no overwrite of a Prepare choice). Verified on web at 320, 390 and 430 wide; npm
run check; export for all platforms.

### Streak celebration, cleanup and app size — Complete (2026-10-15)

Owner requests: remove Gentle haptics and the sound credits from Settings; after a practice show the
calendar with satisfying animations and congratulations ("2 days in a row", "a very consistent week");
clean up the app and reduce its size; then build the Android app.

- Settings: haptics removed entirely (expo-haptics uninstalled; the stored hapticsEnabled field is kept
  for compatibility and ignored); "About Ona sound" and the /credits route removed.
- Celebration: `streakMoment` (domain, tested) + streak-celebration.tsx, shown after "Well done" when the
  practice added a new active day (docs/ONA_UI.md). Verified in web renders over three practice days.
- Size: forest/coastal scenes to WebP q95 (25 MB → 2.8 MB), Choir WAV → AAC 192 kbps (22 MB → 1.8 MB),
  Android ARM-only ABIs with compressed native libraries, Expo template icon (and its iOS icon bundle)
  replaced by Ona's own icon set. Version 1.1.0 / versionCode 2.
- APK: this workspace cannot reach Expo's build service (policy-blocked), so the build runs from the
  owner's PC through Codex with the existing EAS signing key (docs/ANDROID_BUILD.md).
- Open option: interval timelines are now the largest audio (19 MB); three instead of six hours would
  halve them.

### Over-the-air updates — Complete in code, needs one APK (2026-10-15)

Owner chose "updates without a new APK". expo-updates with EAS Update (channel `preview`, runtime =
app version 1.2.0, versionCode 3): launch never waits for the network; updates apply on the next
launch; Settings shows the version and the running update's date. native-runtime.json plus a config
test stop native changes from silently shipping as updates. The 1.2.0 APK must be built and installed
once (through Codex); after that, updates are published with `eas update` (docs/UPDATES.md).

## Android preview 1.2.0 (3) — 2026-10-15

Merged the owner's ota-updates branch, checked version/runtime/channel settings, and pushed main.
Node 24.21.0, clean npm ci, TypeScript/lint, 996 tests and all-platform export passed. Corrected the
SDK 57 publishing command to select the preview EAS environment and configured only the two public
Supabase values there. The superseded 1.1.0 build finished; no replacement 1.1.0 build was started.

EAS build 9965c099-b649-43b8-8946-0cac1449d6bc produced a 94.44 MB APK. Signature matches the approved
certificate; package/version, ARM-only compressed libraries, ARM64 16 KB alignment, bundled runtime
assets and embedded OTA runtime/channel configuration passed. Details and hashes: ANDROID_BUILD.md.
The APK/report stay gitignored. Device installation and OTA arrival remain unverified; publish the
requested verification update only after the owner confirms installing 1.2.0 over the existing app.

### Welcome back and the past year — Complete (2026-10-15)

Owner picked "welcome back" and the calendar idea. `streakMoment` now has `return` (three or more days
away, tested) and `first`; the celebration welcomes returns without loss language. Journey's calendar
gains "The past year" field (53 weeks of dots, week bands, tap to open a week). JavaScript only: not in the
1.2.0 APK (built from e5b9756); ships to it as an over-the-air update. Verified with seven weeks of seeded practice on web at
390/320 wide.

### Painted calendar — Complete (2026-10-15)

Owner asked to rework the calendar's art in Ona's colours (reference image), keep two styles (days in a
row joined in dark, consecutive consistent weeks joined in a lighter tone), adopt the large serif month,
uppercase weekdays, week hairlines and a closing painting (the owner's own ink painting), and remove the
past-year dots. painted-month.tsx now draws both the Journey calendar and the celebration. JavaScript and
assets only: ships to the installed 1.2.0 as an over-the-air update. Verified on web at 390 and 320 wide.

### Calendar marks matched to the owner's reference — Complete (2026-10-15)

Second pass on the owner's request to make the days look exactly like the reference: single counted days
are ink drops, consecutive days one pale wash with rounded necks; composed side by side with the reference
until shapes, sizes and tones matched (necks from bridges plus a re-sharpened blur). The owner's painting
now sits directly under the month; extra information removed (weeks-active line, legend, trails, week
washes). Verified on web at 390 and 320 wide, with seeded data in the reference's pattern.

### Interval bell: the owner's gong — Complete (2026-10-15)

The owner supplied a gong ("gong-4") for the interval bell. Kept unchanged under
scripts/audio-sources/bells with provenance (licence unconfirmed until the owner records its origin);
mastered lightly with the new `--roles interval` option so start/end stay byte-identical, at the
former interval loudness (−35.5 LUFS). The three six-hour timelines were rebuilt and verified
(first/second/final strikes, correlation > 0.9999); the cleanup ceiling is now 9,416 ms. Assets only:
ships to 1.2.0 over the air. Native locked-screen listening remains a device check.

### Published painted calendar and interval bell — 2026-10-15

Published Android OTA group `b3642b6d-0149-4489-af59-17f244359a2a` from clean commit `703c8f4`
to runtime `1.2.0` on channel `preview`, after npm ci, TypeScript/lint, 997 tests and all-platform
export passed. Owner confirmed APK installation over the old app; OTA arrival/listening remains
a device check. Details and dashboard link: UPDATES.md. No APK was built.

### iPhone without a paid Apple account — Prepared (2026-10-15)

Owner chose the free route: an unsigned build from GitHub Actions (ios-unsigned.yml), signed with
a free Apple ID through AltStore, renewed every 7 days, updated over the air like the APK. app.json
gains the iOS identity and the preview channel header; tests guard both. Not yet run: the macOS build,
install and on-device checks (docs/IOS_SIDELOAD.md).

### Unsigned iPhone build — Verified (2026-10-16)

GitHub run `38858542679` succeeded first attempt from `f82e964`; downloaded the unsigned 1.2.0 (1)
IPA outside the repository (50.14 MB), matching the runner's SHA-256. Archive identity/ARM64,
bundled Hermes, background audio and preview runtime 1.2.0 passed. Local checks: TypeScript/lint,
998 tests and all-platform export passed. No build fixes, Apple credentials or generated native
files were committed. Free-ID signing/installation and device behavior remain unverified.
Run link, checksum and details: IOS_SIDELOAD.md.

### Onboarding reworked as a guide to meditating — Complete (2026-10-16)

Owner asked to rework onboarding completely, with a brief guide to meditation and counting breaths.
Owner's choices: shown on first launch then from Guide; an interactive guided breath; very little
about rules. Five pages (welcome, sit, count your breaths, try it with a 4 s / 6 s breathing guide
counting out-breaths 1–10, come back), ending with Meditate now → Prepare. The first-launch gate
reuses the stored explanation dismissal (no migration). Guide's How to Meditate and the
wandering-mind answer now teach counting. Verified on web at 390/320 from a fresh profile (opens
once, not again after reload). JavaScript only: ships over the air.

### Calendar: days practised twice, legend; first-launch guide only for new users (2026-10-16)

Owner asked for double-session days to look different (dark blue suggested) with a legend: indigo ink
drop / indigo drop within a run, two-line legend under the month, a Guide sentence. The first-launch
guide now opens only for a user with no saved practice (it had appeared right after acknowledging a
completion for existing users without the stored dismissal). Owner reported an Android crash on the
completion screen as Consistency was about to grow; not reproducible on web (no errors, consistency
grows by one small step). Hardened the reward glows' colour strings against exponent notation; the
device crash log is still needed to confirm the cause.

### Published breath-counting guide, indigo calendar and reward glow fix — 2026-10-16

Published Android/iOS OTA group `328a10bc-2757-4dca-abd3-6a2668e8d199` from clean commit
`3e6cce1` to runtime `1.2.0` on channel `preview`, using EAS environment `preview`.
Node 24.21.0, npm ci, TypeScript/lint, 1,003 tests and all-platform export passed; EAS confirmed
both platforms and the channel mapping. Update arrival and Android crash resolution remain
device checks. Details: UPDATES.md. No APK was built.

### Owner feedback batch: interval bell, interval lengths, account email, Journey paper (2026-10-16)

- Interval bell re-rendered about 6 dB louder (opening RMS .045, −29.4 LUFS) with `--roles interval`.
- Intervals: Off or every 1–10, 12, 15, 20, 25, 30, 40, 45 or 60 minutes, stepped with − / + in
  Settings. One looped FLAC per length replaces the six-hour AAC timelines (19.33 → 3.57 MB); intervals
  no longer stop after six hours. Stored 300/600/900 keep working. A phone on an older update would
  reject a new length arriving through account sync, so both phones should take this update.
- Settings shows the signed-in Google email on the Account row.
- Journey (calendar and levels) uses Home's paper colour and texture; the stones painting is now ink on
  transparency (scripts/calendar/paper-to-alpha.py), flowing into the month summary without a rule.
- Owner received all forest artwork as the original lossless PNGs.
Verified with npm run check, all-platform export and web captures; native looping, loudness and the
locked-screen interval still need listening on the phone.

### Less clutter, three-minute rule, Home ⇅ Journey (2026-10-17)

Owner: remove short-practice dots; painting cropped at the sides; scroll from Home into Journey with a
smooth animation; practices under three minutes should not count at all. Rules V6 (earning minimum
180 s, prospective, tested with a mixed V5/V6 ledger); completion for an uncounted practice shows one
quiet note; copy updated in Guide and its answers. Pull-up/pull-down page turns between Home and
Journey; Journey's route slides from the bottom. Verified on web (short completion, pull up to Journey,
pull down to Home); native gesture feel and frame pacing still need the phone.

### Calendar after every counted practice; no day line (2026-10-17)

Owner: remove the date line under the calendar and bring the painting closer; show the calendar after
completing a session, so a day or a twice-a-day day is visible right away. streakMoment returns 'again'
for a further counted practice on a day that already counted (tested); the celebration says so, or
"A day practised twice." when the six-hour rule is met. Day taps open the practice directly.

### Home pull hint (2026-10-17)

Owner chose suggestion 4: a quiet chevron hint for the Home → Journey pull, retiring after three uses.
Verified on web (visible, three pulls up/down, gone after reload of state).

### Completion Ripples overlap; Consistency rounds (2026-10-17)

Owner: Ripples texts overlapped after a session (two crossfading texts stacked; on Android both could
show) and the small bars under Consistency were misunderstood. Now one number at a time with a single
caption, and the big bar fills once per milestone while the small bars count completed rounds.

### Level-up and Consistency-round moments; one-line Journey top (2026-10-17)

Owner chose: make filling a small Consistency bar and every level up feel special; reduce Journey's top
clutter as much as possible. Verified on web with frame captures of a completed round and a level step.

### Maintenance pass (2026-10-17)

Owner asked for clean-up to keep the app light and easy to build on. Removed dead code left by the
recent reworks (calendar selection ring and `practiced` prop, stacked Ripples crossfade values, a stale
re-export), un-exported calendar internals, and rewrote ONA_UI.md's calendar/completion sections as one
current description (the dated paragraphs described designs that no longer exist). AUDIO.md and
AGENTS.md updated (interval loops, rules V1–V6). Checked with knip, strict unused-locals and lint:
no unused source files or dependencies remain (pglite is a test dependency; expo-linking/system-ui are
Expo Router peers; expo-symbols' 1 MB icon font comes in through expo-router). No native or runtime
change. Bundle: 26.5 MB audio (9 MB Brown Noise FLAC is the largest), 4.4 MB images, 7.5 MB JS.

### Second clean-up round (2026-10-17)

Owner: interval bell moves from Settings to Prepare; remove the intention; delete Brown Noise; report
sound sizes; fix the forest title ("forest" not visible on the phone). Done: IntervalStepper on Prepare
(saved with the sound on Begin, Settings no longer owns it); intention UI gone (data field kept for
compatibility, cleared on Begin); Brown Noise removed (9 MB; a saved or synced choice opens as Ocean,
tested); the forest title is one line that scales down instead of wrapping. Remaining sounds: Ocean,
Rain, Storm 2.9 MB each, Choir 1.84 MB, bells 2.5 MB, interval loops 3.57 MB, ending timeline 0.86 MB.
Shortening the 3-minute ambience loops was judged not easy (evolving textures, AAC loop seams, analysis
and tests) and not done. The title fix is not verifiable on web, where the title already rendered.

### Published update and verified phone builds — 2026-10-17

From clean main `f192e21`, Node 24.21.0, npm ci, TypeScript/lint, 1,010 tests and all-platform
export passed. Published Android/iOS OTA group `afbf351e-78b9-40bc-a90a-9c8937666efa` on preview,
runtime `1.2.0`; EAS confirmed the channel mapping (UPDATES.md).

Android build `a8ce54e7-91d5-4c0d-82f2-35ac8a83694a` succeeded with the existing key: 1.2.0 (4),
68.45 MB, approved signing digest, ARM-only compressed libraries, ARM64 16 KB alignment and preview
update configuration verified. The verifier follows the new interval-loop manifest and checks all
26 runtime audio files; eight fixtures passed (ANDROID_BUILD.md).

GitHub run `39029728384` succeeded first attempt; its unsigned 1.2.0 (1) IPA (36.49 MB) was downloaded
outside the repo and passed checksum, ARM64/Hermes, background-audio and preview runtime checks
(IOS_SIDELOAD.md). Owner confirmed AltStore installed/signed in, and AltServer is running. iCloud
Drive transfer is blocked by iCloud sign-in; Ona installation and native behavior remain owner checks.
No APK, IPA, generated native folder or credentials were committed.

### iPhone installation confirmed — 2026-10-17

Owner downloaded the IPA over local Wi-Fi after iCloud sign-in failed. The iPhone AltStore import
returned Apple authentication HTTP 503 / -90010, including after disabling Prefer Remote AltServer;
Refresh All worked. Direct Windows AltServer → Sideload .ipa installed the same verified archive.
Owner confirmed Ona opens and works after the Home/version check. Documented the separate OTA
update and weekly free-ID signature-renewal paths in IOS_SIDELOAD.md; Ona's AltStore-managed
renewal and a later OTA arriving remain focused device checks.

### Journey opens on the calendar; Friends — 2026-10-17

Journey: no title, Progress details or weeks-in-a-row line above the calendar any more. It opens on the
month and the owner's painting together; the painting fills the rest of the first screen (70–100% of
its size, measured once per visit). Below it: weeks in a row with this week's pebbles, the month's
practice days and time, the legend, then Progress details and Meditation history as quiet rows.

Friends (FRIENDS.md): Home's top-right icon (replacing the forest's sprout; the Forest is still a left
swipe away) opens /friends. Add a friend by email; once both have added each other, each sees the
other's name, stage symbol (only stages the viewer has reached), level and weeks in a row. Adding never
reveals whether an address uses Ona. Weeks in a row lapse for friends exactly when the sharer's own
calendar would, from a shared "holds until" date instead of practice dates. Supabase migration
20261017120000_ona_friends.sql (RLS, functions only, safe to re-run), tested on PGlite; the client is
tested against it through a PostgREST-shaped fetch. Owner steps: run the SQL, add friends as Google test
users (or publish the Google app), then the OTA update. Not verified on a device or against the live
Supabase project; web screenshots used mocked responses.
