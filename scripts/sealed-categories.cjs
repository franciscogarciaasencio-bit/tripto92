// Sealed journey stages: names, themes and icons the owner discovers only by reaching them.
// The committed form is base64 JSON (sealed, not secret: it only prevents accidental spoilers).
// This script never prints names, themes or geometry, only counts and validation results.
//
//   node scripts/sealed-categories.cjs unseal    -> .sealed/categories.json (+ art/*.png, scenes/*.cjs), gitignored
//   node scripts/sealed-categories.cjs seal      -> encode .sealed/categories.json into the repository
//   node scripts/sealed-categories.cjs check     -> validate the committed sealed data
//   node scripts/sealed-categories.cjs init <id…> -> move plaintext categories into sealed storage
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets/ona/categories.json');
const sealedPath = path.join(root, 'assets/ona/categories-sealed.json');
const runtimePath = path.join(root, 'src/ui/category-sealed.json');
const plainPath = path.join(root, '.sealed/categories.json');
const svgDirectory = path.join(root, 'assets/ona/categories');

const artDirectory = path.join(root, '.sealed/art');
const sceneDirectory = path.join(root, '.sealed/scenes');
const VEIL = Buffer.from('ona-stage-veil');
const veil = (bytes) => Buffer.from(bytes.map((value, index) => value ^ VEIL[index % VEIL.length]));
/** Watercolour stage paintings: square RGBA PNG, 384 px, at most 400 KB. */
function artProblems(bytes) {
  if (bytes.length > 400_000) return ['art larger than 400 KB'];
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['art is not a PNG'];
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), colourType = bytes[25];
  return width === 384 && height === 384 && colourType === 6 ? [] : ['art must be 384x384 RGBA'];
}
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const encode = (entry) => Buffer.from(JSON.stringify({ name: entry.name, theme: entry.theme, ...(entry.paths ? { paths: entry.paths } : {}) }), 'utf8').toString('base64');
const decode = (data) => JSON.parse(Buffer.from(data, 'base64').toString('utf8'));

