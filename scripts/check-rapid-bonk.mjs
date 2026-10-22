// Stress the actual manual-key engine: 64 chord strikes at 100 ms intervals, 35 ms key gates.
// Optional local QA, using the native offline audio dependency outside the app.
// NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js HWM_CHORD_SOUND=lead node scripts/render-hwm-manual-chords.mjs
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const sound='keys678';
assert.ok(['keys678','keys123','lead','harmony'].includes(sound));
const modulePath=process.env.NODE_AUDIO_MODULE;assert.ok(modulePath);
const native=await import(pathToFileURL(modulePath).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')?new Response(await readFile(path.join('public',url))):originalFetch(url,options);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};
export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;
export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;
export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {RosesChordStabEngine} from './src/piano/rosesChordStabEngine';export {hereWithMeChords} from './src/piano/hereWithMeChords';export {rosesChordShortcuts} from './src/piano/rosesChords';export {defaultRosesDropSettings} from './src/piano/rosesDropSettings';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){
 b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'native',namespace:'native'}));
 b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));
 b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));
}}]});
const runtime=path.join(tmpdir(),`mr-pink-manual-chords-${process.pid}.mjs`);await writeFile(runtime,bundle.outputFiles[0].text);
const {Tone,RosesChordStabEngine,hereWithMeChords,rosesChordShortcuts,defaultRosesDropSettings}=await import(pathToFileURL(runtime).href);
const spacing=Number(process.env.RAPID_SPACING??.1),hold=Math.min(.035,spacing*.5),strikeCount=Number(process.env.RAPID_STRIKES??64);
assert.ok(spacing>=.025&&spacing<=1&&strikeCount>=1&&strikeCount<=1000);
const rate=44100,seconds=Math.max(10,strikeCount*spacing+3);
const context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*seconds,rate));Tone.setContext(context);
const counts={oscillators:0,filters:0,bufferSources:0};
for(const [method,key] of [['createOscillator','oscillators'],['createBiquadFilter','filters'],['createBufferSource','bufferSources']]){const original=context[method].bind(context);context[method]=(...args)=>{counts[key]++;return original(...args);};}
const warnings=[];const originalWarn=console.warn;console.warn=(...args)=>{warnings.push(args.join(' '));};
const engine=new RosesChordStabEngine();await engine.load();engine.setSettings({...defaultRosesDropSettings,release:Number(process.env.RAPID_RELEASE??defaultRosesDropSettings.release),bonk:Number(process.env.RAPID_BONK??defaultRosesDropSettings.bonk)});engine.setHereWithMeSound(sound);engine.setHereWithMeHarmonyVolume(Number(process.env.MANUAL_HARMONY_VOLUME??4));
const attacks=[],releases=[];
// Only the QA harness schedules key presses. The manual engine never starts a transport.
const preparedCounts={...counts};
const sequence=process.env.RAPID_KEYS==='876'?['Digit8','Digit7','Digit6'].map(code=>({code,notes:rosesChordShortcuts[code]})):hereWithMeChords;
const hits=Array.from({length:strikeCount},(_,index)=>sequence[index%sequence.length]);
for(const [index,chord] of hits.entries()){
 const at=.1+index*spacing;
 context.transport.schedule(time=>{
  for(const midi of chord.notes){const source=`roses-chord:${chord.code}:${midi}`;assert.equal(engine.noteOn(source,midi,chord.code,time),true);attacks.push({code:chord.code,midi,time});}
 },at);
 context.transport.schedule(time=>{for(const midi of chord.notes){engine.noteOff(`roses-chord:${chord.code}:${midi}`,time);releases.push({midi,time});}},at+hold);
}
context.transport.start(0);await context.workletsAreReady();
const rendered=(await context.render()).get();
assert.equal(attacks.length,hits.reduce((sum,c)=>sum+c.notes.length,0));assert.equal(releases.length,attacks.length);assert.equal(engine.held.size,0);assert.equal(engine.manualSources.size,0);
const channels=[rendered.getChannelData(0),rendered.getChannelData(1)];
if(sound==='harmony'&&hold>1.6)for(let index=0;index<4;index++){
 const first=Math.round((.1+index*spacing+1.6)*rate),last=Math.round((.1+index*spacing+hold-.1)*rate);
 let power=0;for(let i=first;i<last;i++)for(const c of channels)power+=c[i]*c[i];
 assert.ok(power/(2*(last-first))>1e-9,'held harmony must still sound after entering its sustain loop');
}
// Every late strike must retain a live body even after cancelling prior releases.
const lateStart=.1+(strikeCount-4)*spacing,lateEnd=.1+strikeCount*spacing;
let latePower=0;for(let i=Math.round(lateStart*rate);i<Math.round(lateEnd*rate);i++)for(const c of channels)latePower+=c[i]*c[i];
const lateRmsDb=10*Math.log10(latePower/(2*(Math.round(lateEnd*rate)-Math.round(lateStart*rate))));
assert.ok(lateRmsDb>-65,'late rapid strikes must remain audible');
let peak=0,energy=0;const wave=Buffer.alloc(44+rendered.length*4);
wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++){
 const sample=channels[c][i];assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;
 wave.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sample*32767))),44+(i*2+c)*2);
}
assert.ok(peak>0&&peak<1,'manual chord audio must be audible and unclipped');
console.warn=originalWarn;
assert.equal(warnings.filter(w=>w.includes('Max polyphony')).length,0,'rapid repeats must not exhaust live Bonk voices');
const report={lateRmsDb,bonk:Number(process.env.RAPID_BONK??defaultRosesDropSettings.bonk),spacing,strikeCount,release:Number(process.env.RAPID_RELEASE??defaultRosesDropSettings.release),counts,preparedCounts,droppedNotes:warnings.filter(w=>w.includes("Max polyphony")).length,harmonyVolume:Number(process.env.MANUAL_HARMONY_VOLUME??4),renderer:'Actual live chord engine through real Tone.js and native OfflineAudioContext; not browser/device listening',sound,seconds,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(energy/(rendered.length*2)),heldAfterRelease:engine.held.size,attacks,releases};
const out=process.env.RAPID_OUTPUT??'docs/roses-reference/rapid-bonk/after';await mkdir(out,{recursive:true});
await writeFile(path.join(out,`${sound}-preview.wav`),wave);await writeFile(path.join(out,`${sound}-verification.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,attacks:attacks.length,releases:releases.length}));engine.dispose();await context.dispose();
