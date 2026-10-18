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
  'src/piano/pedalInput.ts',
  'src/piano/geometry.ts',
], bundle: true, platform: 'node', format: 'esm', outdir });
const imported = async name => import(pathToFileURL(`${outdir}/${name}.js`).href);
const { interstellarPracticeGroups: groups, interstellarSong: song } = await imported('interstellarPractice');
const { defaultInterstellarMix: mix, practiceNoteGain, sectionGain, shouldDoubleHighE, highEOctaveMidi } = await imported('interstellarMix');
const { interstellarMap, assistedInterstellarMap } = await imported('profiles');
const { LiveNotes } = await imported('liveNotes');
const { PedalInput } = await imported('pedalInput');
const { pianoRange, pianoGeometry } = await imported('geometry');

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
  assert.equal(mix.octaveEnabled, true);
  assert.equal(mix.octave, 0.45);
  assert.equal(shouldDoubleHighE(14, 'KeyF', 76, true), true);
  assert.equal(shouldDoubleHighE(13, 'KeyF', 76, true), false);
  assert.equal(shouldDoubleHighE(14, 'KeyM', 76, true), false);
  assert.equal(shouldDoubleHighE(14, 'KeyF', 76, false), false);
  assert.equal(assistedInterstellarMap.bindings.find(binding => binding.code === 'KeyM').midi, 76);
});

test('only Interstellar bars 9–12 use the section multiplier', () => {
  assert.equal(sectionGain(8), 1);
  assert.equal(sectionGain(9), 0.4);
  assert.equal(sectionGain(12), 0.4);
  assert.equal(sectionGain(13), 1);
  assert.equal(practiceNoteGain(9, 69, mix), 0.4);
  assert.equal(practiceNoteGain(13, 69, mix), 1);
  assert.equal(mix.assisted * sectionGain(9), 0.2);
  assert.equal(mix.assisted * sectionGain(13), 0.5);
});

test('the upper E has a key and aligned note column in the expanded octave', () => {
  const range = pianoRange(interstellarMap.bindings);
  assert.deepEqual(range, { low: 41, high: 96 });
  for (const width of [960, 1920]) {
    const piano = pianoGeometry(width, 0, range.low, range.high);
    assert.ok(piano.keys.has(88));
    assert.ok(piano.keys.get(88).x >= 0 && piano.keys.get(88).x + piano.keys.get(88).width <= width);
    assert.ok(piano.keys.get(88).x > piano.keys.get(76).x);
  }
});

test('Space toggles once per physical press and never on repeat', () => {
  let toggles = 0;
  let prevented = 0;
  const pedal = new PedalInput(() => { toggles++; });
  const event = (repeat = false) => ({ code: 'Space', repeat, target: null, metaKey: false, ctrlKey: false, altKey: false, preventDefault() { prevented++; } });
  pedal.keydown(event());
  pedal.keydown(event(true));
  pedal.keydown(event());
  assert.equal(toggles, 1);
  pedal.keyup(event());
  pedal.keydown(event());
  assert.equal(toggles, 2);
  assert.equal(prevented, 5);
  pedal.reset();
  pedal.keydown(event());
  assert.equal(toggles, 3);
});

test('a sustained sound never extends the physical note trail', () => {
  const notes = new LiveNotes();
  notes.on('KeyF', 76, 100);
  notes.on('octave:KeyF', 88, 100, false, true);
  notes.off('KeyF', 240, true);
  notes.off('octave:KeyF', 240, true);
  const sustained = notes.visible(300, 4400);
  assert.deepEqual(sustained.map(note => note.physicalEndMs), [240, 240]);
  assert.ok(sustained.every(note => note.endMs === null));
  assert.equal(sustained.find(note => note.octave).midi, 88);
  notes.pedalUp(800);
  const released = notes.visible(900, 4400);
  assert.deepEqual(released.map(note => note.physicalEndMs), [240, 240]);
  assert.ok(released.every(note => note.endMs === 800));
  assert.equal(notes.visible(4700, 4400).length, 0);
});
