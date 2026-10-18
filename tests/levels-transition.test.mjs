import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raw = JSON.parse(readFileSync(new URL('../src/piano/levels.song.json', import.meta.url)));
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/piano/levels.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { levelsSong, levelsInputs, levelsMap, levelsDrumCues } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('live transition replaces only bars 9–12 with exact piano keys and timing', () => {
  assert.deepEqual(levelsSong.measures.slice(0, 8), raw.measures.slice(0, 8));
  const events = levelsInputs();
  assert.deepEqual(events.filter(event => event.measure === 9).map(event => [event.beat, event.duration, event.codes, event.pitches]), [
    [0, 1, ['KeyJ'], [68]], [1, 1, ['KeyK'], [71]], [2, 1, ['KeyL'], [76]], [3, 1, ['KeyK'], [71]],
  ]);
  assert.deepEqual(events.filter(event => event.measure === 10).map(event => [event.beat, event.duration, event.codes, event.pitches]), [
    [0, 2, ['KeyJ', 'KeyK'], [68, 71]], [2, 2, ['KeyL'], [76]],
  ]);
  assert.deepEqual(events.filter(event => event.measure === 11).map(event => [event.beat, event.duration, event.codes, event.pitches]), [
    [0, 4, ['KeyM', 'KeyK', 'KeyL'], [64, 71, 76]],
  ]);
  assert.deepEqual(events.filter(event => event.measure === 12).map(event => [event.codes, event.pitches]), [[['KeyM'], [64]]]);
  assert.equal(levelsSong.measures[11].tempoBpm, 100);
  assert.deepEqual(Object.fromEntries(levelsMap('transition').bindings.map(binding => [binding.code, binding.midi])), { KeyJ: 68, KeyK: 71, KeyL: 76, KeyM: 64 });
  assert.deepEqual(levelsDrumCues.map(cue => cue.code), ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB']);
});
