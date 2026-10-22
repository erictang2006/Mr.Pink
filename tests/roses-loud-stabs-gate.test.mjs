import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fakeTone = `
export class ToneAudioBuffer {
  loaded = false;
  duration = .34;
  load(url) { this.url = url; this.loaded = true; this.duration = url.includes('sustain') ? .34 : .78; return Promise.resolve(this); }
  dispose() { this.disposed = true; }
}
export class Gain {
  constructor(level) {
    this.events = [];
    this.gain = {
      setValueAtTime: (value, time) => this.events.push(['set', value, time]),
      linearRampToValueAtTime: (value, time) => this.events.push(['ramp', value, time]),
      cancelAndHoldAtTime: time => this.events.push(['hold', time]),
      rampTo: value => { this.gain.value = value; },
    };
  }
  connect() { return this; }
  toDestination() { return this; }
  dispose() { this.disposed = true; }
}
export class Filter extends Gain {}
export class ToneBufferSource {
  constructor(options) { this.options = options; this.stops = []; }
  connect() { return this; }
  start(time) { this.started = time; }
  stop(time) { this.stops.push(time); }
  dispose() { this.disposed = true; }
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

test('pitched drop hits reuse the finished Fm7 recording and the physical-key release envelope',async()=>{
 const engine=new RosesLoudStabsEngine();await engine.load();engine.setRelease(.2);
 engine.triggerPitch(65,.125,10,.6);
 const hit=[...engine.samples][0];
 assert.equal(hit.source.options.url.url,'/roses/chords/loud-stabs-recorded-fm7.wav');
 assert.equal(hit.source.options.playbackRate,1);
 assert.deepEqual(hit.gain.events,[['set',.6,10],['hold',10.125],['ramp',0,10.325]]);
 engine.triggerPitch(77,.125,11);assert.equal([...engine.samples][1].source.options.playbackRate,2);
 assert.equal(engine.activeLoops.size,0,'short MIDI gates never reach the long-hold loop');
 engine.cancel();assert.equal(engine.samples.size,0);engine.dispose();
});

test('the live recordings use the shared brightness EQ with a neutral original tone at 2800',async()=>{
 const engine=new RosesLoudStabsEngine();await engine.load();
 engine.setBrightness(2800);assert.equal(engine.tone.gain.value,0);
 engine.setBrightness(650);assert.equal(engine.tone.gain.value,-12);
 engine.setBrightness(4000);assert.equal(engine.tone.gain.value,6);
 engine.attack('Digit3',0);
 assert.equal(engine.heldSamples.get('Digit3')[0].source.options.url.url,'/roses/chords/loud-stabs-recorded-fm7.wav');
 engine.dispose();
});

test('offline ended callbacks retain the recorded audio nodes until rendering has finished',async()=>{
 const engine=new RosesLoudStabsEngine();await engine.load();engine.triggerPitch(65,.125,1);
 const hit=[...engine.samples][0];hit.source.context={isOffline:true};hit.source.options.onended();
 assert.equal(hit.source.disposed,undefined);assert.equal(hit.gain.disposed,undefined);
 assert.equal(engine.offlineEnded.has(hit),true);
 engine.dispose();assert.equal(hit.source.disposed,true);assert.equal(hit.gain.disposed,true);
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
