# Ona audio/onboarding verification — 11 October 2026

Actual exported React Native app in desktop Chrome at 390×844, with Expo SQLite's
browser adapter. These are **browser captures**, not an iPhone simulation/device claim.
The native opening animation, timer and progression domain are unchanged.

| Screen | Capture |
| --- | --- |
| Three-message first use after the original opening | [First use](first-use.png) |
| Home with discreet sound control and simplified bars | [Home](home.png) |
| Active practice with the original timer/wave | [Session](active.png) |
| Optional compact sound selection and independent volume | [Sound control](session-sound.png) |
| Separate Home/meditation settings, unavailable bells | [Preferences](preferences.png) |
| Persisted completion while ambience is stopped | [Completion](completion.png) |
| Secondary expanded Journey explanation | [How it works](journey-details.png) |
| Recording attribution/source/license | [Credits](credits.png) |

`playback.json` records real HTMLAudioElement state: local WAV URL, 197.323152-second
duration, loop enabled, volume while fading, one player after rapid transitions,
and the loop returning to zero after seeking near its end. No external track request
occurred. This checks transport looping, not a listener's judgment of an audible seam.

Automated browser run: first-use copy contains no XP/365/six-hour detail; Skip persists;
Home mute survives reload without allocating a player; distinct Home/session volume
and Ocean music/Silence persist; Pause freezes actual timer and sound, reload restores
it; Resume restores sound; Finish saves history/completion; three rapid start/pause/
discard/Home cycles leave one player; Journey details expand; credits links are correct.
Simulated document background stops Home. A real media.pause event represents an OS
interruption: sound requires explicit Resume sound while the active timer continues.

Positive browser playback explicitly permits autoplay. A separate context replaces
the browser play method with a rejected NotAllowedError Promise: Play sound appears,
there is no unhandled page error, and meditation still saves successfully. This is a
**simulated autoplay rejection**, not evidence of real calls, headphones or Safari behavior.

Verification passed: **542 tests (384 domain + 158 data/audio)**, TypeScript, lint,
iOS/Android/web Expo exports and iOS development bundle (HTTP 200). The native export
asset hashes match the original WAV. Config introspection confirms iOS background audio,
Android media playback service, and no added recording/microphone permissions.

There is no signed/native build or physical-device evidence. A forced network-offline
browser seek requested another byte range and failed: the preview requires its local
server, and no web offline/PWA capability is claimed. Native packaged assets are included,
but cold airplane-mode launch must be tested on the installed iPhone application.
Use a rebuilt native binary for reliable lock/background verification; Expo Go cannot
apply this project's native config plugin. See [AUDIO.md](../../AUDIO.md) for the
device checklist, audio ownership, missing bell assets and development command.