/** Same restrained geometry rules as the visible collection (see tests/domain/category-icons.test.cjs). */
function validate(entry, ids) {
  const problems = [];
  if (!ids.includes(entry.id)) problems.push('unknown or unsealed ID');
  if (typeof entry.name !== 'string' || !/^[A-Za-z][A-Za-z' -]{2,28}$/.test(entry.name)) problems.push('name: 3–29 ASCII letters/spaces');
  if (typeof entry.theme !== 'string' || entry.theme.length <= 10 || entry.theme.length >= 65 || !/^[\x20-\x7E]+$/.test(entry.theme)) problems.push('theme: 11–64 ASCII characters');
  if (entry.artBytes) problems.push(...artProblems(entry.artBytes));
  else if (!Array.isArray(entry.paths)) problems.push('needs art or line paths');
  if (entry.paths !== undefined && (!Array.isArray(entry.paths) || entry.paths.length < 2 || entry.paths.length > 4)) problems.push('paths: 2–4');
  for (const geometry of entry.paths ?? []) {
    if (typeof geometry !== 'string' || !/^M/.test(geometry) || /[a-z]/.test(geometry) || /[^MCLHVQZS0-9.\s-]/.test(geometry)) problems.push('path syntax');
    for (const value of (geometry.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)) if (value < 1 || value > 23) { problems.push('path margin'); break; }
  }
  return problems;
}

function sealedIds() { return read(sourcePath).filter((entry) => entry.sealed === true).map((entry) => entry.id); }

function writeSealed(entries) {
  const ids = sealedIds();
  const failures = entries.flatMap((entry) => validate(entry, ids).map((problem) => `${entry.id}: ${problem}`));
  if (entries.length !== ids.length || new Set(entries.map((entry) => entry.id)).size !== ids.length) failures.push(`expected exactly ${ids.length} sealed entries`);
  const all = [...read(sourcePath).filter((entry) => !entry.sealed), ...entries];
  if (new Set(all.map((entry) => entry.name)).size !== all.length) failures.push('names must be unique across the collection');
  const lines = all.filter((entry) => entry.paths).map((entry) => JSON.stringify(entry.paths));
  if (new Set(lines).size !== lines.length) failures.push('line icons must be unique across the collection');
  const arts = entries.filter((entry) => entry.artBytes).map((entry) => entry.artBytes.toString('base64'));
  if (new Set(arts).size !== arts.length) failures.push('paintings must be unique');
  if (failures.length) { console.error(`FAIL\n${failures.join('\n')}`); process.exit(1); }
  const ordered = ids.map((id) => entries.find((entry) => entry.id === id));
  const sealed = ordered.map((entry) => ({ id: entry.id, data: encode(entry), ...(entry.artBytes ? { art: veil(entry.artBytes).toString('base64') } : {}),
    ...(entry.sceneBytes ? { scene: veil(entry.sceneBytes).toString('base64') } : {}) }));
  write(sealedPath, sealed);
  write(runtimePath, sealed);
  for (const id of ids) rmSync(path.join(svgDirectory, `${id}.svg`), { force: true });
  console.log(`Sealed ${sealed.length} stages (${arts.length} with paintings). Visible collection: ${all.length - sealed.length}.`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'unseal') {
  mkdirSync(path.dirname(plainPath), { recursive: true });
  mkdirSync(artDirectory, { recursive: true });
  write(plainPath, read(sealedPath).map(({ id, data, art, scene }) => {
    if (art) writeFileSync(path.join(artDirectory, `${id}.png`), veil(Buffer.from(art, 'base64')));
    if (scene) { mkdirSync(sceneDirectory, { recursive: true }); writeFileSync(path.join(sceneDirectory, `${id}.cjs`), veil(Buffer.from(scene, 'base64'))); }
    return { id, ...decode(data), ...(art ? { art: `art/${id}.png` } : {}), ...(scene ? { scene: `scenes/${id}.cjs` } : {}) };
  }));
  console.log(`Unsealed ${read(sealedPath).length} stages into .sealed/categories.json (gitignored). Do not paste its contents anywhere.`);
} else if (command === 'seal') {
  if (!existsSync(plainPath)) { console.error('Nothing to seal: run unseal first.'); process.exit(1); }
  writeSealed(read(plainPath).map((entry) => {
    const { art, scene, ...rest } = entry;
    return { ...rest, ...(art ? { artBytes: readFileSync(path.join(path.dirname(plainPath), art)) } : {}),
      ...(scene ? { sceneBytes: readFileSync(path.join(path.dirname(plainPath), scene)) } : {}) };
  }));
} else if (command === 'check') {
  const committed = read(sealedPath), mirror = read(runtimePath);
  if (JSON.stringify(committed) !== JSON.stringify(mirror)) { console.error('FAIL: runtime mirror differs'); process.exit(1); }
  const ids = sealedIds();
  const failures = committed.flatMap(({ id, data, art }) => validate({ id, ...decode(data), ...(art ? { artBytes: veil(Buffer.from(art, 'base64')) } : {}) }, ids)
    .map((problem) => `${id}: ${problem}`));
  if (committed.length !== ids.length) failures.push('sealed entry count');
  if (failures.length) { console.error(`FAIL\n${failures.join('\n')}`); process.exit(1); }
  console.log(`OK: ${committed.length} sealed stages decode and validate (${committed.filter((entry) => entry.art).length} with paintings).`);
} else if (command === 'init') {
  const source = read(sourcePath);
  const moving = source.filter((entry) => args.includes(entry.id) && !entry.sealed);
  if (moving.length !== args.length) { console.error('Unknown or already sealed ID'); process.exit(1); }
  const existing = existsSync(sealedPath) ? read(sealedPath).map(({ id, data, art, scene }) => ({ id, ...decode(data), ...(art ? { artBytes: veil(Buffer.from(art, 'base64')) } : {}),
    ...(scene ? { sceneBytes: veil(Buffer.from(scene, 'base64')) } : {}) })) : [];
  write(sourcePath, source.map((entry) => args.includes(entry.id) ? { id: entry.id, sealed: true } : entry));
  writeSealed([...existing, ...moving.map(({ id, name, theme, paths }) => ({ id, name, theme, paths }))]);
} else {
  console.error('Usage: sealed-categories.cjs unseal | seal | check | init <id…>');
  process.exit(1);
}
