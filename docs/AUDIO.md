# Ona sound and short onboarding

## Ownership and API

`src/application/audio-provider.tsx` mounts once underneath OnaProvider. It owns one
audio controller for the process, never one per screen/render. `src/audio/policy.ts`
maps readiness, explicit session phase, pending completion, foreground and saved
preferences to Home/session/silent intent. Audio never reads or writes XP, a timer
cursor or session history. No domain, timer or balancing files changed.

`src/audio/controller.ts` is plain TypeScript. It exposes `setIntent`, `retry` and
`dispose`; a small backend and clock boundary enables deterministic tests. One
shared looping player preserves its position across Home/session changes. Fades
are cancellable, native mode configuration is serialized, and revision guards stop
old Promises from reviving playback. Home enters over 2.5 seconds, session over 1.5;
stopping/changing owner/volume uses a one-second fade. Playback starts at zero and
the fade waits for actual playback, avoiding a full-volume late load.

`backend.ts` uses SDK 57 **expo-audio** and the local WAV. Home/session use
`mixWithOthers`, so Ona does not deliberately pause another music app. SDK 57
exposes no reliable other-music detection API. Active session audio enables native
background mode; Android also enables its required media service/lock controls.
Home, paused, completed and discarded sessions release that background ownership.
Native config enables playback, disables recording and adds no microphone permission.

`backend.web.ts` resolves the same bundled asset with **expo-asset** and uses
HTMLAudioElement. SDK 57's web play method discards the browser play Promise;
the small web boundary catches autoplay denial instead. Native uses expo-audio.
Browser/iOS Safari policies may prevent autoplay/programmatic volume; use native
Ona for iPhone listening. No internet track URL or streaming service is used.

## Lifecycle and failure policy

- Home ambience starts when the app/store is ready, including the opening/first use.
  It can continue on non-session pages such as Journey/Preferences.
- Meditate begins a Home fade immediately, independently of saving the timer.
  Session selection/volume then take ownership. Silence pauses the actual player.
- Pause and Finish fade out; discard never plays a closing bell. Pending completion
  stays silent, including save failure/recovery. Returning Home restores its saved choice.
- Backgrounding Home stops **immediately** inside the AppState callback. JavaScript
  fade timers can suspend, so a cosmetic fade must not leave Home audio playing.
- Active native session playback/looping can continue while JavaScript is suspended.
  Entering background settles its target volume immediately, including a partial fade
  or delayed source load. This avoids freezing Home/session transitions at the wrong
  volume. Native configuration/first-play startup may still require JS before suspension;
  test locking immediately after Meditate as well as after playback starts.
- An unexpected playback stop fails closed, leaves the meditation timer untouched,
  and shows **Resume sound**. No automatic retry over a call. Explicit Resume/retry
  restores sound softly. OS media Pause affects sound, not active meditation time;
  pause the practice in Ona to exclude time.
- Failed loading, mode configuration or playback shows **Play sound**, never a
  saving/navigation error. A 15-second foreground first-play watchdog releases failed
  sources. Background suspends this watchdog; foreground grants a fresh load window
  so a JS timer cannot mistake suspended status delivery for a failed native load.
  Retry creates a fresh failed player; interruption retry retains position.
- Cleanup cancels fades/watchdogs, removes listeners and releases the player.

## Preferences and presentation

Migration **V5** creates a validated `audio_preferences` singleton with typed JSON,
version 1. Defaults: Home enabled at 0.15, Ocean music session at 0.15, both bells off.
Home mute and live session selection/volume persist transactionally. Settings edits
persist on Done; Back cancels them. Unknown versions/malformed values fail explicitly,
without resetting a saved mute preference. Original meditation/gong preferences are
preserved; their former placeholder sound IDs are not repurposed.

Controls: Home Sound on/off; session Sound → Ocean music/Silence and volume;
Preferences → separate Home/session volumes and Sound credits. No suitable bells
exist: both independent preference fields are reserved, and their UI shows Unavailable.
No replacement bells or falsely labelled waves-only option were added.

The opening animation/wordmark are unchanged. First-use copy has three short messages,
with persisted Start practising/Skip dismissal. Returning users reach Meditate directly.
Home hides formula/threshold text. Journey retains the exact three-minute/six-hour
rules, XP/consistency and final-year requirements in expandable **How it works**;
the inspectable level requirements remain available. See GAME_SYSTEM.md for rules.

## Recording and verification

See [asset details](../assets/audio/README.md). **Meditation Choir** by
**zazz.sound.design**, CC0 (public domain dedication, supplied by the user), is
bundled unchanged. No mandatory attribution or licensing fees apply.
The previous recording and its attribution requirements have been removed.
The 24-bit stereo 48 kHz WAV is ~22 MB, with silent endpoint samples.
Native loop=true uses the platform player; no JS end-of-track restart or overlapping
tracks. Listening through the full 76.5-second loop on iPhone remains necessary.
The existing `ocean_music` preference ID/label is retained to preserve saved choices
and UI; both Home and sessions now play Meditation Choir. Defaults stay at 0.15.

`npm test` runs the original domain/SQLite tests plus pure controller/policy tests,
real SQLite audio preference migration/round trips/rollback/corruption tests, and
WAV hash/format/endpoint verification. No new testing framework was added.
TypeScript, lint, iOS/Android/web exports, config introspection and an iOS Metro dev
bundle are checked. Exports include the exact WAV hash for both native platforms.
See [browser evidence](evidence/2026-10-11-audio/README.md) for rendered UI/playback
checks. Browser autoplay denial and pause are simulated, not actual phone calls.
The web preview needs its local server and may request media byte ranges: a forced
browser-network-offline seek was not successful. There is no offline web/PWA claim.

**Expo Go** can check foreground sound, controls, timer and saved choices with SDK 57.
Its development assets come from Metro; this is not a cold offline native-install test.
A rebuilt development/standalone binary is required to apply the background-audio
config. Exports/config inspection do not prove physical-device background playback.

On the iPhone, verify: quiet initial loudness with headphones/speaker; mute after
force-close; session Silence/separate volume; full 1:16.5 loop without clicks/gaps;
Pause/Resume/Finish/discard and rapid taps; another music app, real incoming call,
headphone disconnect; lock for >4 minutes in a new native build; Home background
silence; cold standalone launch in airplane mode; screen reader/large text.

```powershell
cd C:\Users\fga31\Documents\MeditationApp
npx expo start --clear --go --port 8092
```

Scan the QR code with the iPhone on the same Wi-Fi. Do not assume Expo Go supplies
this project's native background configuration. Future audio changes stay above
the repositories and domain; add any later assets with explicit license information.
