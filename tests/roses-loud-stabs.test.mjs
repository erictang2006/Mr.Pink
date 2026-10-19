import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assets = [
  { name: 'dbadd9', preview: '01-dbadd9-recorded-preview.wav', notes: [61, 65, 68, 75] },
  { name: 'eb-major', preview: '02-eb-major-recorded-preview.wav', notes: [63, 67, 70, 75] },
  { name: 'fm7', preview: '03-fm7-recorded-preview.wav', notes: [65, 68, 72, 75] },
];
function channel(buffer, side = 0) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  assert.equal(buffer.readUInt16LE(22), 2);
  assert.equal(buffer.readUInt32LE(24), 44100);
  assert.equal(buffer.readUInt16LE(34), 16);
  return Float64Array.from({ length: (buffer.length - 44) / 4 },
    (_, i) => buffer.readInt16LE(44 + 4 * i + side * 2) / 32768);
}
function magnitude(samples, frequency, start, length) {
  const step = 2 * Math.PI * frequency / 44100;
  let real = 0, imag = 0;
  for (let i = 0; i < length; i++) {
    const v = samples[start + i];
    real += v * Math.cos(step * i);
    imag -= v * Math.sin(step * i);
  }
  return Math.hypot(real, imag) / length;
}
test('each live hit is the approved recorded preview and contains its exact four-note harmony', () => {
  for (const { name, preview, notes } of assets) {
    const master = readFileSync(`docs/roses-reference/loud-stabs-previews/${preview}`);
    const live = readFileSync(`public/roses/chords/loud-stabs-recorded-${name}.wav`);
    assert.deepEqual(live, master, `${name}: live asset must match approved preview`);
    const samples = channel(live);
    assert.ok(samples.length > .7 * 44100 && samples.length < .85 * 44100);
    const peak = Math.max(...samples.map(Math.abs));
    assert.ok(peak < .9, `${name}: no clipped hit`);
    assert.equal(samples.at(-1), 0, `${name}: click-free ending`);
    for (const midi of notes) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const energy = Math.max(...[-2, -1, 0, 1, 2].map(offset =>
        magnitude(samples, frequency + offset, Math.round(.12 * 44100), Math.round(.3 * 44100))));
      assert.ok(energy > .004, `${name}: MIDI ${midi} has audible fundamental`);
    }
  }
});

test('each held body is a short loop cut from the same recorded chord with a smooth seam', () => {
  for (const { name } of assets) {
    const buffer = readFileSync(`public/roses/chords/loud-stabs-recorded-${name}-sustain.wav`);
    const left = channel(buffer);
    const right = channel(buffer, 1);
    assert.ok(left.length > .3 * 44100 && left.length < .4 * 44100);
    for (const samples of [left, right]) {
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      assert.ok(rms > .08 && rms < .22, `${name}: recorded sustain level`);
      const derivativeRms = Math.sqrt(samples.reduce((sum, value, i) =>
        i ? sum + (value - samples[i - 1]) ** 2 : sum, 0) / (samples.length - 1));
      assert.ok(Math.abs(samples[0] - samples.at(-1)) < 2 * derivativeRms,
        `${name}: seam no sharper than normal recorded waveform`);
    }
  }
});
