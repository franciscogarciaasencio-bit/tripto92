// Ona watercolour painter. A scene is a CommonJS module exporting `(brush) => svgString` in a
// 1024 × 1024 space; the brush helpers below build opaque washes with soft inner light and shade,
// gentle mottling, pooled rims, wobbly edges and paper grain, matching the Monkey Mind painting.
// Chromium renders onto transparency at 1024 px; Lanczos downsampling gives the 384 px stage art.
//
//   node scripts/watercolor/paint.cjs scene.cjs out.png [--size 384]
//
// Keep subjects inside about 60–964 (the monkey's margin) with similar visual weight. See STYLE.md.
const path = require('node:path');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
// Development-only: Playwright (playwright-core) and a Chromium binary. Override with ONA_PLAYWRIGHT
// (module path) and ONA_CHROMIUM (executable) on other machines.
const { chromium } = (() => {
  try { return require(process.env.ONA_PLAYWRIGHT ?? 'playwright-core'); }
  catch { return require('/tmp/claude-0/pw/node_modules/playwright-core'); }
})();
const CHROMIUM = process.env.ONA_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Monkey Mind palette (k-means of the reference) plus muted companions for leaves, water and sky. */
const PALETTE = {
  umber: '#4f3817', bark: '#694d1c', olive: '#8a6b31', ochre: '#a08043', fawn: '#b8975a', tan: '#d8b57c',
  sand: '#eed09c', cream: '#f6deb2', paper: '#fae8c4', blush: '#e8a98c',
  moss: '#727638', leaf: '#949952', sage: '#adaf78', mint: '#cfcc9c',
  deep: '#5f7f80', water: '#87a5a3', mist: '#b9cbc4', foam: '#e3e8dc',
  stone: '#9b9384', pebble: '#c3b9a6', dusk: '#c99b86', sun: '#efc77f',
};

function texture(id, seed, { warp = 9, mottle = 0.27, mottleFrequency = 0.008, middle = 0.11, grain = 0.07, grainFrequency = 0.1, rim = 0.55, rimWidth = 6 } = {}) {
  return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="2" seed="${seed}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="${warp}" xChannelSelector="R" yChannelSelector="B" result="shape"/>
    <feGaussianBlur in="shape" stdDeviation="0.9" result="soft"/>
    <feTurbulence type="fractalNoise" baseFrequency="${mottleFrequency}" numOctaves="3" seed="${seed + 3}" result="m"/>
    <feColorMatrix in="m" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="mottle"/>
    <feComposite in="soft" in2="mottle" operator="arithmetic" k1="${mottle * 2}" k2="${1 - mottle}" k3="0" k4="0" result="mottledLarge"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="${seed + 11}" result="mid"/>
    <feColorMatrix in="mid" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="middle"/>
    <feComposite in="mottledLarge" in2="middle" operator="arithmetic" k1="${middle * 2}" k2="${1 - middle}" k3="0" k4="0" result="mottled"/>
    <feTurbulence type="fractalNoise" baseFrequency="${grainFrequency}" numOctaves="4" seed="${seed + 5}" result="g"/>
    <feColorMatrix in="g" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="grain"/>
    <feComposite in="mottled" in2="grain" operator="arithmetic" k1="${grain * 2}" k2="${1 - grain}" k3="0" k4="0" result="textured"/>
    <feComposite in="textured" in2="soft" operator="in" result="body"/>
    <feMorphology in="soft" operator="erode" radius="${rimWidth}" result="inner"/>
    <feGaussianBlur in="inner" stdDeviation="${rimWidth * 1.4}" result="innerSoft"/>
    <feComposite in="body" in2="innerSoft" operator="out" result="rim"/>
    <feColorMatrix in="rim" type="matrix" values="0.74 0 0 0 0  0 0.7 0 0 0  0 0 0.66 0 0  0 0 0 ${rim} 0" result="rimDark"/>
    <feMerge><feMergeNode in="body"/><feMergeNode in="rimDark"/></feMerge>
  </filter>`;
}

const LIBRARY = `<defs>
  ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => texture(`wash${n}`, n * 13)).join('\n')}
  ${[1, 2, 3, 4].map((n) => texture(`fur${n}`, n * 19, { warp: 13, grain: 0.15, grainFrequency: 0.14, mottle: 0.28, middle: 0.14 })).join('\n')}
  ${[1, 2, 3].map((n) => texture(`still${n}`, n * 29, { warp: 6, grain: 0.04, mottle: 0.22, mottleFrequency: 0.007, middle: 0.08, rim: 0.5 })).join('\n')}
  <filter id="shade" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>
  <filter id="shadeWide" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="line" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="shape"/>
    <feGaussianBlur in="shape" stdDeviation="0.9"/>
  </filter>
  <filter id="paper" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="g"/>
    <feColorMatrix in="g" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="grain"/>
    <feComposite in="SourceGraphic" in2="grain" operator="arithmetic" k1="0.14" k2="0.93" k3="0" k4="0" result="textured"/>
    <feComposite in="textured" in2="SourceGraphic" operator="in"/>
  </filter>
