const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const bank = path.join(root, 'assets/audio/bells-v2');
const sources = path.join(root, 'scripts/audio-sources/bells');
const analysis = JSON.parse(readFileSync(path.join(bank, 'analysis.json'), 'utf8'));
const provenance = JSON.parse(readFileSync(path.join(sources, 'provenance.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function pcm(name) {
  const bytes = readFileSync(path.join(bank, name));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  let format, audio;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    assert.equal(chunk.length, size);
    const kind = bytes.toString('ascii', offset, offset + 4);
    if (kind === 'fmt ') format = chunk;
    if (kind === 'data') audio = chunk;
    offset += 8 + size + (size % 2);
  }
  assert.ok(format && audio);
  assert.equal(format.readUInt16LE(0), 1, 'uncompressed PCM');
  assert.equal(format.readUInt16LE(2), 1, 'mono');
  assert.equal(format.readUInt32LE(4), 24000);
  assert.equal(format.readUInt16LE(14), 16);
  assert.equal(audio.length % 2, 0);
  const samples = Array.from({ length: audio.length / 2 }, (_, i) => audio.readInt16LE(i * 2) / 32768);
  return { bytes, samples };
}
const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);

test('Acoustic source evidence covers every retained original with a stable publisher/CC0 reference', () => {
  assert.equal(provenance.license, 'CC0-1.0');
  assert.equal(provenance.author, 'Joseph SARDIN');
  assert.equal(provenance.licenseUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
  for (const [id, source] of Object.entries(provenance.sources)) {
    assert.equal(new URL(source.url).hostname, 'bigsoundbank.com');
    assert.ok(source.url.endsWith(`s${id}.html`));
    assert.ok(source.selection.length > 20);
  }
});

test('Four publisher recordings and the owner-supplied gong remain byte-identical to their originals', () => {
  assert.equal(Object.keys(provenance.sources).length, 4);
  assert.deepEqual(Object.keys(provenance.ownerSupplied), ['gong-4']);
  for (const source of [...Object.values(provenance.sources), ...Object.values(provenance.ownerSupplied)]) {
    assert.equal(hash(readFileSync(path.join(sources, source.file))), source.sha256);
  }
});

test('Owner-supplied sources say who supplied them, when, and that their licence still needs recording', () => {
  for (const source of Object.values(provenance.ownerSupplied)) {
    assert.equal(source.suppliedBy, "Ona's owner");
    assert.match(source.suppliedOn, /^\d{4}-\d{2}-\d{2}$/);
    // Never claim rights that were not evidenced; update both fields when the owner confirms them.
    assert.equal(source.license, 'unconfirmed');
    assert.ok(source.rightsReview.includes('before a public release'));
    assert.ok(source.selection.length > 20);
  }
  assert.equal(analysis.assets['interval.wav'].profile.source, 'gong-4');
  assert.ok(analysis.sources['gong-4']);
});

for (const role of ['start', 'end', 'interval']) {
  test(`${role} acoustic master has verified PCM, headroom, soft endpoints and accurate measurements`, () => {
    const { bytes, samples } = pcm(`${role}.wav`);
    const entry = analysis.assets[`${role}.wav`];
    assert.equal(hash(bytes), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(samples.length / 24000, entry.measurements.seconds);
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
    const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
    assert.ok(peak > .03 && peak < .25);
    assert.equal(peak, entry.measurements.samplePeak);
    assert.ok(Math.abs(samples.reduce((sum, sample) => sum + sample, 0) / samples.length) < 1e-5);
    assert.ok(rms(samples.slice(0, 480)) < .006);
    assert.ok(rms(samples.slice(-24000)) < .001);
    assert.ok(Math.abs(rms(samples.slice(0, 48000)) - entry.profile.firstTwoSecondsRms) < .00001);
    assert.ok(entry.measurements.energyAbove2000HzFraction < analysis.sources[entry.profile.source].energyAbove2000HzFraction);
  });
}

test('Interval is substantially quieter; end and start are matched without a loud ending strike', () => {
  const start = pcm('start.wav').samples;
  const end = pcm('end.wav').samples;
  const interval = pcm('interval.wav').samples;
  const openingRms = samples => rms(samples.slice(0, 48000));
  assert.ok(openingRms(interval) < openingRms(start) * .65);
  assert.ok(openingRms(end) <= openingRms(start));
  assert.ok(openingRms(end) > openingRms(start) * .9);
});

test('Full source decays survive mastering; end retains audible signal well into completion', () => {
  for (const entry of Object.values(analysis.assets)) {
    const source = analysis.sources[entry.profile.source];
    assert.ok(Math.abs(entry.measurements.seconds - (source.seconds - entry.profile.trimSeconds)) < 1 / 24000);
  }
  const end = pcm('end.wav').samples;
  assert.ok(end.length / 24000 > 29);
  assert.ok(rms(end.slice(12 * 24000, 13 * 24000)) > .002);
  assert.ok(rms(end.slice(24 * 24000, 25 * 24000)) < .001);
});

for (const minutes of [5, 10, 15]) {
  test(`${minutes}-minute live timeline contains the acoustic interval source with verified first/second/final timing`, () => {
    const timelines = JSON.parse(readFileSync(path.join(bank, 'timelines.json'), 'utf8'));
    const entry = timelines.assets[`interval-${minutes}m.m4a`];
    const bytes = readFileSync(path.join(bank, `interval-${minutes}m.m4a`));
    assert.equal(hash(bytes), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(entry.sourceSha256, analysis.assets['interval.wav'].sha256);
    assert.equal(timelines.sourceSha256, entry.sourceSha256);
    assert.equal(entry.intervalSeconds, minutes * 60);
    assert.equal(entry.firstBellSeconds, minutes * 60);
    assert.equal(entry.seconds, timelines.activeSeconds + timelines.tailSeconds);
    assert.equal(timelines.activeSeconds, 21600);
    assert.equal(timelines.tailSeconds, 12);
    assert.ok(entry.decoded.correlationWithIntervalMaster > .98);
    assert.ok(entry.decoded.samplePeak < .12);
    assert.ok(entry.decoded.firstSecondRmsDifference < .001);
    assert.ok(entry.decoded.firstLastRmsDifference < .001);
    assert.ok(entry.decoded.beforeFirstBellPeak < .002);
    const catalogue = readFileSync(path.join(root, 'src/audio/assets.ts'), 'utf8');
    assert.ok(catalogue.includes(`require('../../assets/audio/bells-v2/interval-${minutes}m.m4a')`));
  });
}
