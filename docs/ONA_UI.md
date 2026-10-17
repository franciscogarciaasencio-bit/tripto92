# Ona UI

## Current identity and sources

Preserve the approved Design 3 proportions and later user-supplied coastal/forest artwork:
warm sand, restrained ink, generous space, minimal native controls and a single living wave.
src/ui/theme.json defines background #F2E9DA and ink #141414; primitives.tsx supplies
supporting tokens/components. Manrope Regular/Medium carries text, labels and controls;
Newsreader Regular (bundled, SIL OFL, assets/fonts) is the editorial serif on every platform:
wordmark, screen titles and section headings (`title` 34/42, `heading` 24/32), level names,
the timer and streak numbers. Bundling it replaced the platform serifs (Times New Roman on iOS,
Noto Serif on Android), so iOS, Android and web now share letterforms and vertical metrics.
Do not introduce Expo starter styling, generic cards/gradients or new decorative motifs.

assets/ona/design3/coastal-background.png is the byte-for-byte supplied Forest 2/1.png
(853 × 1844) and assets/ona/forest/stage-0.png, stage-2.png–stage-5.png are the original
supplied growth artwork. Highest achievement selects the forest in growth.ts (starting
coast plus five richer stages), independently of current-level decay. Halo anchors align
the sources, with uniform scale and gentle image crossfades; no PNG edits/tinting.
Halo and shoreline remain stationary; wave-trace.json derives from the retained wave-overlay.png.
The older background.png is an intentional design source, not runtime artwork. Source
details live in that directory's README. Category SVGs and matching categories.json
remain editable/parity-tested sources; category-icon.tsx renders them natively.
The phone frame/status bar in references is not app artwork or a screenshot interface.

## Routes and flow

All navigation uses Expo Router. _layout.tsx mounts fonts, safe areas, OnaProvider, FriendsProvider,
AudioProvider, shared OceanMotionProvider and ForestNavigationProvider above a headerless stack.

| Route | Screen |
| --- | --- |
| / | Home: sun/halo Meditate action, wave, current level/Ripples, Consistency bar |
| /forest | Highest-achievement forest; native left swipe from Home, right swipe/back to Home |
| /prepare | Before a practice: sound, open-ended (default) or fixed length, interval bell; Begin |
| /session | Active timer (counts up when open, down when fixed), pause/resume/finish/discard, sound controls |
| /completion | Saved duration, earned Ripples, staged reward progress, Continue |
| /practice | Journey calendar with saved dates/detail and level overview |
| /info | Guide: Why Ona?, How to Meditate (counting breaths) and the rules in detail |
| /preferences | Settings, sounds, Account entry (when configured) and confirmed Reset All Practice Data |
| /account | Optional Google account: sign in/out, sync status, guest copy, remove/delete |
| /friends | Friends (docs/FRIENDS.md): add by email, requests, friends' stage, level and weeks in a row |
| /history | Paginated saved meditation history |
| /practice-detail?id=… | Read-only saved duration, pauses, historical local time and Ripples |
| /how-progress-works | Secondary explanation of practice/progression |
| /introduction | Five-page guide to meditating (counting breaths, breathing guide); first launch and Guide |

