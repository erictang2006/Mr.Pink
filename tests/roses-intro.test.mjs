import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const bundle = await build({ entryPoints: ['src/piano/rosesIntro.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const intro = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function midiNotes(path) {
  const bytes = readFileSync(path); const ppq = bytes.readUInt16BE(12);
  let pos = 14, ticks = 0, status = 0; const active = new Map(), notes = [];
  const vlq = () => { let value = 0, byte; do { byte = bytes[pos++]; value = value * 128 + (byte & 127); } while (byte & 128); return value; };
  assert.equal(bytes.toString('ascii', pos, pos + 4), 'MTrk'); const end = pos + 8 + bytes.readUInt32BE(pos + 4); pos += 8;
  while (pos < end) {
    ticks += vlq(); if (bytes[pos] & 128) status = bytes[pos++];
    if (status === 255) { pos++; const length = vlq(); pos += length; continue; }
    const pitch = bytes[pos++], velocity = bytes[pos++];
    if ((status & 240) === 144 && velocity > 0) active.set(pitch, ticks);
    if ((status & 240) === 128 || (status & 240) === 144 && velocity === 0) notes.push({ midi: pitch, startBeat: active.get(pitch) / ppq, durationBeats: (ticks - active.get(pitch)) / ppq }), active.delete(pitch);
  }
  return notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}

test('all 12 imported measures match the supplied MIDI note onsets and durations', () => {
  const midi = midiNotes('docs/roses-reference/roses_intro_bars_1_to_12.mid');
  const notes = intro.rosesIntroNotes.filter(note => note.bar <= 12).map(({ midi, startBeat, durationBeats }) => ({ midi, startBeat, durationBeats }));
  assert.equal(notes.length, 24);
  assert.deepEqual(notes, midi);
  assert.deepEqual(midiNotes('docs/roses-reference/roses_intro_bars_1_to_4.mid'), notes.slice(0, 8));
});

test('only the armed synth handoff is scheduled; drums remain physical targets', () => {
  assert.deepEqual(intro.rosesEventsAtBeat(15.75, true), []);
  assert.deepEqual(intro.rosesEventsAtBeat(16, true).map(note => note.midi), [64]);
  assert.equal(intro.rosesEventsAtBeat(17.5, true)[0].midi, 68);
  assert.deepEqual(intro.rosesEventsAtBeat(20.75, true), []);
  assert.deepEqual(intro.rosesEventsAtBeat(48, true).map(note => note.midi), [64]);
  assert.deepEqual(intro.rosesEventsAtBeat(16, false), []);
  assert.deepEqual(intro.applyRosesCue(4, false, true), { active: false, pending: true });
  assert.deepEqual(intro.applyRosesCue(5, false, true), { active: true, pending: undefined });
  assert.equal(intro.rosesDrumTargets.filter(hit => hit.kind === 'kick' && hit.bar <= 20).length, 44);
  assert.equal(intro.rosesDrumTargets.filter(hit => hit.kind === 'clap').length, 24);
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar === 5).map(hit => [hit.code, hit.beatInBar]), [['KeyZ', 1], ['KeyZ', 2.5]]);
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar === 9).map(hit => [hit.code, hit.beatInBar]), [['KeyZ', 1], ['KeyX', 2], ['KeyZ', 2.5], ['KeyX', 4]]);
});

test('V synth lead moves attack earlier without moving the written note ending', () => {
  const onBeat = 12;
  const duration = 2.4;
  const early = intro.rosesSynthTiming(onBeat, duration, 20, 11.8);
  assert.ok(Math.abs(early.start - 11.98) < 1e-9);
  assert.ok(Math.abs(early.start + early.duration - (onBeat + duration)) < 1e-9);
  assert.deepEqual(intro.rosesSynthTiming(onBeat, duration, 0, 11.8), { start: onBeat, duration });
  assert.equal(intro.rosesSynthTiming(onBeat, duration, 60, 11.97).start, 11.97);
});

function midiTracks(path, offset = 48) {
  const bytes = readFileSync(path); const ppq = bytes.readUInt16BE(12);
  const tracks = new Map(); let pos = 14;
  for (let track = 0; track < bytes.readUInt16BE(10); track++) {
    assert.equal(bytes.toString('ascii', pos, pos + 4), 'MTrk');
    const end = pos + 8 + bytes.readUInt32BE(pos + 4); pos += 8;
    let ticks = 0, status = 0, name = `track-${track}`;
    const active = new Map(), notes = [];
    const vlq = () => { let value = 0, byte; do { byte = bytes[pos++]; value = value * 128 + (byte & 127); } while (byte & 128); return value; };
    while (pos < end) {
      ticks += vlq(); if (bytes[pos] & 128) status = bytes[pos++];
      if (status === 255) { const kind = bytes[pos++], length = vlq(); if (kind === 3) name = bytes.toString('utf8', pos, pos + length); pos += length; continue; }
      if (status === 240 || status === 247) { pos += vlq(); continue; }
      const type = status & 240;
      if (type === 192 || type === 208) { pos++; continue; }
      const pitch = bytes[pos++], velocity = bytes[pos++];
      if (type === 144 && velocity > 0) active.set(pitch, ticks);
      if (type === 128 || type === 144 && velocity === 0) {
        const start = active.get(pitch); assert.notEqual(start, undefined);
        notes.push({ startBeat: start / ppq + offset, durationBeats: (ticks - start) / ppq, midi: pitch }); active.delete(pitch);
      }
    }
    tracks.set(name, notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi));
  }
  return tracks;
}

