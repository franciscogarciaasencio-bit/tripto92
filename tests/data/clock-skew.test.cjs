// Two phones whose clocks disagree by a couple of minutes, and a phone whose clock is set back.
const { test } = require('node:test');
const path = require('node:path');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { assert, session, at, connection, openStore } = require('./helpers.cjs');
const { supabase } = require('./supabase-helpers.cjs');
const { phone } = require('./sync-helpers.cjs');

const ctx = (timestamp) => ({ timestamp, localDate: new Date(timestamp).toISOString().slice(0, 10), timeZone: 'UTC' });

test('A phone whose clock is behind opens, reads and saves after pulling from a phone running ahead', async (t) => {
  const s = await supabase(t);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-skew-')), 'b.db');
  const a = await phone(t, s), b = await phone(t, s, 'a', ctx(at(1, 6)), file);
  await a.practice(session({ id: 'ahead-1', day: 1, hour: 8 }));
  a.setTime(at(1, 9)); await a.store.meditations.getCurrentPracticeProgress(ctx(at(1, 9))); await a.sync();
  // B's clock runs two minutes behind A's.
  b.setTime(at(1, 9) - 120_000);
  assert.equal((await b.sync()).action, 'pulled');
  const read = await b.store.meditations.getCurrentPracticeProgress(ctx(at(1, 9) - 60_000));
  assert.ok(read.snapshot && read.journey, 'reads at the settled moment instead of failing');
  // B practises; on B's clock the practice ends one minute before A's settlement.
  const late = session({ id: 'behind-1', day: 1, hour: 8.7, minutes: 10 });
  assert.ok(late.endedAt < at(1, 9) && late.startedAt > at(1, 8) + 600_000);
  await b.store.meditations.completePractice(late, late.endedAt);
  await b.store.meditations.acknowledgeCompletion(late.id, late.endedAt);
  // Reopen from disk with the clock still behind: startup validation accepts everything.
  b.setTime(at(1, 9) - 30_000); await b.restart();
  assert.equal((await b.store.meditations.getMeditationHistory({ limit: 10, offset: 0 })).length, 2);
  // And the practice reaches the other phone normally once B syncs.
  b.setTime(at(1, 9.5)); await b.sync();
  a.setTime(at(1, 10)); assert.equal((await a.sync()).action, 'pulled');
  assert.deepEqual(await a.history(), await b.history());
});

test('Across midnight: a practice ending just before a settlement on the next day saves and revalidates', async (t) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-skew-')), 'm.db');
  let store = await openStore(connection(file), ctx(at(2, 7)), undefined, 'progression_v5');
  const earlier = session({ id: 'morning', day: 2, hour: 8 });
  await store.meditations.completePractice(earlier, earlier.endedAt);
  await store.meditations.acknowledgeCompletion(earlier.id, earlier.endedAt);
  // A synced settlement (or a clock correction) already reads just after midnight.
  await store.meditations.getCurrentPracticeProgress(ctx(at(3, 0.1)));
  // On this phone's clock the evening practice ends at 23:55 the day before.
  const evening = session({ id: 'evening', day: 2, hour: 23.65, minutes: 15 });
  assert.ok(evening.endedAt < at(3, 0.1) && evening.localDate < ctx(at(3, 0.1)).localDate);
  await store.meditations.completePractice(evening, evening.endedAt);
  await store.meditations.acknowledgeCompletion(evening.id, evening.endedAt);
  const saved = await store.meditations.getCurrentPracticeProgress(ctx(at(3, 1)));
  await store.close();
  store = await openStore(connection(file), ctx(at(3, 2)), undefined, 'progression_v5');
  t.after(() => store.close());
  assert.equal((await store.meditations.getMeditationHistory({ limit: 10, offset: 0 })).length, 2);
  assert.equal((await store.meditations.getCurrentPracticeProgress(ctx(at(3, 2)))).journey.metrics.lifetimeXpCenti, saved.journey.metrics.lifetimeXpCenti);
});

test('A phone clock set back opens at its stored settlement instead of failing', async (t) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-skew-')), 'c.db');
  let store = await openStore(connection(file), ctx(at(3, 7)), undefined, 'progression_v5');
  const practice = session({ id: 'today', day: 3, hour: 8 });
  await store.meditations.completePractice(practice, practice.endedAt);
  await store.meditations.acknowledgeCompletion(practice.id, practice.endedAt);
  const before = await store.meditations.getCurrentPracticeProgress(ctx(at(3, 12)));
  await store.close();
  // The person sets the phone back two days by hand.
  store = await openStore(connection(file), ctx(at(1, 12)), undefined, 'progression_v5');
  t.after(() => store.close());
  const after = await store.meditations.getCurrentPracticeProgress(ctx(at(1, 12)));
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.deepEqual(after.habit, before.habit);
  // A destructive reset still refuses a moment before the settled one.
  await assert.rejects(store.meditations.resetProgression(ctx(at(1, 12))), /rewind/);
});

test('Seeded stress: random backward clock steps never corrupt history or block reopening', async (t) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ona-skew-')), 'fuzz.db');
  let seed = 20261015;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let store = await openStore(connection(file), ctx(at(1, 6)), undefined, 'progression_v5');
  let lastEnd = at(1, 6), saved = 0, refused = 0;
  for (let day = 1; day <= 60; day++) {
    for (const hour of [7, 13, 21]) {
      // The clock this phone believes in: usually right, sometimes up to an hour behind.
      const skew = random() < 0.35 ? Math.floor(random() * 3_600_000) : 0;
      const now = at(day, hour) - skew;
      await store.meditations.getCurrentPracticeProgress(ctx(now));
      if (random() < 0.5) {
        const minutes = 3 + Math.floor(random() * 20);
        const start = Math.max(lastEnd + 1000, at(day, hour + 0.2) - skew);
        const late = { id: `fuzz-${day}-${hour}`, startedAt: start, endedAt: start + minutes * 60_000, activeDurationSeconds: minutes * 60,
          pausedDurationSeconds: 0, status: 'completed', localDate: ctx(start + minutes * 60_000).localDate, timeZone: 'UTC' };
        try {
          await store.meditations.completePractice(late, late.endedAt);
          await store.meditations.acknowledgeCompletion(late.id, late.endedAt);
          lastEnd = late.endedAt; saved++;
        } catch (error) {
          assert.match(String(error), /rewind/, 'only an explicit rewind refusal is allowed');
          refused++;
        }
      }
    }
    if (day % 10 === 0) {
      await store.close();
      store = await openStore(connection(file), ctx(at(day, 22) - Math.floor(random() * 3_600_000)), undefined, 'progression_v5');
    }
  }
  t.after(() => store.close());
  assert.ok(saved > 60, `most practices save (${saved} saved, ${refused} refused)`);
  assert.equal((await store.meditations.getMeditationHistory({ limit: 500, offset: 0 })).length, saved);
});
