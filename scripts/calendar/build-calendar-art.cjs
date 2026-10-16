// Calendar day marks, painted like ink and wash on paper (scripts/watercolor/paint.cjs renders them).
//
//   node scripts/calendar/build-calendar-art.cjs     (writes assets/ona/calendar/*.webp)
//
// A single counted day is a round drop of near-black ink; consecutive counted days are one pale warm
// grey wash whose drops flow into each other through soft necks (a "metaball" made by blurring the
// drops and sharpening the result's alpha). Sprites are cut to whole columns (146 px per column, sharp at
// 3x on a ~49 pt column) and one column tall, so the app never stretches them. Owner reference:
// docs/evidence/calendar-reference.png. The closing vignette (vignette.webp) is the owner's own painting.
const path = require('node:path');
const { mkdtempSync, rmSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const { paint } = require('../watercolor/paint.cjs');

const NECK = Number(process.env.NECK || 18), NECK_RATIO = Number(process.env.RATIO || 0.58);
const OUT = path.join(__dirname, '../../assets/ona/calendar');
const C = 1024 / 7, Y = 512, R = C * Number(process.env.INK || 0.37), RUN_R = C * Number(process.env.RUN || 0.39);

/** Ink: slightly irregular edge, a little feathering, faint lighter pools and a fine grain. */
function inkFilter(id, seed) {
  return `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="${seed}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="shape"/>
    <feGaussianBlur in="shape" stdDeviation="0.8" result="soft"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="3" seed="${seed + 7}" result="pools"/>
    <feColorMatrix in="pools" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.61  0 0 0 0 0.58  2.2 0 0 0 -0.95" result="light"/>
    <feComposite in="light" in2="soft" operator="in" result="lightIn"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="${seed + 3}" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0 0.88  0.9 0 0 0 -0.42" result="grain"/>
    <feComposite in="grain" in2="soft" operator="in" result="grainIn"/>
    <feComponentTransfer in="lightIn" result="lightSoft"><feFuncA type="linear" slope="0.28"/></feComponentTransfer>
    <feComponentTransfer in="grainIn" result="grainSoft"><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
    <feMerge><feMergeNode in="soft"/><feMergeNode in="lightSoft"/><feMergeNode in="grainSoft"/></feMerge>
  </filter>`;
}

/** Wash: soft edge, mottled pigment (darker blooms), a faintly pooled rim. */
function washFilter(id, seed) {
  return `<filter id="${id}" x="-15%" y="-40%" width="130%" height="180%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="${seed}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" result="shape"/>
    <feGaussianBlur in="shape" stdDeviation="0.9" result="soft"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="4" seed="${seed + 5}" result="m"/>
    <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.52  0 0 0 0 0.47  1.7 0 0 0 -0.78" result="blooms"/>
    <feComposite in="blooms" in2="soft" operator="in" result="bloomsIn"/>
    <feComponentTransfer in="bloomsIn" result="bloomsSoft"><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
    <feMorphology in="soft" operator="erode" radius="4" result="inner"/>
    <feGaussianBlur in="inner" stdDeviation="5" result="innerSoft"/>
    <feComposite in="soft" in2="innerSoft" operator="out" result="rim"/>
    <feColorMatrix in="rim" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.59  0 0 0 0 0.54  0 0 0 0.16 0" result="rimDark"/>
    <feMerge><feMergeNode in="soft"/><feMergeNode in="bloomsSoft"/><feMergeNode in="rimDark"/></feMerge>
  </filter>`;
}

/** Drops at each day centre, melted together into one shape with necks between days. */
function gooMask(id, n, neck) {
  const drops = Array.from({ length: n }, (_, i) => `<circle cx="${C * (i + 0.5)}" cy="${Y}" r="${RUN_R}" fill="#fff"/>`).join('')
    // A bridge between neighbouring drops sets the neck (about 60 % of a drop's height); the blur and
    // re-sharpened alpha below round its corners into soft concave fillets, like wet paint meeting.
    + Array.from({ length: n - 1 }, (_, i) => `<rect x="${C * (i + 0.5)}" y="${Y - RUN_R * NECK_RATIO}" width="${C}" height="${2 * RUN_R * NECK_RATIO}" fill="#fff"/>`).join('');
  return `<filter id="${id}-goo" x="-20%" y="-60%" width="140%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${neck}" result="b"/>
      <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/>
    </filter>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><g filter="url(#${id}-goo)">${drops}</g></mask>`;
}

/** Near-black ink; indigo ink marks a day practised twice (two practices six hours apart). */
const INK_TONES = { black: ['#2b2a27', '#1a1917', '#121210'], indigo: ['#34405c', '#232e48', '#19223a'] };

function inkDay(variant, tone = 'black') {
  const seed = 11 + variant * 17;
  const lightAt = [[0.36, 0.34], [0.6, 0.4], [0.45, 0.62]][variant % 3];
  const [a, b, c] = INK_TONES[tone];
  return `<defs>${inkFilter('ink', seed)}
      <radialGradient id="depth" cx="${lightAt[0]}" cy="${lightAt[1]}" r="0.75">
        <stop offset="0" stop-color="${a}"/><stop offset="0.7" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>
    <g filter="url(#ink)"><circle cx="${C / 2}" cy="${Y}" r="${R * (variant === 2 ? 0.99 : 1)}" fill="url(#depth)"/></g>`;
}

function washRun(n) {
  const seed = 5 + n * 13, width = n * C;
  const necks = Array.from({ length: n - 1 }, (_, i) =>
    `<ellipse cx="${C * (i + 1)}" cy="${Y}" rx="${C * 0.3}" ry="${RUN_R * 0.62}" fill="#b9b1a4" opacity="0.3" filter="url(#neckBlur)"/>`).join('');
  return `<defs>${washFilter('wash', seed)}${gooMask('run', n, NECK)}
      <filter id="neckBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
      <linearGradient id="tone" x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stop-color="#e4ddd0"/><stop offset="0.5" stop-color="#ded7ca"/><stop offset="1" stop-color="#e2dbce"/></linearGradient></defs>
    <g filter="url(#wash)"><g mask="url(#run)">
      <rect x="0" y="${Y - C}" width="${width}" height="${2 * C}" fill="url(#tone)"/>${necks}
    </g></g>`;
}

/** One indigo-washed drop, the size of a run's drop: laid over a day of a run practised twice. */
function indigoBead() {
  return `<defs>${washFilter('wash', 41)}
      <radialGradient id="tone" cx="0.42" cy="0.4" r="0.7">
        <stop offset="0" stop-color="#ccd3de"/><stop offset="0.75" stop-color="#c3cbd8"/><stop offset="1" stop-color="#bac3d2"/></radialGradient></defs>
    <g filter="url(#wash)"><circle cx="${C / 2}" cy="${Y}" r="${RUN_R}" fill="url(#tone)"/></g>`;
}

async function render(scene, name, crop) {
  const work = mkdtempSync(path.join(tmpdir(), 'ona-calendar-'));
  const png = path.join(work, 'full.png');
  await paint(scene, png, 1024);
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGBA').crop(tuple(round(v) for v in ${JSON.stringify(crop)}))
im.save(${JSON.stringify(path.join(OUT, name))}, 'WEBP', quality=92, method=6)`]);
  rmSync(work, { recursive: true, force: true });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  // ONLY=indigo paints just the twice-a-day marks (added 2026-10-16) and leaves the others untouched.
  const only = process.env.ONLY;
  if (only !== 'indigo') {
    for (let v = 0; v < 3; v++) await render(inkDay(v), `ink-${v + 1}.webp`, [0, Y - C / 2, C, Y + C / 2]);
    for (let n = 2; n <= 7; n++) await render(washRun(n), `wash-${n}.webp`, [0, Y - C / 2, n * C, Y + C / 2]);
  }
  for (let v = 0; v < 3; v++) await render(inkDay(v, 'indigo'), `indigo-${v + 1}.webp`, [0, Y - C / 2, C, Y + C / 2]);
  await render(indigoBead(), 'indigo-bead.webp', [0, Y - C / 2, C, Y + C / 2]);
}
main().catch((error) => { console.error(error); process.exit(1); });
