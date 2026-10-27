import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const bundle = await build({ stdin: { contents: `
export * from './src/piano/levelsRealPiano';
export * from './src/piano/levels';
export * from './src/piano/noteMapping';
export * from './src/piano/geometry';
export * from './src/piano/interstellarRoblox';
export * from './src/piano/keyboardInput';
export {drawPerformancePiano} from './src/components/performancePiano';
export {default as IndividualSheet, levelsNoteRows, levelsHandRests} from './src/components/LevelsIndividualSheet';
export {default as LevelsPractice} from './src/components/LevelsPractice';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false,
plugins: [{ name: 'shared-react', setup(b) { b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: pathToFileURL(createRequire(import.meta.url).resolve(args.path)).href, external: true })); } }] });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { levelsEMajor: map, levelsSong: song, levelsInputs, levelsRealInputs, getPitch, LevelsChordCollector, KeyboardInputManager } = api;

test('E-major mapping keeps every existing white-key position and octave without Shift', () => {
  assert.equal(map.id, 'levelsEMajor');
  for (const binding of api.interstellarRobloxMap.bindings) {
    assert.equal(getPitch(map, binding.code, false), binding.midi + 4);
    assert.equal(getPitch(map, binding.code, true), binding.midi + 4);
    assert.equal(map.bindings.find(item => item.code === binding.code).positionMidi, binding.midi);
  }
  assert.deepEqual(['KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','KeyA'].map(code => getPitch(map, code, false)), [64,66,68,69,71,73,75]);
  assert.equal(new Set(map.bindings.map(binding => binding.code)).size, map.bindings.length);
  assert.equal(new Set(map.bindings.map(binding => binding.midi)).size, map.bindings.length);
  assert.equal(getPitch(api.standardMap, 'KeyT', false), 67, 'other presets are unchanged');
  assert.equal(getPitch(api.interstellarRobloxMap, 'KeyT', false), 60);
});

test('every active score pitch has exactly one unshifted key, including the bass extensions', () => {
  for (const note of song.measures.flatMap(bar => bar.notes)) {
    const bindings = map.bindings.filter(binding => binding.midi === note.midi);
    assert.equal(bindings.length, 1, `MIDI ${note.midi}`);
    assert.equal(getPitch(map, bindings[0].code, false), note.midi);
  }
  assert.deepEqual(['BracketLeft', 'BracketRight', 'Backslash'].map(code => getPitch(map, code, false)), [33,35,37]);
  assert.deepEqual(Object.keys(api.levelsRealDrums).filter(code => map.bindings.some(binding => binding.code === code)), []);
});

test('individual prompts come from exact score events, independent of assisted chords', () => {
  const real = levelsRealInputs(), assisted = levelsInputs();
  assert.deepEqual(real.map(group => [group.id, group.absoluteBeat]), assisted.map(group => [group.id, group.absoluteBeat]));
  for (const group of real) {
    const notes = song.measures[group.measure - 1].notes.filter(note => note.beat === group.beat && !note.tieFromPrevious);
    assert.deepEqual([...group.pitches].sort((a,b)=>a-b), [...new Set(notes.map(note => note.midi))].sort((a,b)=>a-b));
    assert.deepEqual(group.notes, notes);
    assert.deepEqual(group.codes.map(code => getPitch(map, code, false)), group.pitches);
  }
  assert.deepEqual(assisted[0].codes, ['KeyA','KeyO']);
  assert.equal(real[0].pitches.length, 6);
  assert.deepEqual(real.filter(group => group.measure === 9).map(group => group.pitches), [[68],[71],[76],[71]]);
  assert.equal(real.filter(group => group.measure > 12).length, 0, 'empty score bars stay empty');
});

test('geometry preserves every rectangle and black/white position at desktop and narrow widths', () => {
  const range = api.pianoRange(api.levelsMap('main').bindings);
  for (const width of [375, 1440]) {
    const old = api.pianoGeometry(width, 0, range.low, range.high);
    const actual = api.mappedPianoGeometry(map, width, 0, range.low, range.high);
    assert.deepEqual([...actual.keys.values()], [...old.keys.values()]);
    assert.equal(actual.whiteWidth, old.whiteWidth);
    assert.equal(actual.blackWidth, old.blackWidth);
    assert.equal(actual.keys.size, old.keys.size, 'no remapped visual slots collide');
    for (const binding of map.bindings) assert.deepEqual(actual.keys.get(binding.midi), old.keys.get(binding.positionMidi));
    assert.equal(actual.keys.get(66).black, false, 'F-sharp uses the old D white key');
    assert.equal(actual.keys.get(65).black, true, 'F natural uses the old C-sharp black key');
  }
});

test('chords require overlapping individual attacks within the chord window', () => {
  const collector = new LevelsChordCollector();
  assert.equal(collector.press('one', [64,68,71], 64, 0, [64], 100).complete, false);
  assert.equal(collector.press('one', [64,68,71], 68, 30, [64,68], 100).complete, false);
  assert.equal(collector.press('one', [64,68,71], 71, 90, [64,68,71], 100).complete, true);
  assert.equal(collector.hasPending('one', 95, [64,68,71], 100), true);
  assert.equal(collector.hasPending('one', 500, [64,68,71], 100), false);
  assert.equal(collector.hasPending('one', 95, [], 100), false);
  collector.clear();
  collector.press('two', [64,68], 64, 0, [64], 100);
  assert.equal(collector.press('two', [64,68], 68, 50, [68], 100).complete, false, 'a released/pedal-held pitch cannot satisfy a chord');
  assert.equal(collector.press('two', [64,68], 64, 200, [64,68], 100).complete, false, 'expired attacks are discarded');
  assert.equal(collector.press('two', [64,68], 68, 220, [64,68], 100).complete, true);
  assert.equal(collector.press('next', [64,68], 64, 230, [64,68], 100).complete, false, 'repeated chords require fresh attacks');
  collector.clear();
  assert.equal(collector.press('next', [64,68], 68, 240, [64,68], 100).complete, false, 'switch/reset clears partial progress');
});

class Target {
  listeners = new Map();
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== fn)); }
  dispatch(type, event = {}) { for (const fn of this.listeners.get(type) ?? []) fn(event); }
}

test('physical input emits one note per key, supports overlapping chords, and releases on switches/blur', () => {
  globalThis.window = new Target(); window.setInterval = setInterval; window.clearInterval = clearInterval;
  globalThis.document = new Target(); document.hidden = false;
  const attacks = [], releases = [], results = [];
  const collector = new LevelsChordCollector();
  const manager = new KeyboardInputManager(map, {
    noteOn: (midi, _code, at) => { attacks.push(midi); results.push(collector.press('chord', [64,68,71], midi, at, manager.heldPitches(), 450)); },
    noteOff: midi => releases.push(midi), change() {},
    chordOn() { assert.fail('Real Piano must never trigger assisted chords'); },
  });
  manager.setEnabled(true);
  const key = (type, code, shiftKey = false, repeat = false) => window.dispatch(type, { code, shiftKey, repeat, target: null, preventDefault() {} });
  try {
    key('keydown', 'KeyT'); key('keydown', 'KeyT', false, true); key('keydown', 'KeyU', true); key('keydown', 'KeyO');
    assert.deepEqual(attacks, [64,68,71]); assert.equal(results.at(-1).complete, true);
    key('keyup', 'KeyU', false); assert.deepEqual(releases, [68]);
    manager.setMap(api.levelsMap('main')); assert.deepEqual(releases, [68,64,71]); assert.deepEqual(manager.heldPitches(), []);
    manager.setMap(map); key('keydown', 'BracketLeft'); window.dispatch('blur');
    assert.equal(releases.at(-1), 33); assert.deepEqual(manager.heldPitches(), []);
  } finally { manager.dispose(); }
});

test('note layout keeps exact durations, simultaneous starts, rests, and cross-bar ties', () => {
  for (const bar of song.measures) {
    const rows = api.levelsNoteRows(bar);
    assert.ok(rows.every(note => note.row < 6), `bar ${bar.number} fits six visible lanes`);
    for (const note of rows) for (const other of rows) if (note !== other && note.row === other.row) {
      assert.ok(note.beat + note.duration <= other.beat || other.beat + other.duration <= note.beat);
    }
  }
  const custom = structuredClone(song); const bar = custom.measures[0];
  bar.notes = [{beat:3,duration:1,midi:64,hand:'right',tieFromPrevious:false,tieToNext:true}];
  custom.measures[1].notes = [{beat:0,duration:2,midi:64,hand:'right',tieFromPrevious:true,tieToNext:false}];
  assert.equal(levelsRealInputs(custom).filter(group => group.measure <= 2).length, 1, 'ties do not become new attacks');
  assert.equal(api.levelsNoteRows(custom.measures[1])[0].tieFromPrevious, true);
});

test('both sheets render in order with the same boundaries and real note labels', () => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(api.LevelsPractice, {
    playingMode:'real',setPlayingMode:noop,getHeldPitches:()=>[],releaseModeVoices:noop,
    map,range:{low:33,high:96},snapshot:{pressed:[],detected:[],notesPerSecond:0,shift:false},pressedPitches:[],audioReady:false,startAudio:noop,
    onNoteRef:{current:null},onUnmappedRef:{current:null},onExit:noop,onMeasureChange:noop,resetVoices:noop,
    transitionGain:.4,setTransitionGain:noop,chords:api.levelsChordDefaults,setChords:noop,
    sustainSettings:{releaseSeconds:.5,showIndicator:true},setSustainSettings:noop,sustainActive:false,
    showAssistedNotes:true,setShowAssistedNotes:noop,onSongChange:noop,onSandbox:noop,
    drums:null,drumSnapshot:null,drumMix:{kick:1,clap:1,hat:1,fill:1,riser:1},setDrumMix:noop,setDrumMode:noop,
  }));
  assert.ok(html.indexOf('ASSISTED KEYBINDS') < html.indexOf('INDIVIDUAL NOTE KEYBINDS'));
  assert.equal((html.match(/class="practice-measure-head"/g) ?? []).length, 32);
  assert.match(html, /\[A O\]/); assert.match(html, /REAL PIANO ACTIVE/); assert.match(html, /F1 KICK/);
  assert.equal((html.match(/class="levels-hand-heading">RIGHT HAND/g) ?? []).length, 16);
  assert.equal((html.match(/class="levels-hand-heading">LEFT HAND/g) ?? []).length, 16);
  assert.match(html, /A1/); assert.match(html, /C♯2/); assert.match(html, /F♯5/);
  assert.match(html, /aria-pressed="true"[^>]*>Real Piano/);
});


test('Real Piano drum instructions preserve assisted text and identify the new shortcuts', () => {
  assert.equal(api.levelsDrumHint('Press Z/X/C; V or B to cue Roses', false), 'Press Z/X/C; V or B to cue Roses');
  assert.equal(api.levelsDrumHint('Press Z/X/C; V or B to cue Roses', true), 'Press F1/F2/F3; F4 or F5 to cue Roses');
});


test('Levels 5/4 hold their paired bracket keys with independent ownership and cleanup', () => {
  globalThis.window = new Target(); window.setInterval = setInterval; window.clearInterval = clearInterval;
  globalThis.document = new Target(); document.hidden = false;
  const attacks = [], releases = []; let snapshot;
  const manager = new KeyboardInputManager(map, {
    noteOn: (midi, code) => attacks.push([code, midi]),
    noteOff: (midi, code) => releases.push([code, midi]), change: value => { snapshot = value; },
  });
  manager.setEnabled(true);
  const key = (type, code, repeat = false) => window.dispatch(type, { code, shiftKey:false, repeat, target:null, preventDefault() {} });
  try {
    for (const [source, target] of [['Digit5', 'BracketRight'], ['Digit4', 'BracketLeft']]) {
      attacks.length = 0; releases.length = 0;
      key('keydown', source); key('keydown', source, true);
      assert.deepEqual(attacks, [[source, getPitch(map, source, false)], [target, getPitch(map, target, false)]]);
      assert.deepEqual(snapshot.pressed.map(note => note.code), [source, target], 'both existing key visuals receive active input');
      key('keydown', target);
      assert.equal(attacks.length, 2, 'pressing a bracket already held by its number does not double-trigger');
      key('keyup', source);
      assert.deepEqual(snapshot.pressed.map(note => note.code), [target], 'a physically held bracket survives releasing the number');
      key('keyup', target); assert.equal(snapshot.pressed.length, 0);
      assert.deepEqual(releases.map(note => note[0]), [source, target]);
      key('keydown', target); key('keydown', source); key('keyup', target);
      assert.deepEqual(snapshot.pressed.map(note => note.code).sort(), [source, target].sort(), 'the number continues holding a released bracket');
      key('keyup', source); assert.equal(snapshot.pressed.length, 0);
    }
    key('keydown', 'Digit5'); key('keydown', 'Digit4');
    window.dispatch('blur'); assert.equal(snapshot.pressed.length, 0);
    key('keydown', 'Digit5'); manager.setMap(api.standardMap);
    assert.equal(snapshot.pressed.length, 0, 'mode/map switching releases both notes');
    manager.setMap(api.interstellarRobloxMap); attacks.length = 0;
    key('keydown', 'Digit5'); assert.equal(attacks.length, 1, 'other song maps do not gain paired notes');
  } finally { manager.dispose(); }
});


test('custom hand lanes use the exact requested fingering and preserve every scored note', () => {
  assert.equal(api.levelsRightHandSequence, String.raw`pu\pu\p\uut8out8outo8tuo8oyoyippijhf`);
  const rightKeys = new Set(api.levelsRightHandSequence);
  for (const binding of map.bindings) assert.equal(api.levelsPracticeHand(binding.midi), rightKeys.has(binding.label) ? 'right' : 'left');
  for (const bar of song.measures) {
    const signature = note => JSON.stringify([note.beat,note.duration,note.midi,note.hand,note.tieFromPrevious,note.tieToNext]);
    const parts = ['right','left'].flatMap(hand => api.levelsNoteRows(bar, hand));
    assert.deepEqual(parts.map(signature).sort(), bar.notes.map(signature).sort(), `bar ${bar.number}: no notes added, lost, or retimed`);
    for (const hand of ['right','left']) {
      const notes = api.levelsNoteRows(bar, hand);
      assert.ok(notes.every(note => note.row < 4), `bar ${bar.number}: ${hand} fits the visible lanes`);
      for (const rest of api.levelsHandRests(bar, hand)) {
        assert.ok(rest.duration > 0);
        assert.ok(notes.every(note => note.beat + note.duration <= rest.beat || note.beat >= rest.beat + rest.duration));
      }
      if (!notes.length) assert.deepEqual(api.levelsHandRests(bar, hand), [{beat:0,duration:bar.beats}]);
    }
  }
  assert.equal(api.levelsPracticeHand(37), 'right', 'backslash bass belongs to the requested right hand');
  assert.equal(api.levelsPracticeHand(52), 'right', '8 belongs to the requested right hand');
  assert.equal(api.levelsPracticeHand(33), 'left', 'left bracket remains left hand');
  assert.equal(api.levelsPracticeHand(35), 'left', 'right bracket remains left hand');
});


test('Performance draws individual E-major labels at sounding pitches, with paired-key highlighting', () => {
  const guide = api.levelsIndividualGuide();
  assert.equal(Object.keys(guide).length, map.bindings.length);
  for (const binding of map.bindings) {
    assert.deepEqual(guide[binding.midi], [{code:binding.code,label:binding.label.toUpperCase(),hand:api.levelsPracticeHand(binding.midi)}]);
  }
  const shifted = api.levelsIndividualGuide(12);
  assert.deepEqual(shifted[76], guide[64], 'octave offsets keep physical labels and hands together');
  const range = api.pianoRange(api.levelsMap('main').bindings);
  range.high = Math.max(range.high, ...map.bindings.map(binding => binding.midi));
  const geometry = api.mappedPianoGeometry(map, 1440, 0, range.low, range.high, true);
  const actual = api.pianoGeometry(1440, 0, range.low, range.high);
  for (const binding of map.bindings) {
    assert.deepEqual(geometry.keys.get(binding.midi), actual.keys.get(binding.midi), `label ${binding.label} occupies MIDI ${binding.midi}`);
    assert.equal(geometry.keys.get(binding.midi).black, api.isBlack(binding.midi));
  }
  assert.equal(geometry.keys.get(64).black, false, 'T is on E4, a white key');
  assert.equal(geometry.keys.get(66).black, true, 'Y is on F-sharp4, a black key');
  assert.equal(geometry.keys.get(68).black, true, 'U is on G-sharp4, a black key');
  assert.equal(geometry.keys.get(33).black, false, 'left bracket is on A1, a white key');
  assert.equal(geometry.keys.get(35).black, false, 'right bracket is on B1, a white key');
  const rendered = [];
  const ctx = new Proxy({
    createLinearGradient: () => ({addColorStop() {}}),
    fillText(label) { rendered.push({label, color:ctx.fillStyle}); },
  }, {get(target, name) { return name in target ? target[name] : () => {}; }});
  const codes = ['Digit5','BracketRight','Digit4','BracketLeft'];
  api.drawPerformancePiano(ctx, 1440, 250, geometry, guide, new Set(codes.map(code => getPitch(map, code, false))), new Set(codes), 'levels');
  assert.equal(rendered.length, map.bindings.length, 'one keycap for each individual physical binding');
  for (const label of ['5',']','4','[']) {
    assert.deepEqual(rendered.filter(entry => entry.label === label), [{label,color:'#06111f'}], `${label} keycap is pressed`);
  }
  assert.equal(rendered.filter(entry => entry.label === 'U').length, 1, 'assisted chord labels do not spread across pitches');
});