Home/Journey/Guide/Settings form the quiet bottom navigation; route filenames above
are historical URLs, not unused legacy screens. Main flow: Home → Prepare → Session →
Completion → Home. Meditate opens /prepare (owner decision, 2026-10-14), which remembers
the last sound, length and interval bell, so a returning person only taps Begin. Sound and length
use an underlined radio pattern; the interval bell (Off or 1–60 minutes) a − / + stepper
(interval-stepper.tsx), moved here from Settings on 2026-10-17. Open-ended stays the recommended
default. The optional intention was removed the same day (owner: unnecessary clutter); a stored one
is cleared on the next Begin and the session line is always the quiet default. A fixed length counts down and ends with the
End bell; finishing earlier still completes the practice.
Home's top-right control opens Friends (owner, 2026-10-17; it replaced the forest's sprout). A small
ink dot marks it while someone who added you waits for an answer. The Forest is a left swipe away.
forest-pages.tsx composes the same Home/Forest surfaces as active and incoming pages.
forest-swipe.tsx tracks horizontal drags on the UI thread, then settles or cancels with
restrained easing. Router commits once after settling; the Forest stack transition is
disabled to avoid a second slide. Buttons and Android Back share that transition, and
return always dismisses to Home (including direct Forest links). Reduced Motion switches
without spatial travel. Vertical Home scrolling remains native, with an explicit simultaneous
recognizer; short/reversed, multi-touch and interrupted gestures cannot commit a stale route.
Resize, focus loss, backgrounding and motion-preference changes cancel pending callbacks.
Incoming surfaces are inert and excluded from accessibility. Home's scroll offset is a
presentation-only provider ref, so returning preserves position; it never stores practice data.
Offscreen waves stop rendering and rejoin the shared phase when needed. Images do not fade
again on their first load during the route handoff; subsequent growth can still crossfade,
while a reset immediately shows the starting artwork. Native gesture arbitration and frame
pacing still require physical iPhone/Android verification.
Forest uses six dedicated stream-garden views derived from the supplied entry reference,
from two saplings to the mature framing canopy. Original coast PNGs still serve Home.
assets/ona/forest/entry-generation.json records editing prompts/source provenance;
forest-entry-artwork.json separates entry geometry from the Home halo landmarks.
Every scene is uniformly scaled; headers/back/dots are native controls, with no baked UI.
Opening shows the Ona wordmark/tagline, supports tap-to-skip, and keeps meaningful
reading time with Reduced Motion/VoiceOver. The introduction (reworked 2026-10-16 at the owner's
request) is a short guide to meditating in five pages: welcome; how to sit; counting breaths (one to
ten on each out-breath, back to one when the count is lost); a minute to try it with a breathing guide
(breath-guide.tsx: a disc that swells for four seconds and settles for six, counting each out-breath,
Begin/Stop, still with Reduced Motion; a teaching aid, not a session, never saved); and coming back
(three minutes count, three days make a consistent week, the calendar, levels and forest). It opens
once on first launch over Home, never over a practice in progress, and marks the stored
explanation dismissal (synced one-way) as soon as it opens; Guide's "A short guide to meditating"
replays it. Back moves to the previous page (or Home at the first); Skip returns Home; Meditate now
opens Prepare without starting a timer.
Transitions are cancellation-guarded, respect live Reduced Motion and announce/focus
chapter headings for screen readers. Body content scrolls on short phones/large type;
the decorative welcome wordmark/tagline limit scaling to preserve the halo composition.
The last page (2026-10-17), "How does your mind usually feel?" (renamed from "Remember how today feels" the same day: the owner meant the usual state of mind, not that day), invites an optional few words about how
the mind usually feels — scattered, anxious, restless, tense — (or a mental note), kept on the phone only (beginning-reflection.ts, platform key
store, never synced) and shown again at Level 100 so the two states of mind can be compared; it says Ona believes you will feel the difference,
without promising it.
Short phones use a compact wave-only chapter header so the essential journey text
fits above the final action; the full coastal welcome remains available on all sizes.

## Presentation and motion

home-screen.tsx owns responsive Home composition and safe-area footer; coastal-scene.tsx
shares artwork with meditation/completion. Keep wave, artwork and text in separate bands.
OceanMotionProvider owns one UI-thread phase, shared across these routes. ocean-geometry.ts
defines the **12-second** periodic curve deformation and 45.76/37.18 source-unit amplitudes
(10% more than the preceding swell);
ocean-wave.tsx applies native Reanimated animated SVG props. Background/other routes
cancel work; navigation among Home/session/completion/introduction and timer pause do
not restart the swell. The phase also remains alive through Forest so returning is continuous.
Onboarding reuses the same native component, not another clock.

The user explicitly requested ambient wave motion with Reduce Motion enabled too:
use live accessibility state to halve wave amplitude and ReduceMotion.Never for its
phase. Other transitions/reward animations honor Reduced Motion and settle immediately.
Never treat the wave as a breathing instruction or derive its phase from the timer/audio.

Current interaction refinements use shared timing in motion.ts and opacity-only
QuietPressable feedback, without scaling controls or changing hit targets. One live
MotionPreferenceProvider serves the app. Waves stay mounted through outgoing route
fades; the shared provider still stops their clock on background/other routes.
SessionTime alone updates at active-second boundaries and stops ticking while hidden,
paused, unfocused or backgrounded; artwork and session controls do not tick with it.
The launch introduction reveals restored content after its minimum hold, while Skip
remains immediate. Home's starting label reflects an actual Begin, not a preference save.
Content expansion uses restrained native layout/fade transitions. Completion entrance
finishes before the reward sequence begins; a presentation-only departure snapshot
retains the saved summary during Continue, without becoming an alternative save source.
Sound previews fade briefly on Stop; background/disposal still releases immediately.

