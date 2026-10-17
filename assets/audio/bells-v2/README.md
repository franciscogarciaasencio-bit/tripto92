# Acoustic bells — live collection

Two real struck-bowl recordings, mastered for quiet Ona playback: the starting bell and the
ending bell. **Since 2026-10-17 (owner) the interval bell is the starting bell:** the interval
loops (`interval-loop-*.flac`, `scripts/build-bell-loops.py`) are built from start.wav, and the
separate interval master (the owner's gong, interval.wav) was removed from the app. It remains in
Git history (`git show 7378fe3:assets/audio/bells-v2/interval.wav > interval.wav`). Removing it also
removes the one sound whose licence was unconfirmed from the shipped bundle.

| Role | Source ID | Duration | Design decision |
| --- | --- | --- | --- |
| Start | 2553 | 13.24 s | Softened 65 ms attack; preserve approximately 474 Hz lower mode |
| End | 1110 | 29.92 s | Lower approximately 305 Hz mode, 120 ms attack, full long decay |
| Interval (retired 2026-10-17) | gong-4 (owner) | 9.42 s | Replaced by the starting bell; profile kept as a comment in master-acoustic-bells.py |

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
python scripts/build-bell-loops.py --ffmpeg /path/to/ffmpeg
python scripts/build-bell-loops.py --ffmpeg /path/to/ffmpeg --verify-only
node --test tests/data/acoustic-bells.test.cjs
npm run check
```

The mastering script validates original hashes before rendering and makes no network
requests. It writes the live PCM bank (or explicit alternate output). Compare the three WAV
hashes after a rerender; other FFmpeg builds can round filters differently. No random
process or current timestamp enters the output. Original generation scripts remain.
Always rebuild the interval loops after changing start.wav: loops.json ties their hashes to the
exact starting bell, and the build decodes every loop back sample-exactly (the bell at 0 s, then
silence). The six-hour AAC timelines described in older notes were retired on 2026-10-16;
build-bell-timelines.py is kept for history and needs interval.wav restored from Git to run.

Serve the repository with `python -m http.server 8099 --bind 127.0.0.1` and open
`http://127.0.0.1:8099/assets/audio/bells-v2/audition.html`. The page reads analysis.json
to match source levels. It is a developer listening tool, not app UI.
It starts at Ona's former default effective bell gain (0.18 × 0.5 = 0.09; the default is 0.6 × 0.5 = 0.3 since 2026-10-17), permits
matched-level source comparison, and stops the previous sound before playing another.
Headphone/speaker listening should check attack comfort, quiet-tail naturalness and
audibility over Choir before approving. Completion-tail ownership and pause/recovery
are covered with fake players/clocks; native locked-screen playback still needs a device.
