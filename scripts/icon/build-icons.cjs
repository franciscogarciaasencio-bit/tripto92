// Ona's app icon: a soft watercolour sun resting on the signature two-line wave, on sand.
// Renders every launcher/web asset from one scene with the stage painter (scripts/watercolor):
//
//   node scripts/icon/build-icons.cjs            (writes assets/images/*.png)
//
// iOS/Expo icon 1024 (opaque), Android adaptive foreground 512 (transparent; artwork inside the
// 66 % safe circle), background 512 (sand), monochrome 432 (alpha mask for themed icons), favicon 48.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { paint, createBrush } = require('../watercolor/paint.cjs');

const SAND = '#F2E9DA', INK = '#1C231B';
const out = (name) => path.join(__dirname, '../../assets/images', name);

/** The wave as it crosses the icon: one gentle S, like the Home wave. `k` scales it about the centre. */
function wavePath(k, dy = 0) {
  const y = (value) => 512 + (value - 512) * k + dy;
  return `M -60 ${y(640)} C ${512 - 380 * k} ${y(560)} ${512 - 220 * k} ${y(556)} ${512 - 40 * k} ${y(626)} S ${512 + 330 * k} ${y(736)} 1084 ${y(612)}`;
}
/** Everything above the wave (the sun sets behind it). */
function skyPath(k) {
  return `${wavePath(k)} L 1084 -60 L -60 -60 Z`;
}

function scene(brush, { k = 1, background = true, mono = false } = {}) {
  const { bloom, paper } = brush;
  const sun = { cx: 512, cy: 512 + (500 - 512) * k, r: 220 * k };
  const clip = `<defs><clipPath id="sky"><path d="${skyPath(k)}"/></clipPath>
    <radialGradient id="sun" cx="0.5" cy="0.46" r="0.62">
      <stop offset="0" stop-color="#F9E4BF"/><stop offset="0.75" stop-color="#F4D3A0"/><stop offset="1" stop-color="#EEC58A"/>
    </radialGradient></defs>`;
  if (mono) {
    return `${clip}<g clip-path="url(#sky)"><circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="#fff"/></g>
      <path d="${wavePath(k)}" fill="none" stroke="#fff" stroke-width="${30 * k}" stroke-linecap="round"/>
      <path d="${wavePath(k, 42 * k)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="${15 * k}" stroke-linecap="round"/>`;
  }
  // A soft halo, then a smooth warm disc: the Home sun, not a textured ball.
  const glow = bloom({ cx: sun.cx, cy: sun.cy, rx: sun.r * 1.45 }, '#F4D7A6', 0.55);
  const disc = `<circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="url(#sun)"/>`;
  const waves = `<path d="${wavePath(k)}" fill="none" stroke="${INK}" stroke-width="${24 * k}" stroke-linecap="round" filter="url(#line)"/>
    <path d="${wavePath(k, 42 * k)}" fill="none" stroke="${INK}" stroke-opacity="0.3" stroke-width="${11 * k}" stroke-linecap="round" filter="url(#line)"/>`;
  return `${background ? `<rect width="1024" height="1024" fill="${SAND}"/>` : ''}${clip}
    ${paper(`<g clip-path="url(#sky)">${glow}${disc}</g>`)}${waves}`;
}

async function main() {
  await paint(scene(createBrush(), { k: 1 }), out('icon.png'), 1024);
  await paint(scene(createBrush(), { k: 0.7, background: false }), out('android-icon-foreground.png'), 512);
  await paint(scene(createBrush(), { k: 0.7, mono: true }), out('android-icon-monochrome.png'), 432);
  execFileSync('python3', ['-c', `
from PIL import Image
Image.new('RGB', (512, 512), '${SAND}').save(${JSON.stringify(out('android-icon-background.png'))}, optimize=True)
icon = Image.open(${JSON.stringify(out('icon.png'))}).convert('RGB')
icon.save(${JSON.stringify(out('icon.png'))}, optimize=True)
icon.resize((48, 48), Image.LANCZOS).save(${JSON.stringify(out('favicon.png'))}, optimize=True)`]);
}
main().catch((error) => { console.error(error); process.exit(1); });
