import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const bundle = await build({
  stdin: { contents: `export { hereWithMeChords, hereWithMeChordShortcuts } from './src/piano/hereWithMeChords';
    export { HereWithMeLeadEngine } from './src/piano/hereWithMeLeadEngine';
    export { KeyboardInputManager } from './src/piano/keyboardInput';
    export { SynthEngine } from './src/piano/synthEngine';
    export { RosesChordStabEngine } from './src/piano/rosesChordStabEngine';
    export { LiveNotes } from './src/piano/liveNotes';
    export { rosesChordShortcuts, rosesChordSource } from './src/piano/rosesChords';
    export { validRosesDropSettings } from './src/piano/rosesDropSettings';
    export { rosesMap } from './src/piano/roses';
    export { bonkPitchForRoot } from './src/piano/rosesFutureBassLayers';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'audio-time', setup(builder) {
    builder.onResolve({ filter: /^tone$/ }, () => ({ path: 'tone', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      export const now = () => 42, immediate = now, start = async () => {}, getContext = () => {};
      export class PolySynth {} export class Sampler {} export class Synth {} export class MonoSynth {}
      export class Gain {} export class Filter {} export class Chorus {}
      export class FeedbackDelay {} export class JCReverb {} export class Volume {}
      export class Distortion {} export class Compressor {}
      export class WaveShaper {} export class ToneAudioBuffer {} export class ToneBufferSource {} export class ToneAudioNode {}
      export class Panner {} export class EQ3 {} export class Limiter {}
    ` }));
  } }],
});
const { hereWithMeChords, hereWithMeChordShortcuts, HereWithMeLeadEngine, KeyboardInputManager, SynthEngine, RosesChordStabEngine, LiveNotes, rosesChordShortcuts, rosesChordSource, rosesMap, validRosesDropSettings, bonkPitchForRoot } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

class Target {
  listeners = new Map();
  addEventListener(type, cb) { this.listeners.set(type, [...this.listeners.get(type) ?? [], cb]); }
  removeEventListener(type, cb) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== cb)); }
  dispatch(type, event = {}) { for (const cb of this.listeners.get(type) ?? []) cb(event); }
}

