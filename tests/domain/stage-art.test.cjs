const { test } = require('node:test');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { assert, api } = require('./helpers.cjs');

const root = path.resolve(__dirname, '../..');
const stages = path.join(root, 'assets/ona/stages');
const collection = JSON.parse(readFileSync(path.join(root, 'assets/ona/categories.json'), 'utf8'));
const png = (bytes) => ({ signature: bytes.subarray(1, 4).toString(), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25] });

test('Every visible stage has a 384 px RGBA watercolour painting wired into the app', () => {
  const wiring = readFileSync(path.join(root, 'src/ui/stage-art.ts'), 'utf8');
  for (const entry of collection.filter((stage) => !stage.sealed)) {
    const file = path.join(stages, `${entry.id}.png`);
    assert.ok(existsSync(file), `${entry.id} painting exists`);
    assert.deepEqual(png(readFileSync(file)), { signature: 'PNG', width: 384, height: 384, colourType: 6 });
    assert.ok(readFileSync(file).length < 400_000);
    assert.match(wiring, new RegExp(`${entry.id}: require\\('\\.\\./\\.\\./assets/ona/stages/${entry.id}\\.png'\\)`));
  }
});

test('Sealed stages never exist as viewable painting files', () => {
  const sealed = new Set(collection.filter((stage) => stage.sealed).map((stage) => stage.id));
  for (const name of readdirSync(stages)) assert.ok(!sealed.has(name.replace(/\.png$/, '')), 'no sealed painting file');
  assert.equal(collection.length, api.JOURNEY_CATEGORIES.length);
});

test('Every sealed stage carries a veiled painting and its veiled scene source', () => {
  const sealed = JSON.parse(readFileSync(path.join(root, 'assets/ona/categories-sealed.json'), 'utf8'));
  assert.equal(sealed.length, collection.filter((stage) => stage.sealed).length);
  for (const entry of sealed) {
    assert.ok(typeof entry.art === 'string' && entry.art.length > 1000, `${entry.id} has a painting`);
    assert.ok(typeof entry.scene === 'string' && entry.scene.length > 100, `${entry.id} keeps its scene source`);
    assert.notEqual(Buffer.from(entry.art, 'base64').subarray(1, 4).toString(), 'PNG', `${entry.id} painting is veiled`);
  }
});
