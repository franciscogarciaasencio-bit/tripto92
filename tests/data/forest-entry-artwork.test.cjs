const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { assert, data } = require('./helpers.cjs');
const art = require('../../src/ui/forest-entry-artwork.json');
const { forestEntryMetadata, forestEntryStageComposition } = data('../ui/forest-geometry.js');
/** Width and height of a lossy WebP (RIFF 'VP8 ' frame header). */
function webpSize(bytes) {
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert.equal(bytes.subarray(8, 16).toString(), 'WEBPVP8 ');
  assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
}

test('Dedicated entry artwork has six unique offline stages and preserves the original reference', () => {
  const hashes = new Set();
  for (let stage = 0; stage <= 5; stage++) {
    const metadata = forestEntryMetadata(`coast_${stage}`);
    const bytes = readFileSync(path.join(__dirname, '../../assets/ona/forest', metadata.file));
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, metadata.sha256);
    assert.deepEqual(webpSize(bytes), { width: metadata.width, height: metadata.height });
    assert.match(metadata.sourceSha256, /^[0-9a-f]{64}$/); // the generated PNG, kept in Git history
    assert.equal(metadata.growthStage, stage);
    hashes.add(hash);
  }
  assert.equal(hashes.size, 6);
  assert.equal(createHash('sha256').update(readFileSync(path.join(__dirname,
    '../../assets/ona/forest', art.reference))).digest('hex'), art.referenceSha256);
  assert.throws(() => forestEntryMetadata('entry'), RangeError);
  assert.throws(() => forestEntryMetadata('constructor'), RangeError);
  assert.throws(() => forestEntryMetadata('coast_6'), RangeError);
});

test('Entry scenes cover phone viewports uniformly while retaining clear upper heading space', () => {
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024]]) {
    let previous;
    for (let stage = 0; stage <= 5; stage++) {
      const id = `coast_${stage}`, source = forestEntryMetadata(id);
      const pose = forestEntryStageComposition(id, width, height);
      assert.ok(pose.left <= 0 && pose.top <= 0);
      assert.ok(pose.left + pose.width >= width - 1e-8);
      assert.ok(pose.top + pose.height >= height - 1e-8);
      assert.ok(Math.abs(pose.width / pose.height - source.width / source.height) < 1e-8);
      assert.ok(Math.abs(pose.left + pose.width / 2 - width / 2) < 1e-8);
      assert.equal(pose.top, 0); // Short phones crop the lower stream, never the title's sky.
      if (previous) assert.deepEqual(pose, previous); // Growing foliage never shifts the stream.
      previous = pose;
    }
  }
  assert.ok(forestEntryStageComposition('coast_5', 320, 568).height > 568);
  for (const bad of [0, -1, NaN, Infinity]) {
    assert.throws(() => forestEntryStageComposition('coast_0', bad, 844), RangeError);
    assert.throws(() => forestEntryStageComposition('coast_0', 390, bad), RangeError);
  }
});
