import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import assisted from '../src/piano/interstellar_assisted_bars_9_13.json' with {type:'json'};

const result=await build({stdin:{contents:`
export * from './src/piano/interstellarRoblox';
export * from './src/piano/interstellarPresentation';
export * from './src/piano/interstellarPerformance';
export * from './src/piano/interstellarMix';
export * from './src/piano/noteMapping';
export * from './src/piano/keyboardInput';
export * from './src/piano/liveNotes';
export * from './src/piano/pedalInput';
export * from './src/piano/performancePresentation';
export * from './src/components/interstellarPiano';
export { rosesMap } from './src/piano/roses';
export { levelsMap } from './src/piano/levels';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const {interstellarRobloxMap:map,robloxWhiteCharacters,robloxShiftCharacter,interstellarAssistedCode,interstellarThemeShortcut,interstellarKeyGuide,interstellarPianoGeometry,interstellarProminentPitches,planInterstellarPress,defaultInterstellarMix,getPitch,midiToName,KeyboardInputManager,LiveNotes,physicalNoteBar,PedalInput,drawInterstellarPiano,rosesMap,levelsMap}=api;

test('full reference sequence maps 36 white keys and 25 shifted black keys to exactly C2–C7',()=>{
 assert.equal(robloxWhiteCharacters,'1234567890qwertyuiopasdfghjklzxcvbnm');
 assert.equal(map.bindings.length,36);
 const whiteNames=['C','D','E','F','G','A','B'];
 const all=[];
 map.bindings.forEach((binding,index)=>{
  assert.equal(binding.label,robloxWhiteCharacters[index]);
  assert.equal(midiToName(binding.midi),whiteNames[index%7]+(2+Math.floor(index/7)));
  all.push(binding.midi);
  if(binding.shiftedMidi!==undefined){
   assert.ok(!['E','B'].includes(whiteNames[index%7]));
   assert.equal(binding.shiftedMidi,binding.midi+1);all.push(binding.shiftedMidi);
  }else assert.ok(['E','B'].includes(whiteNames[index%7])||binding.midi===96);
 });
 assert.deepEqual(all.sort((a,b)=>a-b),Array.from({length:61},(_,i)=>i+36));
 const guide=interstellarKeyGuide(map,0,1,true);
 for(const [midi,label] of [[36,'1'],[37,'!'],[39,'@'],[42,'$'],[44,'%'],[46,'^'],[49,'*'],[51,'('],[60,'t'],[61,'T'],[63,'Y'],[72,'s'],[73,'S'],[88,'x'],[96,'m']])assert.equal(guide[midi][0].label,label);
 for(const binding of map.bindings){assert.equal(guide[binding.midi][0].label,binding.label);if(binding.shiftedMidi)assert.equal(guide[binding.shiftedMidi][0].label,robloxShiftCharacter(binding.label));}
});

class Target {
 listeners=new Map();
 addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}
 removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)??[]).filter(x=>x!==fn));}
 dispatch(name,event={}){for(const fn of this.listeners.get(name)??[])fn(event);}
}
function inputSetup(){
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 const notes=new LiveNotes(),attacks=[],releases=[];let snapshot,pedal=false;
 const input=new KeyboardInputManager(map,{noteOn:(midi,code,at)=>{attacks.push(midi);notes.on(code,midi,at);},noteOff:(midi,code,at)=>{releases.push(midi);notes.off(code,at,pedal);},change:value=>{snapshot=value;}});
 const pedalInput=new PedalInput(()=>{pedal=!pedal;if(!pedal)notes.pedalUp(performance.now());});
 input.setReservedCodes(['Space','Escape','F7','F8','F9','ArrowLeft','ArrowRight','Backquote']);input.setEnabled(true);
 const key=(type,code,shiftKey=false,repeat=false)=>{const event={code,shiftKey,repeat,target:null,preventDefault(){}};window.dispatch(type,event);if(type==='keydown')pedalInput.keydown(event);else pedalInput.keyup(event);};
 return {input,notes,attacks,releases,key,snapshot:()=>snapshot};
}

test('actual input manager plays every white/black mapping, captures shifted releases, chords and fast repeats',()=>{
 const state=inputSetup();
 try {
  for(const binding of map.bindings)for(const shift of [false,true]){
   state.key('keydown',binding.code,shift);
   assert.equal(state.snapshot().pressed[0].midi,shift?(binding.shiftedMidi??binding.midi):binding.midi);
   state.key('keyup',binding.code,!shift);
   assert.equal(state.releases.at(-1),shift?(binding.shiftedMidi??binding.midi):binding.midi);
  }
  state.key('keydown','Digit1',true);state.key('keydown','KeyT');state.key('keydown','KeyS',true);
  assert.deepEqual(state.snapshot().pressed.map(item=>item.midi),[37,60,73]);
  state.key('keydown','KeyS',true,true);assert.equal(state.snapshot().pressed.length,3);
  window.dispatch('blur');assert.deepEqual(state.snapshot().pressed,[]);
  for(let i=0;i<20;i++){state.key('keydown','KeyT');state.key('keyup','KeyT');}
  assert.deepEqual(state.attacks.slice(-20),Array(20).fill(60));
 }finally{state.input.dispose();}
});

test('Space sustain keeps audio ownership but never pressed input or extending physical bars; hidden/stop releases keys',()=>{
 const state=inputSetup();
 try {
  state.key('keydown','Space');state.key('keyup','Space');
  state.key('keydown','KeyT',true);state.key('keyup','KeyT');
  assert.deepEqual(state.snapshot().pressed,[]);assert.deepEqual(state.notes.soundingPitches(),[61]);
  const at=performance.now(),note=state.notes.visible(at,4400).at(-1);
  assert.equal(physicalNoteBar(note,at,440,4400).held,false);
  assert.equal(physicalNoteBar(note,at,440,4400).height,physicalNoteBar(note,at+900,440,4400).height);
  state.key('keydown','Space');state.key('keyup','Space');assert.deepEqual(state.notes.soundingPitches(),[]);
  state.key('keydown','KeyS');document.hidden=true;document.dispatch('visibilitychange');assert.deepEqual(state.snapshot().pressed,[]);
  state.key('keydown','KeyP');state.input.setEnabled(false);assert.deepEqual(state.snapshot().pressed,[]);
 }finally{state.input.dispose();}
});

test('every assisted score event keeps its exact live and generated pitches under standard physical keys',()=>{
 let cursor=0;
 for(const bar of assisted.bars)for(const event of bar.events){
  const binding=map.bindings.find(binding=>binding.midi===event.liveMidi);
  assert.ok(binding);
  const scoreCode=interstellarAssistedCode(binding.code,event.liveMidi,cursor);
  const planned=planInterstellarPress(2,scoreCode,event.liveMidi,cursor,defaultInterstellarMix);
  assert.deepEqual(planned.voices.map(voice=>voice.midi),[event.liveMidi,...event.assistedMidi]);
  cursor=planned.nextCursor;
 }
 assert.equal(cursor,0);
 const unchanged={roses:JSON.stringify(rosesMap),levels:JSON.stringify(levelsMap('main'))};
 interstellarKeyGuide(map,0,3,true);interstellarAssistedCode('KeyP',69,0);
 assert.equal(JSON.stringify(rosesMap),unchanged.roses);assert.equal(JSON.stringify(levelsMap('main')),unchanged.levels);
 assert.equal(interstellarThemeShortcut('KeyT'),'Backquote');assert.equal(interstellarThemeShortcut('Backquote'),'Backquote');
});

test('all 61 actual key labels fit 1080p/1440p geometry, and unused upper keys stay available without prominent guides',()=>{
 for(const [width,height] of [[1366,768],[1920,1080],[2560,1440]]){
  const geometry=interstellarPianoGeometry(width,0,36,96),h=height*.3;
  const guide=interstellarKeyGuide(map,0,3,true),prominent=interstellarProminentPitches(3,true);
  const text=[];const ctx=new Proxy({fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),fillText(label,x,y,maxWidth){text.push({label,x,y,maxWidth,color:this.fillStyle});}},{get(target,key){return key in target?target[key]:()=>{};}});
  drawInterstellarPiano(ctx,width,h,geometry,guide,new Set([61]),new Set(['KeyT']),new Map(),undefined,1,prominent,[{code:'KeyT',midi:61}]);
  assert.equal(text.length,62,'61 direct labels plus the optional doubled F guide');
  for(const [midi,labels] of Object.entries(guide))for(const entry of labels){
   const key=geometry.keys.get(+midi),label=text.find(text=>text.label===entry.label);
   assert.ok(key);assert.ok(Math.abs(label.x-(key.x+key.width/2))<.001);
   assert.ok(label.maxWidth>10);assert.ok(label.y>0&&label.y<h);
   if(key.black)assert.ok(label.y<h*.63);else assert.ok(label.y>h*.63);
  }
  assert.equal(text.find(label=>label.label==='T').color,'#09273a');
  assert.notEqual(text.find(label=>label.label==='t').color,'#09273a');
  assert.equal(prominent.has(88),true);assert.equal(prominent.has(96),false);
  assert.ok(guide[96]&&geometry.keys.has(96),'unused upper note retains real mapping and visible key');
 }
});
