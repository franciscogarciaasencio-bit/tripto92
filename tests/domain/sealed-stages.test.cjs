const { test } = require('node:test');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { assert } = require('./helpers.cjs');

const root = path.resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', '.git', '.expo', 'dist', '.sealed', 'artifacts', 'android', 'ios']);
const TEXT = /\.(ts|tsx|js|cjs|mjs|json|md|txt|svg|py|html|css)$/;
const SEALED_FILES = new Set(['assets/ona/categories-sealed.json', 'src/ui/category-sealed.json']);

function* files(directory) {
  for (const name of readdirSync(directory)) {
    if (SKIP.has(name)) continue;
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (TEXT.test(name) && statSync(full).size < 3_000_000) yield full;
  }
}

// Failure messages name only the stage ID and file: a failing test must not spoil the surprise either.
test('Sealed stage names and themes never appear in plain text anywhere in the repository', () => {
  const stages = JSON.parse(readFileSync(path.join(root, 'assets/ona/categories-sealed.json'), 'utf8'))
    .map(({ id, data }) => ({ id, ...JSON.parse(Buffer.from(data, 'base64').toString('utf8')) }));
  const leaks = [];
  for (const file of files(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (SEALED_FILES.has(relative)) continue;
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const stage of stages) {
      if (text.includes(stage.name.toLowerCase())) leaks.push(`${stage.id} name in ${relative}`);
      if (text.includes(stage.theme.toLowerCase())) leaks.push(`${stage.id} theme in ${relative}`);
    }
  }
  assert.equal(leaks.length, 0, `Sealed text found in plain files (contents withheld): ${leaks.join('; ')}`);
});
