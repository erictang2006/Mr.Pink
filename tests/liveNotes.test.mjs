import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

await build({ entryPoints: ['src/piano/liveNotes.ts', 'src/piano/geometry.ts', 'src/piano/profiles.ts'], bundle: true, platform: 'node', format: 'esm', outdir: '/private/tmp/stage-piano-modules' });
const { LiveNotes } = await import(pathToFileURL('/private/tmp/stage-piano-modules/liveNotes.js').href);
const { pianoGeometry } = await import(pathToFileURL('/private/tmp/stage-piano-modules/geometry.js').href);
const { validateProfile, duplicatePitches } = await import(pathToFileURL('/private/tmp/stage-piano-modules/profiles.js').href);

test('live notes keep independent key instances and accurate release times', () => {
  const notes = new LiveNotes();
  notes.on('KeyZ', 48, 100);
  notes.on('KeyQ', 60, 120);
  notes.on('KeyZ', 48, 130);
  assert.equal(notes.visible(200, 4000).length, 2);
  notes.off('KeyZ', 220);
  notes.on('KeyZ', 48, 230);
  const shown = notes.visible(300, 4000);
  assert.equal(shown.length, 3);
  assert.deepEqual(shown.filter(note => note.code === 'KeyZ').map(note => [note.startMs, note.endMs]), [[100, 220], [230, null]]);
  assert.equal(notes.visible(5000, 4000).length, 2);
  notes.clear();
  assert.equal(notes.visible(5100, 4000).length, 0);
});

test('sustain extends audible trail after physical release and pedal up ends it', () => {
  const notes = new LiveNotes();
  notes.on('KeyC', 60, 100);
  notes.off('KeyC', 200, true);
  notes.on('KeyC', 60, 250);
  let visible = notes.visible(300, 4000);
  assert.equal(visible.length, 2);
  assert.deepEqual(visible.map(note => [note.physicalEndMs, note.endMs]), [[200, null], [null, null]]);
  notes.pedalUp(320);
  visible = notes.visible(330, 4000);
  assert.deepEqual(visible.map(note => [note.physicalEndMs, note.endMs]), [[200, 320], [null, null]]);
});

test('retriggering a sustained pitch ends its old trail while the new note stays active', () => {
  const notes = new LiveNotes();
  notes.on('KeyC', 60, 100);
  notes.off('KeyC', 150, true);
  notes.dampPitch(60, 200);
  notes.on('KeyC', 60, 200);
  assert.deepEqual(notes.visible(250, 4000).map(note => [note.startMs, note.endMs]), [[100, 200], [200, null]]);
});

test('black note bar geometry centers over the matching black key', () => {
  const { keys } = pianoGeometry(1080, 0);
  const c = keys.get(48), sharp = keys.get(49), d = keys.get(50);
  assert.equal(sharp.black, true);
  assert.equal(sharp.x + sharp.width / 2, d.x);
  assert.equal(c.x + c.width, d.x);
});

test('profiles reject duplicate physical bindings but warn for duplicate pitches', () => {
  const map = validateProfile({ id: 'test', name: 'Test', bindings: [{ code: 'KeyZ', label: 'Z', midi: 60, shiftedMidi: 72 }, { code: 'KeyX', label: 'X', midi: 60, shiftedMidi: 74 }] });
  assert.equal(duplicatePitches(map).length, 1);
  assert.throws(() => validateProfile({ ...map, bindings: [...map.bindings, map.bindings[0]] }));
});
