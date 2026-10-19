import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/piano/synthEngine.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { SynthEngine } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('stopping Roses backing mutes its bus and releases an attack queued just after Stop', () => {
  const events = [];
  let pending = null;
  const priorWindow = globalThis.window;
  globalThis.window = {
    setTimeout(callback) { pending = callback; return 1; },
    clearTimeout() { pending = null; },
  };
  try {
    const engine = Object.create(SynthEngine.prototype);
    engine.loopGain = { gain: {
      setValueAtTime(value) { events.push(['gain', value]); },
      rampTo(value) { events.push(['ramp', value]); },
    } };
    engine.loopVoice = {
      releaseAll() { events.push(['release']); },
      triggerAttackRelease() { events.push(['attack']); },
    };
    engine.ready = true;
    engine.loading = false;
    engine.disposed = false;
    engine.loopStopTimer = null;
    engine.loopLevel = .55;
    engine.loopStopped = false;

    engine.stopLoop();
    assert.deepEqual(events, [['gain', 0], ['release']]);
    assert.equal(typeof pending, 'function');
    const lateRelease = pending;
    pending = null;
    lateRelease();
    assert.deepEqual(events, [['gain', 0], ['release'], ['release']]);

    engine.setLoopLevel(1.2);
    assert.deepEqual(events, [['gain', 0], ['release'], ['release']], 'changing level does not unmute stopped backing');

    engine.triggerLoopNote(64, 0, 1);
    assert.deepEqual(events.slice(-2), [['gain', 1.2], ['attack']]);
    assert.equal(pending, null);
    engine.setLoopLevel(.8);
    assert.deepEqual(events.at(-1), ['ramp', .8], 'adjustment affects active backing');
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});