CompletionContent consumes saved HabitRewardReceipt endpoints. reward-sequence.ts and
use-premium-reward.ts implement base progress → Consistency → bonus progress. The content
is keyed by session ID and captures its immutable receipt/endpoints once; prop copies cannot
restart a running sequence. Reanimated completions advance stages. A crossing fades the
label/track/fill together, commits the next React label while hidden, then reveals and fills.
Large receipts keep all crossings with a restrained per-stage time budget. Base earnings
crossfade to the saved total as the bonus arrives; zero rounded bonuses do not create a +0 line.
The five dots use the same real Consistency endpoints. Continue stays available during playback;
an immediate departure guard and Android Back share the durable acknowledgement path.
Cosmetic animation cannot save or issue rewards. Cancellation, duplicate/delayed callbacks,
navigation/backgrounding, live Reduced Motion and incompatible decayed/versioned endpoints
settle to the actual final state. Accessibility exposes saved final progress independently
of intermediate frames. No separate reward sound: ending-bell preference owns closure and
its existing tail spans the visual sequence.

Ripples display as whole numbers; format-ripples.ts is the single formatter. Home
Consistency is a label, continuous bar and five milestone dots, without bonus percentages,
multipliers/day counters. V5 indicatorFraction is the actual bonus momentum score;
ConsistencyBar animates its fill and dots on the UI thread without screen rerenders.
Completion uses immutable habit endpoints for base → Consistency → bonus; old fourteen-day
receipt endpoints remain historical. Category presentation resolves stable IDs into 25
current names and original vectors; Level 0's Monkey Mind symbol is separate from Early Steps.
Journey
uses actual saved historical local dates; Guide describes a habit-building metaphor,
never a scientific claim. Settings reset preserves unrelated preferences.

Journey's monthly summary includes all saved practice (including short sessions),
with captured practice days and active time only; it is not another Consistency score.
Today returns to the current calendar date without changing historical assignments; it sits in the
month row beside thin chevrons and fades in only when another month or day is shown.
history-screen.tsx uses a virtualized SectionList, groups by captured day, preserves
repository order within each day and supports native pull-to-refresh. While more pages
remain, day summaries say “shown”; loading/reset/navigation guards ignore stale reads.
Guide's optional practical answers cover thoughts, short practice, returning, hiding
the existing timer and Silence settings. Expansion follows Reduced Motion preferences.
Tap a saved entry in History or the selected calendar day to open practice details.
This reads the original receipt without replaying completion or changing any reward.
History's day headers remain visible while scrolling. Details ignore late reads after
leaving/reset; captured local-time labels never fall back to the current device zone.
Returning from details retains loaded history pages and scroll position; new completion
or reset invalidates them, and pull-to-refresh explicitly reloads the first page.
Settings keeps its save action (centred, above navigation) while the sound controls scroll.
Unsaved sound changes are marked; Save changes uses the existing explicit save flow.

coastal-composition.ts owns the new asset's source landmarks and uniform aspect ratio.
Home, meditation and completion share CoastalScene. Small screens/large type scroll
instead of squeezing the taller source into controls; navigation stays in the safe area.
One continuous background crop contains only empty lower texture, never repeated
strips or a duplicate halo/shoreline.
The source PNG is neither tinted, stretched nor recompressed. Guide/intro use the same
asset; completion and intro use deliberate landscape crops. Audio retry is available
through existing sound controls, with no floating Resume sound/Play sound buttons.

### Typography and layout pass (2026-10-15)

