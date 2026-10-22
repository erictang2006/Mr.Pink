// Optional local QA; no app dependency changes. Reuse node-web-audio-api installed outside this project:
// NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js VOX_SOUND=lead node scripts/render-buildup-audition.mjs
// Run again with VOX_SOUND=vox. Exercises the actual Start Bar 25 engine entry point.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const mode=process.env.VOX_SOUND ?? process.env.MELODY_SOURCE;
assert.ok(['vox','lead'].includes(mode),'Set VOX_SOUND to vox or lead');
const startBar=Number(process.env.QA_START_BAR??25);assert.ok([1,25,29,33,36,37].includes(startBar));
const buildupTime=.05+(29-startBar)*2.4,dropTime=.05+(37-startBar)*2.4;
const leadSound=process.env.DROP_LEAD_SOUND==='loud-stabs'?'loud-stabs':'original';
const backingMode=process.env.BACKING_MODE??'roses';assert.ok(['roses','hwm-build','hwm-drop','hybrid'].includes(backingMode));
const modulePath=process.env.NODE_AUDIO_MODULE;
assert.ok(modulePath,'Set NODE_AUDIO_MODULE to the optional external node-web-audio-api/index.js');
const native=await import(pathToFileURL(modulePath).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
// The offline render has no visual frames. Tone.Draw never schedules audio.
globalThis.requestAnimationFrame=()=>0;
globalThis.cancelAnimationFrame=()=>{};
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')
 ?new Response(await readFile(path.join(process.cwd(),'public',url))):realFetch(url,options);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};
