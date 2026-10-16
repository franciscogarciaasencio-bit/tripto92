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

All navigation uses Expo Router. _layout.tsx mounts fonts, safe areas, OnaProvider,
AudioProvider, shared OceanMotionProvider and ForestNavigationProvider above a headerless stack.

| Route | Screen |
| --- | --- |
| / | Home: sun/halo Meditate action, wave, current level/Ripples, Consistency bar |
| /forest | Highest-achievement forest; native left swipe from Home, right swipe/back to Home |
| /prepare | Before a practice: optional intention, sound, open-ended (default) or fixed length; Begin |
| /session | Active timer (counts up when open, down when fixed), pause/resume/finish/discard, sound controls |
| /completion | Saved duration, earned Ripples, staged reward progress, Continue |
| /practice | Journey calendar with saved dates/detail and level overview |
| /info | Guide: Why Ona?, How to Meditate (counting breaths) and the rules in detail |
| /preferences | Settings, sounds, Account entry (when configured) and confirmed Reset All Practice Data |
| /account | Optional Google account: sign in/out, sync status, guest copy, remove/delete |
| /history | Paginated saved meditation history |
| /practice-detail?id=… | Read-only saved duration, pauses, historical local time and Ripples |
| /how-progress-works | Secondary explanation of practice/progression |
| /introduction | Five-page guide to meditating (counting breaths, breathing guide); first launch and Guide |

Home/Journey/Guide/Settings form the quiet bottom navigation; route filenames above
are historical URLs, not unused legacy screens. Main flow: Home → Prepare → Session →
Completion → Home. Meditate opens /prepare (owner decision, 2026-10-14), which remembers
the last intention, sound and length, so a returning person only taps Begin. Choices use the
same underlined radio pattern as the interval picker; open-ended stays the recommended
default. An intention replaces the session's quiet line ("Just be here") with a short phrase
(ui/intentions.ts); it is not stored in history. A fixed length counts down and ends with the
End bell; finishing earlier still completes the practice.
The secondary sprout control on Home opens the same Forest route without a gesture.
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
Settings holds only what lives nowhere else: Bells (starting/ending on/off with a small play button
each, interval Off/5/10/15 with play, bell volume), Home ambience volume, Account and Reset. Gentle
haptics and the in-app sound credits were removed at the owner's request (2026-10-15): nothing vibrates,
and sound provenance lives in docs/AUDIO.md and the asset READMEs. Ambience choice is made on Prepare and its volume from the speaker during
a practice; Home's speaker mutes Home. Saving writes only those fields onto the current preferences.

### Streak celebration after completion (2026-10-15)

Owner request: after a practice, the calendar appears with satisfying animation and congratulations
that encourage coming back. Continue on "Well done" now opens a second, display-only moment on the
same completion screen (streak-celebration.tsx) whenever the practice added a new active day (at
least three minutes, completed, its day not already counted); otherwise Continue returns Home as
before. The acknowledgement still happens only on the final Continue, so a restart reopens "Well done".
`streakMoment` (domain/progression/streaks.ts, tested) compares the calendar without and with the
practice. Message priority, weeks before days: a full month ("A full month." — every week of the month
consistent), a week that just reached three days ("A very consistent week."), days in a row
("2 days in a row." with the number rolling up from 1; "Come back tomorrow for 3."), otherwise
"Today counts." with how many days remain for a consistent week. The month of the practice is drawn
with its week bands and streak capsules: the practice's day joins yesterday's capsule (or appears as a
disc), its ink disc settles with a slight overshoot, two thin ripples spread from it like water, the
week's band unfolds when that day made the week count, this week's three pebbles fill with a small pop,
and a completed month sends one soft wave down its weeks. Everything settles in about two seconds, never
loops, and Reduced Motion shows the end state. No haptics, rewards or stored data are involved.

Welcome back (owner choice, 2026-10-15): a practice after three or more days without one
(`WELCOME_BACK_DAYS`) is greeted "Welcome back · Good to see you again. · N days away, and you came back.
Every return counts." It ranks below a full month and a newly consistent week, above days in a row; a
short practice does not end the time away. The very first practice says "The habit begins."

### Painted calendar (2026-10-15)

Owner direction, matched to the owner's reference (docs/evidence/calendar-reference.png):
painted-month.tsx draws every month (Journey calendar and the celebration after a practice). A single
counted day is a round drop of near-black ink with a light number; consecutive counted days are one pale
warm-grey wash whose drops flow into each other through soft necks, with dark numbers. Weeks are separated
by hairlines; the week in progress has a rounded hairline outline; a chosen day other than today a thin ring; a
shorter practice a small dot. Proportions measured on the reference: drops 0.73 of a column, wash drops
0.76 with necks 0.48, numbers 0.34, the short-practice dot 0.115 just under its number. Columns are square for the marks and rows 1.22 × taller, as in the reference.
Sprites (assets/ona/calendar/ink-1…3, wash-2…7) are painted by scripts/calendar/build-calendar-art.cjs
(ink filter with feathered edge and faint lighter pools; wash with mottled blooms and a pooled rim; drops
plus bridges re-sharpened into rounded necks) and cut to whole columns, never stretched.

