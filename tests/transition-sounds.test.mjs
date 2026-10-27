import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/opening/transitionSounds';export {openingCues,OpeningSequence} from './src/opening/sequence';export {state} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'sound-runtime',setup(b){
 b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
 export const state={sources:[],buffers:[],gains:[],fail:false};export const immediate=()=>10.2,now=()=>10.4;
 export class Gain {gain={rampTo:(...args)=>this.ramp=args};constructor(){state.gains.push(this);}toDestination(){return this;}dispose(){this.disposed=true;}}
 export class ToneAudioBuffer {constructor(){state.buffers.push(this);}loaded=false;async load(url){if(state.fail)throw Error('asset failure');this.url=url;this.duration=url.includes('keyboard-tap')?.065:url.includes('logo-form')?1.15:url.includes('logo-fracture')?1.4:url.includes('piano-reveal')?.7:url.includes('levels-warp')?5:3.6;this.loaded=true;}dispose(){this.disposed=true;}}
 export class ToneBufferSource {constructor(options){this.options=options;state.sources.push(this);}connect(){return this;}start(...args){this.startArgs=args;}stop(time){this.stoppedAt=time;}dispose(){this.disposed=true;}end(){this.options.onended();}}
 `,loader:'js'}));
}}]});
const {TransitionSounds,transitionSoundSettings,transitionSoundFiles,isMessageTap,OpeningSequence,openingCues,state}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const snapshot=(patch={})=>({scene:'MESSAGE_COMPLETE',run:1,timelineOrigin:1000,message:'I LOVE CSA',animationOffset:0,...patch});

test('assembly, fracture and piano sweep schedule from the visual origin on the immediate audio clock, once per run',async()=>{
 state.sources.length=0;const sound=new TransitionSounds();await sound.load();sound.setVolume(.72);
 try{
  sound.syncOpening(snapshot(),1000);assert.equal(state.sources.length,3);
  const times=[openingCues.formation,openingCues.fracture,openingCues.reveal];
  for(let i=0;i<3;i++){
   const source=state.sources[i];assert.equal(source.startArgs[0],10.2+times[i]/1000);
   assert.equal(source.startArgs[1],0);assert.ok(Math.abs(source.startArgs[2]+source.options.fadeOut-source.options.url.duration)<1e-10);
  }
  sound.syncOpening(snapshot({scene:'LOGO_HOLD'}),2700);assert.equal(state.sources.length,3);
  assert.equal(state.gains.at(-1).ramp[0],.72*transitionSoundSettings.level);
  sound.syncOpening(snapshot({scene:'TYPING_PIANO_REVEAL'}),5150);assert.ok(state.sources.every(s=>s.stoppedAt===10.2));
 }finally{sound.dispose();}
});

test('logo-only and late commits skip finished clips and seek active ones instead of replaying old attacks',async()=>{
 state.sources.length=0;const sound=new TransitionSounds();await sound.load();
 try{
  sound.syncOpening(snapshot({scene:'LOGO_HOLD'}),1000+openingCues.hold);assert.equal(state.sources.length,2);
  assert.equal(state.sources[0].startArgs[0],10.2+(openingCues.fracture-openingCues.hold)/1000);
  sound.stop();const before=state.sources.length;sound.syncOpening(snapshot({run:2,scene:'LOGO_FRACTURE'}),1000+openingCues.fracture+350);
  assert.equal(state.sources.length,before+2);assert.ok(Math.abs(state.sources[before].startArgs[1]-.35)<1e-10);
  assert.equal(state.sources[before].startArgs[0],10.2);
 }finally{sound.dispose();}
});

test('both song transitions are finite one-shots; cancellation, replay and disposal stop every old source',async()=>{
 state.sources.length=0;const sound=new TransitionSounds();await sound.load();
 for(let run=0;run<12;run++){
  const origin=1000+run*10000;sound.transition('levels',origin,origin);sound.transition('levels',origin,origin+200);
  assert.ok(sound.sources.size<=transitionSoundSettings.maxSources);
  sound.transition('roses',origin+5000,origin+5000);sound.stop();assert.equal(sound.sources.size,0);
 }
 assert.equal(state.sources.length,24);assert.ok(state.sources.every(s=>s.stoppedAt===10.2));assert.ok(sound.retiring.size<=transitionSoundSettings.maxSources);sound.dispose();assert.ok(state.sources.every(s=>s.disposed));
 assert.ok(state.buffers.slice(-6).every(b=>b.disposed));assert.equal(state.gains.at(-1).disposed,true);
 const before=state.sources.length;sound.transition('levels',999999,999999);assert.equal(state.sources.length,before);
});

test('unavailable effects cannot schedule sound, block the scene, or resurrect after disposal',async()=>{
 const sound=new TransitionSounds(),before=state.sources.length;sound.syncOpening(snapshot(),1000);assert.equal(state.sources.length,before);
 state.fail=true;try{await assert.rejects(sound.load());sound.syncOpening(snapshot(),1000);assert.equal(state.sources.length,before);}finally{state.fail=false;sound.dispose();}
});

test('local one-shots are short mono PCM files with bounded peaks and quiet boundaries',()=>{
 const lengths={form:1.15,fracture:1.4,reveal:.7,levels:5,roses:3.6,tap:.065};let totalBytes=0;
 for(const [name,url] of Object.entries(transitionSoundFiles)){
  const bytes=readFileSync('public'+url);totalBytes+=bytes.length;assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),32000);
  assert.ok(Math.abs(bytes.readUInt32LE(40)/2/32000-lengths[name])<1/32000);
  let peak=0,square=0;for(let i=44;i<bytes.length;i+=2){const sample=bytes.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(sample));square+=sample*sample;}
  assert.ok(peak>.03&&peak<=.73);assert.ok(square>0);assert.equal(bytes.readInt16LE(44),0);assert.equal(bytes.readInt16LE(bytes.length-2),0);
 }
 assert.ok(totalBytes<800000,'all sound files add less than 0.8MB on disk and decode once');
});

test('physical message typing taps once per character including spaces, Backspace and final A, but never on repeats or other scenes',async()=>{
 state.sources.length=0;const sound=new TransitionSounds();await sound.load();
 const sequence=new OpeningSequence({now:()=>1000,request:()=>1,cancel(){},setTimer:()=>1,clearTimer(){}});
 sequence.subscribe(s=>sound.syncOpening(s,1000));sequence.start('message');
 const event=(key,patch={})=>({key,code:key==='Backspace'?'Backspace':key===' '?'Space':`Key${key.toUpperCase()}`,repeat:false,isComposing:false,ctrlKey:false,metaKey:false,altKey:false,...patch});
 const send=e=>{const tap=isMessageTap(sequence.getSnapshot(),e),handled=sequence.keyDown(e);if(handled&&tap)sound.tap();sequence.keyUp(e);};
 try{
  send(event('x'));send(event('x',{repeat:true}));send(event('Backspace'));send(event('Shift',{code:'ShiftLeft'}));send(event('a',{ctrlKey:true}));
  for(const key of 'I LOVE CSA')send(event(key));
  const taps=state.sources.filter(s=>s.options.url.url.endsWith('keyboard-tap.wav'));
  assert.equal(taps.length,12);assert.equal(sequence.getSnapshot().scene,'MESSAGE_COMPLETE');
  assert.equal(taps.at(-1).startArgs[0],10.2);assert.ok(Math.abs(taps.at(-1).startArgs[2]-.062)<1e-10);
  assert.equal(taps.at(-1).startArgs[3],transitionSoundSettings.tapLevel);
  send(event('a'));assert.equal(state.sources.filter(s=>s.options.url.url.endsWith('keyboard-tap.wav')).length,12);
  assert.equal(isMessageTap(snapshot({scene:'TYPING_TEST'}),event('a')),false);assert.equal(isMessageTap(snapshot({scene:'TYPING_PIANO_REVEAL'}),event('a')),false);
  sound.stop();for(let i=0;i<100;i++)sound.tap();assert.ok(sound.sources.size<=transitionSoundSettings.maxSources);
 }finally{sequence.dispose();sound.dispose();}
});
