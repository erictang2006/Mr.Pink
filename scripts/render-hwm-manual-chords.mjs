// Optional local QA, using the native offline audio dependency outside the app.
// NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js HWM_CHORD_SOUND=lead node scripts/render-hwm-manual-chords.mjs
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const sound=process.env.HWM_CHORD_SOUND;
assert.ok(['keys678','keys123','lead'].includes(sound));
const modulePath=process.env.NODE_AUDIO_MODULE;assert.ok(modulePath);
const native=await import(pathToFileURL(modulePath).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')?new Response(await readFile(path.join('public',url))):originalFetch(url,options);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};
export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;
export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;
export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {RosesChordStabEngine} from './src/piano/rosesChordStabEngine';export {hereWithMeChords} from './src/piano/hereWithMeChords';export {defaultRosesDropSettings} from './src/piano/rosesDropSettings';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){
 b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'native',namespace:'native'}));
 b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));
 b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));
}}]});
const runtime=path.join(tmpdir(),`mr-pink-manual-chords-${process.pid}.mjs`);await writeFile(runtime,bundle.outputFiles[0].text);
const {Tone,RosesChordStabEngine,hereWithMeChords,defaultRosesDropSettings}=await import(pathToFileURL(runtime).href);
const rate=44100,seconds=10;
const context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*seconds,rate));Tone.setContext(context);
const engine=new RosesChordStabEngine();await engine.load();engine.setSettings(defaultRosesDropSettings);engine.setHereWithMeSound(sound);
const attacks=[],releases=[];
// Only the QA harness schedules key presses. The manual engine never starts a transport.
for(const [index,chord] of hereWithMeChords.entries()){
 const at=.1+index*2;
 context.transport.schedule(time=>{
  for(const midi of chord.notes){const source=`roses-chord:${chord.code}:${midi}`;assert.equal(engine.noteOn(source,midi,chord.code,time),true);attacks.push({code:chord.code,midi,time});}
 },at);
 context.transport.schedule(time=>{for(const midi of chord.notes){engine.noteOff(`roses-chord:${chord.code}:${midi}`);releases.push({midi,time});}},at+.8);
}
context.transport.start(0);await context.workletsAreReady();
const rendered=(await context.render()).get();
assert.equal(attacks.length,18);assert.equal(releases.length,18);assert.equal(engine.held.size,0);assert.equal(engine.manualSources.size,0);
const channels=[rendered.getChannelData(0),rendered.getChannelData(1)];
let peak=0,energy=0;const wave=Buffer.alloc(44+rendered.length*4);
wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++){
 const sample=channels[c][i];assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;
 wave.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(sample*32767))),44+(i*2+c)*2);
}
assert.ok(peak>0&&peak<1,'manual chord audio must be audible and unclipped');
const report={renderer:'Actual live chord engine through real Tone.js and native OfflineAudioContext; not browser/device listening',sound,seconds,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(energy/(rendered.length*2)),heldAfterRelease:engine.held.size,attacks,releases};
const out='docs/roses-reference/hwm-manual-chords';await mkdir(out,{recursive:true});
await writeFile(path.join(out,`${sound}-preview.wav`),wave);await writeFile(path.join(out,`${sound}-verification.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,attacks:attacks.length,releases:releases.length}));engine.dispose();await context.dispose();