Owner request: better font sizes, letter positioning, smooth and beautiful. Screen titles and section
headings are serif (Newsreader); body, labels and controls stay Manrope. Sentence text is at least 12 pt
(letter-spaced capitals at least 11). Secondary screens open with a quiet back arrow (48 pt target,
the forest's arrow) instead of the word Back, then the title. Calendar: month title left in serif with
chevrons and Today on the same row (one row less before the grid); streak numbers share a baseline.
History and the calendar day share one practice row: duration, then start time (with the zone only when
it differs from this phone's) and any pause, inside one divider. Volume is a − / + step control (5 %)
with a thin animated level line and the percentage. Switching Journey between calendar and levels
crossfades the content while title and tabs stay still. Reduced Motion turns the new fades off.

Follow-up (owner review, same day): the wordmark no longer rests on the sun's rim. On Home "Ona"
(34 pt), MEDITATE and the arrow are one stack centred in the sun, slightly above centre where the
horizon leaves the disc most open; the meditation screen puts a 30 pt "Ona" at the top of its own
stack (MEDITATING, time, dot, line) inside the sun. Home's two columns now match: serif title row
("Level n" with a small 30 pt stage symbol, "Consistency"), the bar directly beneath each title, then
captions (stage name, "n of 5"). The stage symbol is smaller on Journey too (96 pt in the ring).
Settings holds only what lives nowhere else: Bells (bell volume only; since 2026-10-17 the bells cannot
be switched off and there are no previews: the owner saw no reason to just listen to them), Home ambience
volume, Account and Reset (the interval is chosen on Prepare). Sounds are Choir and Silence only. Gentle
haptics and the in-app sound credits were removed at the owner's request (2026-10-15): nothing vibrates,
and sound provenance lives in docs/AUDIO.md and the asset READMEs. Ambience choice is made on Prepare and its volume from the speaker during
a practice; Home's speaker mutes Home. Saving writes only those fields onto the current preferences.

### Journey and the calendar (current, 2026-10-17)

Journey is one of Ona's main pages. It sits on Home's paper (PaperBackdrop: #F4EBDD and the coastal
texture). Pull up past the end of Home to rise into it (the route slides in from below, also from the
tab); pull down at its top to settle back (vertical-page.tsx, vertical-page-geometry.ts). A faint
chevron above Home's tabs hints at the pull and fades for good after three uses (journey-hint.ts: a
device-only counter in the platform key store, never synced). Reduced Motion: no page movement or slide.

Journey opens on the calendar and the painting together (owner, 2026-10-17: no title or numbers above
them). Top to bottom: the month in large serif with "‹ year ›" and Today on a fixed line; the painted
month; the owner's ink painting of stones in still water, sized to fill what is left of the first screen
(never below 70%; measured once on the month Journey opens with, so changing months never resizes it;
loading and error lines float over its sky). Below it, one quiet list separated by the calendar's
hairlines: active weeks in a row with this week's three pebbles (calendar-streaks.tsx); practice days and
time for the month; the three-entry legend; then Progress details and Meditation history as rows with
a thin chevron. Tapping a day with practice opens it (several: the history).

The painted month (painted-month.tsx; owner reference docs/evidence/calendar-reference.png) is shared
with the after-session celebration. A single counted day is a round drop of near-black ink with a light
number; consecutive counted days are one pale warm-grey wash whose drops flow together through soft
necks, with dark numbers; a day practised twice (two counted practices six hours apart, the double-credit
rule; double-days.ts) is indigo: an indigo drop, or an indigo bead within its run. Practices under three
minutes leave no mark. Weeks are separated by hairlines; the week in progress has a rounded outline.
Proportions were measured on the reference (drops 0.73 of a column, wash 0.76, necks 0.48, numbers 0.34;
rows 1.22 × the column). Sprites (assets/ona/calendar: ink-1…3, wash-2…7, indigo-1…3, indigo-bead) are
painted by scripts/calendar/build-calendar-art.cjs (ONLY=indigo repaints only the indigo marks) and cut
to whole columns, never stretched. Marks draw in left to right, row by row, light numbers waiting for
their ink. The painting (vignette.webp) is ink on transparency (scripts/calendar/paper-to-alpha.py), 1.12
× the screen width in an edge-to-edge scroll view, so its faded sides fall past the screen.

### Friends (current, 2026-10-17)

friends-screen.tsx on Journey's paper: back arrow, the serif title and a quiet "+ Add a friend" that
opens an underlined email field at the top (open by default while the list is empty, so the keyboard
never covers it). A request ("ADDED YOU", name and email, Add back / Not now) rests on a soft sand
card above the friends. Each friend is one row: their stage in a sand disc, first name in serif (the
full name when two share it), and "Level N · N weeks in a row" (just "Level N" at zero). A stage you
have not reached yourself is an empty dotted ring, so stages ahead stay undiscovered. Tapping a row
offers "Remove". Invitations not yet answered close the list ("Waiting for …", Withdraw), then a
footnote: friends see only your level and weeks in a row, and the address they can add you with.
Signed out, the screen explains and offers Continue with Google. Pull to refresh; it also reloads on focus.

### After a session (current, 2026-10-17)

"Well done", the time, then one Ripples number at a time: the practice's, then the total with "60 for
your practice · +4 for Consistency". Each level step up swells the new "Level N" in a warm glow and one
ring spreads from it. The Consistency bar fills in rounds (consistency-rounds.ts): the big bar fills once
per milestone (a fifth of the eased bar, rules V7); a completed round is a new **Consistency level**
(owner, 2026-10-17): the full bar holds while a band of light sweeps across it and a glow in the round's
colour breathes around it, the new small segment pops in its colour, then the bar empties gently and
refills in the next colour (ROUND_MOTION in use-premium-reward.ts). No words name the level: the bar
says it (owner, later the same day). Each round has its own colour (ROUND_COLORS: olive
#76845A, sea #4C7471, dusk #3E4C76, clay #A0593B, ochre #A47A2E); the small segments keep the colour of
the round they mark. Decay empties rounds in reverse.

Tapping Consistency on Home opens /consistency (consistency-screen.tsx): the bar at 1.6×, why coming
back is the hard part and what Ona rewards, how the bar grows and time away, all without numbers.
Practice details (history) show the Ripples "For the practice" and "From Consistency" when the receipt
has a bonus.

**Writing rule (owner, 2026-10-17):** in-app text explains the habit, not the maths. Say that
Consistency rewards coming back generously, never a multiplier, a rate, a percentage or how long
anything takes; Level 100 means the habit is established. The rules people act on stay: three active
minutes count, a second practice six hours later counts again.

**Stages** (owner, 2026-10-17, "round numbers"): Level 0 begins the first stage and a new stage begins at
every multiple of five (habitStageIndex in journey.ts); the last stage holds 120–125, so "Habit
Established" is Levels 95–99 and Level 100 begins the next stage with the habit moment.

**Milestones** (milestones.ts, milestone-moment.tsx): entering a new stage (Levels 5, 10, … 120), Level
100 and Level 125 open a moment after "Well done" and before the calendar moment, the first time only
(`milestoneOf`; the habit outranks a stage crossed at once). A new stage: the stage left behind shows
with its name, then settles and fades as three rings spread like a drop on still water; the new stage
blooms in its halo with a soft overshoot while a thin ring draws around it and specks of light rise;
then "LEVEL N · A NEW STAGE", the name settling into place, its theme, and a guide for this part of the
way (a title and a few paragraphs) on a sand card; Continue last. At Level 100 a second card, "WHEN YOU
BEGAN", shows the words written in the introduction (or asks to remember the mental note) and "How does
it feel now?". One linear 6.2 s timeline drives everything (transform/opacity
only); a tap settles it at once; Reduced Motion shows the final moment. Levels 100 and 125 hold the
current stage in a golden ring. The completion screen keeps a new stage veiled ("A new stage"), so its
name and painting are first seen in the moment. Notes: one per stage, written from common
descriptions of how a practice grows (docs/MILESTONES.md), without numbers or promises. A practice under
three minutes shows one quiet note instead ("Saved in your history").

Continue then opens the calendar moment (streak-celebration.tsx) after every counted practice:
`streakMoment` (domain/progression/streaks.ts, tested) picks the words, weeks before days: a full month,
a newly consistent week, welcome back after three or more days away, days in a row, the first day, or
"Today counts."; a further counted practice the same day is "Another quiet moment.", or "A day practised
twice." when it meets the six-hour rule. The newest day's mark settles in (or its run grows from the
days it joins, or it turns indigo) and two ripples spread from it; this week's pebbles fill. The
acknowledgement happens only on the final Continue. Reduced Motion shows end states.

