import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const outdir = '/private/tmp/stage-piano-interstellar-practice';
await build({ entryPoints: [
  'src/piano/interstellarPractice.ts',
  'src/piano/interstellarMix.ts',
  'src/piano/profiles.ts',
  'src/piano/liveNotes.ts',
], bundle: true, platform: 'node', format: 'esm', outdir });
const imported = async name => import(pathToFileURL(`${outdir}/${name}.js`).href);
const { interstellarPracticeGroups: groups, interstellarSong: song } = await imported('interstellarPractice');
const { defaultInterstellarMix: mix, practiceNoteGain, shouldDoubleHighE, highEOctaveMidi } = await imported('interstellarMix');
const { interstellarMap, assistedInterstellarMap } = await imported('profiles');
const { LiveNotes } = await imported('liveNotes');

test('the normal sheet replaces only bars 9–13 with the exact assisted fingering', () => {
  assert.equal(song.measureCount, 30);
  for (const [bar, fingering] of [[9,'cbm/cbm/cbm/'],[10,'vnm.vnm.vnm.'],[11,'vnm.vnm.vnm.'],[12,'cbm/zvm,cbm/'],[13,'vnm.cbm/zvm,']]) {
    const events = groups.filter(group => group.measure === bar);
    assert.equal(events.length, 12);
    assert.equal(events.map(group => group.assistedEvent.label).join(''), fingering);
    assert.deepEqual(events.map(group => group.beat), Array.from({ length: 12 }, (_, i) => i / 4));
    assert.ok(events.every(group => group.pitches.length === 1 && group.pitches[0] === group.assistedEvent.liveMidi));
  }
  assert.ok(groups.filter(group => group.measure === 8).every(group => !group.assistedEvent));
  assert.ok(groups.filter(group => group.measure === 14).every(group => !group.assistedEvent));
});

test('bar 14 running sixteenths are quieter while KeyF keeps the E5 lead', () => {
  const keyF = interstellarMap.bindings.find(binding => binding.code === 'KeyF');
  assert.equal(keyF.midi, 76);
  assert.ok(song.measures[13].notes.some(note => note.hand === 'right' && note.midi === keyF.midi));
  assert.equal(practiceNoteGain(14, 69, mix), 0.35);
  assert.equal(practiceNoteGain(14, keyF.midi, mix), 1);
  assert.equal(practiceNoteGain(13, 69, mix), 1);
  assert.equal(highEOctaveMidi, 88);
  assert.equal(shouldDoubleHighE(14, 'KeyF', 76, true), true);
  assert.equal(shouldDoubleHighE(13, 'KeyF', 76, true), false);
  assert.equal(shouldDoubleHighE(14, 'KeyM', 76, true), false);
  assert.equal(shouldDoubleHighE(14, 'KeyF', 76, false), false);
  assert.equal(assistedInterstellarMap.bindings.find(binding => binding.code === 'KeyM').midi, 76);
});

test('a sustained sound never extends the physical note trail', () => {
  const notes = new LiveNotes();
  notes.on('KeyF', 76, 100);
  notes.off('KeyF', 240, true);
  const [sustained] = notes.visible(300, 4400);
  assert.equal(sustained.physicalEndMs, 240);
  assert.equal(sustained.endMs, null);
  notes.pedalUp(800);
  const [released] = notes.visible(900, 4400);
  assert.equal(released.physicalEndMs, 240);
  assert.equal(released.endMs, 800);
  assert.equal(notes.visible(4700, 4400).length, 0);
});
