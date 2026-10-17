# Ona audio

## Sounds, rights and reproduction

The starting and ending bells are real acoustic bowl recordings by Joseph SARDIN / BigSoundBank,
released under CC0 with no mandatory attribution, fee or permission. Since 2026-10-15 the interval
bell is a gong the owner supplied ("gong-4"); its origin and licence are not yet recorded
(provenance.json, `ownerSupplied`), so confirm them before a public release. assets/audio/bells-v2
contains the mastered clips and matching sparse interval tracks. Its README describes
comparison, mastering and remaining subjective/native listening checks. Original 48 kHz
recordings, source URLs, rights evidence and hashes remain in scripts/audio-sources/bells.
master-acoustic-bells.py reproduces the PCM bank (`--roles interval` re-renders one clip and keeps
the others byte-for-byte); build-bell-loops.py builds/verifies the interval loops from that exact
interval master. Regenerate the loops whenever Interval changes.
bell-timing.ts holds sample-verified cleanup ceilings; native end events release normally.

Ocean/Rain/Storm/Brown Noise remain original deterministic procedural DSP in
assets/audio/meditation. Its README and analysis.json document provenance/measurements.
generate-meditation-sounds.py retains the historical complete generator, now writing to
ignored .expo/sound/legacy-dsp so it cannot overwrite current assets. Acoustic recordings
are external CC0 material, not original Ona synthesis. Everything is bundled offline.

| Sound | Character / asset |
| --- | --- |
| Starting bell | Soft acoustic strike, approximately 474 Hz lower mode; 13.24 seconds |
| Ending bell | Deeper approximately 305 Hz mode, 29.92-second natural resonance |
| Interval bell | The owner's gong: approximately 439 Hz with its octave, 9.42-second natural decay; since 2026-10-16 about −29.4 LUFS, a little above the starting bell (−32.1), because the owner could barely hear it |
| Ocean, Rain, Storm | Layered evolving circular synthesis, three-minute stereo AAC loops |
| Brown Noise | Warm circular spectral synthesis, three-minute lossless FLAC loop |
| Silence | No ambience; optional bells remain independent |
| Choir | User-supplied CC0 Meditation Choir, shipped as 192 kbps AAC since 2026-10-15 (original WAV in Git history); Home and optional meditation source |

Choir's one-time provenance/hash is in assets/audio/README.md; saved ocean_music IDs
still select it. The earlier progression swell is retired, with its original synthesis
script retained. That script writes only an ignored development master; there is no
runtime cue/player or fallback closing sound to conflict with ending-bell settings.
Essential design/audio source files are not obsolete just because they are not imported.

## Ownership and preferences

AudioProvider owns one ambience controller and one session-sound controller. Policies
and fake-clock-testable controllers live in src/audio; backend(.web).ts and
session-backend(.web).ts implement platform playback. assets.ts is the local catalogue.
No screen owns a player; sound never changes timer, rewards, persistence or wave phase.

Ambience is chosen on Prepare before each practice; its volume (and a change of ambience) is
adjusted live from the meditation speaker. Settings keeps only what lives nowhere else: starting/
ending bell toggles with previews, Off or 1–60-minute intervals with a preview, bell volume and Home
ambience volume. Haptics were removed (the stored `hapticsEnabled` field is kept for compatibility
and ignored). Done persists only those fields onto the current
preferences; Back cancels edits. Previews use edited volumes, are exclusive/bounded, and stop on
navigation/background; they cannot overlap a running meditation. Home's speaker is its mute.
There is no floating Resume sound/Play sound action on Home or meditation. After a
failure, Home mute→unmute explicitly retries; opening the meditation speaker controls
also retries interrupted playback. Resume still restores paused session sound normally.
Stopping a preview uses a short fade; switching, beginning a meditation, backgrounding
or disposal cancels stale fades and cannot release a newer player.

New defaults: Ocean 0.15, start/end enabled, bell volume 0.18, intervals disabled,
haptics disabled; Home Choir 0.15 enabled. MASTER_PLAYBACK_GAIN = 0.5 applies once to
actual output, never repeatedly to stored preferences. Migration 9 upgrades preference
version 1 → 2 while preserving old choices. Malformed/future values fail explicitly.

## Lifecycle and background policy

