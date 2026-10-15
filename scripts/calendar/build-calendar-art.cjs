// Painted calendar marks in Ona's watercolour (scripts/watercolor). The closing vignette,
// assets/ona/calendar/vignette.webp, is the owner's own ink painting (paper matched to #F2E9DA, edges faded).
//
//   node scripts/calendar/build-calendar-art.cjs     (writes assets/ona/calendar/*.webp)
//
// The calendar uses square cells, so every sprite is cut to whole cells: a run of n counted days is
// n cells wide and one cell tall; a block of k consecutive active weeks is seven cells wide and k tall.
// Days in a row are one deep warm grey shape (waisted between days like joined drops); consecutive
// consistent weeks are one lighter warm grey wash. Cut at 146 px per cell (sharp at 3x on a ~49 pt cell).
const path = require('node:path');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const { paint, createBrush } = require('../watercolor/paint.cjs');

const OUT = path.join(__dirname, '../../assets/ona/calendar');
const C = 1024 / 7;
let clips = 0;
/** Like brush.form, for a shape made of several elements (an SVG clipPath cannot hold a <g>). */
function multiForm(elements, fill, { texture, opacity = 1, shades = [] }) {
  const id = `cal${++clips}`;
  const shadeMarkup = shades.map(({ shape, color, opacity: o = 0.7, wide = false }) =>
    `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry ?? shape.rx}" fill="${color}" opacity="${o}" filter="url(#${wide ? 'shadeWide' : 'shade'})"/>`).join('');
  return `<defs><clipPath id="${id}">${elements}</clipPath></defs>
    <g filter="url(#${texture})" opacity="${opacity}"><g clip-path="url(#${id})"><rect x="-50" y="-50" width="1124" height="1124" fill="${fill}"/>${shadeMarkup}</g></g>`;
}
const DAY = { fill: '#4f4943', light: '#77706a', dark: '#36322e' };
const WEEK = { fill: '#dcd3c4', light: '#e9e2d6', deep: '#cfc5b4' };

function dayRun(brush, n, variant) {
  const r = C * 0.39, y = 512;
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(`<circle cx="${C * (i + 0.5)}" cy="${y}" r="${r}"/>`);
  // A slightly narrower waist between neighbouring days, so a run reads as joined drops.
  for (let i = 0; i < n - 1; i++) parts.push(`<ellipse cx="${C * (i + 1)}" cy="${y}" rx="${C * 0.5}" ry="${r * 0.8}"/>`);
  const width = n * C;
  return brush.paper(multiForm(parts.join(''), DAY.fill, { texture: `wash${1 + (variant % 8)}`, shades: [
    { shape: { cx: width * 0.3, cy: y - r * 0.45, rx: Math.max(r, width * 0.3), ry: r * 0.6 }, color: DAY.light, opacity: 0.55 },
    { shape: { cx: width * 0.72, cy: y + r * 0.55, rx: Math.max(r, width * 0.35), ry: r * 0.6 }, color: DAY.dark, opacity: 0.55 },
  ] }));
}

function weekBlock(brush, k) {
  const top = 512 - (k * C) / 2, inset = C * 0.06, rowHeight = C * 0.92;
  const parts = [];
  for (let i = 0; i < k; i++) parts.push(`<rect x="${inset}" y="${top + i * C + (C - rowHeight) / 2}" width="${1024 - 2 * inset}" height="${rowHeight}" rx="${rowHeight / 2}"/>`);
  // Consecutive consistent weeks join into one wash, a little narrower where two weeks meet.
  for (let i = 0; i < k - 1; i++) parts.push(`<rect x="${C * 0.16}" y="${top + (i + 1) * C - C * 0.3}" width="${1024 - C * 0.32}" height="${C * 0.6}"/>`);
  return brush.paper(multiForm(parts.join(''), WEEK.fill, { texture: `still${1 + (k % 3)}`, opacity: 0.8, shades: [
    { shape: { cx: 300, cy: top + C * 0.3, rx: 360, ry: Math.max(60, k * C * 0.35) }, color: WEEK.light, opacity: 0.6, wide: true },
    { shape: { cx: 760, cy: top + k * C - C * 0.25, rx: 380, ry: Math.max(50, k * C * 0.3) }, color: WEEK.deep, opacity: 0.35, wide: true },
  ] }));
}

async function render(scene, name, crop) {
  const work = mkdtempSync(path.join(tmpdir(), 'ona-calendar-'));
  const png = path.join(work, 'full.png');
  await paint(scene, png, 1024);
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGBA').crop(tuple(round(v) for v in ${JSON.stringify(crop)}))
im.save(${JSON.stringify(path.join(OUT, name))}, 'WEBP', quality=90, method=6)`]);
  rmSync(work, { recursive: true, force: true });
}

async function main() {
  require('node:fs').mkdirSync(OUT, { recursive: true });
  for (let n = 1; n <= 7; n++) await render(dayRun(createBrush(), n, n), `days-${n}.webp`, [0, 512 - C / 2, n * C, 512 + C / 2]);
  for (let k = 1; k <= 6; k++) await render(weekBlock(createBrush(), k), `weeks-${k}.webp`, [0, 512 - (k * C) / 2, 1024, 512 + (k * C) / 2]);
}
main().catch((error) => { console.error(error); process.exit(1); });
