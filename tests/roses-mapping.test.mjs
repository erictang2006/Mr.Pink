import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/piano/roses.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { rosesMap, phrasePitches, rosesPhrase } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const source = (await import('../src/piano/interstellar_roblox_aligned_mapping.json', { with: { type: 'json' } })).default.mapping;

test('Roses preserves every individual Interstellar physical key at +4 semitones', () => {
  assert.equal(rosesMap.name, 'Roses — Interstellar Layout +4');
  assert.equal(rosesMap.bindings.length, Object.keys(source).length);
  for (const binding of rosesMap.bindings) {
    assert.equal(binding.midi, source[binding.code].midi + 4);
    assert.equal(binding.shiftedMidi, undefined);
  }
  assert.equal(rosesMap.bindings.find(binding => binding.code === 'KeyT').midi, 64);
  assert.deepEqual(phrasePitches('eg', 4), ['E: C♯4', 'G: unmapped']);
  assert.deepEqual(phrasePitches('ef', 4), ['E: C♯4', 'F: G♯5']);
  assert.equal(rosesPhrase.length, 14);
});

test('Roses intro live drum and backing controls do not steal mapped piano keys', () => {
  for (const code of ['KeyZ', 'KeyX', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'KeyL', 'KeyC', 'KeyG'])
    assert.equal(rosesMap.bindings.some(binding => binding.code === code), false);
});
