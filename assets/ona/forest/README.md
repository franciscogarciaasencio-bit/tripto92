# Original Ona forest artwork

User-supplied `Forest 2/0.png`–`5.png` and `Forest entry.png`. The bundled stages are
quality-95 WebP encodes made on 2026-10-15 to shrink the app (about 1.6 MB → 70–100 KB each;
same dimensions, no tint, crop or retouching); `forest-entry.png` stays the original PNG as the
reference for the entry scenes and is not bundled. Stage 1 reuses `../design3/coastal-background.webp`.
src/ui/forest-artwork.json keeps each supplied PNG's SHA-256 (`sha256`) beside the shipped file and
its hash (`file`, `fileSha256`); the original PNGs are in Git history (for example
`git show 6f62785:assets/ona/forest/stage-2.png`).

0 is the sparse starting coast; 1–5 are five richer stages. Growth policy/thresholds live
in src/domain/forest/growth.ts and default to permanent highest level. Static Metro
sources live in src/ui/forest-assets.ts; alignment/crops in forest-geometry.ts.
Each source keeps its original aspect ratio; captured halo landmarks stabilize transitions.

## Dedicated Forest entry scenes

`entry-0.webp`–`entry-5.webp` (quality-95 WebP since 2026-10-15; the generated PNGs and their
hashes, `sourceSha256`, remain in Git history) are original imagegen edits derived from the supplied
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
subscriptions or licensing services were introduced. The shipped WebPs keep that resolution.