test('drop controls reject invalid stored settings and retain independent layer mutes', () => {
  const settings = validRosesDropSettings({ body: 0, punch: 0, bass: 0, bassEnabled: false, brightness: Infinity, decay: -100, output: 20, mode: 'previous', duck: true });
  assert.deepEqual([settings.body, settings.punch, settings.bass], [0,0,0]);
  assert.equal(settings.output, 1);
  assert.equal(settings.decay, .2);
  assert.ok(Number.isFinite(settings.brightness));
  assert.equal(settings.mode, 'bonk', 'new or unknown settings select the new instrument');
  assert.equal(settings.bonk, .35); assert.equal(settings.space, .15);
  assert.equal(validRosesDropSettings({ mode: 'drop' }).mode, 'drop', 'original instrument remains explicitly selectable');
  assert.equal(settings.bassEnabled, false, 'the optional bass can still be disabled');
  assert.equal(settings.duck, true);
});
function setup() {
  globalThis.window = new Target();
  window.setInterval = setInterval; window.clearInterval = clearInterval;
  globalThis.document = new Target(); document.hidden = false;
  const events = [], bassEvents = [], active = new Map(), melodyActive = new Map(), notes = new LiveNotes();
  // Exercise both real engines' source ownership without a browser AudioContext.
  const stabs = Object.assign(Object.create(RosesChordStabEngine.prototype), {
    ready: true, loading: false, held: new Map(), sustained: new Map(), closerSources: new Set(), closerSustained: new Map(), pedal: false,
    settings: validRosesDropSettings({ mode: "drop", closerMode: "current", bassEnabled: true }),
    bassOwners: new Map(), bassCurrentCode: null,
    bass: {
      triggerAttack(note, at) { bassEvents.push(['on', note, at]); },
      triggerRelease(at) { bassEvents.push(['off', at]); },
    },
    voice: {
      releaseAll() { active.clear(); },
      triggerAttack(note, at, velocity) {
        active.set(note, (active.get(note) ?? 0) + 1); events.push(['on', note, at, velocity]);
      },
      triggerRelease(note, at) {
        // PolySynth releases one matching voice per call; catch orphaned unisons.
        if (active.get(note)) active.set(note, active.get(note) - 1);
        events.push(['off', note, at]);
      },
    },
  });
  const synth = Object.assign(Object.create(SynthEngine.prototype), {
    ready: true, loading: false, held: new Map(), sustained: new Set(), pedal: false,
    voice: {
      triggerAttack(note) { melodyActive.set(note, (melodyActive.get(note) ?? 0) + 1); },
      triggerRelease(note) { melodyActive.set(note, Math.max(0, (melodyActive.get(note) ?? 0) - 1)); },
    },
  });
  const impactEvents = [], futureEvents = [], futureActive = new Map();
  stabs.future = {
    releaseAll() { futureActive.clear(); },
    triggerAttack(note, at) { futureEvents.push(['on', note, at]); futureActive.set(note, (futureActive.get(note) ?? 0) + 1); },
    triggerRelease(note, at) { futureEvents.push(['off', note, at]); futureActive.set(note, Math.max(0, (futureActive.get(note) ?? 0) - 1)); },
    triggerImpact(root, at, velocity) { impactEvents.push({ root, at, velocity }); },
  };
  const closerEvents = [], closerImpacts = [], closerActive = new Map();
  stabs.closer = {
    releaseAll() { closerActive.clear(); },
    attack(code, at) { closerEvents.push(['on', code, at]); closerActive.set(code, (closerActive.get(code) ?? 0) + 1); },
    release(code, at) { closerEvents.push(['off', code, at]); closerActive.set(code, Math.max(0, (closerActive.get(code) ?? 0) - 1)); },
  };
  const manualEvents=[],manualActive=new Map();
  const manualOn=(sound,midi,at)=>{const key=sound+':'+midi;manualActive.set(key,(manualActive.get(key)??0)+1);manualEvents.push(['on',sound,midi,at]);};
  const manualOff=(sound,midi,at,all=false)=>{const key=sound+':'+midi;manualActive.set(key,all?0:Math.max(0,(manualActive.get(key)??0)-1));manualEvents.push(['off',sound,midi,at]);};
  Object.assign(stabs,{hereWithMeSound:'keys678',manualSources:new Map(),manualSustained:[],
    manualHarmony:{attack(code,at){manualOn('harmony',code,at);},release(code,at){manualOff('harmony',code,at,true);},cancel(){for(const key of manualActive.keys())if(key.startsWith('harmony:'))manualActive.set(key,0);}},
    manualLead:{prepareVoices(){},attackChordNote(midi,at){manualOn('lead',midi,at);},releaseChordNote(midi,at){manualOff('lead',midi,at);},stop(){for(const key of manualActive.keys())if(key.startsWith('lead:'))manualActive.set(key,0);}},
    stabNote:{triggerAttack(note,at){manualOn('stabs',note,at);},triggerRelease(note,at){manualOff('stabs',note,at,true);},releaseAll(){for(const key of manualActive.keys())if(key.startsWith('stabs:'))manualActive.set(key,0);}}
  });
  let snapshot, graded = 0;
  const input = new KeyboardInputManager(rosesMap, {
    noteOn(midi, code, at) { synth.noteOn(code, midi); notes.on(code, midi, at); graded++; },
    noteOff(midi, code, at) { synth.noteOff(code); notes.off(code, at); },
    chordOn(pitches, code, at) {
      for (const midi of pitches) {
        const source = rosesChordSource(code, midi);
        if (stabs.noteOn(source, midi, code, 42)) notes.on(source, midi, at);
      }
    },
    chordOff(pitches, code, at) {
      for (const midi of pitches) {
        const source = rosesChordSource(code, midi);
        stabs.noteOff(source); notes.off(source, at);
      }
    },
    change(value) { snapshot = value; },
  });
  input.setEnabled(true); input.setChords(rosesChordShortcuts);
  const key = (type, code, extra = {}) => window.dispatch(type, {
    code, repeat: false, shiftKey: false, target: null, preventDefault() {}, ...extra,
  });
  return { manualEvents, manualActive, closerEvents, closerImpacts, closerActive, impactEvents, futureEvents, futureActive, input, key, synth, stabs, notes, events, bassEvents, active, melodyActive, snapshot: () => snapshot, graded: () => graded };
}

