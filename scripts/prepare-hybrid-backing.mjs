// Generation-only native audio dependency; no live synths or worklets are added.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modulePath=process.env.NODE_AUDIO_MODULE;assert.ok(modulePath,'Set NODE_AUDIO_MODULE');
const native=await import(pathToFileURL(modulePath).href);
const bundle=await build({stdin:{contents:`export * from './src/piano/hybridBacking';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {hybridPercussion,hybridHarmonyGain,hybridRiserEndBeat}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const out='public/roses/hybrid',rate=44100,seconds=19.2;await mkdir(out,{recursive:true});
const decodeContext=new native.OfflineAudioContext(2,1,rate);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs={};
async function decode(file){const bytes=await readFile(file);inputs[file]=hash(bytes);return decodeContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));}
const reports=[];
async function save(file,channels){
 const frames=channels[0].length,wave=Buffer.alloc(44+frames*8);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(3,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*8,28);wave.writeUInt16LE(8,32);wave.writeUInt16LE(32,34);wave.write('data',36);wave.writeUInt32LE(frames*8,40);
 let peak=0,energy=0;for(let i=0;i<frames;i++)for(let c=0;c<2;c++){const x=channels[c][i];assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));energy+=x*x;wave.writeFloatLE(x,44+(i*2+c)*4);}
 assert.ok(peak>0&&peak<1);await writeFile(`${out}/${file}`,wave);reports.push({file,frames,rate,sha256:hash(wave),peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(energy/(2*frames))});
}
// Exact existing E-major pitched recordings, only a new amplitude envelope.
for(const group of ['chords','bass']){
 const buffer=await decode(`public/roses/hwm-backing/drop-${group}.wav`);
 const channels=[0,1].map(c=>Float32Array.from(buffer.getChannelData(c).subarray(0,rate*seconds),(x,i)=>x*hybridHarmonyGain(112+i/rate/.6)));
 assert.ok(channels.every(c=>c.subarray(Math.ceil(16.8*rate)).every(x=>x===0)));
 await save(`${group}.wav`,channels);
}
// Only original imported Roses percussion; no Roses Vox/bass/chops or HWM kick/hat.
const drums=new native.OfflineAudioContext(2,rate*seconds,rate),buffers=new Map();
for(const event of hybridPercussion){
 if(!buffers.has(event.file))buffers.set(event.file,await decode('public'+event.file));
 const buffer=buffers.get(event.file),start=(event.beat-112)*.6,duration=Math.min((event.end-event.beat)*.6,(buffer.duration-event.offset)/event.rate),fade=.003;
 const source=drums.createBufferSource(),gain=drums.createGain();source.buffer=buffer;source.playbackRate.value=event.rate;source.connect(gain).connect(drums.destination);
 gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(event.gain*event.level,start+.001);gain.gain.setValueAtTime(event.gain*event.level,start+duration-fade);gain.gain.linearRampToValueAtTime(0,start+duration);source.start(start,event.offset);source.stop(start+duration);
}
const drumAudio=await drums.startRendering();await save('drums.wav',[drumAudio.getChannelData(0),drumAudio.getChannelData(1)]);
// Two deterministic, equally loud noise sweeps. Intensity crossfades their
// spectral trajectories at runtime; neither contains an alarm-like tonal lead.
const riserSeconds=(hybridRiserEndBeat-140)*.6;
for(const strong of [false,true]){
 const ctx=new native.OfflineAudioContext(2,Math.round(rate*riserSeconds),rate),noise=ctx.createBuffer(2,Math.round(rate*riserSeconds),rate);let seed=42891;
 for(let c=0;c<2;c++){const data=noise.getChannelData(c);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}
 const source=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noise;high.type='highpass';high.frequency.value=strong?380:240;high.Q.value=.5;low.type='lowpass';low.Q.value=.55;
 low.frequency.setValueAtTime(strong?450:650,0);low.frequency.exponentialRampToValueAtTime(strong?11500:3000,riserSeconds-.08);
 gain.gain.setValueAtTime(0,0);gain.gain.linearRampToValueAtTime(.05,.08);gain.gain.exponentialRampToValueAtTime(1,riserSeconds-.08);gain.gain.linearRampToValueAtTime(0,riserSeconds);
 source.connect(high).connect(low).connect(gain).connect(ctx.destination);source.start(0);
 const rendered=await ctx.startRendering(),channels=[0,1].map(c=>rendered.getChannelData(c));for(let i=0;i<channels[0].length;i++){const mid=(channels[0][i]+channels[1][i])*.5,side=(channels[0][i]-channels[1][i])*.5,width=.12+(strong?.88:.55)*i/(channels[0].length-1);channels[0][i]=mid+side*width;channels[1][i]=mid-side*width;}
 let power=0;for(const c of channels)for(const x of c)power+=x*x;
 const scale=10**(-25/20)/Math.sqrt(power/(channels[0].length*2));
 await save(`riser-${strong?'strong':'soft'}.wav`,channels.map(c=>Float32Array.from(c,x=>x*scale)));
}
const sourceHashes={};for(const file of ['scripts/prepare-hybrid-backing.mjs','src/piano/hybridBacking.ts','src/piano/rosesBuildup.ts','src/piano/roses_buildup_manifest.json'])sourceHashes[file]=hash(await readFile(file));
await writeFile(`${out}/manifest.json`,JSON.stringify({bpm:100,key:'E major / C♯ minor',transposeApplied:0,harmony:'Existing E-major HWM Drop Backing; amplitude processing only',harmonySilenceBeat:140,riserStartBeat:140,riserEndBeat:hybridRiserEndBeat,snapBeat:143,inputs,sourceHashes,percussion:hybridPercussion,files:reports},null,2)+'\n');console.log(JSON.stringify(reports));