Journey calendar, top to bottom: streak numbers (weeks in a row, full months, this week's pebbles, days in
a row); the month in large serif with "‹ year ›" and Today on a fixed line; the painted month; one quiet
line for the chosen day (tap opens its practice); the owner's ink painting of stones in still water
(vignette.webp: paper matched to #F2E9DA, edges faded), whose misty sky reaches up under that line and
bleeds to the screen edges; then practice days and time for the month, and Meditation history. Removed at
the owner's request: the past-year dots, the "n of 5 weeks active" line, the legend, the recent-week and
month trails, and the week washes. Marks draw in left to right row by row, light numbers waiting for their
ink. In the celebration the newest day's drop settles in (or its run grows from the days it joins while
the marks it replaces fade), and two ripples spread from it.

### App size and icon (2026-10-15)

Owner request: clean up and shrink the app before the next APK. Runtime scenes (coastal background,
forest stages, forest entry scenes) are quality-95 WebP (about 25 MB → 2.8 MB, same dimensions); the
Choir is 192 kbps AAC (22 MB → 1.8 MB); haptics (expo-haptics) and the credits route are gone; Android
builds only ARM ABIs (armeabi-v7a, arm64-v8a; x86 is emulator-only) with compressed native libraries
(expo-build-properties). The Expo template icon was replaced by Ona's own: a smooth warm sun resting on
the two-line wave, on sand (scripts/icon/build-icons.cjs renders the iOS/Expo icon, Android adaptive
foreground/background/monochrome and favicon).

### Journey calendar and level path (2026-10-15)

Calendar hierarchy (owner direction: weeks and months lead, days stay quiet): the header shows
active weeks in a row as the hero serif number, with this week's three pebbles ("2 of 3 days this
week", "This week counts", or "A fresh week begins Monday") and the last eight weeks as small
capsules; full months come second with the last six months as small circles; days in a row is a
single quiet line ("5 days in a row · best 8"). Filled = counted, outlined = in progress, faint = not counted.

Grid: each Monday–Sunday row is a week; an active week rests on a soft solid band, the week in
progress has a hairline outline. Consecutive counting days in a row are one capsule (no seams);
a single counting day is a disc; a dot marks a shorter practice. Neighbouring-month days are faint.
Under the grid, the month's own weeks as capsules plus "All 5 weeks active · this month counts" /
"3 of 5 weeks active so far", then a one-line legend. Solid tones (#E9E0D1 band, #D9D0C1 capsule).
No flames, warnings or "streak lost" language.

Streak motion (streak-geometry.ts holds timings; everything on the UI thread, settles in about one
second, nothing loops): week bands unfold row by row (80 ms stagger); each run appears as a disc on
its first day and extends to its last day like one brush stroke; the chosen day's ink disc eases in
(180 ms); a new month slides 22 pt in from the side it was reached from (300 ms); header numbers rise
into place when they change; pebbles and capsules fill in sequence. Reduced Motion, or a preference
not yet known at cold start, draws everything finished immediately.

Levels (owner direction 2026-10-15): Journey is a centred composition, not a list: the current
stage's symbol sits in a soft sand halo inside a thin ring that fills toward the next level only
(never a 0–100 track, which would make progress feel slow); below it LEVEL n, the stage name in
serif, its theme and "Toward Level n+1"; then one serif line of purpose ("Level 100 completes the
habit"), Ripples, and quiet links to How it works and history. Halo, symbol, ring and words draw in
over about a second (instant with Reduced Motion). Future stages are never listed. Stages 2–20
(Levels 6–100) are sealed surprises: the completion screen veils the level row as "A new stage" while
the level animation runs, then reveals the stage's symbol (scale/fade, 900 ms) and name (500 ms
later) once, the first time that stage is reached (stage-reveal.tsx).

Stage paintings (owner direction 2026-10-15): stage symbols are small watercolour paintings, not
line icons. Monkey Mind (Level 0 and Levels 1–5) is the owner's own painting, cut out of its paper
by scripts/watercolor/cutout.py; every other stage is painted in code to match it
(scripts/watercolor: SVG washes with wet-in-wet shading, mottling, pooled rims, paper grain, rendered
in Chromium; STYLE.md). 384 px RGBA, shown small (30 pt, 92 % opacity) beside the level on Home, 96 pt in the Journey
medallion and 84 pt in the new-stage reveal. Visible stages are bundled PNGs (stage-art.ts); sealed
stages are XOR-veiled inside the sealed data and unveiled in memory to a data URI (core RN Image);
no sealed painting exists as an image file. The old line symbols remain only as a fallback.

Consistency bar (owner direction 2026-10-15): one rounded bar (ink on a darker sand track) with five
small segments beneath it, one per milestone; a segment fills, with a tiny swell, as the bar passes
its milestone. Same component on Home, completion and the introduction.

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
