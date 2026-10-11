# Ona native interface

## Sources and diagnosis

The approved original design is at
C:/Users/fga31/.codex/visualizations/2026/10/01/01a0f891-1387-7610-8f16-c6add45aff15/ona-design/.
This milestone applies the user's revised habit journey, exact sand colour and motion requirements.
No HTML replacement, audio, sea-opening animation, tabs, gradients, coloured badges or cards.
Manrope Regular/Medium and existing wordmark/wave geometry remain the design sources.

The inspected clean baseline was 801b2d9. Its opening had a 500 ms full-opacity hold and
was omitted for Reduced Motion/screen readers; its moving wave varied only 2.4 viewBox units
and kept its phase loop active while paused/backgrounded. The rendered background was
#F6F1E7. These are code findings; stale bundles or the user's iPhone accessibility settings
were not independently observed and cannot be asserted as the cause of their report.

## Entry, opening and theme

expo-router/entry → src/app/_layout.tsx → process-local Opening → first explanation or native Stack.
Font readiness renders the root; Opening awaits native splash dismissal before starting its hold.
SQLite startup proceeds underneath and never shortens the opening. Exact wordmark/tagline:
**Ona / Build your meditation habit**. Entrance 300 ms, full hold 1100 ms, exit 350 ms.
Tap skips without activating underlying Meditate. Reduced Motion and VoiceOver remove transitions
but preserve the hold. Returns Home and background/resume do not remount it; a new process does.

src/ui/theme.json is the actual central #F2E9DA / #141414 source. Primitives, root, opening,
stack content and every current screen use it. app.config.ts applies it to native config/splash
backgrounds; app.json matches for tooling. Unused starter components/theme files are outside
the active route/import graph. Screenshot background pixels are RGB(242,233,218).
Native splash configuration requires a new binary; Expo Go controls its own host launch screen.
[SDK 57 splash documentation](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/).

The first explanation is short, scrollable, skippable, and stores dismissal. Start practising leads
to Home, not a setup step. Journey → How progress works makes it available again. Pending
timer/completion recovery takes precedence over a never-dismissed explanation.

## Native routes and lifecycle

- /: dominant one-tap Meditate; two quiet indicators for permanent lifetime practice and actual
  recent consistency; Journey, saved-history count and preferences. Both bars appear for new users.
- /session: count UP, hide/show time, Pause/Resume, Finish and deliberate discard.
  Existing durable cursor/retry/recovery remain unchanged. Running locked/closed time counts;
  Pause excludes it. No duration setup/selection.
- /completion: confirmed atomic save; Well done, active duration, real saved-practice count,
  immutable awarded XP, permanent level and all unmet gates. Durable credit feedback distinguishes
  ordinary, double-day increment, already credited/capped and short history. Category transitions
  receive a quiet acknowledgement; crossing 100 receives the exact habit milestone message.
  Home acknowledges the summary. Old summaries never invent pre-migration event feedback.
- /practice: native **Journey**. Permanent level/category/step/icon, two indicators, lifetime XP,
  credits vs real dates, explanations and expandable 25-category/125-level list. Automatically
  bring the current category into view; scroll upward for the overview and How progress works.
  All future requirements/icons remain inspectable. Maximum has no next level, never exceeds 125.
- /how-progress-works: explanation, early three-minute/six-hour examples, actual XP/consistency rules
  and separate 365-date/elapsed-day safeguard.
- /history, /preferences: retained real history/pagination and typed persisted future audio choices.

All number/date rules are domain/repository outputs. No SQL or XP formula lives in screens.
See GAME_SYSTEM.md for the complete threshold table, simulations and historical version policy;
ARCHITECTURE.md documents V4 migration and immutable completion metadata.

## Wave and icon assets

Wave samples the ten original approved artwork contours along the **permanent** journey; their
legacy asset IDs no longer select a visible rank. During practice, Reanimated changes cubic
control/join heights by at most six drawing units in a 12-second sinusoidal cycle. Adjacent
controls move together, preserving tangents. It changes shape, rather than translating a drawing.
Pause smoothly settles over 1100 ms and stops the phase loop. Resume eases back in; full-cycle
phase endpoints have identical sine values. Background cancels animation work, independently
of the timer. Reduced Motion is static, including preference changes during a session.
Animation props run on the native UI thread; no whole-screen frame renders. It is not a breathing pacer.

assets/ona/categories.json contains 25 native path definitions; categories/ contains the matching
editable SVGs. Shared 24×24 viewBox, monochrome 1.35 strokes, rounded joins/caps; optically shown
at 28–32 logical pixels. IDs match central Journey category icon IDs. Update both sources together;
a parity test prevents drift. icon-specimen.svg is the compact specimen. Every icon is integrated
in the actual Journey with accessible names; icons are not substituted with emoji/placeholders.

## Evidence and verification limits

See [browser evidence](evidence/2026-10-11/README.md): opening, explanation, Home, active practice,
ordinary/double completion, current/future Journey and clearly labelled Level 100 test data.
The wave recording contains actual browser-rendered curve motion and a smooth Pause; its sampled
phases differ, while paused/Reduced Motion paths remain static. This is not iPhone evidence.

Automated checks: npm test (pure TS and real Node SQLite), npx tsc --noEmit, npm run lint,
npx expo export --platform all; exported React Native web against browser SQLite.
Browser checks cover the >=1-second actual full-opacity hold, skip/dismissal/reopening,
rendered colours, all icons, inspectable future levels, active/paused/Reduced Motion curve,
pause/reload recovery, actual ordinary/double credits and Level 100 recovery. Test wall-clock
advances/fixture history are explicit; no fake product counters or debug route are shipped.
Native exports/dev bundle do not verify a signed release, native filesystem or visible device motion.

On iPhone: cold launch vs resume; tap skip; first explanation dismiss/reopen; warm sand across
all screens; watch wave >=12 seconds; Pause/Resume; Reduce Motion; lock/force-close running,
paused and pending completion; save 2:59 vs 3:00 active; double gap just below/exactly six hours;
Journey gates/current auto-scroll; large text/VoiceOver; persistent history/preferences after restart.

From PowerShell:

~~~powershell
cd C:\Users\fga31\Documents\MeditationApp
npx expo start --clear --go --port 8091
~~~

Computer/iPhone on the same Wi-Fi; scan the terminal QR with Camera. Verification used the
additional --offline flag in a restricted environment; normal network mode lets the CLI resolve
Expo configuration metadata. The app's saved data stays local. Select another port if occupied. Rebuild a native
binary to assess the configured splash; Expo Go's host splash cannot be branded by JS changes.

## Later direction (not implemented)

Restrained outline waves and soft sea ambience may accompany the wordmark later, with accessible
motion/sound controls. Session ambience and gongs remain future work. No audio module/assets,
sea opening animation, Garmin, notifications, account, sync or subscriptions are added here.