test('live chords have the exact requested MIDI voicings and avoid all existing Roses controls', () => {
  assert.deepEqual(rosesChordShortcuts, {
    Digit1: [61,65,68,75], Digit2: [63,67,70,75], Digit3: [65,68,72,75],
    Digit4: [49,53,56,63], Digit5: [51,55,58,63], Digit6: [57,61,64,69],
    Digit7: [59,63,66,71], Digit8: [61,64,68,73],
  });
  const reserved = ['KeyL','KeyC','KeyG','KeyV','KeyN','KeyB','KeyM','KeyZ','KeyX','F6','F7','F8','F9','Space'];
  for (const code of Object.keys(rosesChordShortcuts)) {
    assert.equal(rosesMap.bindings.some(binding => binding.code === code), ['Digit4','Digit5','Digit6','Digit7','Digit8'].includes(code), 'only 4–8 intentionally replace individual Roses notes');
    assert.equal(reserved.includes(code), false);
  }
});

test('manual Here With Me keys use the four source harmony voicings in = - 0 9 order',()=>{
 const notes=JSON.parse(readFileSync('reference/here-with-me-remake/backing-events-e-major.json')).selections.drop.notes;
 assert.deepEqual(hereWithMeChords.map(c=>c.code),['Equal','Minus','Digit0','Digit9']);
 for(const chord of hereWithMeChords){
  const pitches=notes.filter(n=>n.channel===2&&n.tick===chord.tick).map(n=>n.midi).sort((a,b)=>a-b);
  assert.deepEqual([...chord.notes],pitches);
  assert.equal(rosesChordShortcuts[chord.code],undefined,'keys 1–8 retain their own mapping');
 }
});

test('manual chord shortcuts work immediately without a clock and retain keyup/repeat/focus handling',()=>{
 const state=setup();
 try{
  state.input.setChords({...rosesChordShortcuts,...hereWithMeChordShortcuts});
  state.stabs.settings.mode='bonk';
  for(const chord of hereWithMeChords){
   const before=state.futureEvents.length,impacts=state.impactEvents.length;
   state.key('keydown',chord.code);state.key('keydown',chord.code,{repeat:true});
   assert.deepEqual(state.snapshot().pressed.map(n=>n.midi),[...chord.notes]);
   assert.ok(state.snapshot().pressed.every(n=>n.label===chord.key));
   assert.equal(state.futureEvents.length-before,chord.notes.length);
   assert.equal(state.impactEvents.length-impacts,1,'Bonk fires once per chord, using its real root');
   assert.equal(state.impactEvents.at(-1).root,chord.notes[0]);
   state.key('keyup',chord.code);assert.ok([...state.futureActive.values()].every(n=>n===0));
   state.key('keydown',chord.code,{target:{closest:()=>true}});assert.equal(state.snapshot().pressed.length,0);
  }
  assert.equal(state.graded(),0,'these chords do not advance practice or start playback');
  state.key('keydown','Equal');window.dispatch('blur');assert.ok([...state.futureActive.values()].every(n=>n===0));
 }finally{state.input.dispose();}
});

test('all three manual sound options route only the new keys and switching releases held and pedaled notes',()=>{
 const state=setup();
 try{
  state.input.setChords({...rosesChordShortcuts,...hereWithMeChordShortcuts});
  state.stabs.settings.closerMode='loud';
  for(const sound of ['keys678','keys123','lead']){
   state.stabs.setHereWithMeSound(sound);
   const first=state.events.length,manual=state.manualEvents.length;
   state.key('keydown','Equal');state.key('keydown','Equal',{repeat:true});
   if(sound==='keys678')assert.equal(state.events.length-first,4);
   else assert.deepEqual(state.manualEvents.slice(manual).map(e=>e.slice(0,2)),Array.from({length:4},()=>['on',sound==='lead'?'lead':'stabs']));
   state.key('keydown','Digit1');assert.equal(state.closerEvents.at(-1)[1],'Digit1','old keys 1–3 keep their sound');
   state.key('keyup','Digit1');
   state.stabs.setSustain(true);state.key('keyup','Equal');
   if(sound!=='keys678')assert.ok([...state.manualActive.values()].some(n=>n>0));
   state.stabs.setSustain(false);
   assert.ok([...state.active.values(),...state.manualActive.values()].every(n=>n===0));
   state.key('keydown','Minus');state.stabs.setSustain(true);state.key('keyup','Minus');
   state.stabs.setHereWithMeSound(sound==='lead'?'keys678':'lead');
   assert.equal(state.stabs.held.size,0);assert.equal(state.stabs.manualSustained.length,0);
   assert.ok([...state.active.values(),...state.manualActive.values()].every(n=>n===0));state.stabs.setSustain(false);
  }
  state.stabs.setHereWithMeSound('keys123');state.stabs.settings.closerMode='current';
  const count=state.events.length;state.key('keydown','Equal');assert.equal(state.events.length-count,4,'Current chord sound follows the existing selection');state.key('keyup','Equal');
 }finally{state.input.dispose();}
});

