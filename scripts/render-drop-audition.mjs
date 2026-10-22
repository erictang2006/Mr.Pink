// Optional local audio QA. npm install --prefix /tmp/mr-pink-offline-audio node-web-audio-api
// NODE_AUDIO_MODULE=/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/render-drop-audition.mjs
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const modes=process.env.RENDER_MODES?.split(',') ?? ['all','lead','bass','chords','drums','maximum'];
if(process.env.DROP_CHORD_MODE==='synth'&&process.env.DROP_CHORD_SOUND==='bonk')throw Error('The Bonk option uses prepared playback; omit DROP_CHORD_MODE=synth.');
const out=path.resolve(process.env.RENDER_OUTPUT_DIR ?? 'docs/roses-reference/drop-audition');
// A fresh native context per process avoids native worklet teardown affecting
// a later render. The app itself does not use this QA-only renderer.
if(modes.length>1){
 const cases=[];
 for(const mode of modes){
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[process.argv[1]],{env:{...process.env,RENDER_MODES:mode},stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(Error(`Render ${mode} exited ${code}`)));child.on('error',reject);});
  cases.push(JSON.parse(await readFile(path.join(out,`${mode}-verification.json`),'utf8')));
 }
 await writeFile(path.join(out,'verification.json'),JSON.stringify({renderer:'Actual Tone.js graph on node-web-audio-api OfflineAudioContext; not a browser or hardware latency test',cases},null,2)+'\n');
 process.exit(0);
}

const modulePath=process.env.NODE_AUDIO_MODULE;
if(!modulePath)throw Error('Set NODE_AUDIO_MODULE to the installed node-web-audio-api/index.js path. This is a generation-only dependency.');
const native=await import(pathToFileURL(modulePath).href);
// No browser automation or device output: this runs Tone against a native
// OfflineAudioContext, with its real oscillators, filters, envelopes and limiter.
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')
 ?new Response(await readFile(path.join(process.cwd(),'public',url))):realFetch(url,options);
