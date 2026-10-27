import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const mockTone = `
export const state={voices:[],events:[]};
export class Volume {
  volume={rampTo(){}};
  toDestination(){return this;}
  dispose(){}
}
export class Sampler {
  _activeSources=new Map();
  constructor(options){queueMicrotask(options.onload);}
  connect(){return this;}
  triggerAttack(_note,_time,_gain){
    state.events.push(['on',_note,_time]);
    const midi=globalThis.__testMidi;
    const voice={stops:0,stop(time){this.stops++;state.events.push(['stop',time]);}};
    state.voices.push(voice);
    this._activeSources.set(midi,[...(this._activeSources.get(midi)??[]),voice]);
  }
  triggerRelease(note,time){state.events.push(['off',note,time]);}
  releaseAll(){for(const voice of state.voices)if(!voice.stops)voice.stop();}
  dispose(){}
}
export const start=async()=>{};
export const now=()=>.2,immediate=()=>0;
`;
const bundled=await build({stdin:{contents:"export {PianoAudioEngine} from './src/piano/audioEngine';export {state} from 'tone';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-tone',setup(bundle){bundle.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));bundle.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mockTone,loader:'js'}));}}]});
const path='/private/tmp/mr-pink-piano-audio-budget-test.mjs';writeFileSync(path,bundled.outputFiles[0].text);
const {PianoAudioEngine,state}=await import(pathToFileURL(path).href);

test('large simultaneous chords keep all forty physically held sample voices until their actual releases',async()=>{
 state.voices.length=0;
 const engine=new PianoAudioEngine();await engine.start();
 try{
  for(let index=0;index<40;index++){
   globalThis.__testMidi=60+index;
   assert.equal(engine.noteOnSource(`typing:${index}`,60+index),true);
  }
  assert.equal(state.voices.filter(voice=>voice.stops===0).length,40,'physical notes must not be stolen by either tail budget');
  engine.noteOffSource('typing:39');
  assert.equal(state.voices.at(-1).stops,1);
  engine.releaseAll();
  assert.equal(state.voices.filter(voice=>voice.stops===0).length,0);
 }finally{engine.dispose();delete globalThis.__testMidi;}
});

test('rapid pedal-held tails are trimmed before any still-physical chord, and pedal-up releases every remaining tail',async()=>{
 state.voices.length=0;const engine=new PianoAudioEngine();await engine.start();engine.setSustain(true);
 try{
  for(let i=0;i<10;i++){globalThis.__testMidi=48+i;engine.noteOnSource(`held:${i}`,48+i);}
  const held=state.voices.slice();
  for(let i=0;i<100;i++){
   globalThis.__testMidi=60+i%24;engine.noteOnSource(`tail:${i}`,60+i%24);engine.noteOffSource(`tail:${i}`);
   assert.ok(held.every(voice=>voice.stops===0),'ongoing physical chord stays intact');
   assert.ok(state.voices.filter(voice=>voice.stops===0).length<=24);
  }
  assert.ok(state.voices.some(voice=>voice.fadeOut===.012));
  engine.setSustain(false);assert.equal(state.voices.filter(voice=>voice.stops===0).length,10);
  for(let i=0;i<10;i++)engine.noteOffSource(`held:${i}`);
  assert.equal(state.voices.filter(voice=>voice.stops===0).length,0);
 }finally{engine.dispose();delete globalThis.__testMidi;}
});

test('retriggering one source never cuts a different physical owner of the same MIDI pitch',async()=>{
 state.voices.length=0;const engine=new PianoAudioEngine();await engine.start();
 try{
  globalThis.__testMidi=64;engine.noteOnSource('left',64);engine.noteOnSource('right',64);engine.noteOnSource('left',64);
  assert.equal(state.voices[0].stops,1);assert.equal(state.voices[1].stops,0);assert.equal(state.voices[2].stops,0);
  engine.noteOffSource('right');assert.equal(state.voices[1].stops,1);assert.equal(state.voices[2].stops,0);
  engine.releaseAll();assert.ok(state.voices.every(voice=>voice.stops>0));
 }finally{engine.dispose();delete globalThis.__testMidi;}
});

test('sampled piano live attacks and releases bypass 200ms look-ahead in Levels, Interstellar and ordinary piano routes',async()=>{
 state.events.length=0;const engine=new PianoAudioEngine();await engine.start();
 try{
  engine.noteOn(64);engine.noteOff(64);
  globalThis.__testMidi=60;engine.noteOnSource('interstellar:test',60);engine.noteOffSource('interstellar:test');
  engine.setSustain(true);engine.noteOn(65);engine.noteOff(65);engine.setSustain(false);
  assert.ok(state.events.some(event=>event[0]==='on'));assert.ok(state.events.some(event=>event[0]==='off'));assert.ok(state.events.some(event=>event[0]==='stop'));
  for(const event of state.events)assert.equal(event.at(-1),0,'physical audio must use the immediate clock');
 }finally{engine.dispose();delete globalThis.__testMidi;}
});