- Ambience volume changes reuse the same player. Source changes fade out/release then
  fade in. Loops use native decoder playback, not JS end-event restarts. Home is
  foreground-only; active meditation may continue in background with mixed audio mode.
- Start plays only after a successful live Begin; restoration never replays it.
  End plays once when finished and can resonate through Completion/Continue to Home.
  A new session replaces that tail. Ending Off means a genuinely quiet finish.
  Pausing/live bell mute stops relevant tones; slow-loading start/end clips drop after
  two seconds rather than arriving late. Preview load watchdogs are bounded too.
  Cleanup deadlines begin at actual playback and allow the full clip plus a one-second
  safety margin; the old 25-second ending cutoff no longer truncates the acoustic tail.
- Interval bells (since 2026-10-16) offer 1–60 minutes (INTERVAL_MINUTES in audio-preferences.ts). Each
  length is one looped FLAC: the interval master at 0 s, then silence (scripts/build-bell-loops.py,
  loops.json, 3.57 MB for 18 lengths; the former 19.33 MB of six-hour AAC timelines are retired, their
  builder kept). Native looping rings a bell every N active minutes while JavaScript sleeps, with no
  six-hour limit; the controller seeks to active seconds mod N and keeps the strike at 0 s silent
  (volume 0 until it is over). Drift is corrected by loop distance whenever the app is in front. Pause stops their clock;
  resume/recovery seeks to active time, excluding pauses. Serialized revision-guarded
  seeks prevent stale playback; missed bells do not create catch-up bursts.
- On Android, audible ambience owns the foreground media service; with Silence/zero
  ambience the interval loop (or opening tone when appropriate) owns it. Never
  create competing background owners. OS media Pause affects sound, not the saved timer.
- Unexpected media stops fail closed; explicit Resume sound realigns playback. Cleanup
  cancels timers/listeners and attempts background release, pause and removal separately
  so one native error cannot strand a player. No late async seek/load can revive disposal.

## Size, analysis and verification limits

All assets are local at 24 kHz except Choir (48 kHz AAC). Bundled audio is about 26 MB; the largest item is
the 9 MB lossless Brown Noise loop. Interval loops total 3.57 MB (see Lifecycle). Native decoders stream
only selected files.
On 2026-10-15 the Choir moved from its 22 MB WAV to a 1.8 MB AAC encode (assets/audio/README.md).

Generation analysis checks headroom/DC, soft attacks/tails, >0.99 decoded/master
correlation, ordinary-sized wrap steps and first/second/final interval timing. Brown Noise
uses lossless FLAC because AAC testing revealed a boundary mismatch. These checks
do not prove subjective realism or native decoder gaplessness.

npm run check exercises migrations, persisted preferences, sound policy/controllers,
previews, pause/resume/recovery, interruptions, cleanup and asset hashes/envelopes.
Browser verification in docs/evidence/meditation-sounds used real decoded playback;
it is not physical-device listening. Exports likewise do not test native audio.

Use an SDK-compatible Expo Go for foreground checks. A **rebuilt development/standalone
binary** is required to apply enableBackgroundPlayback in app.json. Physical iPhone and
Android review remains required for 20–60-minute loops, speaker/headphone loudness,
immediate locking, calls/audio focus, route changes and cold offline recovery.
Native background mode and interruption behavior depend on OS/device policy.

SDK 57 reference: [Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

## Ending timeline for fixed-length practice (2026-10-14)

`assets/audio/bells-v2/ending-timeline.m4a` is one hour of digital silence followed by the exact
End master (scripts/build-ending-timeline.py; report and hashes in ending-timeline.json;
0.86 MB). For a fixed practice, the session controller seeks it so the bell lands when active
time reaches the target, pauses it with the practice and re-aligns on resume, exactly like the
interval timelines. Native playback therefore rings the End bell on a locked phone while
JavaScript sleeps. When the practice finishes at its target after the timeline played, no
second End clip is created; the timeline rings out and is released after the bell's tail.
Finishing early releases it and plays the ordinary End clip. With the ending bell off or muted
no timeline exists. In Silence without intervals it holds Android's media service. Offered
lengths are at most 60 minutes, within the timeline. A coincident interval bell at the target
may sound together with the End bell (accepted, documented). Physical locked-screen listening
remains a device check.

