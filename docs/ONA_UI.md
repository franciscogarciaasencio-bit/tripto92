# Ona native interface

## Source of truth

Implemented from the approved portable Ona study at:
`C:/Users/fga31/.codex/visualizations/2026/10/01/01a0f891-1387-7610-8f16-c6add45aff15/ona-design/`.
`HANDOFF.md`, the screen SVGs, opening/rank storyboards, and `wave-spec.json` govern this implementation.
The preliminary Figma board is incomplete; the portable handoff is the complete specification.

`src/ui/primitives.tsx` contains #FDFCFB surfaces, #141414 ink, exact type sizes, 18-point outlined actions,
safe-area insets and scrollable/reflowing layouts. No tab bar, cards, gradients, reward counts or blue accents.
Home stays sparse; Practice and History appear after a saved session. The domain supplies every displayed rank and XP value.

`assets/ona/wave-spec.json` is copied unchanged from the approved artifacts. Native SVG renders its single three-cubic contour,
keyed by stable rank ID. Unknown future rank artwork is omitted while its correct domain name remains visible.
Regular/Medium Manrope static fonts are unmodified files from the author's maintained `googlefonts/manrope` repository
(`fonts/ttf/manrope-regular.ttf`, `manrope-medium.ttf`), version 4.505, matching the artifact font version.
Static aliases avoid variable-weight differences on Android. The bundled SIL license must stay with the fonts.

## Implemented flow

- `/`: cold-launch Ona wordmark, then Meditate. Preferences; returning Practice and History links.
- `/setup`: saved default duration, 5/10/20/30/60 choices, editable 1–180 minutes, Begin.
  A session override does not change the saved default.
- `/session`: elapsed-time countdown, static current-rank wave, Pause / Resume; paused early-end confirmation.
- `/completion`: only committed success claims completion; failed saves retain payload and offer Retry.
  Early finishes show actual activity and history confirmation. Home / View practice.
- `/preferences`: editable persisted default duration; existing audio settings remain intact and are shown honestly as future audio preferences.
- `/practice`: current rank, wave/theme, next-step fraction, permanent highest rank when different, optional numeric details.
- `/history`: repository ordering and paginated real records, actual active duration and completion status.

Launch uses the specified 350/650/450 ms wordmark timing and overlapping 400 ms app fade, tap-to-skip with touch interception,
and no replay on resume. Screen readers omit it; reduced motion uses a 180 ms ready-screen fade.
Rank increases use the approved 250 ms rest + 800 ms corresponding-point wave morph, then acknowledgement before ordinary completion.
Reduced motion immediately shows the new contour and a brief acknowledgement. Stack transitions use quiet 200 ms fades.
Label/dissolve timing is simplified; no looping movement, bounce, reward sound or XP count-up is introduced.

This milestone is **silent**. The design proposed five sounds but supplied no audio assets. Sound/gong defaults are None;
setup exposes their absence and preserves existing stored audio preferences. No decorative/fake playback controls are supplied.
No notifications or background completion sounds. The remaining time is restored from the durable timer rather than JS interval counts.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform all`.
Node tests exercise the pure timer and production repositories against real SQLite, including V1→V2 migration,
pending completion rollback, reopening, protected decay and immutable historical awards.
The exported React Native web app is smoke-tested at phone dimensions with browser SQLite: Home→setup→running→pause→
early end→completion→Home, real one-minute natural completion, paused reload, saved preferences and history reload.
These checks do not substitute for physical iOS/Android lifecycle or accessibility testing.

On the iPhone, test normal completion, multiple pauses, lock/unlock, force-close while running/paused, reopen after the deadline,
larger text, Reduce Motion, VoiceOver, and restarting after saved preferences/history. XP qualification is still five active minutes.
An empty/native development launch has the plain light background; Expo Go controls its own host launch screen/icon.

```powershell
cd C:\Users\fga31\Documents\MeditationApp
npx expo start --clear --go --offline --port 8084
```

Offline here disables CLI cloud requests, not local Wi-Fi. Keep computer and iPhone on the same network and scan the terminal QR
with iPhone Camera to open Expo Go. Stop another server on that port or choose another unused port.
