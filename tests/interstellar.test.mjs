import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

await build({ entryPoints: ['src/piano/profiles.ts', 'src/piano/keyboardInput.ts', 'src/piano/geometry.ts'], bundle: true, platform: 'node', format: 'esm', outdir: '/private/tmp/stage-piano-interstellar-test' });
const { interstellarMap, defaultProfiles, loadProfiles } = await import(pathToFileURL('/private/tmp/stage-piano-interstellar-test/profiles.js').href);
const { KeyboardInputManager } = await import(pathToFileURL('/private/tmp/stage-piano-interstellar-test/keyboardInput.js').href);
const { pianoGeometry, pianoRange } = await import(pathToFileURL('/private/tmp/stage-piano-interstellar-test/geometry.js').href);

const expected = {
  Digit4: 41, Digit5: 43, Digit6: 45, Digit7: 47, Digit8: 48, Digit9: 50, Digit0: 52,
  KeyQ: 53, KeyW: 55, KeyE: 57, KeyR: 59, KeyT: 60, KeyY: 62, KeyU: 64,
  KeyI: 65, KeyO: 67, KeyP: 69, KeyA: 71, KeyS: 72, KeyD: 74, KeyF: 76,
  KeyH: 79, KeyJ: 81, KeyK: 83,
};

test('bundled Interstellar assignments exactly match the supplied 24-note inventory', () => {
  assert.equal(interstellarMap.name, 'Interstellar (Roblox-Aligned)');
  assert.deepEqual(Object.fromEntries(interstellarMap.bindings.map(({ code, midi }) => [code, midi])), expected);
  assert.ok(interstellarMap.bindings.every(binding => binding.shiftedMidi === undefined));
  assert.ok(interstellarMap.bindings.every(binding => binding.label === binding.code.replace(/^(Key|Digit)/, '').toLowerCase()));
  assert.ok(defaultProfiles.some(profile => profile.id === 'standard'));
  assert.ok(defaultProfiles.some(profile => profile.id === 'rush-e'));
});

test('existing stored profiles survive while the exact bundled preset is added', () => {
  const old = { id: 'interstellar', name: 'Interstellar', bindings: [{ code: 'KeyQ', label: 'Q', midi: 60 }] };
  globalThis.localStorage = { getItem: () => JSON.stringify([old]), setItem() {} };
  const loaded = loadProfiles();
  assert.equal(loaded.find(profile => profile.id === 'interstellar').bindings[0].midi, 60);
  assert.equal(loaded.find(profile => profile.id === interstellarMap.id).bindings.length, 24);
});

class EventTargetMock {
  listeners = new Map();
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener)); }
  dispatch(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

test('chords, Shift changes, and rapid repeated presses produce one assigned note per keydown', () => {
  globalThis.window = new EventTargetMock();
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  globalThis.document = new EventTargetMock();
  document.hidden = false;
  const attacks = [], releases = [];
  let snapshot;
  const input = new KeyboardInputManager(interstellarMap, {
    noteOn: (midi, code) => attacks.push([code, midi]),
    noteOff: (midi, code) => releases.push([code, midi]),
    change: value => { snapshot = value; },
  });
  input.setEnabled(true);
  const key = (type, code, shiftKey = false, repeat = false) => window.dispatch(type, { code, shiftKey, repeat, target: null, preventDefault() {} });
  key('keydown', 'Digit4');
  key('keydown', 'KeyT');
  key('keydown', 'KeyA', true);
  key('keydown', 'KeyT', false, true);
  key('keydown', 'KeyZ');
  assert.deepEqual(attacks, [['Digit4', 41], ['KeyT', 60], ['KeyA', 71]]);
  assert.deepEqual(snapshot.pressed.map(item => item.midi), [41, 60, 71]);
  key('keyup', 'KeyA', false);
  key('keyup', 'KeyT', true);
  key('keyup', 'Digit4');
  key('keydown', 'KeyT');
  key('keyup', 'KeyT');
  key('keydown', 'KeyT');
  key('keyup', 'KeyT');
  assert.deepEqual(releases, [['KeyA', 71], ['KeyT', 60], ['Digit4', 41], ['KeyT', 60], ['KeyT', 60]]);
  assert.equal(attacks.filter(([code]) => code === 'KeyT').length, 3);
  input.dispose();
});

test('switching to the Standard preset releases held Interstellar notes and clears keys', () => {
  globalThis.window = new EventTargetMock();
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  globalThis.document = new EventTargetMock();
  document.hidden = false;
  const attacks = [], releases = [];
  let snapshot;
  const input = new KeyboardInputManager(interstellarMap, {
    noteOn: midi => attacks.push(midi),
    noteOff: midi => releases.push(midi),
    change: value => { snapshot = value; },
  });
  input.setEnabled(true);
  const event = code => ({ code, shiftKey: false, repeat: false, target: null, preventDefault() {} });
  window.dispatch('keydown', event('KeyT'));
  input.setMap(defaultProfiles.find(profile => profile.id === 'standard'));
  assert.deepEqual(releases, [60]);
  assert.deepEqual(snapshot.pressed, []);
  window.dispatch('keydown', event('KeyT'));
  assert.deepEqual(attacks, [60, 67]);
  input.dispose();
});

test('visualizer and piano share the same Interstellar key geometry at projector widths', () => {
  const range = pianoRange(interstellarMap.bindings);
  assert.deepEqual(range, { low: 41, high: 84 });
  for (const width of [960, 1920]) {
    const { keys, whites } = pianoGeometry(width, 0, range.low, range.high);
    assert.equal(whites[0], 41);
    assert.ok(keys.has(83));
    assert.ok(keys.get(60).x < keys.get(62).x);
    assert.ok(Math.abs(keys.get(60).width * whites.length - width) < 0.001);
  }
});
