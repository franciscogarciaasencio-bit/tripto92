# Ona stage paintings — style guide

Every journey stage has one small watercolour painting, shown at 46 pt (Home), 84 pt (new-stage
reveal) and 112 pt (Journey). The reference is the owner's Monkey Mind painting
(`monkey-mind-source.png`, cut out by `cutout.py` into `assets/ona/stages/monkey_mind.png`).

## Look
- Soft watercolour "sticker" illustration on transparency: no outlines, no background, no text.
- Rounded, simple, friendly forms with gentle volume: light from the upper left, deeper pigment
  low and right, wet-in-wet transitions inside each form, slightly darker pooled edges.
- Characters (if any) share the monkey's face language: thick soft closed-eye arcs, a small calm
  smile or beak, faint blush. Calm, content, never silly, never mystical or religious.
- One clear subject that reads at 46 pt. Fill the square like the monkey: subject inside roughly
  60–964 of the 1024 canvas, similar visual weight; a shadow/ground shape is welcome.

## Palette (PALETTE in paint.cjs)
Monkey pigments first (ochre, olive, fawn, tan, creams, bark, umber, blush), then muted companions:
leaf/moss/sage/mint greens leaning warm, deep/water/mist/foam sea tones as on the Home coast,
stone/pebble, dusk, sun. Avoid saturated or cold colours and pure black/white. Cream subjects need a
darker partner: the app background is sand (#F2E9DA).

## Technique (paint.cjs)
`form(shape, fill, { shades, texture })` paints an opaque wash with soft inner shades (blurred
blobs clipped to the shape); textures: `wash1–8` (general), `fur1–4` (dry-brush, fur/foliage),
`still1–3` (smooth: ceramics, water, sky). `stroke()` for painted detail lines, `bloom()` for blush
and glows, everything wrapped in `paper()`. Render: `node scripts/watercolor/paint.cjs scene.cjs
out.png` (384 px RGBA). Review with `python3 scripts/watercolor/sheet.py sheet.png a.png …` (monkey
first, 260/112/46 px on sand) and at full size; iterate until shapes, faces and contrast are clean.

## Sealed stages
Scenes and paintings for sealed stages are never committed in readable form. Keep their scene
files and renders only under `.sealed/` (gitignored) and seal the PNG with
`scripts/sealed-categories.cjs` (stored XOR-veiled; scenes are stored veiled too).
