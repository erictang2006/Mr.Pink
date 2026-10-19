import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/piano/rosesCloser.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const cue = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('the marked word lands at bar 27 beat 1&, including the unprocessed pickup', () => {
  const plan = cue.closerCuePlan(cue.defaultCloserSettings);
  assert.equal(plan.onsetBeat, 104.5);
  assert.ok(Math.abs(plan.onsetBeat * .6 - 62.7) < 1e-10);
  assert.ok(Math.abs(plan.startBeat * .6 + cue.closerSource.pickupSeconds - 62.7) < 1e-10);
  assert.equal(cue.closerSource.originalPlaybackRate, 1);
  for (const secondsPerBeat of [.48, .6, 1.2]) {
    const settings = { ...cue.defaultCloserSettings, offsetMs: 130 };
    const plan = cue.closerCuePlan(settings, secondsPerBeat);
    assert.ok(Math.abs(plan.startBeat * secondsPerBeat + .12 - (104.5 * secondsPerBeat + .13)) < 1e-9);
  }
});

test('every entrance preset maps to its displayed measure and beat', () => {
  for (const preset of cue.closerTimingPresets) {
    const plan = cue.closerCuePlan({ ...cue.defaultCloserSettings, preset: preset.id });
    assert.equal(plan.onsetBeat, preset.beat);
  }
  assert.equal(cue.validCloserSettings({ preset: 'missing', offsetMs: Infinity }).preset, '27-1-and');
  assert.equal(cue.validCloserSettings({ offsetMs: 2000 }).offsetMs, 1000);
  const migrated = cue.migrateCloserSettings({ preset: '20-4-and', offsetMs: 90, rosesLevel: .6, closerLevel: .8 });
  assert.equal(migrated.preset, '27-1-and');
  assert.deepEqual([migrated.offsetMs, migrated.rosesLevel, migrated.closerLevel], [0, .6, .8]);
  assert.equal(cue.migrateCloserSettings({ preset: '21-1' }).preset, '27-1-and', 'the temporary experiment starts at its requested entrance');
  assert.equal(cue.validCloserSettings({ preset: '20-4-and' }).preset, '20-4-and', 'older presets remain selectable after migration');
});

test('the bundled chorus is the measured original-speed, original-pitch PCM excerpt', () => {
  const manifest = JSON.parse(readFileSync('docs/roses-reference/here_with_me_alignment.json'));
  const wav = readFileSync(manifest.excerpt_file);
  assert.equal(createHash('sha256').update(wav).digest('hex'), manifest.excerpt_sha256);
  let offset = 12, pcm;
  while (offset + 8 <= wav.length) {
    const kind = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4);
    if (kind === 'data') { pcm = wav.subarray(offset + 8, offset + 8 + size); break; }
    offset += 8 + size + (size % 2);
  }
  assert.ok(pcm);
  assert.equal(pcm.length, manifest.excerpt_frame_count * manifest.channels * 2);
  assert.equal(createHash('sha256').update(pcm).digest('hex'), manifest.excerpt_pcm_sha256);
});

const mockTone = `
export const events = [];
export let now = 0;
export const immediate = () => now;
export function setNow(value) { now = value; }
export class Gain { constructor() { this.gain = { rampTo: (value, time) => events.push(['gain', value, time]) }; } connect() { return this; } dispose() {} }
export class Player {
  constructor(options) { events.push(['options', options.playbackRate]); queueMicrotask(options.onload); }
  connect() { return this; }
  start(...args) { events.push(['start', ...args]); }
  stop(...args) { events.push(['stop', ...args]); }
  dispose() {}
}
`;
const engineBundle = await build({
  stdin: { contents: 'export { RosesCloserEngine } from "./src/piano/rosesCloserEngine.ts"; export { events, setNow } from "tone";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'mock-audio-context', setup(build) {
    build.onResolve({ filter: /^tone$/ }, () => ({ path: 'tone', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: mockTone, loader: 'js' }));
  } }],
});
const audio = await import(`data:text/javascript;base64,${Buffer.from(engineBundle.outputFiles[0].text).toString('base64')}`);

test('automatic playback fires once at a fractional audio time and A/B preserves its position', async () => {
  const engine = new audio.RosesCloserEngine({}, () => {});
  await Promise.resolve();
  audio.events.length = 0;
  engine.tick(104, 62.4, .6);
  assert.equal(audio.events.filter(e => e[0] === 'start').length, 0);
  engine.tick(104.25, 62.55, .6);
  const start = audio.events.find(e => e[0] === 'start');
  assert.ok(Math.abs(start[1] - 62.58) < 1e-9);
  assert.equal(start[2], 0);
  engine.tick(104.5, 62.7, .6);
  assert.equal(audio.events.filter(e => e[0] === 'start').length, 1);
  engine.configure({ ...cue.defaultCloserSettings, enabled: false });
  assert.equal(engine.snapshot().closerStatus, 'OFF');
  engine.configure(cue.defaultCloserSettings);
  assert.equal(engine.snapshot().closerStatus, 'PLAYING');
  assert.equal(audio.events.filter(e => e[0] === 'start' || e[0] === 'stop').length, 1, 'A/B changes the gain without restarting the source');
  engine.finishSection(64.8);
  assert.equal(engine.snapshot().closerStatus, 'PLAYING', 'the new entrance must not be cut off at the Roses section boundary');
  assert.equal(audio.events.filter(e => e[0] === 'stop').length, 0);
  engine.reset(64.8);
  engine.tick(104.25, 85.95, .6);
  assert.equal(audio.events.filter(e => e[0] === 'start').length, 2, 'a new practice cycle gets one new entrance');
});

test('late seeks do not play an unrelated phrase, and pause resumes the raw source in place', async () => {
  const engine = new audio.RosesCloserEngine({}, () => {});
  await Promise.resolve();
  engine.tick(105, 64.8, .6);
  assert.equal(engine.snapshot().closerStatus, 'MISSED');
  engine.reset(0);
  engine.tick(104.25, 62.55, .6);
  audio.setNow(64.0);
  engine.pause();
  assert.equal(engine.snapshot().closerStatus, 'PAUSED');
  engine.resume(66.0);
  const resumed = audio.events.filter(e => e[0] === 'start').at(-1);
  assert.equal(resumed[1], 66.0);
  assert.ok(Math.abs(resumed[2] - 1.42) < 1e-9);
});
