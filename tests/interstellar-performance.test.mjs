import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import assistedSource from '../src/piano/interstellar_assisted_bars_9_13.json' with { type: 'json' };

const output = '/private/tmp/stage-piano-performance-section-test.mjs';
await build({ entryPoints: ['src/piano/interstellarPerformance.ts'], bundle: true, platform: 'node', format: 'esm', outfile: output });
const { moveInterstellarSection, mapForInterstellarSection, planInterstellarPress, interstellarPerformanceGain, interstellarSections } = await import(pathToFileURL(output).href);
const mix = { accompaniment: .35, melody: 1, assisted: .5, octaveEnabled: true, octave: .45 };

test('manual sections clamp at both ends and select only their own map', () => {
  assert.deepEqual([moveInterstellarSection(1, -1), moveInterstellarSection(1, 1), moveInterstellarSection(2, 1), moveInterstellarSection(3, 1)], [1, 2, 3, 3]);
  assert.equal(interstellarSections[1].firstBar, 1);
  assert.equal(interstellarSections[2].firstBar, 9);
  assert.equal(interstellarSections[3].firstBar, 14);
  assert.equal(mapForInterstellarSection(1).id, mapForInterstellarSection(3).id);
  assert.notEqual(mapForInterstellarSection(1).id, mapForInterstellarSection(2).id);
});

test('Opening has exactly one note per key and never doubles P or F', () => {
  assert.deepEqual(planInterstellarPress(1, 'KeyP', 69, 0, mix).voices.map(v => v.midi), [69]);
  assert.deepEqual(planInterstellarPress(1, 'KeyF', 76, 0, mix).voices.map(v => v.midi), [76]);
});

test('Assisted section follows imported physical keys and plans every sounding pitch', () => {
  const first = planInterstellarPress(2, 'KeyC', 69, 0, mix);
  assert.deepEqual(first.voices.map(v => [v.midi, v.assisted]), [[69, false], [64, true]]);
  assert.ok(first.voices.every(v => v.gain === .4));
  const next = planInterstellarPress(2, 'KeyB', 72, first.nextCursor, mix);
  assert.deepEqual(next.voices.map(v => v.midi), [72, 65]);
  assert.ok(next.nextCursor > first.nextCursor);
  assert.deepEqual(planInterstellarPress(2, 'KeyF', 76, 0, mix).voices.map(v => v.midi), [76]);
});

test('all 60 assisted performance presses reproduce the imported live and generated MIDI', () => {
  let cursor = 0;
  for (const bar of assistedSource.bars) for (const event of bar.events) {
    const planned = planInterstellarPress(2, event.physicalKey, event.liveMidi, cursor, mix);
    assert.deepEqual(planned.voices.map(voice => voice.midi), [event.liveMidi, ...event.assistedMidi], `bar ${bar.bar}, beat ${event.beat}`);
    assert.deepEqual(planned.voices.map(voice => voice.assisted), [false, ...event.assistedMidi.map(() => true)]);
    cursor = planned.nextCursor;
  }
  assert.equal(cursor, 0);
});

test('Climax is source-aware: quiet sixteenths, clear E lead and only F doubles', () => {
  assert.equal(interstellarPerformanceGain(3, 64, false, mix), .35);
  assert.equal(interstellarPerformanceGain(3, 76, false, mix), 1);
  assert.deepEqual(planInterstellarPress(3, 'KeyF', 76, 0, mix).voices.map(v => [v.midi, v.gain]), [[76, 1], [88, .45]]);
  assert.deepEqual(planInterstellarPress(3, 'KeyP', 69, 0, mix).voices.map(v => v.midi), [69]);
  assert.deepEqual(planInterstellarPress(3, 'KeyF', 76, 0, { ...mix, octaveEnabled: false }).voices.map(v => v.midi), [76]);
});
