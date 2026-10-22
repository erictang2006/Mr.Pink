// Generation-only native offline render. NODE_AUDIO_MODULE points to the external QA dependency.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const instrumental=process.env.HWM_INSTRUMENTAL==='1';
const mode=process.env.HWM_REGION;assert.ok(['build','drop'].includes(mode));
const modulePath=process.env.NODE_AUDIO_MODULE;assert.ok(modulePath);
const native=await import(pathToFileURL(modulePath).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async url=>typeof url==='string'&&url.startsWith('/hwm-source/')?new Response(await readFile(path.join('reference/here-with-me-remake/normalized-samples',url.slice('/hwm-source/'.length)))):fetchOriginal(url);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {HwmBackingRenderEngine,hwmRenderGroups} from './src/piano/hwmBackingRenderEngine';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));}}]});
const {Tone,HwmBackingRenderEngine,hwmRenderGroups}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rate=44100,context=new Tone.OfflineContext(new native.OfflineAudioContext(8,rate*20,rate));Tone.setContext(context);
const merge=new Tone.Merge(8),splits=[];
merge.connect(context.rawContext.destination);
const engine=new HwmBackingRenderEngine(mode,!instrumental);await engine.load();
hwmRenderGroups.forEach((group,index)=>{
 engine.buses[group].channelCount=2;engine.buses[group].channelCountMode='explicit';
 const split=new Tone.Split(2);engine.buses[group].connect(split);split.connect(merge,0,index*2);split.connect(merge,1,index*2+1);splits.push(split);
});
let step=0;context.transport.bpm.value=100;context.transport.scheduleRepeat(time=>engine.tick(step++*24,time),'16n');context.transport.start(.1);
await context.workletsAreReady();console.log('Rendering actual source arrangement',mode);
const started=performance.now(),audio=(await context.render()).get();
const channels=Array.from({length:8},(_,i)=>audio.getChannelData(i));
const first=Math.round(.1*rate),frames=Math.round(19.35*rate);
let peak=0,energy=Array(4).fill(0);
for(let i=0;i<Math.round(19.2*rate);i++)for(let c=0;c<2;c++){
 let sum=0;for(let group=0;group<4;group++) {const x=channels[group*2+c][first+i];assert.ok(Number.isFinite(x));sum+=x;energy[group]+=x*x;}peak=Math.max(peak,Math.abs(sum));
}
assert.ok(energy.every(x=>x>0),'all four backing submixes must contain real audio');
// Preserve existing mix gain and percussion bytes while changing only pitched material.
const previous=JSON.parse(await readFile(`reference/here-with-me-remake/analysis/${mode}-render.json`,'utf8'));
const gain=previous.normalizationGain;
const out='public/roses/hwm-backing';await mkdir(out,{recursive:true});
const files=[];
for(const [g,group] of hwmRenderGroups.entries()){
 if(instrumental && group!=='chords')continue;
 const wave=Buffer.alloc(44+frames*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
 let stemPeak=0;
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++){
  const fade=Math.min(1,Math.max(0,(frames-1-i-Math.round(.01*rate))/Math.round(.05*rate)));
  const x=channels[g*2+c][first+i]*gain*fade;assert.ok(Number.isFinite(x));stemPeak=Math.max(stemPeak,Math.abs(x));assert.ok(stemPeak<1);
  wave.writeInt16LE(Math.round(x*32767),44+(i*2+c)*2);
 }
 const file=`${mode}-${instrumental?'instrumental-':''}${group}.wav`;
 if(group==='chords'||group==='bass')await writeFile(path.join(out,file),wave);
 else { const kept=previous.files.find(f=>f.group===group); files.push({...kept,preservedUnpitched:true}); continue; }
 files.push({group,file,seconds:frames/rate,sha256:createHash('sha256').update(wave).digest('hex'),peak:stemPeak,rmsDb:10*Math.log10(energy[g]/(19.2*rate*2)*gain*gain)});
}
const source=JSON.parse(await readFile('reference/here-with-me-remake/backing-events-e-major.json','utf8'));
const expected=source.selections[mode].notes.length+source.selections[mode].audio.length;assert.equal(engine.scheduled.length,expected);
const sourceHashes={};for(const file of ['reference/here-with-me-remake/extracted/Remake.flp','reference/here-with-me-remake/backing-source-events.json','reference/here-with-me-remake/backing-events-e-major.json','reference/here-with-me-drop-lead/lead-events-e-major.json','scripts/prepare-hwm-e-major.mjs','scripts/analyze-hwm-remake.py','scripts/normalize-hwm-samples.mjs','scripts/prepare-hwm-sample-fx.py','scripts/render-hwm-backing.mjs','src/piano/hwmBackingRenderEngine.ts','src/piano/dropChordAmbience.ts','src/piano/hereWithMeLeadEngine.ts','src/piano/hereWithMeLead.ts','reference/here-with-me-remake/analysis/normalized-samples.json','reference/here-with-me-remake/analysis/sample-fx-preparation.json','package-lock.json'])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const report={mode,renderer:'Real Tone.js synth approximations and decoded supplied samples, native 8-channel OfflineAudioContext. No proprietary plugin emulation claim.',sourceBars:source.selections[mode].sourceBars,targetBars:instrumental?[37,44]:[29,36],key:'E major / C♯ minor',transposeSemitones:1,includeLead:!instrumental,bpm:100,ppq:96,normalizationGain:gain,rawMixPeak:peak,renderWallSeconds:(performance.now()-started)/1000,files,sourceHashes,scheduled:engine.scheduled};
await writeFile(`reference/here-with-me-remake/analysis/${mode}${instrumental?'-instrumental':''}-render.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,scheduled:report.scheduled.length,sourceHashes:undefined}));
engine.dispose();for(const node of [...splits,merge])node.dispose();await context.dispose();
