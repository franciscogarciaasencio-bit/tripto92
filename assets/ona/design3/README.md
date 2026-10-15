# Design 3 artwork

User-supplied sources from `Images Ona Desgin 3`:

Current artwork: `coastal-background.webp`, the user-supplied `OneDrive/Desktop/Ona/Forest 2/1.png`
(853 × 1844; original PNG SHA-256 `8b4c197da02529904fbc800c62c1d99f0a3828184029c7a5646fb0e89bfe8fc9`)
encoded as quality-95 WebP on 2026-10-15 to shrink the app (1.6 MB → 80 KB; same dimensions and
landmarks, no tint or crop). The original PNG is in Git history, for example
`git show 6f62785:assets/ona/design3/coastal-background.png`.
Its halo, shoreline and trees are stationary. The previous `forest-background.png`
(941 × 1672) remains a design source, unreferenced by the app. The original sources below remain
design references; Home no longer loads their background.

- `background.png`: unchanged `ona-home-background-no-wave(1).png` (932 × 1688).
- `wave-overlay.png`: unchanged `ona-wave-overlay(1).png`, retained as the editable
  contour/colour source. It is not flattened into the background or duplicated at runtime.
- `wave-trace.json`: alpha-weighted centreline samples every 12 source pixels from
  each of the two overlay curves, including both edges. Native SVG joins the samples
  with Catmull–Rom cubic curves so Reanimated can deform the actual geometry.

The layout master is `Concept 3 - final design(1).png`, not the composed preview.
It is not bundled as an interface. coastal-composition.ts scales the replacement
uniformly to the canvas width and positions its source landmarks above the wave.
Small screens/large type scroll the composition. Bottom texture crops fill the surface
without stretching the circular halo. The forest artwork has no tint overlay.
The animated black stroke is slightly thicker than the supplied layer to match
the master. `src/ui/ocean-wave.tsx` renders the separate band on Home and meditation;
`ocean-motion.tsx` shares its phase and `ocean-geometry.ts` defines the shared
12-second cycle. Its 45.76/37.18 source-unit amplitudes are 10% above the preceding
41.6/33.8 swell. The user's explicit accessibility preference keeps small motion
with Reduce Motion on as well as off.

The motion video was not available; the user authorized animation without it.
