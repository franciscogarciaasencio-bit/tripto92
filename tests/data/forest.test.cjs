const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { assert, data, domain, connection, openStore, disk, session, context } = require('./helpers.cjs');
const art = require('../../src/ui/forest-artwork.json');
const { alignedForestArtwork, forestMetadata, shouldNavigateForest } = data('../ui/forest-geometry.js');
const { coastalComposition } = data('../ui/coastal-composition.js');
const { getForestStage } = domain('forest/growth.js');

test('All supplied source assets remain byte-identical, correctly dimensioned and locally bundled', () => {
  for (const [id, metadata] of Object.entries(art)) {
    const filename = id === 'entry' ? 'assets/ona/forest/forest-entry.png' : id === 'coast_1'
      ? 'assets/ona/design3/coastal-background.png' : `assets/ona/forest/stage-${id.slice(-1)}.png`;
    const png = readFileSync(path.join(__dirname, '../../', filename));
    assert.equal(createHash('sha256').update(png).digest('hex'), metadata.sha256);
    assert.equal(png.readUInt32BE(16), metadata.width); assert.equal(png.readUInt32BE(20), metadata.height);
  }
});
test('Every stage aligns its sun at the same coordinates without stretching across phone sizes', () => {
  for (const [w,h] of [[320,568],[375,667],[390,844],[430,932],[768,1024]]) {
    const c = coastalComposition(w,h,1,34);
    for (const id of Object.keys(art).filter(id => id !== 'entry')) {
      const m = forestMetadata(id), pose = alignedForestArtwork(id,c.artWidth,c.haloCenterX,c.haloCenterY);
      const scale = pose.width / m.width;
      assert.ok(Math.abs(pose.left + m.haloX * scale - c.haloCenterX) < 1e-8);
      assert.ok(Math.abs(pose.top + m.haloY * scale - c.haloCenterY) < 1e-8);
      assert.ok(Math.abs(pose.width / pose.height - m.width / m.height) < 1e-8);
    }
  }
});
test('Coast metadata rejects reserved reference/unknown IDs rather than selecting incorrect artwork', () => {
  assert.throws(() => forestMetadata('entry'), RangeError);
  assert.throws(() => forestMetadata('unbundled'), RangeError);
  assert.throws(() => forestMetadata('constructor'), RangeError);
  assert.throws(() => forestMetadata('toString'), RangeError);
});
test('Directional gestures accept deliberate releases and reject scrolling, short drags and wrong-direction flings', () => {
  for (const direction of ['left','right']) {
    const sign = direction === 'left' ? -1 : 1;
    assert.equal(shouldNavigateForest(direction,sign*70,2,0),true);
    assert.equal(shouldNavigateForest(direction,sign*30,2,sign*600),true);
    assert.equal(shouldNavigateForest(direction,sign*15,0,sign*900),false);
    assert.equal(shouldNavigateForest(direction,sign*60,50,sign*900),false);
    assert.equal(shouldNavigateForest(direction,sign*30,0,-sign*900),false);
    assert.equal(shouldNavigateForest(direction,-sign*100,0,-sign*900),false);
    assert.equal(shouldNavigateForest(direction,NaN,0,0),false);
  }
});
test('Real saved/reopened progression feeds forest growth; decay preserves growth and confirmed reset clears it', async t => {
  let store;
  // Close the native SQLite handle before the disk helper's deletion hook (Windows).
  t.after(() => store?.close());
  const file = disk(t);
  store = await openStore(connection(file), context(1), undefined, 'progression_v4');
  let meditations = store.meditations;
  for (let day=1; day<=40; day++) await meditations.completePractice(session({ day, minutes:60 }), session({ day, minutes:60 }).endedAt);
  await store.close();
  store = await openStore(connection(file), context(41), undefined, 'progression_v4');
  meditations = store.meditations;
  const grown = await meditations.getCurrentPracticeProgress(context(41));
  const selected = getForestStage({ highestLevel:grown.habit.highestLevel, currentLevel:grown.journey.level.number });
  assert.ok(grown.habit.highestLevel >= 20);
  const decayed = await meditations.getCurrentPracticeProgress(context(410));
  assert.equal(getForestStage({ highestLevel:decayed.habit.highestLevel, currentLevel:decayed.journey.level.number }).id, selected.id);
  assert.equal((await meditations.loadProgressionState()).lifetimeXpCenti, grown.snapshot.lifetimeXpCenti);
  // Reset cannot proceed with unacknowledged completion. Use the actual acknowledgement API.
  let pending = await meditations.getPendingCompletion();
  while (pending) {
    await meditations.acknowledgeCompletion(pending.session.id, context(410).timestamp);
    pending = await meditations.getPendingCompletion();
  }
  await meditations.resetAllPracticeData(context(411));
  const empty = await meditations.getCurrentPracticeProgress(context(412));
  assert.equal(getForestStage({ highestLevel:empty.habit.highestLevel, currentLevel:empty.journey.level.number }).id, 'coast_0');
  assert.equal((await meditations.getMeditationHistory()).length,0);
  assert.ok(store);
});
