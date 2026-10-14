const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const geometry = require(path.join(process.env.DATA_BUILD_DIR, '../ui/ocean-geometry.js'));
const trace = require('../../assets/ona/design3/wave-trace.json');
const nodes = trace.paths.map(p => p.filter((_, i) => i % 3 === 0 || i === p.length - 1));
const numbers = d => d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('Both native swell amplitudes increase gently by ten percent', () => {
  close(geometry.OCEAN_AMPLITUDES.dark, 41.6 * 1.1);
  close(geometry.OCEAN_AMPLITUDES.light, 33.8 * 1.1);
});

test('The shared 12-second swell returns to identical geometry after each complete cycle', () => {
  assert.equal(geometry.OCEAN_CYCLE_MS, 12_000);
  for (const phase of [0, .7, 2.4, 5.9]) {
    const a = numbers(geometry.oceanPath(nodes[0], phase, geometry.OCEAN_AMPLITUDES.dark, 1));
    const b = numbers(geometry.oceanPath(nodes[0], phase + 2 * Math.PI, geometry.OCEAN_AMPLITUDES.dark, 1));
    a.forEach((value, i) => close(value, b[i]));
  }
});
test('Velocity is continuous at the loop boundary, with no reversal or reset jump', () => {
  const e = 1e-5, lift = phase => geometry.oceanLift(466, phase, geometry.OCEAN_AMPLITUDES.dark, 1);
  const before = (lift(2 * Math.PI) - lift(2 * Math.PI - e)) / e;
  const after = (lift(e) - lift(0)) / e;
  close(before, after, .001);
});
test('The swell changes curvature rather than translating every point by the same amount', () => {
  const displacements = [0, 232, 466, 700, 932].map(x => geometry.oceanLift(x, 1.2, geometry.OCEAN_AMPLITUDES.dark, 1));
  assert.ok(Math.max(...displacements) - Math.min(...displacements) > 10);
});
test('Reduced Motion retains a smaller nonzero swell, as explicitly requested', () => {
  const regular = geometry.oceanLift(466, 1.5, geometry.OCEAN_AMPLITUDES.dark, 1);
  const reduced = geometry.oceanLift(466, 1.5, geometry.OCEAN_AMPLITUDES.dark, geometry.OCEAN_REDUCED_AMPLITUDE);
  assert.ok(Math.abs(reduced) > 1);
  close(reduced, regular * .5);
});
test('Both lines have distinct phase/amplitude while sharing the same cycle', () => {
  const dark = geometry.oceanLift(466, 1, geometry.OCEAN_AMPLITUDES.dark, 1);
  const light = geometry.oceanLift(466, 1.24, geometry.OCEAN_AMPLITUDES.light, 1);
  assert.notEqual(dark, light);
  close(light, geometry.oceanLift(466, 1.24 + 2 * Math.PI, geometry.OCEAN_AMPLITUDES.light, 1));
});
test('All curves/control points stay inside their independent wave band throughout the cycle', () => {
  for (let i = 0; i <= 36; i++) for (const [line, amplitude] of [[0, geometry.OCEAN_AMPLITUDES.dark], [1, geometry.OCEAN_AMPLITUDES.light]]) {
    const values = numbers(geometry.oceanPath(nodes[line], i / 36 * Math.PI * 2, amplitude, 1));
    values.filter((_, i) => i % 2 === 1).forEach(y => assert.ok(y > 660 && y < 1020, `Out-of-band y=${y}`));
  }
});
test('Neighbouring cubic segments share position and tangent as the geometry deforms', () => {
  const values = numbers(geometry.oceanPath(nodes[0], 2.1, geometry.OCEAN_AMPLITUDES.dark, 1));
  for (let i = 2; i + 12 <= values.length; i += 6) {
    close(values[i + 4] - values[i + 2], values[i + 6] - values[i + 4]);
    close(values[i + 5] - values[i + 3], values[i + 7] - values[i + 5]);
  }
});