export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;
export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;
export const isSupported=async()=>true;`;
// Tone's deprecated singleton Transport/Draw exports are captured at import time.
// In Node that is before the offline context exists. Route only these exports
// to the current context's real Tone objects; scheduling and nodes stay unchanged.
const transportShim=`export * from 'qa-tone-runtime';import {getContext} from 'qa-tone-runtime';
const current=key=>new Proxy({}, {get(_,name){const target=getContext()[key],value=target[name];return typeof value==='function'?value.bind(target):value;},set(_,name,value){getContext()[key][name]=value;return true;}});
export const Transport=current('transport'),Draw=current('draw');`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {RosesBassEngine} from './src/piano/rosesBassEngine';export {RosesIntroEngine} from './src/piano/rosesIntroEngine';export {HereWithMeLeadEngine} from './src/piano/hereWithMeLeadEngine';export {defaultBuildupSettings} from './src/piano/rosesBuildup';export {defaultRosesDropSettings} from './src/piano/rosesDropSettings';export {defaultCloserSettings} from './src/piano/rosesCloser';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'native-offline',setup(b){
  b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'transport'}));
  b.onResolve({filter:/^qa-tone-runtime$/},()=>({path:fileURLToPath(import.meta.resolve('tone'))}));
  b.onLoad({filter:/.*/,namespace:'transport'},()=>({contents:transportShim}));
  b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));
  b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));
  b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));
 }}]});
const runtime=path.join(tmpdir(),`mr-pink-buildup-qa-${mode}-${process.pid}.mjs`);
await writeFile(runtime,bundle.outputFiles[0].text);
const {Tone,RosesBassEngine,RosesIntroEngine,HereWithMeLeadEngine,defaultBuildupSettings,defaultCloserSettings,defaultRosesDropSettings}=await import(pathToFileURL(runtime).href);
const rate=44100,seconds=Math.max(56,(45-startBar)*2.4+8);
const context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*seconds,rate));Tone.setContext(context);
const audioNodeCreations={oscillators:0,filters:0,waveshapers:0,bufferSources:0};
for(const [method,key] of [['createOscillator','oscillators'],['createBiquadFilter','filters'],['createWaveShaper','waveshapers'],['createBufferSource','bufferSources']]){const original=context[method].bind(context);context[method]=(...args)=>{audioNodeCreations[key]++;return original(...args);};}
const attacks=[],samples=[],bufferUrls=new WeakMap();
const bufferLoad=Tone.ToneAudioBuffer.prototype.load;
Tone.ToneAudioBuffer.prototype.load=async function(url){const result=await bufferLoad.call(this,url);bufferUrls.set(this.get(),url);return result;};
const sampleStart=Tone.ToneBufferSource.prototype.start;
Tone.ToneBufferSource.prototype.start=function(time,offset=0,...rest){
 const url=bufferUrls.get(this.buffer.get());if(url)samples.push({url,time,offset,playbackRate:this.playbackRate.value});return sampleStart.call(this,time,offset,...rest);
};
const bassAttacks=[];const bassTrigger=RosesBassEngine.prototype.triggerExact;
RosesBassEngine.prototype.triggerExact=function(notes,time,spb){bassAttacks.push(...notes.map(note=>({...note,time})));return bassTrigger.call(this,notes,time,spb);};
let region;
const trigger=Tone.PolySynth.prototype.triggerAttackRelease;
Tone.PolySynth.prototype.triggerAttackRelease=function(note,duration,time,velocity){
 if(region!==undefined)attacks.push({region,note,duration,time,velocity});
 return trigger.call(this,note,duration,time,velocity);
};
const leadTick=HereWithMeLeadEngine.prototype.tick;
HereWithMeLeadEngine.prototype.tick=function(...args){
 region=this.startBeat;
 try{return leadTick.apply(this,args);}finally{region=undefined;}
};
const melodyTrigger=HereWithMeLeadEngine.prototype.triggerMelodyNote;
HereWithMeLeadEngine.prototype.triggerMelodyNote=function(...args){
 region=112;
 try{return melodyTrigger.apply(this,args);}finally{region=undefined;}
};
// These synth methods concern the optional manual backing from bars 5–20,
// outside this audition. All bar-25 onward bass/samples/lead nodes are real Tone.
const engine=new RosesIntroEngine({isPlayable:()=>true,stopLoop(){},triggerLoopNote(){}},()=>{},()=>0);
await engine.load();await Tone.loaded();
engine.setDropLeadSettings({...defaultRosesDropSettings,brightness:Number(process.env.DROP_LEAD_BRIGHTNESS??2800)});engine.setDropLeadSound(leadSound);
engine.setBuildupSettings({...defaultBuildupSettings,voxMode:mode==='lead'?'lead':'original'});engine.setBackingMode(backingMode);
if(process.env.QA_MAX_BACKING==='1')engine.setPreDropRiser({volume:1,intensity:1});
if(process.env.QA_MAX_BACKING==='1'){
 engine.setMaster(1);engine.setBackingMix({gain:1.5});for(const group of ['chords','bass','drums','fx'])engine.setBackingMix({group,level:1.5});
 engine.setCloserSettings({...defaultCloserSettings,closerLevel:1.5});
}
// Full bar-1 playback must arm the selected 29–36 backing itself.
if(startBar===1)engine.armBuild();
assert.equal(await (startBar===1?engine.startWithDrop(1,'timed'):startBar===25?engine.rehearseFrom25('timed'):startBar===29?engine.rehearseFrom29('timed'):startBar===37?engine.playDrop():engine.rehearseBuildup(startBar,'timed')),true);
await context.workletsAreReady();
console.log('Rendering Start Bar',startBar,backingMode,mode);
const rendered=await context.render();const audio=rendered.get();
const replacement=attacks.filter(e=>e.region===112),drop=attacks.filter(e=>e.region===144);
assert.equal(replacement.length,mode==='lead'&&backingMode==='roses'?120:0);assert.equal(drop.length,leadSound==='original'?224:0);
const dropHits=leadSound==='original'?drop:samples.filter(s=>s.url.endsWith('/loud-stabs-recorded-fm7.wav'));assert.equal(dropHits.length,224);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
near(dropHits[0].time,dropTime);
assert.equal(dropHits.filter(e=>Math.abs(e.time-dropTime)<1e-7).length,4);
if(mode==='lead'&&backingMode==='roses') {
 near(replacement[0].time,buildupTime+.3);
 const phrase=JSON.parse(await readFile('src/piano/voxMelody.json','utf8')).notes;
 const expected=[...phrase,...phrase.filter(n=>n.beat<12).map(n=>({...n,beat:n.beat+16}))];
 const name=midi=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+(Math.floor(midi/12)-1);
 expected.forEach((note,i)=>replacement.slice(i*4,i*4+4).forEach(event=>{
  near(event.time,buildupTime+note.beat*.6);near(event.duration,note.duration*.6);assert.equal(event.note,name(note.midi));
 }));
 assert.ok(replacement.every(e=>e.time<buildupTime+16.8),'bar 36 keeps its original break');
}
const prepared=samples.filter(s=>s.url.includes('/hwm-backing/')&&s.time<dropTime-1e-7);
assert.equal(prepared.length,backingMode==='roses'||backingMode==='hybrid'||startBar===37?0:4);
if(backingMode!=='roses'&&backingMode!=='hybrid'&&startBar!==37){
 assert.equal(samples.filter(s=>s.url.includes('/roses/buildup/')).length,0);
 prepared.forEach(s=>{near(s.time,buildupTime);near(s.offset,0);});
}
const vocal=samples.filter(s=>s.url.includes('here_with_me_chorus_e_major'));
assert.equal(vocal.length,startBar===37?0:1);
if(startBar!==37){
 if(startBar<29)near(vocal[0].time,.05+(25-startBar)*2.4+4.98);
 else assert.ok(vocal[0].time>=.05-1e-7&&vocal[0].time<=.05+128/rate,'native Tone.Player may clamp the first callback to its current render quantum');
 near(vocal[0].offset,startBar>=29?4.62+(startBar-29)*2.4:0);
}
const hybridTracks=samples.filter(s=>s.url.startsWith('/roses/hybrid/')&&!s.url.includes('riser-'));
const risers=samples.filter(s=>s.url.startsWith('/roses/hybrid/riser-'));
if(backingMode==='hybrid'&&startBar<37){
 assert.equal(hybridTracks.length,3);assert.equal(risers.length,2);
 hybridTracks.forEach(s=>{near(s.time,.05+Math.max(0,29-startBar)*2.4);near(s.offset,Math.max(0,startBar-29)*2.4);near(s.playbackRate,1);});
 risers.forEach(s=>{near(s.time,.05+(36-startBar)*2.4);near(s.offset,0);near(s.playbackRate,1);});
 assert.equal(samples.some(s=>s.url.includes('/roses/buildup/')||s.url.includes('chop loop')),false,'only the prepared original percussion is borrowed');
 assert.equal(prepared.length,0,'no HWM drum/FX or conflicting source stems');
}else{assert.equal(hybridTracks.length,0);assert.equal(risers.length,0);}
const chordTracks=samples.filter(s=>s.url.endsWith('/drop-instrumental-chords.wav')&&s.time>=dropTime-1e-7);assert.equal(chordTracks.length,1);chordTracks.forEach(s=>{near(s.time,dropTime);near(s.offset,0);});
const dropDrums={};for(const [name,url,count] of [['kick','Roses Kick.wav',24],['clap','Roses SnareClap.wav',16],['hat','HiHat Closed 004 Crunk.wav',38]]){const hits=samples.filter(s=>s.url.endsWith(url));assert.equal(hits.length,count);assert.ok(hits.every(s=>s.time>=dropTime));dropDrums[name]=hits.length;}
assert.equal(bassAttacks.length,0,'original Roses drop bass must never be scheduled');
const bassTracks=samples.filter(s=>s.url.endsWith('/drop-bass.wav')&&s.time>=dropTime-1e-7);assert.equal(bassTracks.length,1);near(bassTracks[0].time,dropTime);
const backingTracks=[...chordTracks,...bassTracks];assert.ok(backingTracks.every(s=>s.playbackRate===1));
assert.equal(samples.some(s=>s.url.includes('/chord-cache/')||s.url.includes('loud-stabs-recorded-fm7')),false);
const leadSource=JSON.parse(await readFile('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json','utf8')).events.filter(e=>e.repeat_index<2);
leadSource.forEach((event,i)=>{const midi=event.midi_pitch+1;assert.equal(drop[i].note,['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+(Math.floor(midi/12)-1));near(drop[i].time,dropTime+event.start_seconds_relative_to_rose_bar37);near(drop[i].duration,event.duration_seconds);});
assert.ok(vocal.every(s=>s.playbackRate===1),'vocal timing cannot be repitched at runtime');
assert.equal(engine.snapshot().status,'finished');assert.equal(engine.snapshot().drop.status,'done');
let peak=0,power=0,finite=true;
// The native implementation copies channel data. Read it once per channel.
const channels=[audio.getChannelData(0),audio.getChannelData(1)];
const wave=Buffer.alloc(44+audio.length*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++) {
 const sample=channels[c][i];finite&&=Number.isFinite(sample);peak=Math.max(peak,Math.abs(sample));power+=sample*sample;
 wave.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sample*32767))),44+(i*2+c)*2);
}
assert.ok(finite&&peak>0&&peak<1,'audio must be finite, audible and unclipped');
const report={hybridTracks:hybridTracks.length,riserTracks:risers.length,renderer:'Actual section start through Tone.js on a native OfflineAudioContext; not a browser or hardware listening test',startBar,mode,backingMode,leadSound,key:'E major / C♯ minor',transposeSemitones:1,dropBassEvents:bassAttacks.length,dropBassTracks:bassTracks.length,dropChordTracks:chordTracks.length,dropDrums,maximumControls:process.env.QA_MAX_BACKING==='1',audioNodeCreations,samples,seconds,prerollSeconds:.05,voxSynthEvents:replacement.length,voxMelodyRetained:true,dropEvents:dropHits.length,bar37Attacks:4,finite,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(power/(audio.length*2)),attacks};
const out=path.resolve(process.env.BACKING_QA_OUTPUT??'docs/roses-reference/vox-instrument-audition');const prefix=(startBar!==25?`bar${startBar}-`:'')+(process.env.BACKING_QA_OUTPUT?`${backingMode}-${mode}`:mode)+(leadSound==='loud-stabs'?'-loud-stabs':'')+(process.env.QA_MAX_BACKING==='1'?'-maximum':'');await mkdir(out,{recursive:true});
await writeFile(path.join(out,`${prefix}-verification.json`),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(out,`${prefix}-preview.wav`),wave);
console.log(JSON.stringify({...report,attacks:undefined,samples:undefined}));
engine.dispose();await context.dispose();
