import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const toneMock=`
export const events=[];export const immediate=()=>10,now=()=>10;
class Param {rampTo(value){this.value=value;}}
export class Gain {constructor(){this.volume=new Param();this.gain=new Param();}connect(){return this;}chain(){return this;}toDestination(){return this;}disconnect(){}dispose(){}}
export class Volume extends Gain{} export class Filter extends Gain{} export class Distortion extends Gain{} export class Synth{}
export class PolySynth extends Gain {
 constructor(options){super();this.options=options;events.push({kind:'create',voice:this});}
 triggerAttack(note,at,velocity){events.push({kind:'attack',note,at,velocity,voice:this});}
 triggerRelease(note,at){events.push({kind:'release',note,at,voice:this});}
 triggerAttackRelease(note,duration,at,velocity){events.push({kind:'auto',note,duration,at,velocity,voice:this});}
 releaseAll(at){events.push({kind:'all-off',at,voice:this});}
}
`;
const bundle=await build({stdin:{contents:`export {RosesBassEngine} from './src/piano/rosesBassEngine';export {silentAutomaticBassActive,rosesManualBassKeys,rosesManualBassNote} from './src/piano/rosesManualBass';export {KeyboardInputManager} from './src/piano/keyboardInput';export {rosesKeyGuide} from './src/piano/rosesPresentation';export {rosesMap} from './src/piano/roses';export {events} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'audio',setup(b){b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:toneMock}));}}]});
const {silentAutomaticBassActive,RosesBassEngine,rosesManualBassKeys,rosesManualBassNote,KeyboardInputManager,rosesKeyGuide,rosesMap,events}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('manual bass uses the existing bass/sub voices, pitches, levels and velocities, with no allocation on rapid repeats',()=>{
 events.length=0;const engine=new RosesBassEngine();
 const bass=engine.bass,sub=engine.sub,levels=[engine.bassOutput.volume.value,engine.subOutput.volume.value];
 for(const key of rosesManualBassKeys){
  engine.attackManual(key.midi);engine.attackManual(key.midi);
  const on=events.filter(e=>e.kind==='attack').slice(-2);
  assert.deepEqual(on.map(e=>e.voice),[bass,sub]);assert.deepEqual(on.map(e=>e.velocity),[.78,.68]);
  assert.equal(on[0].note,key.midi===49?'C#3':key.midi===45?'A2':'E2');
  engine.releaseManual(key.midi);engine.releaseManual(key.midi);
 }
 assert.equal(events.filter(e=>e.kind==='attack').length,6);assert.equal(events.filter(e=>e.kind==='release').length,6);
 for(let i=0;i<100;i++){engine.attackManual(49);engine.releaseManual(49);}
 assert.equal(events.filter(e=>e.kind==='create').length,3,'manual playing reuses the three existing bass/sub/build synths');
 assert.deepEqual([engine.bassOutput.volume.value,engine.subOutput.volume.value],levels);
 engine.attackManual(40);engine.releaseManualNotes();assert.equal(engine.manualNotes.size,0);
 engine.attackManual(45);engine.releaseAll();assert.equal(engine.manualNotes.size,0);engine.dispose();
});

class Target{
 listeners=new Map();addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}
 removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)??[]).filter(x=>x!==fn));}
 dispatch(name,event){for(const fn of this.listeners.get(name)??[])fn(event);}
}
test('manual physical keys ignore repeat and release both layers on keyup, blur, visibility and disabling input',()=>{
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;globalThis.document=new Target();document.hidden=false;
 const engine=new RosesBassEngine();events.length=0;
 const input=new KeyboardInputManager(rosesMap,{pitchForKey:e=>rosesManualBassNote(e.code)?.midi,noteOn:midi=>engine.attackManual(midi),noteOff:midi=>engine.releaseManual(midi),change(){}});input.setEnabled(true);
 const key=(type,code,repeat=false,target=null)=>window.dispatch(type,{code,repeat,target,shiftKey:false,preventDefault(){}});
 try{
  key('keydown','Comma');key('keydown','Comma',true);assert.equal(events.filter(e=>e.kind==='attack').length,2);
  key('keyup','Comma');assert.equal(events.filter(e=>e.kind==='release').length,2);
  for(const release of [()=>window.dispatch('blur'),()=>{document.hidden=true;document.dispatch('visibilitychange');document.hidden=false;},()=>input.setEnabled(false)]){
   key('keydown','Period');key('keydown','Slash');assert.equal(engine.manualNotes.size,2);release();assert.equal(engine.manualNotes.size,0);
  }
  input.setEnabled(true);const before=events.length;key('keydown','Comma',false,{closest:()=>true});assert.equal(events.length,before,'typing in a field does not trigger bass');
 }finally{input.dispose();engine.dispose();}
});

test('manual bass adds conflict-free labels without shifting any existing Roses or chord mapping',()=>{
 const original=JSON.stringify(rosesMap);const guide=rosesKeyGuide(rosesMap,3,'KeyL',true);
 for(const key of rosesManualBassKeys){assert.equal(rosesMap.bindings.some(b=>b.code===key.code),false);assert.ok(guide[key.midi].some(x=>x.code===key.code&&x.label===key.label));}
 assert.equal(JSON.stringify(rosesMap),original);assert.equal(rosesKeyGuide(rosesMap,3,'KeyL')[49]?.some(x=>x.code==='Comma')??false,false);
});


test('automatic bass gestures update physical notes without triggering audio and release across section changes',()=>{
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;globalThis.document=new Target();document.hidden=false;
 let clock={bassPlaybackMode:'auto',status:'running',measure:13,bassActive:true};
 const held=new Set(),visual=new Map();let sounds=0,snapshot;
 const input=new KeyboardInputManager(rosesMap,{
  pitchForKey:e=>silentAutomaticBassActive(clock)?rosesManualBassNote(e.code)?.midi:undefined,
  noteOn(midi,code){if(silentAutomaticBassActive(clock)&&rosesManualBassNote(code)){held.add(code);visual.set(code,midi);}else sounds++;},
  noteOff(midi,code){if(held.delete(code))visual.delete(code);},change(value){snapshot=value;}
 });input.setEnabled(true);
 const key=(type,code,repeat=false)=>window.dispatch(type,{code,repeat,target:null,shiftKey:false,preventDefault(){}});
 try{
  for(const note of rosesManualBassKeys){key('keydown',note.code);key('keydown',note.code,true);}
  assert.deepEqual(snapshot.pressed.map(key=>key.midi),[49,45,40]);assert.equal(visual.size,3);assert.equal(sounds,0);
  key('keyup','Period');assert.equal(visual.size,2);
  clock={...clock,measure:21};key('keyup','Comma');key('keyup','Slash');assert.equal(visual.size,0,'keyup retains visual ownership past bar 20');
  clock={...clock,measure:20};key('keydown','Slash');window.dispatch('blur');assert.equal(visual.size,0);
  for(const override of [{measure:12},{measure:21},{bassActive:false},{status:'idle'},{bassPlaybackMode:'manual'}])assert.equal(silentAutomaticBassActive({...clock,...override}),false);
  const guide=rosesKeyGuide(rosesMap,-4,'KeyL',silentAutomaticBassActive(clock));
  for(const note of rosesManualBassKeys)assert.ok(guide[note.midi].some(key=>key.code===note.code));
 }finally{input.dispose();}
});
