import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const song = JSON.parse(readFileSync(new URL('../src/piano/interstellar.song.json', import.meta.url)));
const mapping = JSON.parse(readFileSync(new URL('../src/piano/interstellar_roblox_aligned_mapping.json', import.meta.url)));

test('approved MuseScore import contains exactly the first 30 complete measures', () => {
  assert.equal(song.measureCount, 30);
  assert.equal(song.measures.length, 30);
  assert.deepEqual(song.measures.map(measure => measure.number), Array.from({ length: 30 }, (_, i) => i + 1));
  for (const measure of song.measures) {
    assert.equal(measure.beats, 3);
    assert.deepEqual(measure.timeSignature, [3, 4]);
    for (const hand of ['left', 'right']) {
      const events = [...measure.notes.filter(note => note.hand === hand), ...measure.rests.filter(rest => rest.hand === hand)];
      assert.ok(events.length > 0);
      assert.ok(events.every(event => event.beat >= 0 && event.beat + event.duration <= measure.beats));
    }
  }
  assert.equal(song.measures.reduce((total, measure) => total + measure.notes.length, 0), 428);
  assert.deepEqual(song.unsupportedFeatures, []);
});

test('every written score pitch has a physical Interstellar binding', () => {
  const mapped = new Set(Object.values(mapping.mapping).map(binding => binding.midi));
  assert.equal(song.pitches.length, 24);
  assert.deepEqual(song.pitches.filter(pitch => !mapped.has(pitch)), []);
});

test('import preserves chords, rests, repeated notes and ties', () => {
  const chords = song.measures.flatMap(measure => {
    const at = new Map();
    for (const note of measure.notes) {
      const key = `${measure.number}:${note.beat}`;
      at.set(key, (at.get(key) ?? 0) + 1);
    }
    return [...at.values()].filter(count => count > 1);
  });
  assert.ok(chords.length > 0);
  assert.ok(song.measures.some(measure => measure.rests.length > 0));
  assert.ok(song.measures.some(measure => measure.notes.some(note => note.tieFromPrevious)));
  assert.ok(song.measures.some(measure => measure.notes.some((note, index) => measure.notes.slice(index + 1).some(next => next.hand === note.hand && next.midi === note.midi && next.beat > note.beat))));
});
