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
const startBar=Number(process.env.QA_START_BAR??25);assert.ok([1,25,29,33,36,37,39,41].includes(startBar));
const buildupTime=.05+(29-startBar)*2.4,dropTime=.05+(37-startBar)*2.4;
const leadSound=process.env.DROP_LEAD_SOUND==='loud-stabs'?'loud-stabs':'original';
const backingMode=process.env.BACKING_MODE??'roses';assert.ok(['roses','hwm-build','hwm-drop','hybrid'].includes(backingMode));
const fullyArmed=process.env.QA_FULL_ARM==='1';
const captureMelody=process.env.QA_MELODY_TAP==='1';
const captureDropLead=process.env.QA_DROP_LEAD_TAP==='1';
const captureVocals=process.env.QA_VOCAL_TAP==='1'||captureDropLead;
const dropBackingSource=process.env.QA_DROP_BACKING??'hwm';assert.ok(['roses','hwm','recording'].includes(dropBackingSource));
const recordedLeadEnabled=process.env.QA_RECORDED_LEAD==='1';
const playDropLead=dropBackingSource!=='recording'||recordedLeadEnabled;
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
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {RosesBassEngine} from './src/piano/rosesBassEngine';export {RosesIntroEngine} from './src/piano/rosesIntroEngine';export {HereWithMeLeadEngine} from './src/piano/hereWithMeLeadEngine';export {defaultBuildupSettings} from './src/piano/rosesBuildup';export {defaultRosesDropSettings} from './src/piano/rosesDropSettings';export {defaultCloserSettings} from './src/piano/rosesCloser';export {SynthEngine,presetSettings} from './src/piano/synthEngine';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,
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
const {Tone,RosesBassEngine,RosesIntroEngine,HereWithMeLeadEngine,defaultBuildupSettings,defaultCloserSettings,defaultRosesDropSettings,SynthEngine,presetSettings}=await import(pathToFileURL(runtime).href);
const rate=44100,seconds=Math.max(56,(45-startBar)*2.4+8);
const context=new Tone.OfflineContext(new native.OfflineAudioContext(captureVocals?8:captureMelody?4:2,rate*seconds,rate));Tone.setContext(context);
const audioNodeCreations={oscillators:0,filters:0,waveshapers:0,bufferSources:0};
for(const [method,key] of [['createOscillator','oscillators'],['createBiquadFilter','filters'],['createWaveShaper','waveshapers'],['createBufferSource','bufferSources']]){const original=context[method].bind(context);context[method]=(...args)=>{audioNodeCreations[key]++;return original(...args);};}
const attacks=[],samples=[],bufferUrls=new WeakMap();
const bufferLoad=Tone.ToneAudioBuffer.prototype.load;
Tone.ToneAudioBuffer.prototype.load=async function(url){const result=await bufferLoad.call(this,url);bufferUrls.set(this.get(),url);return result;};
const sampleStart=Tone.ToneBufferSource.prototype.start;
Tone.ToneBufferSource.prototype.start=function(time,offset=0,...rest){
 const url=bufferUrls.get(this.buffer.get());if(url)samples.push({url,time,offset,duration:rest[0],fadeOut:this.fadeOut,playbackRate:this.playbackRate.value});return sampleStart.call(this,time,offset,...rest);
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
// Full-arming audits use the real early synth too. Map its UI cleanup timers to
// the offline audio clock; the browser app itself is unchanged.
let earlySynth;
const earlyNotes=[],earlyStops=[],earlyBass=[];
if(fullyArmed){
 globalThis.window={setTimeout:(fn,ms)=>context.setTimeout(fn,ms/1000),clearTimeout:id=>context.clearTimeout(id)};
 earlySynth=new SynthEngine(presetSettings.roses);await earlySynth.start();earlySynth.setGlobalVolume(.72);
 const attack=earlySynth.triggerLoopNote.bind(earlySynth),stop=earlySynth.stopLoop.bind(earlySynth);
 earlySynth.triggerLoopNote=(midi,time,duration)=>{earlyNotes.push({midi,time,duration});return attack(midi,time,duration);};
 earlySynth.stopLoop=(time=Tone.immediate())=>{earlyStops.push(time);return stop(time);};
 const triggerBass=RosesBassEngine.prototype.trigger;
 RosesBassEngine.prototype.trigger=function(bass,sub,time,spb){earlyBass.push(...[...bass,...sub].map(n=>({...n,time})));return triggerBass.call(this,bass,sub,time,spb);};
}
const engine=new RosesIntroEngine(earlySynth??{isPlayable:()=>true,stopLoop(){},triggerLoopNote(){}},()=>{},()=>4);
const timingTrace=[];
const offsetEdits=[];
if(process.env.QA_TIMING_TRACE==='1'){
 const tick=engine.tick.bind(engine);
 engine.tick=time=>{
  tick(time);
  const beat=(engine.state.measure-1)*4+engine.state.beat-1;
  if(process.env.QA_EDIT_RECORDED_OFFSET_MS!==undefined&&!offsetEdits.length&&beat>=Number(process.env.QA_OFFSET_EDIT_BEAT??140)){
   engine.setRecordedDropOffset(Number(process.env.QA_EDIT_RECORDED_OFFSET_MS));
   offsetEdits.push({time,beat,requested:engine.drop.recordedOffsetMs,active:engine.drop.activeRecordedOffsetMs});
  }
  if(engine.state.measure>=29&&engine.state.measure<=44)timingTrace.push({time,bar:engine.state.measure,beat:engine.state.beat,bpm:engine.tempo(),speed:engine.speed,hereWithMePlaybackRate:engine.closer.player.playbackRate});
 };
}
await engine.load();await Tone.loaded();
engine.setDropBackingSource(dropBackingSource);
if(recordedLeadEnabled)engine.setDropRow('lead',{enabled:true});
if(process.env.QA_RECORDED_VOLUME)engine.setDropRow('recorded',{volume:Number(process.env.QA_RECORDED_VOLUME)});
const recordedOffsetMs=Number(process.env.QA_RECORDED_OFFSET_MS??0);engine.setRecordedDropOffset(recordedOffsetMs);
engine.setDropLeadSettings({...defaultRosesDropSettings,brightness:Number(process.env.DROP_LEAD_BRIGHTNESS??2800)});engine.setDropLeadSound(leadSound);
engine.setBuildupSettings({...defaultBuildupSettings,voxMode:mode==='lead'?'lead':'original'});engine.setBackingMode(backingMode);
if(process.env.QA_AUDIBLE_CLICK==='1')engine.setAudibleClick(true);
if(process.env.QA_MAX_BACKING==='1')engine.setPreDropRiser({volume:1,intensity:1});
if(process.env.QA_MAX_BACKING==='1'){
 engine.setMaster(1);engine.setBackingMix({gain:1.5});for(const group of ['chords','bass','drums','fx'])engine.setBackingMix({group,level:1.5});
 engine.setCloserSettings({...defaultCloserSettings,closerLevel:1.5});
}
// Full bar-1 playback must arm the selected 29–36 backing itself.
if(startBar===1)engine.armBuild();
// Optional audit of the actual full-song L-key vocal path; the bar-25 shortcut
// intentionally does not arm or seek this earlier Roses vocal.
const rosesVocalArmed=(process.env.QA_ROSES_VOCAL==='1'||fullyArmed)&&startBar===1;
if(fullyArmed&&startBar===1){engine.armSynth();engine.armBass();}
if(rosesVocalArmed){engine.setVocalOffset(9.6,true);assert.equal(engine.armVocal(),true);}
assert.equal(await (startBar===1?engine.startWithDrop(1,'timed'):startBar===25?engine.rehearseFrom25('timed'):startBar===29?engine.rehearseFrom29('timed'):startBar>=37?engine.playDrop(startBar):engine.rehearseBuildup(startBar,'timed')),true);
let melodySplit,melodyMerge,melodyBus;
const vocalTaps=[];
if(captureVocals){
 for(const [bus,channel] of [[engine.vocalHandoffGain??engine.vocalGain,4],[engine.closer.gain,6],...(captureDropLead?[[engine.drop.buses.get('lead'),2]]:[])]){
  const split=new Tone.Split(2),merge=new Tone.Merge(8);bus.connect(split);
  split.connect(merge,0,channel);split.connect(merge,1,channel+1);merge.connect(context.rawContext.destination);vocalTaps.push(split,merge);
 }
}
if(captureMelody){
 melodyBus=new Tone.Gain(1);melodySplit=new Tone.Split(2);melodyMerge=new Tone.Merge(4);
 if(backingMode==='roses'){
  const original=engine.buildup.original;
  original.voxOriginal.connect(melodyBus);original.voxLight.connect(melodyBus);original.alternateGain.connect(melodyBus);
 }else engine.buildup.groups.get('chords').connect(melodyBus);
 melodyBus.connect(melodySplit);melodySplit.connect(melodyMerge,0,2);melodySplit.connect(melodyMerge,1,3);melodyMerge.connect(context.rawContext.destination);
}
await context.workletsAreReady();
console.log('Rendering Start Bar',startBar,backingMode,mode);
const rendered=await context.render();const audio=rendered.get();
const replacement=attacks.filter(e=>e.region===112),drop=attacks.filter(e=>e.region===144);
assert.equal(replacement.length,mode==='lead'&&backingMode==='roses'&&startBar<37?120:0);assert.equal(drop.length,!playDropLead?0:leadSound==='original'?224:0);
const dropHits=leadSound==='original'?drop:samples.filter(s=>s.url.endsWith('/loud-stabs-recorded-fm7.wav'));assert.equal(dropHits.length,playDropLead?224:0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const originalVocal=samples.filter(s=>s.url.endsWith('/roses_vocals_original_timeline.wav'));
assert.equal(originalVocal.length,rosesVocalArmed?1:0);
originalVocal.forEach(s=>{assert.ok(s.time>=.05+9.6-1e-7&&s.time<=.05+9.6+128/rate,'native Player may clamp a first callback to its render quantum');near(s.offset,9.6);near(s.playbackRate,1);});
if(playDropLead){near(dropHits[0].time,dropTime);assert.equal(dropHits.filter(e=>Math.abs(e.time-dropTime)<1e-7).length,4);}
if(mode==='lead'&&backingMode==='roses'&&startBar<37) {
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
assert.equal(prepared.length,backingMode==='roses'||startBar>=37?0:backingMode==='hybrid'?(startBar>=35?0:1):4);
if(backingMode!=='roses'&&backingMode!=='hybrid'&&startBar<37){
 assert.equal(samples.filter(s=>s.url.includes('/roses/buildup/')).length,0);
 prepared.forEach(s=>{near(s.time,buildupTime);near(s.offset,0);});
}
const vocal=samples.filter(s=>s.url.includes('here_with_me_chorus_e_major'));
assert.equal(vocal.length,startBar>=37?0:1);
if(startBar<37){
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
 assert.equal(prepared.length,startBar>=35?0:1,'reuse HWM drums once; do not start their silent bus in bar 36');
 prepared.forEach(s=>{assert.ok(s.url.endsWith('/drop-drums.wav'));near(s.time,.05+Math.max(0,29-startBar)*2.4);near(s.offset,Math.max(0,startBar-29)*2.4);});
}else{assert.equal(hybridTracks.length,0);assert.equal(risers.length,backingMode==='roses'&&startBar<37?2:0);
 if(backingMode==='roses'&&startBar<37)risers.forEach(s=>{near(s.time,.05+(36-startBar)*2.4);near(s.offset,0);near(s.playbackRate,1);});
}
const rosesInstrumental=samples.filter(s=>s.url.endsWith('/roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav'));
assert.equal(rosesInstrumental.length,dropBackingSource==='roses'?1:0);
rosesInstrumental.forEach(s=>{near(s.time,dropTime);near(s.offset,0);near(s.duration,19.2);near(s.playbackRate,1);});
const originalRecording=samples.filter(s=>s.url.endsWith('/roses-original-recording-8bars-100bpm.wav'));
assert.equal(originalRecording.length,dropBackingSource==='recording'?1:0);
originalRecording.forEach(s=>{const target=dropTime+recordedOffsetMs/1000;near(s.time,Math.max(.05,target));near(s.offset,Math.max(0,.05-target));near(s.playbackRate,1);near(s.duration+Number(s.fadeOut),Math.min(19.2-s.offset,(45-startBar)*2.4-Math.max(0,target-.05)));});
const chordTracks=samples.filter(s=>s.url.endsWith('/drop-instrumental-chords.wav')&&s.time>=dropTime-1e-7);assert.equal(chordTracks.length,dropBackingSource==='hwm'?1:0);chordTracks.forEach(s=>{near(s.time,dropTime);near(s.offset,0);});
const dropDrums={};for(const [name,url,count] of [['kick','Roses Kick.wav',24],['clap','Roses SnareClap.wav',16],['hat','HiHat Closed 004 Crunk.wav',38]]){const hits=samples.filter(s=>s.url.endsWith(url));assert.equal(hits.length,dropBackingSource==='hwm'?count:0);assert.ok(hits.every(s=>s.time>=dropTime));dropDrums[name]=hits.length;}
assert.equal(bassAttacks.length,0,'original Roses drop bass must never be scheduled');
const bassTracks=samples.filter(s=>s.url.endsWith('/drop-bass.wav')&&s.time>=dropTime-1e-7);assert.equal(bassTracks.length,dropBackingSource==='hwm'?1:0);bassTracks.forEach(s=>near(s.time,dropTime));
const backingTracks=[...chordTracks,...bassTracks];assert.ok(backingTracks.every(s=>s.playbackRate===1));
assert.equal(samples.some(s=>s.url.includes('/chord-cache/')||s.url.includes('loud-stabs-recorded-fm7')),false);
const leadSource=JSON.parse(await readFile('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json','utf8')).events.filter(e=>e.repeat_index<2);
if(playDropLead)leadSource.forEach((event,i)=>{const midi=event.midi_pitch+1;assert.equal(drop[i].note,['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+(Math.floor(midi/12)-1));near(drop[i].time,dropTime+event.start_seconds_relative_to_rose_bar37);near(drop[i].duration,event.duration_seconds);});
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
const report={fullyArmed,captureMelody,earlyNotes,earlyStops,earlyBass,rosesVocalArmed,originalRosesVocalStreams:originalVocal.length,dropBackingSource,recordedOffsetMs,originalRecordingPitchShiftSemitones:0,originalRecordingTracks:originalRecording.length,rosesInstrumentalTracks:rosesInstrumental.length,hybridHwmDrumTracks:backingMode==='hybrid'?prepared.length:0,hybridDrumSettings:engine.snapshot().buildup.hybridDrums,hybridTracks:hybridTracks.length,riserTracks:risers.length,renderer:'Actual section start through Tone.js on a native OfflineAudioContext; not a browser or hardware listening test',startBar,mode,backingMode,leadSound,key:'E major / C♯ minor',transposeSemitones:1,dropBassEvents:bassAttacks.length,dropBassTracks:bassTracks.length,dropChordTracks:chordTracks.length,dropDrums,maximumControls:process.env.QA_MAX_BACKING==='1',audioNodeCreations,samples,seconds,prerollSeconds:.05,voxSynthEvents:replacement.length,voxMelodyRetained:true,dropEvents:dropHits.length,bar37Attacks:dropBackingSource==='recording'?0:4,finite,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(power/(audio.length*2)),attacks};
const out=path.resolve(process.env.BACKING_QA_OUTPUT??'docs/roses-reference/vox-instrument-audition');const prefix=(startBar!==25?`bar${startBar}-`:'')+(process.env.BACKING_QA_OUTPUT?`${backingMode}-${mode}`:mode)+(leadSound==='loud-stabs'?'-loud-stabs':'')+(process.env.QA_MAX_BACKING==='1'?'-maximum':'');await mkdir(out,{recursive:true});
report.recordedLeadEnabled=recordedLeadEnabled;report.bar37Attacks=playDropLead?4:0;
if(timingTrace.length)report.timingTrace=timingTrace;
if(offsetEdits.length)report.offsetEdits=offsetEdits;
await writeFile(path.join(out,`${prefix}-verification.json`),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(out,`${prefix}-preview.wav`),wave);
if(captureMelody){
 const frames=Math.round(19.2*rate),first=Math.round(buildupTime*rate),taps=[audio.getChannelData(2),audio.getChannelData(3)];
 const wav=Buffer.alloc(44+frames*8);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(3,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*8,28);wav.writeUInt16LE(8,32);wav.writeUInt16LE(32,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++)wav.writeFloatLE(taps[c][first+i]??0,44+(i*2+c)*4);
 await writeFile(path.join(out,`${prefix}-melody-tap.wav`),wav);
}
if(captureVocals){
 for(const [name,channel] of [['roses-vocal',4],['hwm-vocal',6],...(captureDropLead?[['drop-lead',2]]:[])]){
  const data=[audio.getChannelData(channel),audio.getChannelData(channel+1)],wav=Buffer.alloc(44+audio.length*8);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(3,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*8,28);wav.writeUInt16LE(8,32);wav.writeUInt16LE(32,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++)wav.writeFloatLE(data[c][i],44+(i*2+c)*4);
  await writeFile(path.join(out,`${prefix}-${name}.wav`),wav);
 }
}
console.log(JSON.stringify({...report,attacks:undefined,samples:undefined,earlyNotes:undefined,earlyStops:undefined,earlyBass:undefined}));
for(const node of vocalTaps)node.dispose();
engine.dispose();earlySynth?.dispose();melodyBus?.dispose();melodySplit?.dispose();melodyMerge?.dispose();await context.dispose();
