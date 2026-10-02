const { test } = require('node:test');
const { assert } = require('./helpers.cjs');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
test('Editable wordmark SVG retains the same vector coordinates as the native rendering', () => {
  const directory = join(__dirname, '../../assets/ona');
  const native = JSON.parse(readFileSync(join(directory, 'wordmark.json'), 'utf8'));
  const svg = readFileSync(join(directory, 'wordmark.svg'), 'utf8');
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(paths, native.paths);
  assert.ok(svg.includes('viewBox="' + native.viewBox + '"'));
  assert.ok(svg.includes('stroke-width="' + native.strokeWidth + '"'));
});