const shim=`
 import * as N from ${JSON.stringify(pathToFileURL(modulePath).href)};
 export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;
 export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;
 export const isSupported=async()=>true;
`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {RosesDropAuditionEngine} from './src/piano/rosesDropAuditionEngine';export {RosesDropLayers} from './src/piano/rosesDropLayers';export {RosesFutureBassLayers} from './src/piano/rosesFutureBassLayers';export {defaultRosesDropSettings} from './src/piano/rosesDropSettings';export {BrightDropChordProfile,brightDropChordSettings} from './src/piano/brightDropChordProfile';export {midiToToneName} from './src/piano/noteMapping';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'native-offline',setup(b){b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));}}]});
const {Tone,RosesDropAuditionEngine,RosesDropLayers,RosesFutureBassLayers,defaultRosesDropSettings,BrightDropChordProfile,brightDropChordSettings,midiToToneName}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const arrangement=JSON.parse(await readFile('src/piano/rosesDropArrangement.json','utf8'));
await mkdir(out,{recursive:true});
const report={renderer:'Actual Tone.js graph on node-web-audio-api OfflineAudioContext; not a browser or hardware latency test',cases:[]};
for(const mode of modes){
 const rate=44100,seconds=Number(process.env.RENDER_SECONDS ?? 23);
 console.log('Preparing',mode,seconds);
 const context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*seconds,rate));Tone.setContext(context);
 const audioNodeCreations={oscillators:0,filters:0,waveshapers:0};
 for(const [method,key] of [['createOscillator','oscillators'],['createBiquadFilter','filters'],['createWaveShaper','waveshapers']]){
  const create=context[method].bind(context);
  context[method]=(...args)=>{audioNodeCreations[key]++;return create(...args);};
 }
 const bonkCache=mode==='bonkA'||mode==='bonkB';
 const brightCache=mode==='brightA'||mode==='brightB';
 const cacheTrack=mode==='chordA'||mode==='bonkA'||mode==='brightA'?39:mode==='chordB'||mode==='bonkB'||mode==='brightB'?53:undefined;
 const impacts=[],presetSwitches=[];
 let engine,profile;
 let step=0;
 if(cacheTrack){
  engine=bonkCache?new RosesFutureBassLayers():new RosesDropLayers(true);
  if(bonkCache)await engine.load();
  engine.setSettings(brightCache?brightDropChordSettings:defaultRosesDropSettings);
  if(brightCache){profile=new BrightDropChordProfile();engine.connect(profile.input);profile.connect(Tone.getDestination());}
  else engine.connect(Tone.getDestination());
  context.transport.scheduleRepeat(time=>{
   const beat=144+(step++)/4;
   profile?.tick(beat,time);
   const notes=arrangement.notes.filter(n=>n.track===cacheTrack&&n.beat>=beat&&n.beat<beat+.25);
   for(const note of notes)
    engine.triggerAttackRelease(midiToToneName(note.midi),note.duration*.6,time+(note.beat-beat)*.6,note.velocity/127);
   if(bonkCache)for(const onset of new Set(notes.map(n=>n.beat))){
    const root=Math.min(...notes.filter(n=>n.beat===onset).map(n=>n.midi));
    engine.triggerImpact(root,time+(onset-beat)*.6,.9);impacts.push({beat:onset,root,velocity:.9});
   }
  },'16n');
 }else{
  engine=new RosesDropAuditionEngine(()=>{},process.env.DROP_CHORD_MODE==='synth'?'synth':'cached');
  if(process.env.DROP_BACKING_SOURCE==='roses')engine.setBackingSource('roses');
  engine.setLeadSettings({...defaultRosesDropSettings,brightness:Number(process.env.DROP_LEAD_BRIGHTNESS??2800)});
  if(process.env.DROP_LEAD_SOUND==='loud-stabs')engine.setLeadSound('loud-stabs');
  await engine.prepare();if(process.env.DROP_CHORD_PRESET==='bright')engine.setChordPreset('bright');engine.setMaster(mode==='maximum'?1:.72);
  if(process.env.DROP_CHORD_SOUND==='bonk')engine.setRow('chords',{enabled:false});
  if(process.env.DROP_CHORD_SOUND==='original'||process.env.DROP_CHORD_MODE==='synth')engine.setRow('bonkChords',{enabled:false});
  if(mode==='maximum'){for(const id of Object.keys(engine.snapshot().rows))engine.setRow(id,{volume:1});engine.setChordLevel(0,1.5);engine.setChordLevel(1,1.5);}
  else if(mode!=='all')engine.setRow(mode,{solo:true});
  engine.start();context.transport.scheduleRepeat(time=>{
   const beat=144+(step++)/4;
   if(process.env.DROP_CHORD_AB==='1'&&[152,160,168].includes(beat)){
    const preset=beat===160?'bright':'original';engine.setChordPreset(preset);presetSwitches.push({beat,preset});
   }
   engine.tick(beat,time,.6);
  },'16n');
 }
 console.log('Graph ready',mode);
 context.transport.bpm.value=100;context.transport.start(.1);
 await context.workletsAreReady();console.log('Worklets ready',mode);
 const renderStarted=performance.now();
 const rendered=await context.render();const audio=rendered.get();
 const renderWallSeconds=(performance.now()-renderStarted)/1000;
 // Native getChannelData may copy: fetch each channel once, outside sample loops.
 const channels=[audio.getChannelData(0),audio.getChannelData(1)];
 if(cacheTrack){
  // Preserve over-unity synth samples in float WAV; mixer gain/limiting happens
  // at runtime. Remove only the scheduling preroll, retaining the entire tail.
  const first=Math.round(.1*rate),frames=audio.length-first;
  const wave=Buffer.alloc(44+frames*8);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(3,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*8,28);wave.writeUInt16LE(8,32);wave.writeUInt16LE(32,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
  let peak=0,tail=0,loudnessMatchGain=1;
  let referenceFile;
  if(brightCache){
   referenceFile=`public/roses/drop/chord-cache/chord${cacheTrack===39?'A':'B'}.wav`;
   const reference=await readFile(referenceFile);
   const windowFrames=Math.min(Math.round(19.2*rate),frames);
   let originalPower=0,brightPower=0;
   for(let i=0;i<windowFrames;i++)for(let c=0;c<2;c++){
    originalPower+=reference.readFloatLE(44+(i*2+c)*4)**2;
    brightPower+=channels[c][first+i]**2;
   }
   loudnessMatchGain=Math.sqrt(originalPower/brightPower);
  }
  for(let i=0;i<frames;i++)for(let c=0;c<2;c++){
   const x=channels[c][first+i]*loudnessMatchGain;if(!Number.isFinite(x))throw Error('Non-finite chord cache');
   peak=Math.max(peak,Math.abs(x));if(i>=frames-rate)tail=Math.max(tail,Math.abs(x));wave.writeFloatLE(x,44+(i*2+c)*4);
  }
  if(tail>1e-6)throw Error('Chord cache tail has not finished');
  const sourceHashes={};
  const instruments=bonkCache?['src/piano/rosesFutureBassLayers.ts','public/roses/chords/future-house-bonk.wav']:['src/piano/rosesDropLayers.ts','src/piano/dropChordAmbience.ts',...(brightCache?['src/piano/brightDropChordProfile.ts',referenceFile]:[])];
  for(const file of ['src/piano/rosesDropArrangement.json',...instruments,'src/piano/rosesDropSettings.ts','src/piano/noteMapping.ts','package-lock.json'])sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  const metrics={mode,track:cacheTrack,...(brightCache?{preset:brightDropChordSettings,loudnessMatchGain}:{}),seconds:frames/rate,prerollRemovedSeconds:.1,renderWallSeconds,peak,tail,finite:true,sourceHashes,notes:arrangement.notes.filter(n=>n.track===cacheTrack),...(bonkCache?{impacts}:{}),audioSha256:createHash('sha256').update(wave).digest('hex')};
  await writeFile(path.join(out,`${mode}.wav`),wave);
  await writeFile(path.join(out,`${mode}-verification.json`),JSON.stringify(metrics,null,2)+'\n');
  console.log(JSON.stringify({mode,seconds:metrics.seconds,peak,tail,notes:metrics.notes.length}));
  engine.dispose();profile?.dispose();await context.dispose();continue;
 }
 let peak=0,power=0,tail=0,finite=true;
 const wave=Buffer.alloc(44+audio.length*4);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
 for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++){
  const x=channels[c][i];if(!Number.isFinite(x))finite=false;peak=Math.max(peak,Math.abs(x));power+=x*x;if(i>rate*22)tail=Math.max(tail,Math.abs(x));wave.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(x*32767))),44+(i*2+c)*2);
 }
 const metrics={mode,seconds,leadSound:engine.snapshot().leadSound,leadBrightness:engine.snapshot().leadBrightness,chordPlayback:engine.snapshot().chordPlayback,chordPreset:engine.snapshot().chordPreset,...(presetSwitches.length?{presetSwitches}:{}),chordRows:engine.snapshot().rows,renderWallSeconds,audioNodeCreations,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(power/(audio.length*2)),tailPeakDb:tail>0?20*Math.log10(tail):null,finite};
 console.log(JSON.stringify(metrics));report.cases.push(metrics);
 await writeFile(path.join(out,`${mode}-verification.json`),JSON.stringify(metrics,null,2)+'\n');
 await writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
 if(!finite||peak>=1||peak===0)throw Error('Invalid, silent or clipped render');
 // Keep separate solo previews as well as the combined listening reference.
 await writeFile(path.join(out,`${mode}-preview.wav`),wave);
 engine.dispose();await context.dispose();
}
await writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
