// Prepare untimed manual chord hits using the actual drop-render graph and samples.
// NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/render-hwm-manual-harmony.mjs
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modulePath=process.env.NODE_AUDIO_MODULE;assert.ok(modulePath);
const native=await import(pathToFileURL(modulePath).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async url=>typeof url==='string'&&url.startsWith('/hwm-source/')?new Response(await readFile('reference/here-with-me-remake/normalized-samples/'+url.slice(12))):fetchOriginal(url);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {HwmBackingRenderEngine} from './src/piano/hwmBackingRenderEngine';export {hereWithMeChords} from './src/piano/hereWithMeChords';export {midiToToneName} from './src/piano/noteMapping';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));}}]});
const {Tone,HwmBackingRenderEngine,hereWithMeChords,midiToToneName}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const source=JSON.parse(await readFile('reference/here-with-me-remake/backing-events-e-major.json','utf8'));
const gain=JSON.parse(await readFile('reference/here-with-me-remake/analysis/drop-render.json','utf8')).normalizationGain;
const rate=44100,context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*12,rate));Tone.setContext(context);
const engine=new HwmBackingRenderEngine('drop',false);await engine.load();engine.buses.chords.connect(context.rawContext.destination);
const usedSamples=new Set(),notes=[];
// Generation-only access to the existing graph avoids a second patch definition.
for(const [index,chord] of hereWithMeChords.entries()){
 const time=.1+index*3;
 for(const midi of chord.notes){
  for(const channel of [2,3])engine.voices.get(channel).triggerAttackRelease(midiToToneName(midi),2,time,100/128);
  const zone=source.channels.find(c=>c.id===14).zones.find(z=>z.present&&midi>=z.low&&midi<=z.high&&100>=z.velocityLow&&100<=z.velocityHigh);assert.ok(zone);
  usedSamples.add(zone.file+'.wav');
  engine.play(zone.file+'.wav',engine.guitarPump,time,0,2,2**((midi-zone.root)/12),100/128*.32);
  notes.push({code:chord.code,midi,channels:[2,3,14],guitarRoot:zone.root,guitarRate:2**((midi-zone.root)/12)});
 }
 engine.guitarPump.gain.setValueAtTime(.72,time);engine.guitarPump.gain.linearRampToValueAtTime(1,time+.15);
}
await context.workletsAreReady();const audio=(await context.render()).get();const channels=[audio.getChannelData(0),audio.getChannelData(1)];
const out='public/roses/hwm-manual-harmony';await mkdir(out,{recursive:true});
const frames=Math.round(1.6*rate),loopStart=.8,loopEnd=1.4,crossfade=Math.round(.04*rate),files=[];
for(const [index,chord] of hereWithMeChords.entries()){
 const start=Math.round((.1+index*3)*rate),data=channels.map(c=>Float64Array.from(c.slice(start,start+frames),v=>v*gain));
 for(const c of data)for(let j=0;j<crossfade;j++){
  const end=Math.round(loopEnd*rate)-crossfade+j,begin=Math.round(loopStart*rate)-crossfade+j,t=j/(crossfade-1);
  c[end]=c[end]*(1-t)+c[begin]*t;
 }
 const wave=Buffer.alloc(44+frames*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(frames*4,40);
 let peak=0,power=0;for(let i=0;i<frames;i++)for(let c=0;c<2;c++){const x=data[c][i];assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));power+=x*x;wave.writeInt16LE(Math.round(Math.max(-1,Math.min(1,x))*32767),44+(i*2+c)*2);}
 assert.ok(peak>0&&peak<1);const file=chord.code+'.wav';await writeFile(out+'/'+file,wave);files.push({code:chord.code,file,notes:chord.notes,loopStart,loopEnd,seconds:frames/rate,peak,rmsDb:10*Math.log10(power/(frames*2)),sha256:createHash('sha256').update(wave).digest('hex')});
}
const sourceHashes={};for(const file of ['scripts/render-hwm-manual-harmony.mjs','src/piano/hwmBackingRenderEngine.ts','src/piano/dropChordAmbience.ts','src/piano/hereWithMeChords.ts','reference/here-with-me-remake/backing-events-e-major.json','reference/here-with-me-remake/analysis/drop-render.json',...[...usedSamples].map(f=>'reference/here-with-me-remake/normalized-samples/'+f)])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(out+'/manifest.json',JSON.stringify({renderer:'Existing HWM drop render graph; only chord channel 2, pad channel 3 and original Piezo samples channel 14. No transport phrase, bass, lead, drums or FX.',key:'E major / C♯ minor',normalizationGain:gain,files,notes,sourceHashes},null,2)+'\n');
console.log(JSON.stringify({files,notes:notes.length}));engine.dispose();await context.dispose();
