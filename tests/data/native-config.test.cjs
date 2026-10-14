const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const theme = JSON.parse(fs.readFileSync(path.join(root, 'src/ui/theme.json'), 'utf8'));
function configuration(input = base) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const sandbox = { exports: {}, require(name) {
    if (name === './app.json') return input;
    if (name === './src/ui/theme.json') return theme;
    throw new Error(`Unexpected config import: ${name}`);
  } };
  vm.runInNewContext(code, sandbox, { timeout: 1000 });
  return JSON.parse(JSON.stringify(sandbox.exports.default));
}

test('Dynamic native config preserves approved identity, version and EAS project', () => {
  const actual = configuration();
  assert.equal(actual.android.package, base.expo.android.package);
  assert.equal(actual.android.versionCode, base.expo.android.versionCode);
  assert.deepEqual(actual.extra.eas, base.expo.extra.eas);
  assert.equal(actual.owner, base.expo.owner);
});

test('Splash image/options survive theme application instead of leaving a missing Android drawable', () => {
  const input = structuredClone(base);
  const splash = input.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  splash[1].imageWidth = 173;
  splash[1].ios = { resizeMode: 'contain' };
  const actual = configuration(input).plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  assert.deepEqual(actual[1], { ...splash[1], backgroundColor: theme.background });
  assert.ok(actual[1].android.image);
  assert.ok(fs.existsSync(path.resolve(root, actual[1].android.image)));
});

test('Android launch resource is transparent, retaining the existing blank warm launch canvas', () => {
  const splash = configuration().plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  const png = fs.readFileSync(path.resolve(root, splash[1].android.image));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1);
  assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6, 'RGBA');
  const chunks = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += 12 + size;
  }
  assert.deepEqual([...zlib.inflateSync(Buffer.concat(chunks))], [0, 0, 0, 0, 0]);
  assert.equal(splash[1].backgroundColor, theme.background);
});

test('Unrelated audio/Router/SQLite plugins retain their configuration', () => {
  const actual = configuration();
  const unrelated = plugins => plugins.filter(plugin => !Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen');
  assert.deepEqual(unrelated(actual.plugins), unrelated(base.expo.plugins));
  assert.equal(actual.backgroundColor, theme.background);
});
