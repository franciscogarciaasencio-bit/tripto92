// Original Ona paths live in categories.json. Export editable SVGs without a design dependency.
const { readFileSync, writeFileSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const categoryDirectory = path.dirname(module.filename);
const icons = JSON.parse(readFileSync(path.join(categoryDirectory, '..', 'categories.json'), 'utf8'));
// The local JSON mirror can also be resolved by isolated Node TypeScript test builds.
copyFileSync(path.join(categoryDirectory, '..', 'categories.json'), path.join(categoryDirectory, '..', '..', '..', 'src', 'ui', 'category-artwork.json'));
function escape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}
for (const icon of icons) {
  if (!/^[a-z_]+$/.test(icon.id)) throw new Error('Unexpected category ID');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><title>${escape(icon.name)}</title><desc>${escape(icon.theme)}</desc>${icon.paths.map((geometry) => `<path d="${escape(geometry)}"/>`).join('')}</svg>\n`;
  writeFileSync(path.join(categoryDirectory, `${icon.id}.svg`), svg);
  if (icon.preludePaths) {
    writeFileSync(path.join(categoryDirectory, `${icon.id}-prelude.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><title>Monkey Mind</title>${icon.preludePaths.map((geometry) => `<path d="${escape(geometry)}"/>`).join('')}</svg>\n`);
  }
}
