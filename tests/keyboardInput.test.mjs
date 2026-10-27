import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const output = '/private/tmp/stage-piano-keyboard-test.mjs';
await build({ entryPoints: ['src/piano/keyboardInput.ts'], bundle: true, platform: 'node', format: 'esm', outfile: output });
const { KeyboardInputManager } = await import(pathToFileURL(output).href);

class EventTargetMock {
  listeners = new Map();
  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== callback));
  }
  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
}

function setup() {
  globalThis.window = new EventTargetMock();
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  globalThis.document = new EventTargetMock();
  document.hidden = false;
  const attacks = [];
  const releases = [];
  let latest;
  const map = { id: 'test', name: 'Test', bindings: [{ code: 'KeyZ', label: 'Z', midi: 48, shiftedMidi: 60 }, { code: 'KeyQ', label: 'Q', midi: 60, shiftedMidi: 72 }] };
  const manager = new KeyboardInputManager(map, { noteOn: pitch => attacks.push(pitch), noteOff: pitch => releases.push(pitch), change: snapshot => { latest = snapshot; } });
  manager.setEnabled(true);
  const key = (type, code, shiftKey = false, repeat = false) => window.dispatch(type, { code, shiftKey, repeat, target: null, preventDefault() {} });
  return { manager, key, attacks, releases, snapshot: () => latest };
}

test('held keys ignore repeat and release the pitch captured at keydown', () => {
  const state = setup();
  state.key('keydown', 'KeyZ');
  state.key('keydown', 'KeyZ', false, true);
  state.key('keydown', 'KeyQ', true);
  assert.deepEqual(state.attacks, [48, 72]);
  assert.deepEqual(state.snapshot().pressed.map(item => item.midi), [48, 72]);
  state.key('keyup', 'KeyQ', false);
  state.key('keyup', 'KeyZ', true);
  assert.deepEqual(state.releases, [72, 48]);
  state.manager.dispose();
});

test('losing focus and disabling performance release all held notes', () => {
  const state = setup();
  state.key('keydown', 'KeyZ');
  state.key('keydown', 'KeyQ');
  window.dispatch('blur');
  assert.deepEqual(state.releases, [48, 60]);
  assert.equal(state.snapshot().pressed.length, 0);
  state.key('keydown', 'KeyZ');
  state.manager.setEnabled(false);
  assert.deepEqual(state.releases, [48, 60, 48]);
  state.manager.dispose();
});

test('section map changes preserve the original held pitch until keyup', () => {
  const state = setup();
  state.key('keydown', 'KeyQ');
  state.manager.setMap({ id: 'transition', name: 'Transition', bindings: [{ code: 'KeyQ', label: 'Q', midi: 68 }] }, true);
  assert.deepEqual(state.releases, []);
  state.key('keydown', 'KeyQ', false, true);
  assert.deepEqual(state.attacks, [60]);
  state.key('keyup', 'KeyQ');
  assert.deepEqual(state.releases, [60]);
  state.key('keydown', 'KeyQ');
  assert.deepEqual(state.attacks, [60, 68]);
  state.manager.dispose();
});

test('unchanged polling does not refresh the app; physical changes and note-rate expiry still publish',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,oldPerformance=globalThis.performance;
 globalThis.window=new EventTargetMock();globalThis.document=new EventTargetMock();document.hidden=false;
 let poll,now=0;window.setInterval=callback=>{poll=callback;return 1;};window.clearInterval=()=>{};
 globalThis.performance={now:()=>now};
 const changes=[],attacks=[],releases=[];
 const manager=new KeyboardInputManager({id:'load-test',bindings:[{code:'KeyZ',label:'Z',midi:48}]},{noteOn:pitch=>attacks.push(pitch),noteOff:pitch=>releases.push(pitch),change:snapshot=>changes.push(snapshot)});
 const key=type=>window.dispatch(type,{code:'KeyZ',shiftKey:false,repeat:false,target:null,preventDefault(){}});
 try{
  manager.setEnabled(true);
  for(let index=0;index<1000;index++)poll();
  assert.equal(changes.length,1,'1,000 identical idle polls produce one UI update');
  key('keydown');assert.deepEqual(attacks,[48]);assert.equal(changes.at(-1).pressed.length,1);assert.equal(changes.at(-1).notesPerSecond,1);
  const before=changes.length;for(let index=0;index<1000;index++)poll();assert.equal(changes.length,before);
  now=1001;poll();assert.equal(changes.length,before+1);assert.equal(changes.at(-1).notesPerSecond,0);assert.equal(changes.at(-1).pressed.length,1);
  key('keyup');assert.deepEqual(releases,[48]);assert.equal(changes.at(-1).pressed.length,0);
  const after=changes.length;window.dispatch('blur');poll();assert.equal(changes.length,after);
 }finally{manager.dispose();globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.performance=oldPerformance;}
});

test('rapid Roses keys sound and release synchronously while UI snapshots coalesce per frame',()=>{
 const names=['window','document','requestAnimationFrame','cancelAnimationFrame'];
 const saved=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
 globalThis.window=new EventTargetMock();globalThis.document=new EventTargetMock();
 window.setInterval=()=>1;window.clearInterval=()=>{};
 const frames=new Map();let serial=0;
 globalThis.requestAnimationFrame=callback=>{frames.set(++serial,callback);return serial;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const changes=[],audio=[],letters=[...'TEPURYOWEIQT'];
 const bindings=[...new Set(letters)].map((label,index)=>({code:`Key${label}`,label,midi:60+index}));
 const manager=new KeyboardInputManager({id:'rapid-input',bindings},{
  noteOn:(midi,code)=>audio.push(['on',code,midi]),noteOff:(midi,code)=>audio.push(['off',code,midi]),change:snapshot=>changes.push(snapshot),
 },{batchChanges:true});
 const key=(type,label,repeat=false)=>window.dispatch(type,{code:`Key${label}`,shiftKey:false,repeat,target:null,preventDefault(){}});
 const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());};
 try{
  manager.setEnabled(true);
  for(const letter of letters){key('keydown',letter);key('keydown',letter,true);key('keyup',letter);}
  assert.equal(audio.length,letters.length*2,'all audio runs before any animation frame');
  assert.deepEqual(audio.map(event=>event.slice(0,2)),letters.flatMap(letter=>[['on',`Key${letter}`],['off',`Key${letter}`]]));
  assert.equal(changes.length,0);assert.equal(frames.size,1);
  tick();assert.equal(changes.length,1);assert.equal(changes[0].notesPerSecond,letters.length);
  assert.deepEqual(changes[0].pressed,[]);assert.deepEqual(changes[0].detected,[]);
  key('keydown','P');key('keydown','O');tick();
  assert.deepEqual(changes.at(-1).pressed.map(key=>key.code),['KeyP','KeyO']);
  const before=changes.length;window.dispatch('blur');
  assert.deepEqual(audio.slice(-2).map(event=>event.slice(0,2)),[['off','KeyP'],['off','KeyO']]);
  assert.equal(changes.length,before);tick();assert.deepEqual(changes.at(-1).pressed,[]);
  key('keydown','T');manager.dispose();assert.equal(frames.size,0);
  assert.deepEqual(audio.at(-1).slice(0,2),['off','KeyT']);
 }finally{manager.dispose();for(const [name,value] of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});
