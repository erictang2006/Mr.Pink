import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fakeTone = `
export class ToneAudioBuffer {
  loaded = false;
  duration = .34;
  load(url) { this.url = url; this.loaded = true; this.duration = url.includes('sustain') ? .34 : .78; return Promise.resolve(this); }
  dispose() {}
}
export class Gain {
  constructor(level) {
    this.events = [];
    this.gain = {
      setValueAtTime: (value, time) => this.events.push(['set', value, time]),
      linearRampToValueAtTime: (value, time) => this.events.push(['ramp', value, time]),
      cancelAndHoldAtTime: time => this.events.push(['hold', time]),
      rampTo: () => {},
    };
  }
  connect() { return this; }
  toDestination() { return this; }
  dispose() {}
}
export class Filter extends Gain {}
export class ToneBufferSource {
  constructor(options) { this.options = options; this.stops = []; }
  connect() { return this; }
  start(time) { this.started = time; }
  stop(time) { this.stops.push(time); }
  dispose() {}
}
export const immediate = () => 0;
`;
const bundle = await build({
  entryPoints: ['src/piano/rosesLoudStabsEngine.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'fake-tone',
    setup(build) {
      build.onResolve({ filter: /^tone$/ }, () => ({ path: 'tone', namespace: 'fake' }));
      build.onLoad({ filter: /.*/, namespace: 'fake' }, () => ({ contents: fakeTone, loader: 'js' }));
    },
  }],
});
const { RosesLoudStabsEngine } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('short keyup fades each recorded hit and loop before the fixed 0.8-second sample ends', async () => {
  const engine = new RosesLoudStabsEngine();
  await engine.load();
  assert.equal(engine.isReady(), true);
  for (const [key, suffix] of [['Digit1', 'dbadd9'], ['Digit2', 'eb-major'], ['Digit3', 'fm7']]) {
    engine.attack(key, 0);
    const sample = engine.heldSamples.get(key)?.at(-1);
    const loop = engine.heldLoops.get(key)?.at(-1);
    assert.ok(sample && loop);
    assert.equal(sample.source.options.url.url, `/roses/chords/loud-stabs-recorded-${suffix}.wav`);
    assert.equal(loop.source.options.url.url, `/roses/chords/loud-stabs-recorded-${suffix}-sustain.wav`);
    engine.release(key, .1);
    for (const voice of [sample, loop]) {
      assert.deepEqual(voice.gain.events.slice(-2), [['hold', .1], ['ramp', 0, .22]]);
      assert.ok(voice.source.stops[0] < .25, 'short tap ends before the source would naturally end');
    }
  }
  const before = engine.samples.size;
  engine.attack('Digit4', 0);
  assert.equal(engine.samples.size, before, 'keys 4–8 are not handled by this engine');
  engine.dispose();
});

test('a long hold keeps its recorded loop active until keyup, then fades it', async () => {
  const engine = new RosesLoudStabsEngine();
  await engine.load();
  engine.attack('Digit1', 0);
  const loop = engine.heldLoops.get('Digit1')[0];
  assert.equal(loop.source.stops.length, 0);
  engine.release('Digit1', 2);
  assert.deepEqual(loop.gain.events.slice(-2), [['hold', 2], ['ramp', 0, 2.12]]);
  assert.ok(loop.source.stops[0] > 2.12 && loop.source.stops[0] < 2.15);
  engine.dispose();
});

test('old saved long releases migrate to the short physical-key gate', async () => {
  const settingsBundle = await build({
    entryPoints: ['src/piano/rosesDropSettings.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const { defaultRosesDropSettings, validRosesDropSettings } = await import(
    `data:text/javascript;base64,${Buffer.from(settingsBundle.outputFiles[0].text).toString('base64')}`);
  assert.equal(defaultRosesDropSettings.closerRelease, .12);
  assert.equal(validRosesDropSettings({ closerRelease: .9 }).closerRelease, .12);
  assert.equal(validRosesDropSettings({ closerRelease: .2 }).closerRelease, .2);
});