test('sampled manual chords preserve pitches shared by another held chord and clear on panic',()=>{
 const state=setup();
 try{
  state.input.setChords({...rosesChordShortcuts,...hereWithMeChordShortcuts});
  state.stabs.settings.closerMode='loud';state.stabs.setHereWithMeSound('keys123');
  state.key('keydown','Equal');state.key('keydown','Digit0');state.key('keyup','Equal');
  assert.ok(state.manualActive.get('stabs:C#4')>0,'C♯4 belongs to both chords');
  assert.ok(state.manualActive.get('stabs:E4')>0,'E4 belongs to both chords');
  state.key('keyup','Digit0');assert.ok([...state.manualActive.values()].every(n=>n===0));
  state.key('keydown','Digit9');state.stabs.releaseAll();assert.ok([...state.manualActive.values()].every(n=>n===0));
 }finally{state.input.dispose();}
});

test('manual lead chords reuse the four lead banks with the original one-octave separation',()=>{
 const events=[],banks=new Map([19,20,21,22].map(channel=>[channel,{voice:{
  triggerAttack(note,time,velocity){events.push(['on',channel,note,time,velocity]);},
  triggerRelease(note,time){events.push(['off',channel,note,time]);},
 }}]));
 const lead=Object.assign(Object.create(HereWithMeLeadEngine.prototype),{banks});
 lead.attackChordNote(60,42);lead.releaseChordNote(60,43);
 assert.deepEqual(events.slice(0,4).map(e=>e.slice(1,4)),[[19,'C4',42],[20,'C5',42],[21,'C5',42],[22,'C5',42]]);
 assert.deepEqual(events.slice(4).map(e=>e.slice(1)),[[19,'C4',43],[20,'C5',43],[21,'C5',43],[22,'C5',43]]);
 assert.ok([...banks.values()].every(bank=>bank.voice.maxPolyphony===24));
});

test('4/5 exactly lower 1/2 by one octave', () => {
  for (let key = 1; key <= 2; key++)
    assert.deepEqual(rosesChordShortcuts[`Digit${key + 3}`], rosesChordShortcuts[`Digit${key}`].map(midi => midi - 12));
});

test('chords attack together, illuminate every pitch, produce physical trails, and retrigger after release', () => {
  const state = setup();
  try {
    state.input.setTranspose(8); // Exact chord voicings stay fixed, unlike the melody map.
    for (const [code, pitches] of Object.entries(rosesChordShortcuts)) {
      state.events.length = 0;
      state.key('keydown', code);
      state.key('keydown', code, { repeat: true });
      assert.deepEqual(state.snapshot().pressed.map(note => note.midi), pitches);
      assert.equal(state.events.length, pitches.length);
      assert.ok(state.events.every(event => event[2] === 42 && event[3] === (['Digit4','Digit5','Digit6','Digit7'].includes(code) ? .68 : .86)));
      const held = state.notes.visible(performance.now(), 10000).filter(note => note.physicalEndMs === null);
      assert.deepEqual(held.map(note => note.midi), pitches);
      assert.equal(new Set(held.map(note => note.startMs)).size, 1);
      state.key('keyup', code);
      assert.equal(state.snapshot().pressed.length, 0);
      assert.ok([...state.active.values()].every(count => count === 0));
      state.key('keydown', code); state.key('keyup', code);
      assert.equal(state.events.filter(event => event[0] === 'on').length, pitches.length * 2);
    }
    assert.equal(state.graded(), 0, 'free experimentation does not advance or penalize practice');
  } finally { state.input.dispose(); }
});

