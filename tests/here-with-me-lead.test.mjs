import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const folder = 'reference/here-with-me-drop-lead/';
const source = JSON.parse(readFileSync(folder + 'roses_37_52_here_with_me_lead_16bar_events.json'));

// Independent SMF reader: compare the supplied four-track MIDI to the runtime JSON.
function midiNotes(file) {
  const bytes = readFileSync(file), ppq = bytes.readUInt16BE(12), notes = [];
  let offset = 14;
  while (offset < bytes.length) {
    assert.equal(bytes.toString('ascii', offset, offset + 4), 'MTrk');
    const end = offset + 8 + bytes.readUInt32BE(offset + 4);
    offset += 8;
    let tick = 0, running = 0, name = '', pending = new Map();
    const variable = () => {
      let value = 0, byte;
      do { byte = bytes[offset++]; value = (value << 7) | (byte & 127); } while (byte & 128);
      return value;
    };
    while (offset < end) {
      tick += variable();
      let status = bytes[offset];
      if (status & 128) { offset++; if (status < 240) running = status; }
      else status = running;
      if (status === 255) {
        const kind = bytes[offset++], length = variable();
        if (kind === 3) name = bytes.toString('utf8', offset, offset + length);
        offset += length;
      } else if (status === 240 || status === 247) offset += variable();
      else {
        const kind = status >> 4, pitch = bytes[offset++];
        const velocity = kind === 12 || kind === 13 ? 0 : bytes[offset++];
        if (kind === 9 && velocity > 0) pending.set(pitch, { tick, velocity });
        if (kind === 8 || kind === 9 && velocity === 0) {
          const start = pending.get(pitch);
          assert.ok(start, `note-off has an attack: ${name} ${pitch}`);
          notes.push({ name, tick: start.tick / ppq, duration: (tick - start.tick) / ppq, pitch, velocity: start.velocity });
          pending.delete(pitch);
        }
      }
    }
    assert.equal(pending.size, 0);
  }
  return notes;
}

test('all 448 JSON events agree with the independent 16-bar MIDI and four original lanes', () => {
  const midi = midiNotes(folder + 'Here_With_Me_4Layer_Lead_Repeated_16Bars_RELATIVE.mid');
  const normalize = note => [note.tick, note.duration, note.pitch, note.velocity].join(':');
  assert.equal(midi.length, 448);
  for (const channel of [19, 20, 21, 22]) {
    const events = source.events.filter(e => e.track_channel === channel);
    const names = [...new Set(midi.map(note => note.name))];
    const name = names.find(name => channel === 19 ? name.startsWith('Lead 1') : channel === 20 ? /^lead 2 -/.test(name) : name.startsWith(`lead 2 #${channel - 19}`));
    assert.ok(name, `source MIDI name for channel ${channel}`);
    assert.equal(events.length, 112);
    assert.deepEqual(midi.filter(note => note.name === name).map(normalize).sort(), events.map(e => normalize({
      tick: e.start_tick_relative_to_rose_bar37 / 96, duration: e.duration_ticks / 96,
      pitch: e.midi_pitch, velocity: e.velocity_raw,
    })).sort());
  }
  const phrase = midiNotes(folder + 'Bar26_Drop_Melody_All4Layers.mid');
  assert.equal(phrase.length, 112);
  for (const repeat of [0, 1, 2, 3]) {
    const events = source.events.filter(e => e.repeat_index === repeat);
    assert.deepEqual(events.map(e => normalize({ tick: e.start_tick_relative_to_rose_bar37 / 96 - repeat * 16,
      duration: e.duration_ticks / 96, pitch: e.midi_pitch, velocity: e.velocity_raw })).sort(), phrase.map(normalize).sort());
    const lower = events.filter(e => e.track_channel === 19);
    for (const channel of [20, 21, 22]) assert.deepEqual(events.filter(e => e.track_channel === channel).map(e => e.midi_pitch), lower.map(e => e.midi_pitch + 12));
    near(Math.min(...events.map(e => e.absolute_roses_transport_seconds)), 86.4 + repeat * 9.6);
  }
  assert.ok(source.events.every(e => e.start_tick_relative_to_rose_bar37 + e.duration_ticks < 64 * 96));
});

