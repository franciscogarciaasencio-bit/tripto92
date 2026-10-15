const { test }=require('node:test');
const { existsSync, readFileSync }=require('node:fs');
const path=require('node:path');
const { assert,api }=require('./helpers.cjs');
test('Every journey category has distinct editable SVG geometry matching the native icon source',()=>{
  const root=path.resolve(__dirname,'../../assets/ona');
  const icons=JSON.parse(readFileSync(path.join(root,'categories.json'),'utf8'));
  const runtime=JSON.parse(readFileSync(path.resolve(__dirname,'../../src/ui/category-artwork.json'),'utf8'));
  assert.deepEqual(runtime,icons,'Generated native runtime mirror matches the editable source');
  assert.deepEqual(icons.map(i=>i.id),api.JOURNEY_CATEGORIES.map(c=>c.iconId));
  const visible=icons.filter(icon=>!icon.sealed);
  assert.equal(new Set(visible.map(i=>JSON.stringify(i.paths))).size,visible.length);
  for(const icon of icons.filter(entry=>entry.sealed)) {
    assert.deepEqual(Object.keys(icon).sort(),['id','sealed'],`${icon.id} keeps no plain text`);
    assert.equal(existsSync(path.join(root,'categories',icon.id+'.svg')),false,`${icon.id} is never exported as a viewable file`);
  }
  for(const icon of visible) {
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

const sealedStages=()=>JSON.parse(readFileSync(path.resolve(__dirname,'../../assets/ona/categories-sealed.json'),'utf8'))
  .map(({id,data})=>({id,...JSON.parse(Buffer.from(data,'base64').toString('utf8'))}));
const fullCollection=()=>{
  const sealed=new Map(sealedStages().map(entry=>[entry.id,entry]));
  return JSON.parse(readFileSync(path.resolve(__dirname,'../../assets/ona/categories.json'),'utf8')).map(entry=>entry.sealed?sealed.get(entry.id):entry);
};

test('Category collection retains 25 stable five-level identities with Monkey Mind first',()=>{
  const icons=fullCollection();
  assert.equal(icons.length,25);
  assert.ok(icons.every(Boolean),'every sealed stage has data');
  assert.equal(new Set(icons.map(icon=>icon.name)).size,25);
  assert.equal(new Set(icons.map(icon=>icon.id)).size,25);
  assert.equal(new Set(icons.map(icon=>JSON.stringify(icon.paths))).size,25,'every stage has its own icon');
  assert.equal(icons[0].name,'Monkey Mind');
  assert.equal(icons[19].id,'habit_established');
  for(let index=0;index<25;index++) {
    const category=api.JOURNEY_CATEGORIES[index];
    assert.equal(category.id,icons[index].id);
    assert.equal(category.firstLevel,index*5+1);
    assert.equal(category.lastLevel,index*5+5);
    assert.ok(icons[index].theme.length > 10 && icons[index].theme.length < 65);
  }
});

test('Sealed stages: committed data, runtime mirror and geometry rules agree',()=>{
  const committed=readFileSync(path.resolve(__dirname,'../../assets/ona/categories-sealed.json'),'utf8');
  assert.equal(readFileSync(path.resolve(__dirname,'../../src/ui/category-sealed.json'),'utf8'),committed);
  for(const stage of sealedStages()) {
    assert.match(stage.name,/^[A-Za-z][A-Za-z' -]{2,28}$/);
    assert.match(stage.theme,/^[\x20-\x7E]+$/);
    assert.ok(stage.paths.length>=2&&stage.paths.length<=4);
  }
});

test('Monkey Mind keeps its editable starting symbol for Level 0 and Levels 1–5',()=>{
  const root=path.resolve(__dirname,'../../assets/ona');
  const first=JSON.parse(readFileSync(path.join(root,'categories.json'),'utf8'))[0];
  const svg=readFileSync(path.join(root,'categories','monkey_mind-prelude.svg'),'utf8');
  assert.ok(svg.includes('<title>Monkey Mind</title>'));
  assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),first.preludePaths);
  assert.deepEqual(first.paths,first.preludePaths,'Levels 1–5 share the Monkey Mind symbol');
});

test('Original native icon geometry remains within the small-size padded view box',()=>{
  const icons=fullCollection();
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
