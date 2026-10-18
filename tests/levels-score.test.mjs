import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const score = JSON.parse(readFileSync(new URL('../src/piano/levels.song.json', import.meta.url)));
const chordInventory = new Set([
  '68,71,76', '68,73,76', '68,73,78', '66,71,75', '66,71,76', '69,73,76',
  '76,85', '76,83', '76,80', '66,73', '66,71', '64,71',
]);

test('Levels import preserves the scored chord inventory and empty ending', () => {
  assert.equal(score.measureCount, 16);
  assert.equal(score.measures.reduce((count, measure) => count + measure.notes.length, 0), 333);
  assert.deepEqual(score.unsupportedFeatures, []);
  const actual = new Set();
  for (const measure of score.measures.slice(0, 8)) {
    const right = new Map();
    for (const note of measure.notes.filter(note => note.hand === 'right'))
      right.set(note.beat, [...(right.get(note.beat) ?? []), note.midi]);
    for (const pitches of right.values()) actual.add(pitches.join(','));
  }
  assert.deepEqual(actual, chordInventory);
  assert.ok(score.measures.slice(8, 10).every(measure => measure.notes.length === 8));
  assert.ok(score.measures[10].notes.some(note => note.midi === 68 && note.beat === 1.5));
  assert.ok(score.measures.slice(11).every(measure => measure.notes.length === 0));
});
