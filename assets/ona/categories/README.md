# Ona category artwork

These 25 original paths were authored for Ona, without external icon packs, licensed
illustrations or raster tracing. Quiet organic curves, rounded ends and a 1.35-unit
stroke share one 24 × 24 view box. The symbols describe returning and continuity,
not skill, scientific benefits or achievements requiring a different earning system.

`../categories.json` is the editable source: stable ID, current display name, short
theme and geometry. `src/ui/category-presentation.ts` resolves these names by stable
ID; stored domain category definitions and historical achievements remain unchanged.
Level 0 retains Monkey Mind with its separate starting symbol (`preludePaths`);
numbered Levels 1–5 are Early Steps. Category 20 includes Level 100, Habit Established.

Run `node assets/ona/categories/export.cjs` after editing paths or captions. It exports
the SVGs and the generated local `src/ui/category-artwork.json` runtime mirror. This
mirror lets isolated Node TypeScript builds load the same source as Metro. The SVG
files and native `CategoryIcon` use the exact same paths. Parity/coverage tests live
in `tests/domain/category-icons.test.cjs`; presentation tests are in `tests/data/`.
No runtime SVG file loading, extra font, dependency or network access is required.
