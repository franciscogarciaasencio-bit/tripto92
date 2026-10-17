# Original Ona ambience (retired)

**Removed from the app on 2026-10-17 (owner): Choir and Silence are now the only meditation sounds.**
This report and analysis.json moved here from assets/audio/meditation so the provenance stays with
the generator. The encoded files are in Git history, e.g.
`git show 7378fe3:assets/audio/meditation/ocean.m4a > ocean.m4a` (likewise rain, storm).
The text below is unchanged from when they shipped.

The three active environments in this directory are deterministic procedural DSP,
created for Ona without external recordings, models, royalties or attribution duties.
The acoustic bell bank and matching interval tracks live in ../bells-v2/ and have
separate CC0 source evidence. Choir remains the user-supplied recording outside both folders.

## Active collection

- Ocean: evolving water/surf/foam with asymmetric swells and jittered arrivals.
- Rain: steady bed with evolving fine patter and microtexture.
- Storm: rain beneath long, low, distant thunder rolls; no crash transients.

These are three-minute circular masters, not short clips restarted by JavaScript.
Ocean/Rain/Storm use 128 kbps stereo AAC-LC with priming metadata, 24 kHz, about 2.9 MB each.
Brown Noise (lossless FLAC, 9 MB) was removed at the owner's request on 2026-10-17; its generator
remains and the file is in Git history. analysis.json records hashes, signal measurements,
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
