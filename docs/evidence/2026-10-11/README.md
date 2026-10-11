# Ona habit journey verification — 11 October 2026

These captures show the actual exported React Native application running in Chrome at
390×844, using Expo SQLite's browser adapter. They are browser evidence, not an iPhone
simulator or physical-device verification. The same native routes/components were exported
for iOS and Android. No mock screens or product debug routes were added.

## Actual application captures

| View | Evidence |
| --- | --- |
| Cold opening | [Opening](opening.png) |
| Persisted first-use explanation | [First use](first-use.png) |
| Home's two compact bars | [Home](home.png) |
| Count-up meditation and evolving curve | [Active practice](active-practice.png) |
| Ordinary credit | [Completion](ordinary-credit.png) |
| Six-hour double-session day | [Double-session feedback](double-session.png) |
| Current Monkey Mind category | [Current Journey](journey-current.png) |
| Inspectable future category and final safeguards | [Future Journey](journey-future.png) |
| Explanation reopened from Journey | [How progress works](how-progress-works.png) |
| Small 320×568 phone layout | [Preferences](preferences-320.png) |
| Level 99 → 100 milestone | [Clearly labelled test data](level100-test-data.png) |
| Automatically positioned Habit Established category | [Clearly labelled test data](journey-level100-test-data.png) |
| All 25 matching editable outline icons | [Specimen](icon-specimen.png), [SVG source](../../../assets/ona/icon-specimen.svg) |

The double-session run advances a test wall clock, saves two real practices through the
normal repository, and reloads the pending completion. The Level 100 fixture contains
266 domain-generated daily ten-minute sessions and their real receipts, plus a finished
267th timer cursor. An isolated browser test database receives that fixture; normal startup
recovery produces the actual Level 100 completion. Both Level 100 captures are visibly
labelled **TEST DATA · 267 daily 10-minute practices**. No user's database was modified.

## Motion evidence

[Watch the browser wave recording](wave-motion-browser.webm) (approximately 16 seconds).
It records actual continuous rendered motion through more than one 12-second cycle,
followed by Pause settling. Its on-video label identifies browser recording.

Continuous playback was decoded and inspected at [3 seconds](recorded-phase-3.png),
[7 seconds](recorded-phase-7.png), and [12 seconds](recorded-phase-12.png).
[Captured SVG paths](wave-phases.json) also differ across five active samples with unchanged
anchors: the curve changes shape rather than translating an unchanged drawing.
Separate browser assertions confirm static paths after Pause settles, static Reduced Motion,
and static simulated background state followed by resumed foreground motion. Simulating a
browser visibility event does not verify the native AppState lifecycle.

## Available checks passed

- `npm test`: **505 tests** — 384 domain/assets and 121 data tests, including all retained
  historical progression tests. Data tests use real Node SQLite with transaction failures.
- `npx tsc --noEmit` and `npm run lint`: passed.
- `npx expo export --platform all`: iOS, Android and web passed.
- Expo Go development server started on port 8091: iOS manifest identifies **Ona**;
  manifest and development bundle returned HTTP 200 (1,843 modules).
  The restricted offline run emitted an Expo CLI manifest-asset resolution warning.
  Its resolver consults an Expo-hosted SDK configuration schema; no missing local asset was
  identified. Manrope files are bundled locally, but native font/icon loading still needs
  device verification. The normal iPhone launch command omits `--offline`.
- Browser flow: full-opacity opening hold measured 1.09 seconds; Reduced Motion hold
  1.10 seconds; tap skip did not accidentally start meditation. First-use dismissal
  persisted and the explanation reopened from Journey.
- Home has exactly two progress indicators; actual rendered backgrounds on opening,
  explanation, Home, practice, completions, Journey and preferences are RGB(242,233,218),
  matching **#F2E9DA**. SVG linework uses **#141414**.
- Pause/reload/resume, saved ordinary/double credit feedback after reopening, current/future
  Journey, all 25 accessible category icons and the 320px preferences layout passed.
- The Level 100 browser fixture passed actual repository recovery and Journey positioning.

React Native web reports screen-reader mode enabled, so its opening uses the simplified
transition. These captures verify the visible hold; native 300ms entrance/350ms exit still
need an iPhone check. Browser clock advances accelerate sessions; they do not measure real
hours of runtime. Browser SQLite evidence does not verify native filesystem behavior.

## Remaining device checks

On iPhone, test cold launch versus foreground return, VoiceOver/large text/Reduce Motion,
the full wave cycle and Pause/Resume, then lock and force-close running/paused practice and
pending completion. Confirm history/preferences survive restarting. Try 2:59 versus 3:00
active practice and genuine six-hour end-to-start separation. Check native Journey scrolling.

The configured native splash background needs a rebuilt application binary to verify.
Expo Go's own host splash is not fully controlled by application JavaScript. No signed
release, native simulator, physical iPhone or physical Android verification was available.
