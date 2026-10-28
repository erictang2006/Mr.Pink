import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:`export {performanceKeyPitch} from './src/piano/performanceKeyPitch';export {KeyboardInputManager} from './src/piano/keyboardInput';export {levelsEMajor} from './src/piano/levelsRealPiano';export {getPitch} from './src/piano/noteMapping';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {performanceKeyPitch,KeyboardInputManager,levelsEMajor,getPitch}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const roses={manualBuildupLeadPitch:()=>undefined,bassInputPitch:()=>undefined};
test('Roses intro pitch wins over stale opening state, Shift and the previous Levels keyboard map',()=>{
 assert.equal(getPitch(levelsEMajor,'KeyL',false,0),88,'the previous map can return E6 instead of the dedicated E4');
 for(const pianoTyping of [false,true])for(const shiftKey of [false,true])for(const transpose of [-4,0,4]){
  for(const [code,midi] of [['KeyL',64],['Semicolon',66],['Quote',68]]){
   assert.equal(performanceKeyPitch({code,shiftKey},12,'roses',pianoTyping,transpose+4,'KeyG',roses),midi+transpose);
  }
 }
 assert.equal(performanceKeyPitch({code:'Digit1',shiftKey:true},0,'levels',true,4,'KeyG',roses),getPitch(levelsEMajor,'Digit1',true,0));
 assert.equal(performanceKeyPitch({code:'Digit1',shiftKey:true},0,'interstellar',true,4,'KeyG',roses),undefined);
});

test('rapid intro notes keep exact pitches and releases even when UI frames are delayed by 250 ms',()=>{
 const names=['window','document','performance','requestAnimationFrame','cancelAnimationFrame'],saved=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
 const target=()=>({listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);},removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)??[]).filter(item=>item!==fn));},dispatch(name,event){for(const fn of this.listeners.get(name)??[])fn(event);}});
 globalThis.window=target();globalThis.document=target();window.setInterval=()=>1;window.clearInterval=()=>{};
 let now=0,serial=0;const frames=new Map(),on=[],off=[],changes=[];globalThis.performance={now:()=>now};
 globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const input=new KeyboardInputManager(levelsEMajor,{pitchForKey:(event,transpose)=>performanceKeyPitch(event,transpose,'roses',true,4,'KeyG',roses),noteOn:(midi,code)=>on.push([code,midi]),noteOff:(midi,code)=>off.push([code,midi]),change:value=>changes.push(value)},{batchChanges:true});
 const keys=[['KeyL',64],['Semicolon',66],['Quote',68]],key=(type,code,repeat=false)=>window.dispatch(type,{code,shiftKey:true,repeat,target:null,preventDefault(){}});
 try{
  input.setEnabled(true);
  for(let i=0;i<60;i++){const [code]=keys[i%3];key('keydown',code);key('keydown',code,true);now+=250;key('keyup',code);}
  assert.deepEqual(on,Array.from({length:60},(_,i)=>keys[i%3]));assert.deepEqual(off,on);assert.equal(changes.length,0);assert.equal(frames.size,1);
  for(const fn of [...frames.values()])fn();frames.clear();assert.deepEqual(changes.at(-1).pressed,[]);
 }finally{input.dispose();for(const [name,value] of Object.entries(saved))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
});

test('HWM gesture pitches override the old octave and chord map only during their silent section',()=>{
 const pitches={KeyJ:73,KeyH:71,KeyF:68,KeyD:66,KeyS:64,KeyA:63,KeyW:59};
 const engine={...roses,isSilentBuildupLeadGesture:code=>code in pitches};
 for(const shiftKey of [false,true])for(const transpose of [-4,0,4])for(const [code,midi] of Object.entries(pitches))
  assert.equal(performanceKeyPitch({code,shiftKey},transpose,'roses',false,transpose+4,'KeyG',engine),midi);
 assert.equal(performanceKeyPitch({code:'KeyA',shiftKey:false},0,'roses',false,4,'KeyG',roses),undefined,'outside the section existing pitch fallback is unchanged');
});
