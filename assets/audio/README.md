# Meditation Choir provenance

Meditation Choir by zazz.sound.design was supplied by the user under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/): no licensing fees,
royalties, permission or mandatory attribution, including commercial use.

- Supplied original: PCM WAV, stereo, 24-bit, 48 kHz; 76.502458 seconds; 22,032,752 bytes;
  SHA-256 b974de6aa17ae128b89a53dcc1619c7f0debcf17a5f81993c91d76a3a7227a85. It was bundled
  unchanged until 2026-10-15 and remains retrievable from Git history (for example
  `git show 6f62785:assets/audio/meditation-choir.wav > meditation-choir.wav`).
- Shipped since 2026-10-15 (owner request to reduce app size): meditation-choir.m4a, AAC-LC
  192 kbps, stereo, 48 kHz, 1,843,668 bytes, SHA-256
  f218aaef83de9ff948577198cac0e1c9a66cb64c3408ef8ee0c29a168ecff1cf. Made with FFmpeg 6.1.1:
  `ffmpeg -i meditation-choir.wav -c:a aac -b:a 192k -ar 48000 -movflags +faststart meditation-choir.m4a`.
  Decoded against the original: correlation 0.99994, 39 dB SNR, no gain change. The recording fades
  in from and out to silence, so the encoder's few milliseconds of padding cannot click at the loop.
- Home uses Choir; saved ocean_music meditation choices still select it.

Original ambience lives in meditation/; acoustic CC0 bells and matching interval tracks
live in bells-v2/. See their READMEs and docs/AUDIO.md for reproduction/provenance.
The retired original progression swell's source remains in
scripts/generate-progression-cue.py, generating an ignored development master only.
