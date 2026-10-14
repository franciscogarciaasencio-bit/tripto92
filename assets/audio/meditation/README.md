# Original Ona ambience

The four active environments in this directory are deterministic procedural DSP,
created for Ona without external recordings, models, royalties or attribution duties.
The acoustic bell bank and matching interval tracks live in ../bells-v2/ and have
separate CC0 source evidence. Choir remains the user-supplied recording outside both folders.

## Active collection

- Ocean: evolving water/surf/foam with asymmetric swells and jittered arrivals.
- Rain: steady bed with evolving fine patter and microtexture.
- Storm: rain beneath long, low, distant thunder rolls; no crash transients.
- Brown Noise: warm band-limited noise with restrained stereo width.

These are three-minute circular masters, not short clips restarted by JavaScript.
Ocean/Rain/Storm use 128 kbps stereo AAC-LC with priming metadata; Brown Noise uses
lossless FLAC after AAC testing exposed a boundary mismatch. All are 24 kHz. The four
unchanged assets total 17.73 MB. analysis.json records hashes, signal measurements,
decoded correlation and boundary steps. Its historical generator ID remains accurate.

## Reproduction

Development tools: Python, NumPy, FFmpeg; no runtime dependency or remote service.

```sh
python scripts/generate-meditation-sounds.py --ffmpeg /path/to/ffmpeg
python scripts/analyse-meditation-sounds.py --ffmpeg /path/to/ffmpeg
```

The complete original generator is retained, including the retired 196/146.832/293.665 Hz
procedural bowls and their sparse timelines. It now writes .expo/sound/legacy-dsp/;
lossless ambient masters write .expo/sound/masters/. It cannot overwrite active assets.
If deliberately changing ambience, copy only the selected environment into this directory
and update its analysis/hash entry, then verify its loop. Do not reintroduce retired bowls.
Acoustic regeneration commands are in ../bells-v2/README.md.

Checks establish hash identity and recorded headroom, decoded-to-master correlation above
0.99, and boundary steps below ordinary sample changes. They do not establish subjective
realism or native gapless playback. Long-session speaker/headphone and physical iOS/Android
loop checks remain necessary. See docs/AUDIO.md for ownership and device limitations.
