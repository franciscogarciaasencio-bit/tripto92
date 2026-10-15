// Sealed journey stages: names, themes and icons the owner discovers only by reaching them.
// The committed form is base64 JSON (sealed, not secret: it only prevents accidental spoilers).
// This script never prints names, themes or geometry, only counts and validation results.
//
//   node scripts/sealed-categories.cjs unseal    -> .sealed/categories.json (gitignored) for editing
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

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const encode = (entry) => Buffer.from(JSON.stringify({ name: entry.name, theme: entry.theme, paths: entry.paths }), 'utf8').toString('base64');
const decode = (data) => JSON.parse(Buffer.from(data, 'base64').toString('utf8'));

/** Same restrained geometry rules as the visible collection (see tests/domain/category-icons.test.cjs). */
function validate(entry, ids) {
  const problems = [];
  if (!ids.includes(entry.id)) problems.push('unknown or unsealed ID');
  if (typeof entry.name !== 'string' || !/^[A-Za-z][A-Za-z' -]{2,28}$/.test(entry.name)) problems.push('name: 3–29 ASCII letters/spaces');
  if (typeof entry.theme !== 'string' || entry.theme.length <= 10 || entry.theme.length >= 65 || !/^[\x20-\x7E]+$/.test(entry.theme)) problems.push('theme: 11–64 ASCII characters');
  if (!Array.isArray(entry.paths) || entry.paths.length < 2 || entry.paths.length > 4) problems.push('paths: 2–4');
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
  if (new Set(all.map((entry) => JSON.stringify(entry.paths))).size !== all.length) failures.push('icons must be unique across the collection');
  if (failures.length) { console.error(`FAIL\n${failures.join('\n')}`); process.exit(1); }
  const ordered = ids.map((id) => entries.find((entry) => entry.id === id));
  const sealed = ordered.map((entry) => ({ id: entry.id, data: encode(entry) }));
  write(sealedPath, sealed);
  write(runtimePath, sealed);
  for (const id of ids) rmSync(path.join(svgDirectory, `${id}.svg`), { force: true });
  console.log(`Sealed ${sealed.length} stages. Visible collection: ${all.length - sealed.length}.`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'unseal') {
  mkdirSync(path.dirname(plainPath), { recursive: true });
  write(plainPath, read(sealedPath).map(({ id, data }) => ({ id, ...decode(data) })));
  console.log(`Unsealed ${read(sealedPath).length} stages into .sealed/categories.json (gitignored). Do not paste its contents anywhere.`);
} else if (command === 'seal') {
  if (!existsSync(plainPath)) { console.error('Nothing to seal: run unseal first.'); process.exit(1); }
  writeSealed(read(plainPath));
} else if (command === 'check') {
  const committed = read(sealedPath), mirror = read(runtimePath);
  if (JSON.stringify(committed) !== JSON.stringify(mirror)) { console.error('FAIL: runtime mirror differs'); process.exit(1); }
  const ids = sealedIds();
  const failures = committed.flatMap(({ id, data }) => validate({ id, ...decode(data) }, ids).map((problem) => `${id}: ${problem}`));
  if (committed.length !== ids.length) failures.push('sealed entry count');
  if (failures.length) { console.error(`FAIL\n${failures.join('\n')}`); process.exit(1); }
  console.log(`OK: ${committed.length} sealed stages decode and validate.`);
} else if (command === 'init') {
  const source = read(sourcePath);
  const moving = source.filter((entry) => args.includes(entry.id) && !entry.sealed);
  if (moving.length !== args.length) { console.error('Unknown or already sealed ID'); process.exit(1); }
  const existing = existsSync(sealedPath) ? read(sealedPath).map(({ id, data }) => ({ id, ...decode(data) })) : [];
  write(sourcePath, source.map((entry) => args.includes(entry.id) ? { id: entry.id, sealed: true } : entry));
  writeSealed([...existing, ...moving.map(({ id, name, theme, paths }) => ({ id, name, theme, paths }))]);
} else {
  console.error('Usage: sealed-categories.cjs unseal | seal | check | init <id…>');
  process.exit(1);
}