</defs>`;

function createBrush() {
  let count = 0;
  const shapeOf = (shape) => typeof shape === 'string' ? (shape.trim().startsWith('<') ? shape : `<path d="${shape}"/>`)
    : `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry ?? shape.rx}"${shape.rotate ? ` transform="rotate(${shape.rotate} ${shape.cx} ${shape.cy})"` : ''}/>`;
  const filled = (shape, attributes) => shapeOf(shape).replace(/^<(\w+)/, `<$1 ${attributes}`);
  return {
    PALETTE,
    /**
     * One painted form: an opaque base wash clipped to `shape`, with soft light and shade painted
     * wet-in-wet inside it. `shades`: [{ shape, color, opacity = 0.7, wide = false }].
     */
    form(shape, fill, { shades = [], texture = 'wash1', opacity = 1 } = {}) {
      const id = `form${++count}`;
      const inner = shades.map(({ shape: s, color, opacity: o = 0.7, wide = false }) =>
        filled(s, `fill="${color}" opacity="${o}" filter="url(#${wide ? 'shadeWide' : 'shade'})"`)).join('');
      return `<defs><clipPath id="${id}">${shapeOf(shape)}</clipPath></defs>
        <g filter="url(#${texture})" opacity="${opacity}"><g clip-path="url(#${id})">${filled(shape, `fill="${fill}"`)}${inner}</g></g>`;
    },
    /** A painted detail line (eyes, veins, roots, ripples): slightly irregular, softly blurred. */
    stroke(d, color = PALETTE.bark, width = 9, opacity = 0.9) {
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" filter="url(#line)"/>`;
    },
    /** A soft wet bloom (blush, light, mist). */
    bloom(shape, color, opacity = 0.5) { return filled(shape, `fill="${color}" opacity="${opacity}" filter="url(#glow)"`); },
    /** Wrap the whole scene so it shares one paper grain. */
    paper(content) { return `<g filter="url(#paper)">${content}</g>`; },
  };
}

async function paint(scene, output, size = 384) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <svg id="art" xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${LIBRARY}${scene}</svg></body></html>`;
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent(html);
  const work = mkdtempSync(path.join(tmpdir(), 'ona-paint-'));
  const large = path.join(work, 'large.png');
  await page.locator('#art').screenshot({ path: large, omitBackground: true });
  await browser.close();
  execFileSync('python3', ['-c', `
from PIL import Image
Image.open(${JSON.stringify(large)}).convert('RGBA').resize((${size}, ${size}), Image.LANCZOS).save(${JSON.stringify(output)}, optimize=True)`]);
  rmSync(work, { recursive: true, force: true });
}

if (require.main === module) {
  const [scenePath, output, ...rest] = process.argv.slice(2);
  const sizeIndex = rest.indexOf('--size');
  const scene = require(path.resolve(scenePath));
  paint(scene(createBrush()), output, sizeIndex >= 0 ? Number(rest[sizeIndex + 1]) : 384)
    .catch((error) => { console.error(error); process.exit(1); });
}
module.exports = { paint, createBrush, PALETTE, LIBRARY };