test('shared chord and melody pitches release without stuck voices or ending another held chord', () => {
  const state = setup();
  try {
    state.key('keydown', 'Digit1'); state.key('keydown', 'Digit3');
    state.key('keydown', 'KeyU'); // Roses U = G#4, also held in both chords.
    state.key('keyup', 'Digit1');
    assert.equal(state.active.get('G#4'), 1);
    state.key('keyup', 'Digit3');
    assert.equal(state.active.get('G#4'), 0);
    assert.equal(state.melodyActive.get('G#4'), 1, 'the melody uses its own voice');
    state.key('keyup', 'KeyU');
    assert.ok([...state.active.values()].every(count => count === 0));
    assert.ok([...state.melodyActive.values()].every(count => count === 0));
  } finally { state.input.dispose(); }
});

test('pedal holds released stabs without muting a newly pressed chord', () => {
  const state = setup();
  try {
    state.stabs.setSustain(true);
    state.key('keydown', 'Digit1'); state.key('keyup', 'Digit1');
    assert.equal(state.active.get('G#4'), 1);
    state.key('keydown', 'Digit3');
    assert.equal(state.active.get('G#4'), 2, 'a repeated pitch gets a fresh attack while the previous strike rings');
    state.stabs.setSustain(false);
    assert.equal(state.active.get('G#4'), 1, 'pedal-up leaves a physically held note sounding');
    state.key('keyup', 'Digit3');
    assert.ok([...state.active.values()].every(count => count === 0));
  } finally { state.input.dispose(); }
});

test('overlapping shared pitches never release a previous strike on keydown', () => {
  const state = setup();
  try {
    state.key('keydown', 'Digit1'); state.key('keydown', 'Digit3');
    assert.equal(state.active.get('G#4'), 2);
    assert.equal(state.events.filter(event => event[0] === 'off').length, 0);
    state.key('keyup', 'Digit3');
    assert.equal(state.active.get('G#4'), 1);
    state.key('keyup', 'Digit1');
    assert.equal(state.active.get('G#4'), 0);
    assert.equal(state.notes.visible(performance.now(), 10000).filter(note => note.physicalEndMs === null).length, 0);
  } finally { state.input.dispose(); }
});

test('pedal release balances repeated sustained attacks and leaves a held strike alive', () => {
  const state = setup();
  try {
    state.stabs.setSustain(true);
    for (let i = 0; i < 3; i++) { state.key('keydown', 'Digit1'); state.key('keyup', 'Digit1'); }
    state.key('keydown', 'Digit1');
    assert.equal(state.active.get('G#4'), 4);
    state.stabs.setSustain(false);
    assert.equal(state.active.get('G#4'), 1);
    state.key('keyup', 'Digit1');
    assert.ok([...state.active.values()].every(count => count === 0));
  } finally { state.input.dispose(); }
});

test('each chord adds one mono root bass attack, with octave pairs sharing the same bass register', () => {
  const state = setup();
  try {
    const bassNotes = ['C#2', 'D#2', 'F2', 'C#2', 'D#2', 'A2', 'B2', 'C#2'];
    for (let index = 0; index < 8; index++) {
      state.bassEvents.length = 0;
      state.key('keydown', `Digit${index + 1}`);
      state.key('keydown', `Digit${index + 1}`, { repeat: true });
      assert.deepEqual(state.bassEvents, [['on', bassNotes[index], 42]]);
      assert.equal(state.snapshot().pressed.length, 4, 'bass is not shown as extra physical input');
      state.key('keyup', `Digit${index + 1}`);
      assert.equal(state.bassEvents.at(-1)[0], 'off');
    }
    state.key('keydown', 'Digit1'); state.key('keydown', 'Digit2');
    state.key('keyup', 'Digit2');
    assert.deepEqual(state.bassEvents.at(-1), ['on', 'C#2', 42], 'releasing the latest chord restores the held root');
    state.stabs.setSustain(true); state.key('keyup', 'Digit1');
    assert.equal(state.bassEvents.at(-1)[0], 'on');
    state.stabs.setSustain(false);
    assert.equal(state.bassEvents.at(-1)[0], 'off');
  } finally { state.input.dispose(); }
});

