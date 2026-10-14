const { test } = require('node:test');
const { assert, data } = require('./helpers.cjs');
const { COASTAL_ARTWORK, coastalComposition } = data('../ui/coastal-composition.js');

test('Source landmarks match the actual unchanged PNG dimensions, with texture below the shoreline', () => {
  const png = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../assets/ona/design3/coastal-background.png'));
  assert.equal(png.readUInt32BE(16), COASTAL_ARTWORK.width);
  assert.equal(png.readUInt32BE(20), COASTAL_ARTWORK.height);
  assert.ok(COASTAL_ARTWORK.paperTop > COASTAL_ARTWORK.shorelineBottom && COASTAL_ARTWORK.paperTop < COASTAL_ARTWORK.height);
});

test('New artwork remains uniformly scaled, full width, with the shoreline and wave in separate bands', () => {
  for (const [width, height, fontScale, bottom] of [[320, 568, 1, 0], [375, 667, 1, 0], [390, 844, 1, 34], [430, 932, 1, 34], [390, 844, 2, 34], [768, 1024, 1, 20]]) {
    const c = coastalComposition(width, height, fontScale, bottom);
    assert.equal(c.artWidth, c.canvasWidth);
    assert.ok(Math.abs(c.artWidth / c.artHeight - COASTAL_ARTWORK.width / COASTAL_ARTWORK.height) < 1e-10);
    assert.ok(c.artTop + COASTAL_ARTWORK.shorelineBottom * c.artWidth / COASTAL_ARTWORK.width < c.waveTop);
    assert.ok(c.waveTop + c.waveHeight < c.progressionTop);
    assert.ok(c.haloCenterY > 0 && c.sunTop + c.sunDiameter < c.waveTop);
  }
});