test('bars 13–20 bass, sub and continued synth exactly match the supplied three-track MIDI', () => {
  const tracks = midiTracks('docs/roses-reference/roses_bars13_to20_3_tracks.mid');
  const compact = notes => notes.map(({ startBeat, durationBeats, midi }) => ({ startBeat, durationBeats, midi }));
  assert.deepEqual(compact(intro.rosesIntroNotes.filter(note => note.bar >= 13)), tracks.get('intro_pad'));
  assert.deepEqual(compact(intro.rosesBassNotes), tracks.get('break_bass'));
  assert.deepEqual(compact(intro.rosesSubNotes), tracks.get('break_sub'));
  assert.equal(intro.rosesBassNotes.length, 24);
  assert.equal(intro.rosesSubNotes.length, 24);
  assert.deepEqual(intro.rosesBassAtBeat(48, true).bass.map(note => note.midi), [49]);
  assert.deepEqual(intro.rosesBassAtBeat(48, false), { bass: [], sub: [] });
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar === 20 && hit.kind === 'kick'), []);
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar === 20 && hit.kind === 'clap').map(hit => hit.beatInBar), [2, 4]);
  assert.deepEqual(intro.rosesAccentTargets.map(hit => [hit.bar, hit.beatInBar]), [[12, 4], [16, 4], [20, 4]]);
  assert.deepEqual(intro.rosesEventsAtBeat(48, true).map(note => note.midi), [64]);
  assert.deepEqual(intro.rosesEventsAtBeat(79.5, true), []);
  assert.equal(intro.rosesEventsAtBeat(80, true).length, 0);
  for (const note of intro.rosesIntroNotes.filter(note => note.bar >= 13)) {
    const matchingLoop = intro.rosesIntroLoopEvents.find(event => event.startBeat === (note.startBeat - 48) % 16);
    assert.deepEqual([note.midi, note.durationBeats], [matchingLoop?.midi, matchingLoop?.durationBeats]);
  }
});

test('bundled samples and comparison recording are present', () => {
  for (const name of ['experimental_E4_note_sample.wav', 'Roses Kick.wav', 'Roses SnareClap.wav', 'original_intro_pad_bars_1_to_4.wav', 'woo weird sample roses.wav'])
    assert.equal(readFileSync(`public/roses/${name}`).toString('ascii', 0, 4), 'RIFF');
});

test('vocal stem is the exact supplied original-timeline WAV', () => {
  const bytes = readFileSync('public/roses/roses_vocals_original_timeline.wav');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '32082fae8650ab6b51001c63dfeb16d966bea1a7a5ebd6d55b65648697b625ae');
});

test('bar-4 vocal arm starts the unchanged source phrase on bar 5, four measures earlier', () => {
  assert.deepEqual(intro.rosesVocalCue, { armBar: 4, startBar: 5, sourceOffsetSeconds: 9.6 });
  assert.equal(intro.rosesVocalPerformanceSeconds, 9.6);
  assert.equal(intro.rosesVocalPerformanceSeconds + (10.8 - intro.rosesVocalCue.sourceOffsetSeconds), 10.8);
  assert.ok(Math.abs(intro.rosesVocalPerformanceSeconds + (10.8 - intro.rosesVocalCue.sourceOffsetSeconds) - ((5 - 1) * 4 + 2) * 60 / 100) < 1e-9);
});

test('bars 21–24 use the supplied bass MIDI without extending old loops or drum targets', () => {
  const compact = notes => notes.map(({ startBeat, durationBeats, midi }) => ({ startBeat, durationBeats, midi }));
  const bass = [...midiTracks('docs/roses-reference/roses_bars21_to24_build_bass.mid', 80).values()].flat();
  assert.deepEqual(compact(intro.rosesBuildBassNotes.filter(note => note.bar <= 24)), bass);
  assert.equal(intro.rosesIntroBars, 36);
  assert.equal(intro.rosesIntroBeats, 144);
  assert.deepEqual(intro.rosesEventsAtBeat(80, true), []);
  assert.deepEqual(intro.rosesBassAtBeat(80, true), { bass: [], sub: [] });
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar >= 21 && hit.bar <= 28), []);
  assert.equal(intro.rosesBuildBassNotes[0].startBeat, 80);
  for (const name of ['Guitar build up bass compliment.wav', 'ah intro sample.wav', 'aah vocal chop loop 2.wav'])
    assert.equal(readFileSync(`public/roses/${name}`).toString('ascii', 0, 4), 'RIFF');
});

test('bars 25–28 exactly repeat the supplied Build Bass MIDI, preserving the E2 hold', () => {
  const imported = [...midiTracks('docs/roses-reference/roses_bars25_to28_build_bass.mid', 96).values()].flat();
  const notes = intro.rosesBuildBassNotes.filter(note => note.bar >= 25).map(({ startBeat, durationBeats, midi }) => ({ startBeat, durationBeats, midi }));
  assert.deepEqual(notes, imported);
  assert.deepEqual(notes, [
    { startBeat: 96, durationBeats: 4, midi: 49 },
    { startBeat: 100, durationBeats: 4, midi: 45 },
    { startBeat: 104, durationBeats: 8, midi: 40 },
  ]);
  assert.deepEqual(intro.rosesDrumTargets.filter(hit => hit.bar >= 25 && hit.bar <= 28), []);
});
