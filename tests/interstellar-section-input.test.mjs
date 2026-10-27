import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import assistedSource from '../src/piano/interstellar_assisted_bars_9_13.json' with {type:'json'};
const bundle=await build({stdin:{contents:`
export * from './src/piano/interstellarPerformance';
export * from './src/piano/interstellarMix';
export * from './src/piano/interstellarPresentation';
export * from './src/piano/interstellarRoblox';
export * from './src/piano/keyboardInput';
export * from './src/components/interstellarPiano';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {mapForInterstellarSection,moveInterstellarSection,planInterstellarPress,defaultInterstellarMix,interstellarKeyGuide,interstellarRobloxMap,interstellarDisplayPressedKeys,KeyboardInputManager,drawInterstellarPiano,interstellarPianoGeometry}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
class Target {
 listeners=new Map();
 addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}
 removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)??[]).filter(item=>item!==fn));}
 dispatch(name,event={}){for(const fn of this.listeners.get(name)??[])fn(event);}
}
function setup(){
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 let section=1,cursor=0,snapshot;const attacks=[],releases=[];
 const manager=new KeyboardInputManager(mapForInterstellarSection(section),{
  noteOn:(midi,code)=>{const plan=planInterstellarPress(section,code,midi,cursor,defaultInterstellarMix);cursor=plan.nextCursor;attacks.push({code,midi,voices:plan.voices});},
  noteOff:(midi,code)=>releases.push({midi,code}),change:value=>{snapshot=value;},
 });
 manager.setReservedCodes(['ArrowLeft','ArrowRight','Space','Escape','F7','F8','F9']);manager.setEnabled(true);
 window.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.code)||event.repeat)return;
  const next=moveInterstellarSection(section,event.code==='ArrowRight'?1:-1);if(next===section)return;
  section=next;if(next===2)cursor=0;manager.setMap(mapForInterstellarSection(next),true);
 });
 const key=(type,code,repeat=false)=>window.dispatch(type,{code,repeat,shiftKey:false,target:null,preventDefault(){}});
 const tap=code=>{key('keydown',code);key('keyup',code);};
 return {manager,key,tap,attacks,releases,section:()=>section,cursor:()=>cursor,snapshot:()=>snapshot};
}

test('right/left arrows switch all three original input maps and preserve held-key release ownership',()=>{
 const state=setup();try{
  state.tap('KeyC');assert.equal(state.attacks.length,0,'Opening retains its original mapping');
  state.tap('ArrowRight');assert.equal(state.section(),2);
  state.key('keydown','KeyC');assert.equal(state.attacks.at(-1).midi,69);
  state.key('keydown','ArrowRight',true);assert.equal(state.section(),2,'repeat cannot skip a section');
  state.tap('ArrowRight');assert.equal(state.section(),3);
  assert.equal(state.snapshot().pressed[0].midi,69,'held assisted pitch survives section change');
  state.key('keyup','KeyC');assert.deepEqual(state.releases.at(-1),{code:'KeyC',midi:69});
  state.tap('KeyF');assert.deepEqual(state.attacks.at(-1).voices.map(voice=>voice.midi),[76,88]);
  state.tap('ArrowRight');assert.equal(state.section(),3);
  state.tap('ArrowLeft');assert.equal(state.section(),2);assert.equal(state.cursor(),0);
  state.tap('KeyC');assert.deepEqual(state.attacks.at(-1).voices.map(voice=>voice.midi),[69,64]);
  window.dispatch('blur');assert.deepEqual(state.snapshot().pressed,[]);
 }finally{state.manager.dispose();}
});

test('the original cbm/vnm.cbm/zvm fingering plays the actual assisted pitches',()=>{
 const state=setup();try{
  state.tap('ArrowRight');
  for(const char of 'cbm/vnm.cbm/zvm'){
   const code=char==='/'?'Slash':char==='.'?'Period':`Key${char.toUpperCase()}`;
   state.tap(code);assert.equal(state.attacks.at(-1).midi,assistedSource.keyboardMapping[code].midi);
  }
 }finally{state.manager.dispose();}
});

test('all 60 original physical assisted inputs reproduce the imported live and generated score exactly',()=>{
 const state=setup();try{
  state.tap('ArrowRight');
  for(const bar of assistedSource.bars)for(const event of bar.events){
   state.tap(event.physicalKey);
   assert.equal(state.attacks.at(-1).midi,event.liveMidi);
   assert.deepEqual(state.attacks.at(-1).voices.map(voice=>voice.midi),[event.liveMidi,...event.assistedMidi]);
  }
  assert.equal(state.attacks.length,60);assert.equal(state.cursor(),0);
 }finally{state.manager.dispose();}
});

test('Roblox visual labels stay fixed while assisted input illuminates the correct reference keycap',()=>{
 const guide=interstellarKeyGuide(interstellarRobloxMap,0,2,true);
 assert.equal(guide[69][0].label,'p');assert.equal(guide[72][0].label,'s');assert.equal(guide[76][0].label,'f');
 assert.equal(guide[89][0].label,'c','the visible c label remains the Roblox reference, never the assisted alias');
 const physical=[{code:'KeyC',midi:69},{code:'KeyB',midi:72},{code:'KeyM',midi:76}];
 const display=interstellarDisplayPressedKeys(physical);
 assert.deepEqual(display,[{code:'KeyP',midi:69},{code:'KeyS',midi:72},{code:'KeyF',midi:76}]);
 const labels=[];const ctx=new Proxy({fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),fillText(label){labels.push({label,color:this.fillStyle});}},{get(target,key){return key in target?target[key]:()=>{};}});
 drawInterstellarPiano(ctx,1920,324,interstellarPianoGeometry(1920,0,36,96),guide,new Set([69,72,76]),new Set(physical.map(key=>key.code)),new Map(),undefined,1,undefined,display);
 for(const label of ['p','s','f'])assert.equal(labels.find(item=>item.label===label).color,'#09273a');
 assert.notEqual(labels.find(item=>item.label==='c').color,'#09273a');
 assert.deepEqual(physical,[{code:'KeyC',midi:69},{code:'KeyB',midi:72},{code:'KeyM',midi:76}],'display conversion never mutates actual held input');
});


test('full Interstellar display labels all 61 C2–C7 keys once and highlights every sounding assisted/octave pitch',()=>{
 for(const transpose of [0,2,-3]){
  const guide=interstellarKeyGuide(interstellarRobloxMap,transpose,1,false);
  const geometry=interstellarPianoGeometry(1920,transpose,36,96);
  assert.equal(geometry.keys.size,61);assert.equal(Object.keys(guide).length,61);
  for(const midi of geometry.keys.keys())assert.equal(guide[midi]?.length,1,`one label at MIDI ${midi}`);
  for(const section of [1,2,3]){
   const map=mapForInterstellarSection(section);
   for(const binding of map.bindings){
    const pitches=planInterstellarPress(section,binding.code,binding.midi+transpose,0,defaultInterstellarMix).voices.map(voice=>voice.midi);
    const display=interstellarDisplayPressedKeys(pitches.map(midi=>({code:'',midi})),transpose);
    const labels=[];
    const ctx=new Proxy({fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),fillText(label){labels.push({label,color:this.fillStyle});}},{get(target,key){return key in target?target[key]:()=>{};}});
    drawInterstellarPiano(ctx,1920,324,geometry,guide,new Set(pitches),new Set(),new Map(),undefined,1,undefined,display);
    assert.equal(labels.length,61);
    for(const midi of pitches)assert.equal(labels.find(entry=>entry.label===guide[midi][0].label)?.color,'#09273a');
   }
  }
 }
});