test('optional root bass stays silent for every chord when disabled', () => {
  const state = setup();
  try {
    state.stabs.settings = validRosesDropSettings({ mode: "drop", closerMode: "current", bassEnabled: false });
    for (const code of Object.keys(rosesChordShortcuts)) {
      state.key('keydown', code); state.key('keyup', code);
    }
    assert.deepEqual(state.bassEvents, []);
    assert.equal(state.events.filter(event => event[0] === 'on').length, 32);
  } finally { state.input.dispose(); }
});

test('blur, hidden pages, disabling input, and changing songs release whole chords', () => {
  const state = setup();
  try {
    for (const release of [() => window.dispatch('blur'), () => { document.hidden = true; document.dispatch('visibilitychange'); },
      () => state.input.setEnabled(false), () => state.input.setChords({})]) {
      document.hidden = false; state.input.setEnabled(true); state.input.setChords(rosesChordShortcuts);
      state.key('keydown', 'Digit1'); state.key('keydown', 'Digit2'); release();
      assert.equal(state.snapshot().pressed.length, 0);
      assert.ok([...state.active.values()].every(count => count === 0));
    }
  } finally { state.input.dispose(); }
});

test('text entry and modified browser shortcuts never trigger chords', () => {
  const state = setup();
  try {
    state.key('keydown', 'Digit1', { target: { closest: () => true } });
    state.key('keydown', 'Digit2', { metaKey: true });
    state.key('keydown', 'Digit3', { ctrlKey: true });
    assert.equal(state.events.length, 0);
  } finally { state.input.dispose(); }
});


test('Bonk preset routes every physical chord exactly once without old synth or bass attacks', () => {
  const state = setup(); state.stabs.settings = validRosesDropSettings({ closerMode: "current" });
  try {
    for (const [code, pitches] of Object.entries(rosesChordShortcuts)) {
      const before = state.impactEvents.length;
      state.key('keydown', code); state.key('keydown', code, { repeat: true });
      assert.equal(state.impactEvents.length, before + 1);
      assert.equal(state.impactEvents.at(-1).root, pitches[0]);
      assert.deepEqual(state.snapshot().pressed.map(note => note.midi), pitches);
      assert.equal(state.futureEvents.filter(event => event[0] === 'on').length, (before + 1) * 4);
      state.key('keyup', code);
      assert.equal(state.snapshot().pressed.length, 0);
      assert.ok([...state.futureActive.values()].every(count => count === 0));
    }
    assert.equal(state.events.length, 0); assert.equal(state.bassEvents.length, 0);
    assert.equal(state.graded(), 0);
    assert.deepEqual(Object.values(rosesChordShortcuts).map(pitches => bonkPitchForRoot(pitches[0])), [37,39,41,37,39,33,35,37]);
  } finally { state.input.dispose(); }
});

test('Bonk preset sustain balances repeated/shared MIDI voices while impact remains a one-shot', () => {
  const state = setup(); state.stabs.settings = validRosesDropSettings({ closerMode: "current" });
  try {
    state.stabs.setSustain(true);
    for (let i=0;i<3;i++) { state.key('keydown', 'Digit1'); state.key('keyup', 'Digit1'); }
    state.key('keydown', 'Digit3');
    assert.equal(state.futureActive.get('G#4'), 4);
    assert.equal(state.snapshot().pressed.length, 4);
    state.stabs.setSustain(false);
    assert.equal(state.futureActive.get('G#4'), 1);
    state.key('keyup', 'Digit3');
    assert.ok([...state.futureActive.values()].every(count => count === 0));
    assert.equal(state.impactEvents.length, 4);
    assert.equal(state.notes.visible(performance.now(),10000).filter(note=>note.physicalEndMs===null).length,0);
  } finally { state.input.dispose(); }
});