### App size and icon (2026-10-15)

Owner request: clean up and shrink the app before the next APK. Runtime scenes (coastal background,
forest stages, forest entry scenes) are quality-95 WebP (about 25 MB → 2.8 MB, same dimensions); the
Choir is 192 kbps AAC (22 MB → 1.8 MB); haptics (expo-haptics) and the credits route are gone; Android
builds only ARM ABIs (armeabi-v7a, arm64-v8a; x86 is emulator-only) with compressed native libraries
(expo-build-properties). The Expo template icon was replaced by Ona's own: a smooth warm sun resting on
the two-line wave, on sand (scripts/icon/build-icons.cjs renders the iOS/Expo icon, Android adaptive
foreground/background/monochrome and favicon).

### Levels

Levels (owner direction 2026-10-15): Journey is a centred composition, not a list: the current
stage's symbol sits in a soft sand halo inside a thin ring that fills toward the next level only
(never a 0–100 track, which would make progress feel slow); below it LEVEL n, the stage name in
serif, its theme and "Toward Level n+1"; then one serif line of purpose ("Level 100 completes the
habit"), Ripples, and quiet links to How it works and history. Halo, symbol, ring and words draw in
over about a second (instant with Reduced Motion). Future stages are never listed. Stages 2–20
(Levels 6–100) are sealed surprises: the completion screen veils the level row as "A new stage", and
the milestone moment after it reveals the stage's painting and name, the first time that stage is
reached (milestone-moment.tsx).

Stage paintings (owner direction 2026-10-15): stage symbols are small watercolour paintings, not
line icons. Monkey Mind (Level 0 and Levels 1–5) is the owner's own painting, cut out of its paper
by scripts/watercolor/cutout.py; every other stage is painted in code to match it
(scripts/watercolor: SVG washes with wet-in-wet shading, mottling, pooled rims, paper grain, rendered
in Chromium; STYLE.md). 384 px RGBA, shown small (30 pt, 92 % opacity) beside the level on Home, 96 pt in the Journey
medallion and 84 pt in the new-stage reveal. Visible stages are bundled PNGs (stage-art.ts); sealed
stages are XOR-veiled inside the sealed data and unveiled in memory to a data URI (core RN Image);
no sealed painting exists as an image file. The old line symbols remain only as a fallback.

## Timer/data boundary and accessibility

Screens render provider/repository results; pure domain computes rewards, qualification
and levels. Durable timer actions/save/recovery belong to OnaProvider and repositories.
Root navigation gives durable running/paused practice and pending completion priority over
every restored route or incoming link. The opening reveal waits for that route to resolve;
ordinary navigation remains available after acknowledgement/discard. Completion redirects
only while focused. Android Back closes discard/reset confirmations first, pauses a running
practice, and shares the guarded completion acknowledgement. Settings blocks Back while saving.
Bottom navigation exposes explicit selected/disabled ARIA state as well as native state.
UI ticks only display elapsed time; no rendered frame awards or persists progression.
Finish/retry waits for durable completion; Continue acknowledges that existing result.
Audio remains independently owned. Buttons have meaningful labels, selected/disabled
states and practical touch targets; small phones/large text use bounded scrolling.

## Verification limits

Automated checks cover geometry, reward plans/cancellation and repository lifecycle.
Earlier physical iPhone captures in docs/evidence/native-wave prove actual mounted SVG
deformation and an 18-second phase, not current whole-screen performance or every setting.
Browser screenshots are actual React Native web renders, not native-device proof.
After significant UI changes, verify real iPhone/Android safe areas, text scaling,
navigation, background/reopen, frame pacing and accessibility. Audio device limits are
documented separately in [AUDIO.md](AUDIO.md).

### Journey stages to revisit, slower rewards, screen-off line — 2026-10-17

- Journey's level view is a horizontal pager of every stage reached (owner: "if I'm level 20, I still
  want to see [the first stage]"): it opens on the stage you are in, earlier stages wait to the left.
  Each page shows the stage symbol (ring full and "Completed" for past stages, Levels a–b), small dots
  (tap to jump) with "Swipe to revisit earlier stages", and below it the guide that opened that stage
  (milestones.ts `stageGuides`; the first stage has its own "Where everyone begins"; the stage that
  begins at Level 100 shows the habit guide and the beginning reflection; the last adds the journey's
  end once reached). Stages ahead stay undiscovered.
- Completion rewards move at about half the earlier pace (owner: "way too fast… rushed"): REWARD_MOTION
  fills, a short rest between practice, Consistency and bonus, a slower Consistency round celebration
  (ROUND_MOTION) and a slower level-up swell, hold and ring.
- The meditation screen's quiet line under the time reads "You can turn your screen off", in the
  wordmark's serif (16 pt, the quiet ink), instead of "Just be here".