const toneMock = `
export const attacks = [], nodes = [];
export class Gain {
  constructor(value) { this.gain = { value, rampTo(value) { this.value = value; } }; nodes.push(this); }
  connect(destination) { this.destination = destination; return this; }
  dispose() { this.disposed = true; }
}
export class Limiter extends Gain {}
export class Filter extends Gain {}
export class Panner extends Gain {}
export class Synth {}
export class PolySynth extends Gain {
  constructor(type, options) { super(); this.options = options; this.volume = { value: options.volume, rampTo(value) { this.value = value; } }; }
  triggerAttackRelease(note, duration, at, velocity) { attacks.push({ voice: this, note, duration, at, velocity }); }
}
`;
const bundle = await build({
  stdin: { contents: `export { HereWithMeLeadEngine } from './src/piano/hereWithMeLeadEngine'; export * from 'tone';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'audio', setup(builder) {
    builder.onResolve({ filter: /^tone$/ }, () => ({ path: 'tone', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: toneMock }));
  } }],
});
const { HereWithMeLeadEngine, attacks, nodes } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const fresh = () => { attacks.length = 0; nodes.length = 0; return new HereWithMeLeadEngine({}); };
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-9, `${a} == ${b}`); }

test('manual arm schedules only the first two source phrases through bar 44 at exact audio timestamps', () => {
  const engine = fresh();
  engine.tick(144, 86.4, .6);
  assert.equal(attacks.length, 0, 'selecting a song does not enable the layer');
  assert.equal(engine.arm(0, false), true);
  assert.equal(engine.arm(0, false), false, 'repeated arm does not duplicate the take');
  engine.begin(0);
  for (let beat = 0; beat <= 220; beat += .25) {
    engine.tick(beat, beat * .6, .6);
    engine.tick(beat, beat * .6, .6); // duplicate clock callback must be harmless
    if (beat < 144) assert.equal(attacks.length, 0);
  }
  assert.equal(attacks.length, 224);
  assert.equal(new Set(attacks.map(event => event.voice)).size, 4);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  source.events.filter(event => event.repeat_index < 2).forEach((event, i) => {
    const actual = attacks[i];
    assert.equal(actual.note, names[event.midi_pitch % 12] + (Math.floor(event.midi_pitch / 12) - 1));
    near(actual.at, event.absolute_roses_transport_seconds);
    near(actual.duration, event.duration_seconds);
    near(actual.velocity, event.velocity_raw / 127);
  });
  near(attacks[0].at, 86.4);
  assert.ok(attacks.every(event => event.at < 105.6));
  assert.equal(engine.snapshot().status, 'DONE');
  assert.ok(attacks.every(event => !event.voice.disposed), 'end marker allows natural release tails');
  engine.dispose();
  assert.ok(nodes.every(node => node.disposed));
});

test('start near 37, stop, disarm, pause, seek and a second take cannot retain old voices', () => {
  const engine = fresh();
  engine.arm(140, true); engine.begin(140);
  engine.tick(143.75, 10, .6); assert.equal(attacks.length, 0);
  engine.tick(144, 10.15, .6); assert.equal(attacks.length, 4);
  const first = attacks.slice();
  engine.pause();
  assert.equal(engine.snapshot().status, 'PLAYING');
  assert.ok(first.every(event => event.voice.disposed), 'pause cancels queued attacks too');
  engine.tick(144, 11, .6); assert.equal(attacks.length, 4, 'resume never doubles the downbeat');
  engine.tick(144.25, 11.15, .6); assert.equal(attacks.length, 8);
  engine.begin(160);
  assert.equal(engine.snapshot().status, 'OFF', 'seeking a playing take disarms it');
  assert.ok(attacks.every(event => event.voice.disposed));
  engine.tick(160, 20, .6); assert.equal(attacks.length, 8);
  assert.equal(engine.arm(160, true), false, 'late arm never starts halfway');
  engine.arm(0, false); engine.begin(144); engine.tick(144, 30, .6);
  assert.equal(attacks.length, 12);
  engine.stop(); engine.tick(144.25, 30.15, .6);
  assert.equal(attacks.length, 12);
  assert.ok(nodes.every(node => node.disposed), 'reset/disarm disconnect every old bank');
  engine.arm(0, false); engine.begin(148);
  assert.equal(engine.snapshot().status, 'OFF', 'pending arm cannot survive a seek past entry');
});

test('mute and independent lower gain preserve the timeline and keep the three upper banks quiet', () => {
  const engine = fresh();
  engine.configure({ muted: true, volume: .5, lower: .25 });
  engine.arm(0, false); engine.begin(144); engine.tick(144, 10, .6);
  const voices = attacks.slice(0, 4).map(event => event.voice);
  assert.equal(voices[0].destination.destination.destination.gain.value, 0);
  near(voices[0].volume.value, -12 + 20 * Math.log10(.25));
  assert.deepEqual(voices.slice(1).map(voice => voice.volume.value), [-20, -18, -20]);
  engine.configure({ muted: false, lower: 0 });
  assert.equal(voices[0].volume.value, -Infinity);
  near(voices[0].destination.destination.destination.gain.value, .5 * 10 ** (9 / 20));
  engine.tick(144.25, 10.15, .6);
  assert.equal(attacks.length, 8, 'unmute changes gain without restarting the phrase');
  near(attacks[4].at, 10.15);
  engine.dispose();
});


test('the bar-29 instance reuses every source event with an exact eight-bar shift and independent boundary', () => {
  const engine = new HereWithMeLeadEngine({}, 112);
  attacks.length = 0; nodes.length = 0;
  engine.arm(0, false); engine.begin(96); engine.prepareVoices();
  for (let beat = 96; beat <= 176; beat += .25) {
    engine.tick(beat, beat * .6, .6);
    engine.tick(beat, beat * .6, .6);
  }
  assert.equal(attacks.length, 224);
  assert.equal(new Set(attacks.map(event => event.voice)).size, 4);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  source.events.filter(event => event.repeat_index < 2).forEach((event, i) => {
    assert.equal(attacks[i].note, names[event.midi_pitch % 12] + (Math.floor(event.midi_pitch / 12) - 1));
    near(attacks[i].at, event.absolute_roses_transport_seconds - 19.2);
    near(attacks[i].duration, event.duration_seconds);
    near(attacks[i].velocity, event.velocity_raw / 127);
  });
  near(attacks[0].at, 67.2); near(attacks[112].at, 76.8);
  assert.ok(attacks.every(event => event.at < 86.4));
  assert.equal(engine.snapshot().status, 'DONE');
  engine.dispose(); assert.ok(nodes.every(node => node.disposed));
  engine.arm(0, false); engine.begin(144, true); engine.tick(144, 90, .6);
  assert.equal(engine.snapshot().status, 'OFF');
  assert.equal(attacks.length, 224, 'a seek to bar 37 cannot replay the replacement');
});