test('Closer keys 1–3 route one chord strike without Bonk or current-instrument attacks', () => {
  const state=setup();state.stabs.settings=validRosesDropSettings();
  try {
    for (const code of ['Digit1','Digit2','Digit3']) {
      const before=state.closerEvents.length;
      state.key('keydown',code);state.key('keydown',code,{repeat:true});
      assert.deepEqual(state.snapshot().pressed.map(note=>note.midi),rosesChordShortcuts[code]);
      assert.equal(state.closerEvents.length-before,1);
      assert.equal(state.closerEvents.at(-1)[1],code);
      state.key('keyup',code);
      assert.ok([...state.closerActive.values()].every(count=>count===0));
    }
    assert.equal(state.events.length,0);assert.equal(state.futureEvents.length,0);assert.equal(state.bassEvents.length,0);assert.equal(state.impactEvents.length,0);
    assert.equal(state.stabs.closerSources.size,0);
    assert.equal(state.notes.visible(performance.now(),10000).filter(note=>note.physicalEndMs===null).length,0);
  } finally {state.input.dispose();}
});

test('Closer A/B retains keydown ownership and releases pedal notes independently of held key 8', () => {
  const state=setup();state.stabs.settings=validRosesDropSettings({closerMode:'current'});
  try {
    state.key('keydown','Digit1');
    state.stabs.settings=validRosesDropSettings();
    state.key('keyup','Digit1');
    assert.ok([...state.futureActive.values()].every(count=>count===0));
    state.stabs.setSustain(true);
    for(let i=0;i<3;i++){state.key('keydown','Digit3');state.key('keyup','Digit3');}
    state.key('keydown','Digit8');
    assert.equal(state.closerActive.get('Digit3'),3);assert.equal(state.futureActive.get('G#4'),1);
    state.stabs.settings=validRosesDropSettings({closerMode:'current'});
    state.stabs.setSustain(false);
    assert.equal(state.closerActive.get('Digit3'),0);assert.equal(state.futureActive.get('G#4'),1);
    state.key('keyup','Digit8');
    assert.ok([...state.futureActive.values()].every(count=>count===0));
    assert.equal(state.stabs.closerSustained.size,0);
  } finally {state.input.dispose();}
});

test('Closer selection never routes keys 4–8 away from either of their current instrument choices', () => {
  for(const mode of ['bonk','drop']) {
    const state=setup();state.stabs.settings=validRosesDropSettings({mode,closerMode:'loud'});
    try {
      for(const code of ['Digit4','Digit5','Digit6','Digit7','Digit8']) {
        state.key('keydown',code);state.key('keyup',code);
      }
      assert.equal(state.closerEvents.length,0);assert.equal(state.closerImpacts.length,0);
      assert.equal((mode==='bonk'?state.futureEvents:state.events).filter(event=>event[0]==='on').length,20);
      assert.equal((mode==='bonk'?state.impactEvents:state.bassEvents.filter(event=>event[0]==='on')).length,5);
    } finally {state.input.dispose();}
  }
});


test('HWM chord/guitar/pad option plays one full chord per key, preserves old keys and releases under pedal and sound changes',()=>{
 const state=setup();try{
  state.input.setChords({...rosesChordShortcuts,...hereWithMeChordShortcuts});state.stabs.setHereWithMeSound('harmony');
  for(const chord of hereWithMeChords){
   const count=state.manualEvents.length;state.key('keydown',chord.code);state.key('keydown',chord.code,{repeat:true});
   assert.deepEqual(state.manualEvents.slice(count),[['on','harmony',chord.code,42]]);assert.equal(state.active.size,0);
   assert.deepEqual(state.snapshot().pressed.map(n=>n.midi),[...chord.notes]);state.key('keyup',chord.code);
   assert.equal(state.manualActive.get('harmony:'+chord.code),0);
  }
  state.key('keydown','Equal');state.stabs.setSustain(true);state.key('keyup','Equal');assert.ok(state.manualActive.get('harmony:Equal')>0);
  state.key('keydown','Equal');state.stabs.setSustain(false);assert.ok(state.manualActive.get('harmony:Equal')>0,'pedal up cannot silence a re-held chord');
  state.key('keyup','Equal');assert.equal(state.manualActive.get('harmony:Equal'),0);
  state.key('keydown','Minus');state.stabs.setSustain(true);state.key('keyup','Minus');state.stabs.setHereWithMeSound('keys678');
  assert.ok([...state.manualActive.values()].every(n=>n===0));assert.equal(state.stabs.manualSources.size,0);
  state.stabs.setSustain(false);state.key('keydown','Digit8');assert.ok(state.active.size>0,'physical 1–8 retain their own instrument');state.key('keyup','Digit8');
  assert.equal(state.graded(),0);
 }finally{state.input.dispose();}
});
