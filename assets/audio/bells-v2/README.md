# Acoustic bells — live collection

Three real struck-bowl recordings, mastered for quiet Ona playback. The app imports
these clips and matching sparse interval timelines together. No preferences or playback
gain have changed. The former procedural clips/tracks are retired; their deterministic
generator and historical provenance remain available.

| Role | Source ID | Duration | Design decision |
| --- | --- | --- | --- |
| Start | 2553 | 13.24 s | Softened 65 ms attack; preserve approximately 474 Hz lower mode |
| End | 1110 | 29.92 s | Lower approximately 305 Hz mode, 120 ms attack, full long decay |
| Interval | gong-4 (owner) | 9.42 s | Owner's gong since 2026-10-15: approximately 439 Hz with its octave; 45 ms lead trimmed, 30 ms fade into the strike, −3 dB above 2 kHz, quieter master |

These frequencies describe measured partials, not equal-tempered tuning. No pitch
shifting, synthesized bell layers, repeated tails, compression or added reverb.
Mono avoids artificial stereo placement and makes the delivery bank only **2.51 MB**.
The masters are 24 kHz/16-bit PCM WAV; preserving their small lossless tails is preferable
to lossy encoding. Four original 48 kHz WAVs (8.00 MB total) remain under
`scripts/audio-sources/bells/`, outside the runtime asset graph.

## Rights and comparison

**Interval since 2026-10-15:** the owner supplied the gong (`owner-gong-4.mp3`, kept unchanged
beside the other sources) and asked for it as the interval bell. Its origin and licence were not
stated, so provenance.json records it under `ownerSupplied` with licence `unconfirmed`; record both
before a public or commercial release. It was mastered with `--roles interval` (FFmpeg 6.1.1), which
left start.wav and end.wav byte-identical, at the former interval's opening RMS (0.022): integrated
loudness −35.5 LUFS against −35.4 before. Bowl #2554 remains as a comparison source. The text below
describes the original BigSoundBank selection.

Sources are Joseph SARDIN / BigSoundBank recordings individually marked **CC0 1.0**.
Commercial use, editing and redistribution are permitted; no required credit, fee,
account or ongoing service. One-time provenance, URLs, retrieval date, source hashes
and selection reasons are in `scripts/audio-sources/bells/provenance.json`. This is
internal provenance, not an app attribution requirement. Publisher terms:
<https://bigsoundbank.com/licenses.html>.

Four acoustic strikes were compared analytically. #2555 remains an alternate; its
strong approximately 2.4 kHz mode and greater initial energy favored #2553 instead.
The rubbed-bowl #1109 was unsuitable for a brief onset. Freesound/Monkay #48325 was
also researched (CC0), but not acquired: original download requires login, lower
sample rate and reported abrupt tail. No uncertain-license source was used.

First-pass signal review led to a longer ending attack (80 → 120 ms), gentler upper
partials in the ending (-8 → -10 dB shelf) and interval (-6 → -9 dB shelf). The ending
peak fell from 0.174 to 0.161 at the same opening RMS. Interval opening RMS is about
61% of Start, rather than normalizing every strike to the same peak. Half-cosine fades
reach exact silence at both endpoints; tails fade only in their already quiet final
1.2–2 seconds. `analysis.json` records profiles, constant gains, tool versions, hashes,
sample peaks, DC, spectral energy and per-second RMS for all sources/masters.

**Not listening-approved yet.** This environment supports decoding/signal analysis,
not reliable subjective listening or a physical iPhone/Android sound check. Measurements
do not establish naturalness, pleasantness or speaker audibility. The developer audition
page below supports a proper comparison before Session 10 integration. No listener
approval is implied by passing automated checks.

## Reproduce and verify

Development-only Python + NumPy and FFmpeg; no runtime packages. Tested with NumPy
2.3.5 and FFmpeg 7.1 (full encoder version in analysis.json). Supply their local paths:

```sh
python scripts/master-acoustic-bells.py --ffmpeg /path/to/ffmpeg
python scripts/master-acoustic-bells.py --ffmpeg /path/to/ffmpeg --output .expo/bell-reproduction
python scripts/build-bell-timelines.py --ffmpeg /path/to/ffmpeg
python scripts/build-bell-timelines.py --ffmpeg /path/to/ffmpeg --verify-only
node --test tests/data/acoustic-bells.test.cjs
npm run check
```

The mastering script validates original hashes before rendering and makes no network
requests. It writes the live PCM bank (or explicit alternate output). Compare the three WAV
hashes after a rerender; other FFmpeg builds can round filters differently. No random
process or current timestamp enters the output. Original generation scripts remain.
Always rebuild timelines after changing Interval. timelines.json ties their hashes to
the exact interval master; verification decodes the first, second and final six-hour strikes,
checking quiet lead-ins, >0.98 waveform correlation and a complete tail. Each AAC timeline
begins silently and has strikes at 300/600/900 active seconds through six hours, with a
12-second final-tail window. The three timelines total 19.33 MB. These are streamed by
native decoders; JavaScript never loads six hours of PCM. Existing active-time seeking,
pause/recovery, background ownership and preferences remain controlled by AudioProvider.

Serve the repository with `python -m http.server 8099 --bind 127.0.0.1` and open
`http://127.0.0.1:8099/assets/audio/bells-v2/audition.html`. The page reads analysis.json
to match source levels. It is a developer listening tool, not app UI.
It starts at Ona's unchanged default effective bell gain (0.18 × 0.5 = 0.09), permits
matched-level source comparison, and stops the previous sound before playing another.
Headphone/speaker listening should check attack comfort, quiet-tail naturalness and
audibility over Ocean/Rain before approving. Completion-tail ownership and pause/recovery
are covered with fake players/clocks; native locked-screen playback still needs a device.
