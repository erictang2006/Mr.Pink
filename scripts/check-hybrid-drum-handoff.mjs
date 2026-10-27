// Actual Tone.js prepared-riser playback and control checks, without a browser.
import {build} from 'esbuild';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict';
const native=await import(pathToFileURL(process.env.NODE_AUDIO_MODULE).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const fetchOriginal=globalThis.fetch;globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')?new Response(await readFile(path.join('public',url))):fetchOriginal(url,options);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(process.env.NODE_AUDIO_MODULE).href)};export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {HybridDrumEngine} from './src/piano/hybridDrumEngine';export {hybridDrumGains} from './src/piano/hybridDrumTransition';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));}}]});
const {Tone,HybridDrumEngine,hybridDrumGains}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const reports=[];
for(const [name,offset,patch] of [['bar29',0,{}],['bar33',9.6,{}],['bar36',16.8,{}],['favor-hwm',0,{balance:0}],['favor-roses',0,{balance:1}],['muted',0,{hwmVolume:0,rosesVolume:0}]]){
 const rate=44100,seconds=19.6-offset,context=new Tone.OfflineContext(new native.OfflineAudioContext(2,Math.round(rate*seconds),rate));Tone.setContext(context);
 const counts={oscillators:0,bufferSources:0};for(const [method,key] of [['createOscillator','oscillators'],['createBufferSource','bufferSources']]){const create=context[method].bind(context);context[method]=(...a)=>{counts[key]++;return create(...a);};}
 const output=new Tone.Gain(1).toDestination(),engine=new HybridDrumEngine(output),buffers={hwm:new Tone.ToneAudioBuffer(),roses:new Tone.ToneAudioBuffer()};
 await Promise.all([buffers.hwm.load('/roses/hwm-backing/drop-drums.wav'),buffers.roses.load('/roses/hybrid/drums.wav')]);engine.configure(patch);
 const inputs={hwm:[0,1].map(c=>buffers.hwm.get().getChannelData(c)),roses:[0,1].map(c=>buffers.roses.get().getChannelData(c))};
 engine.start(.05,offset,.6,buffers);const settings=engine.snapshot();const audio=(await context.render()).get(),channels=[0,1].map(c=>audio.getChannelData(c));
 let peak=0,maxError=0,earlyGrooveError=0,breakPower=0,finalGap=0;
 for(let i=0;i<audio.length;i++)for(let c=0;c<2;c++){
  const actual=channels[c][i];peak=Math.max(peak,Math.abs(actual));const local=i/rate-.05,sourceFrame=Math.round(offset*rate)+i-Math.round(.05*rate),beat=112+(offset+local)/.6;
  if(local<.02)continue;const gains=hybridDrumGains(beat,settings),hwm=inputs.hwm[c][sourceFrame]??0,roses=inputs.roses[c][sourceFrame]??0,expected=hwm*gains.hwm+roses*gains.roses;
  maxError=Math.max(maxError,Math.abs(expected-actual));
  if(beat>=112&&beat<128&&name==='bar29')earlyGrooveError=Math.max(earlyGrooveError,Math.abs(actual-hwm));
  if(beat>=140&&beat<143)breakPower+=actual*actual;if(beat>=143.8)finalGap=Math.max(finalGap,Math.abs(actual));
 }
 assert.ok(maxError<1/32768,`${name}: actual automation differs ${maxError}`);assert.ok(earlyGrooveError<1/32768,'first four bars must match original HWM drums within PCM16 precision');assert.ok(breakPower<1e-12);assert.equal(finalGap,0);assert.ok(peak<1);assert.equal(counts.oscillators,0);assert.equal(counts.bufferSources,offset>=14.4?1:2);assert.equal(engine.sources.size,0);
 if(name==='muted')assert.equal(peak,0);
 reports.push({name,offset,settings,counts,maxError,earlyGrooveError,bar36DrumPowerBeforeSnap:breakPower,finalGapPeak:finalGap,peakDb:peak?20*Math.log10(peak):null});
 engine.dispose();output.dispose();for(const buffer of Object.values(buffers))buffer.dispose();await context.dispose();
}
const out=process.env.HYBRID_DRUM_QA_OUTPUT??'/private/tmp/mr-pink-handoff';await mkdir(out,{recursive:true});await writeFile(out+'/drum-waveform-verification.json',JSON.stringify({renderer:'Actual Tone.js/native offline two-bus output; browser/device listening unavailable',reports},null,2)+'\n');console.log(JSON.stringify(reports));
