import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
  export * from './src/piano/performancePresentation';
  export { levelsMap, levelsChordDefaults, levelsTransitionChords } from './src/piano/levels';
  export { interstellarMap, assistedInterstellarMap } from './src/piano/profiles';
  export { LiveNotes } from './src/piano/liveNotes';
  export { LevelsOrb, orbDirection } from './src/components/levelsOrb';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { stageKeyGuide, stageSourceCode, levelsMap, levelsChordDefaults, levelsTransitionChords, interstellarMap, assistedInterstellarMap, LiveNotes, physicalNoteBar, LevelsOrb, orbDirection } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('Levels labels every chord pitch and preserves all shared physical bindings', () => {
  const guide = stageKeyGuide(levelsMap('main'), 0, levelsChordDefaults);
  for (const [code, pitches] of Object.entries(levelsChordDefaults)) {
    assert.deepEqual(Object.entries(guide).filter(([, entries]) => entries.some(entry => entry.code === code)).map(([midi]) => Number(midi)), [...pitches].sort((a,b) => a-b));
  }
  assert.deepEqual(guide[76].map(entry => entry.label), ['U', 'I', 'K', 'L', 'Y', 'P', ';']);
  assert.equal(guide[37][0].hand, 'left');
  assert.equal(guide[68][0].hand, 'right');
  const transition = stageKeyGuide(levelsMap('transition'), 0, levelsTransitionChords);
  assert.deepEqual(Object.keys(transition).map(Number), [64,68,71,76]);
});

test('Interstellar guide follows the active mapping, including assisted physical keys', () => {
  for (const map of [interstellarMap, assistedInterstellarMap]) {
    const guide = stageKeyGuide(map, 0);
    for (const binding of map.bindings) assert.ok(guide[binding.midi].some(entry => entry.code === binding.code));
  }
  assert.ok(stageKeyGuide(assistedInterstellarMap, 0)[69].some(entry => entry.code === 'KeyC'));
  assert.equal(stageSourceCode('levels:KeyU:76'), 'KeyU');
  assert.equal(stageSourceCode('interstellar:Slash:123'), 'Slash');
});

test('physical note bars stop growing on release even when pedal audio continues', () => {
  const notes = new LiveNotes();
  notes.on('KeyU', 76, 0);
  const held = notes.visible(80, 4400)[0];
  assert.equal(physicalNoteBar(held, 80, 440, 4400).height, 8);
  assert.equal(physicalNoteBar(held, 100, 440, 4400).height, 10);
  notes.off('KeyU', 100, true);
  const released = notes.visible(200, 4400)[0];
  const before = physicalNoteBar(released, 200, 440, 4400);
  const later = physicalNoteBar(released, 1200, 440, 4400);
  assert.equal(before.held, false);
  assert.equal(before.height, 10);
  assert.equal(later.height, 10);
  assert.ok(later.bottom < before.bottom, 'completed bar continues rising');
  assert.equal(released.endMs, null, 'audio ownership remains independent');
  assert.deepEqual(notes.soundingPitches(), [76]);
  assert.equal(notes.visible(6000, 4400).length, 0);
  assert.deepEqual(notes.soundingPitches(), [76]);
  notes.pedalUp(6100);
  assert.deepEqual(notes.soundingPitches(), []);
});

test('Levels pitch direction biases low/high notes left/right while middle notes span every quadrant', () => {
  for (let id = 1; id < 25; id++) {
    assert.ok(Math.cos(orbDirection(37, id, 33, 85)) < -.65);
    assert.ok(Math.cos(orbDirection(83, id, 33, 85)) > .65);
  }
  const quadrants = new Set(Array.from({ length: 24 }, (_, id) => Math.floor(orbDirection(60, id, 33, 85) / (Math.PI / 2))));
  assert.equal(quadrants.size, 4);
});

test('orb impulses deform local sections in multiple directions and elastically settle', () => {
  const orb = new LevelsOrb();
  assert.ok(orb.shape.every(value => value === 0));
  orb.impulse(Math.PI, .85); orb.impulse(0, .85);
  for (let frame = 0; frame < 6; frame++) orb.update(1000 / 60);
  assert.ok(orb.shape[0] > .04 && orb.shape[orb.shape.length / 2] > .04, 'simultaneous left and right bulges');
  assert.ok(orb.shape[orb.shape.length / 4] < .02 && orb.shape[orb.shape.length * 3 / 4] < .02, 'surface redistributes instead of scaling uniformly');
  for (let frame = 0; frame < 150; frame++) orb.update(1000 / 60);
  assert.ok(orb.shape.every(value => Math.abs(value) < .0001), 'returns to resting circle');
});

test('orb motion stays bounded under rapid chords and consistent across refresh rates', () => {
  const slow = new LevelsOrb(), fast = new LevelsOrb();
  slow.impulse(.8, 1); fast.impulse(.8, 1);
  for (let frame = 0; frame < 15; frame++) slow.update(1000 / 30);
  for (let frame = 0; frame < 60; frame++) fast.update(1000 / 120);
  assert.ok(slow.shape.every((value, i) => Math.abs(value - fast.shape[i]) < .001));
  for (let frame = 0; frame < 240; frame++) {
    for (let note = 0; note < 8; note++) fast.impulse(frame * 1.7 + note, 1.2);
    fast.update(frame % 3 === 0 ? 1000 : 1000 / 60);
    assert.ok(fast.shape.every(value => Number.isFinite(value) && value >= -.32 && value <= .68));
    assert.ok(fast.bursts.length <= 24 && fast.sparks.length <= 160 && fast.ghosts.length <= 3);
  }
});

test('sharp hits create larger, narrower pointed extensions than rounded hits', () => {
  const rounded = new LevelsOrb(), spiked = new LevelsOrb();
  rounded.impulse(0, 1.2, 0); spiked.impulse(0, 1.2, 1);
  for (let frame = 0; frame < 4; frame++) { rounded.update(1000 / 60); spiked.update(1000 / 60); }
  assert.ok(spiked.shape[0] > .35, 'dramatic outward stretch');
  assert.ok(spiked.shape[0] - rounded.shape[0] > .1);
  assert.ok(spiked.shape[0] - spiked.shape[3] > rounded.shape[0] - rounded.shape[3], 'steeper local tip');
  assert.ok(spiked.sparks.length > 0 && spiked.ghosts.length > 0);
});

test('dense chord activity drives stronger reactions, and all secondary effects expire', () => {
  const single = new LevelsOrb(), chord = new LevelsOrb();
  single.impulse(0, .5, .2);
  for (let note = 0; note < 8; note++) chord.impulse(note * .09, 1.5, .9);
  single.update(40); chord.update(40);
  assert.ok(chord.activity > single.activity);
  assert.ok(Math.max(...chord.shape) > Math.max(...single.shape));
  assert.ok(chord.sparks.length > single.sparks.length);
  for (let frame = 0; frame < 240; frame++) chord.update(1000 / 60);
  assert.equal(chord.bursts.length + chord.sparks.length + chord.ghosts.length, 0);
  assert.ok(chord.shape.every(value => Math.abs(value) < .0001));
});
