const { test }=require('node:test');
const { readFileSync }=require('node:fs');
const path=require('node:path');
const { assert,api }=require('./helpers.cjs');
test('Every journey category has distinct editable SVG geometry matching the native icon source',()=>{
  const root=path.resolve(__dirname,'../../assets/ona');
  const icons=JSON.parse(readFileSync(path.join(root,'categories.json'),'utf8'));
  assert.deepEqual(icons.map(i=>i.id),api.JOURNEY_CATEGORIES.map(c=>c.iconId));
  assert.equal(new Set(icons.map(i=>JSON.stringify(i.paths))).size,25);
  for(const icon of icons) {
    const svg=readFileSync(path.join(root,'categories',icon.id+'.svg'),'utf8');
    assert.match(svg,/viewBox="0 0 24 24"/); assert.match(svg,/stroke-width="1.35"/);
    assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),icon.paths);
  }
});
