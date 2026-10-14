const { test }=require('node:test');
const { readFileSync }=require('node:fs');
const path=require('node:path');
const { assert,api }=require('./helpers.cjs');
test('Every journey category has distinct editable SVG geometry matching the native icon source',()=>{
  const root=path.resolve(__dirname,'../../assets/ona');
  const icons=JSON.parse(readFileSync(path.join(root,'categories.json'),'utf8'));
  const runtime=JSON.parse(readFileSync(path.resolve(__dirname,'../../src/ui/category-artwork.json'),'utf8'));
  assert.deepEqual(runtime,icons,'Generated native runtime mirror matches the editable source');
  assert.deepEqual(icons.map(i=>i.id),api.JOURNEY_CATEGORIES.map(c=>c.iconId));
  assert.equal(new Set(icons.map(i=>JSON.stringify(i.paths))).size,25);
  for(const icon of icons) {
    const svg=readFileSync(path.join(root,'categories',icon.id+'.svg'),'utf8');
    assert.match(svg,/viewBox="0 0 24 24"/); assert.match(svg,/stroke-width="1.35"/);
    assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),icon.paths);
    assert.ok(icon.paths.length >= 2 && icon.paths.length <= 4, `${icon.id} uses restrained geometry`);
    assert.match(svg,/stroke-linecap="round" stroke-linejoin="round"/);
    assert.match(svg,/fill="none"/);
    assert.ok(svg.includes(`<title>${icon.name}</title>`));
    assert.ok(svg.includes(`<desc>${icon.theme}</desc>`));
  }
});

test('Category collection retains 25 stable five-level identities and the Habit Established milestone',()=>{
  const icons=JSON.parse(readFileSync(path.resolve(__dirname,'../../assets/ona/categories.json'),'utf8'));
  assert.equal(icons.length,25);
  assert.equal(new Set(icons.map(icon=>icon.name)).size,25);
  assert.equal(new Set(icons.map(icon=>icon.id)).size,25);
  assert.equal(icons[0].name,'Early Steps');
  assert.equal(icons[19].id,'habit_established');
  assert.equal(icons[19].name,'Habit Established');
  for(let index=0;index<25;index++) {
    const category=api.JOURNEY_CATEGORIES[index];
    assert.equal(category.id,icons[index].id);
    assert.equal(category.firstLevel,index*5+1);
    assert.equal(category.lastLevel,index*5+5);
    assert.ok(icons[index].theme.length > 10 && icons[index].theme.length < 65);
  }
});

test('The Monkey Mind prelude retains separate editable geometry outside the numbered categories',()=>{
  const root=path.resolve(__dirname,'../../assets/ona');
  const first=JSON.parse(readFileSync(path.join(root,'categories.json'),'utf8'))[0];
  const svg=readFileSync(path.join(root,'categories','monkey_mind-prelude.svg'),'utf8');
  assert.ok(svg.includes('<title>Monkey Mind</title>'));
  assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),first.preludePaths);
  assert.notDeepEqual(first.paths,first.preludePaths);
});

test('Original native icon geometry remains within the small-size padded view box',()=>{
  const icons=JSON.parse(readFileSync(path.resolve(__dirname,'../../assets/ona/categories.json'),'utf8'));
  for(const icon of icons) {
    for(const geometry of icon.paths) {
      // All authoring commands are absolute; every control/endpoint has a safe stroke margin.
      assert.match(geometry,/^M/);
      assert.doesNotMatch(geometry,/[a-z]/);
      assert.doesNotMatch(geometry,/[^MCLHVQZS0-9.\s-]/);
      for(const value of geometry.match(/-?\d+(?:\.\d+)?/g).map(Number)) {
        assert.ok(value >= 1 && value <= 23, `${icon.id}: ${value} retains at least one source-unit margin`);
      }
    }
  }
});
