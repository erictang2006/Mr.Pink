import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const output = '/private/tmp/stage-piano-keyboard-test.mjs';
await build({ entryPoints: ['src/piano/keyboardInput.ts'], bundle: true, platform: 'node', format: 'esm', outfile: output });
const { KeyboardInputManager } = await import(pathToFileURL(output).href);

class EventTargetMock {
  listeners = new Map();
  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== callback));
  }
  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
}

function setup() {
  globalThis.window = new EventTargetMock();
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  globalThis.document = new EventTargetMock();
  document.hidden = false;
  const attacks = [];
  const releases = [];
  let latest;
  const map = { id: 'test', name: 'Test', bindings: [{ code: 'KeyZ', label: 'Z', midi: 48, shiftedMidi: 60 }, { code: 'KeyQ', label: 'Q', midi: 60, shiftedMidi: 72 }] };
  const manager = new KeyboardInputManager(map, { noteOn: pitch => attacks.push(pitch), noteOff: pitch => releases.push(pitch), change: snapshot => { latest = snapshot; } });
  manager.setEnabled(true);
  const key = (type, code, shiftKey = false, repeat = false) => window.dispatch(type, { code, shiftKey, repeat, target: null, preventDefault() {} });
  return { manager, key, attacks, releases, snapshot: () => latest };
}

test('held keys ignore repeat and release the pitch captured at keydown', () => {
  const state = setup();
  state.key('keydown', 'KeyZ');
  state.key('keydown', 'KeyZ', false, true);
  state.key('keydown', 'KeyQ', true);
  assert.deepEqual(state.attacks, [48, 72]);
  assert.deepEqual(state.snapshot().pressed.map(item => item.midi), [48, 72]);
  state.key('keyup', 'KeyQ', false);
  state.key('keyup', 'KeyZ', true);
  assert.deepEqual(state.releases, [72, 48]);
  state.manager.dispose();
});

test('losing focus and disabling performance release all held notes', () => {
  const state = setup();
  state.key('keydown', 'KeyZ');
  state.key('keydown', 'KeyQ');
  window.dispatch('blur');
  assert.deepEqual(state.releases, [48, 60]);
  assert.equal(state.snapshot().pressed.length, 0);
  state.key('keydown', 'KeyZ');
  state.manager.setEnabled(false);
  assert.deepEqual(state.releases, [48, 60, 48]);
  state.manager.dispose();
});

test('section map changes preserve the original held pitch until keyup', () => {
  const state = setup();
  state.key('keydown', 'KeyQ');
  state.manager.setMap({ id: 'transition', name: 'Transition', bindings: [{ code: 'KeyQ', label: 'Q', midi: 68 }] }, true);
  assert.deepEqual(state.releases, []);
  state.key('keydown', 'KeyQ', false, true);
  assert.deepEqual(state.attacks, [60]);
  state.key('keyup', 'KeyQ');
  assert.deepEqual(state.releases, [60]);
  state.key('keydown', 'KeyQ');
  assert.deepEqual(state.attacks, [60, 68]);
  state.manager.dispose();
});
