# Ona audio

## Sounds, rights and reproduction

The active bells are real acoustic bowl recordings by Joseph SARDIN / BigSoundBank,
released under CC0 with no mandatory attribution, fee or permission. assets/audio/bells-v2
contains the mastered clips and matching sparse interval tracks. Its README describes
comparison, mastering and remaining subjective/native listening checks. Original 48 kHz
recordings, source URLs, rights evidence and hashes remain in scripts/audio-sources/bells.
master-acoustic-bells.py reproduces the PCM bank; build-bell-timelines.py builds/verifies
timelines from that exact interval master. Regenerate timelines whenever Interval changes.
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
| Interval bell | Related approximately 473 Hz mode, quieter 9.06-second strike |
| Ocean, Rain, Storm | Layered evolving circular synthesis, three-minute stereo AAC loops |
| Brown Noise | Warm circular spectral synthesis, three-minute lossless FLAC loop |
| Silence | No ambience; optional bells remain independent |
| Choir | Unchanged user-supplied CC0 Meditation Choir; Home and optional meditation source |

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

Settings → Meditation Sounds offers ambience selection/previews, independent ambience
and bell volumes, starting/ending toggles, Off/5/10/15-minute intervals and optional
gentle haptics. Done persists typed preferences; Back cancels edits. Previews use edited
volumes, are exclusive/bounded, and stop on navigation/background; they cannot overlap
a running meditation. Session controls change ambience live. Home retains simple mute.
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
- Interval assets are sparse six-hour native timelines, beginning silently, with
  bells at 300/600/900 active seconds and subsequent intervals. Pause stops their clock;
  resume/recovery seeks to active time, excluding pauses. Serialized revision-guarded
  seeks prevent stale playback; missed bells do not create catch-up bursts.
- On Android, audible ambience owns the foreground media service; with Silence/zero
  ambience the interval timeline (or opening tone when appropriate) owns it. Never
  create competing background owners. OS media Pause affects sound, not the saved timer.
- Unexpected media stops fail closed; explicit Resume sound realigns playback. Cleanup
  cancels timers/listeners and attempts background release, pause and removal separately
  so one native error cannot strand a player. No late async seek/load can revive disposal.
- Optional live-action haptics use Soft on iOS and frequent-tick on Android; web is silent.

## Size, analysis and verification limits

All assets are local at 24 kHz except unchanged Choir. The new collection is about
39.56 MB, including 19.33 MB of sparse interval timelines; native decoders stream
only selected files. Intervals stop after six active hours; ambience/timing continue.

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
immediate locking, calls/audio focus, route changes, cold offline recovery and haptics.
Native background mode and interruption behavior depend on OS/device policy.

SDK 57 references: [Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/),
[Haptics](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/).

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

