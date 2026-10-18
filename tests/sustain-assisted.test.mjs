import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

await build({ entryPoints: ['src/piano/sustainVoices.ts', 'src/piano/assistedSong.ts'], bundle: true, platform: 'node', format: 'esm', outdir: '/private/tmp/stage-piano-stage5' });
const { SustainVoices } = await import(pathToFileURL('/private/tmp/stage-piano-stage5/sustainVoices.js').href);
const { assistedEvents } = await import(pathToFileURL('/private/tmp/stage-piano-stage5/assistedSong.js').href);

test('damper holds released notes and frees them on pedal up', () => {
  const gate = new SustainVoices();
  gate.setPedal(true);
  assert.equal(gate.attack(60), false);
  assert.equal(gate.release(60), false);
  assert.equal(gate.isSustained(60), true);
  assert.deepEqual(gate.setPedal(false), [60]);
  assert.equal(gate.isSustained(60), false);
});

test('pedal release does not stop physically held notes, including rapid chords', () => {
  const gate = new SustainVoices();
  gate.setPedal(true);
  [60, 64, 67].forEach(midi => gate.attack(midi));
  assert.equal(gate.release(60), false);
  assert.equal(gate.release(64), false);
  assert.deepEqual(gate.setPedal(false).sort(), [60, 64]);
  assert.equal(gate.isHeld(67), true);
  assert.equal(gate.release(67), true);
});

test('repeated same pitch under sustain retriggers without muting a held note', () => {
  const gate = new SustainVoices();
  gate.setPedal(true);
  gate.attack(64);
  gate.release(64);
  assert.equal(gate.attack(64), true); // damp previous voice before reattack
  gate.attack(64); // overlapping physical keys
  assert.equal(gate.release(64), false);
  assert.deepEqual(gate.setPedal(false), []);
  assert.equal(gate.isHeld(64), true);
  assert.equal(gate.release(64), true);
  gate.clear();
  assert.equal(gate.isHeld(64), false);
});

test('assisted JSON is exact, ordered, and consistent with the imported MuseScore bars', () => {
  assert.equal(assistedEvents.length, 60);
  assert.deepEqual(assistedEvents.filter(event => event.bar === 9).map(event => event.label).join(''), 'cbm/cbm/cbm/');
  assert.deepEqual(assistedEvents.filter(event => event.bar === 10).map(event => event.label).join(''), 'vnm.vnm.vnm.');
  assert.deepEqual(assistedEvents.filter(event => event.bar === 11).map(event => event.label).join(''), 'vnm.vnm.vnm.');
  assert.deepEqual(assistedEvents.filter(event => event.bar === 12).map(event => event.label).join(''), 'cbm/zvm,cbm/');
  assert.deepEqual(assistedEvents.filter(event => event.bar === 13).map(event => event.label).join(''), 'vnm.cbm/zvm,');
  for (const bar of [9, 10, 11, 12, 13]) {
    const events = assistedEvents.filter(event => event.bar === bar);
    assert.deepEqual(events.map(event => event.beat), Array.from({length:12}, (_, i) => i / 4));
    assert.ok(events.every(event => event.assistedMidi.length === 1 && event.durationBeats === 1/4));
  }
});
