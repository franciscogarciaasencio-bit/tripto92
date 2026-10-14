# Original Ona forest artwork

User-supplied `Forest 2/0.png`–`5.png` and `Forest entry.png`, copied byte-for-byte.
Stage 1 reuses `../design3/coastal-background.png`; no duplicate is bundled. Dimensions,
SHA-256 and source names: src/ui/forest-artwork.json. No supplied original is edited,
tinted or recompressed; generated entry scenes below are separate assets.

0 is the sparse starting coast; 1–5 are five richer stages. Growth policy/thresholds live
in src/domain/forest/growth.ts and default to permanent highest level. Static Metro
sources live in src/ui/forest-assets.ts; alignment/crops in forest-geometry.ts.
Each source keeps its original aspect ratio; captured halo landmarks stabilize transitions.

## Dedicated Forest entry scenes

`entry-0.png`–`entry-5.png` are original imagegen edits derived from the supplied
`forest-entry.png`. They keep the reference's stream, stepping stones, sea opening,
warm paper and olive watercolor identity, with progressively richer near-bank trees.
Stage zero contains only two small saplings; mature stage five closely follows the
reference framing. There is no baked text, back arrow or page indicator in these assets.
All controls remain native. The original reference and coastal images remain unchanged.

Native `ForestScreen` uses these six dedicated views, not an enlarged coastal crop.
`forestEntrySource` bundles them offline and `forestEntryStageComposition` applies one
uniform horizontal center / vertical top crop at every growth stage. This preserves
the upper title space on shorter phones instead of shifting trees behind headings.
No per-frame image transforms or decode loop
are used; expo-image handles stage crossfades and downsampling. Home/meditation still use
the untouched coastal series. Retired coast-zoom/reference-crop rendering helpers were
removed; there is one active Forest composition path.

SHA-256, dimensions and stage mapping: `src/ui/forest-entry-artwork.json`.
Generation method, exact prompts and edit inputs: `entry-generation.json`. Built-in
imagegen created the lossless 853×1844 PNGs on 2026-10-12; no external stock assets,
subscriptions or licensing services were introduced. Source assets are retained at
their original resolution for later refinements.
