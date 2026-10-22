// Actual Tone.js prepared-riser playback and control checks, without a browser.
import {build} from 'esbuild';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict';
const native=await import(pathToFileURL(process.env.NODE_AUDIO_MODULE).href);
globalThis.self={TONE_SILENCE_LOGGING:true,BaseAudioContext:native.BaseAudioContext,AudioWorkletNode:native.AudioWorkletNode};
const fetchOriginal=globalThis.fetch;globalThis.fetch=async(url,options)=>typeof url==='string'&&url.startsWith('/roses/')?new Response(await readFile(path.join('public',url))):fetchOriginal(url,options);
const shim=`import * as N from ${JSON.stringify(pathToFileURL(process.env.NODE_AUDIO_MODULE).href)};export const AudioContext=N.AudioContext,OfflineAudioContext=N.OfflineAudioContext,AudioWorkletNode=N.AudioWorkletNode,AudioBuffer=N.AudioBuffer;export const isAnyAudioContext=x=>x instanceof N.AudioContext,isAnyOfflineAudioContext=x=>x instanceof N.OfflineAudioContext,isAnyAudioNode=x=>x instanceof N.AudioNode,isAnyAudioParam=x=>x instanceof N.AudioParam;export const isSupported=async()=>true;`;
const bundle=await build({stdin:{contents:`export * as Tone from 'tone';export {PreDropRiserEngine} from './src/piano/preDropRiserEngine';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native',setup(b){b.onResolve({filter:/^standardized-audio-context$/},()=>({path:'audio',namespace:'native'}));b.onLoad({filter:/.*/,namespace:'native'},()=>({contents:shim}));b.onResolve({filter:/node-web-audio-api\/index.js$/},a=>({path:a.path,external:true}));}}]});
const {Tone,PreDropRiserEngine}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const reports=[];
for(const [name,enabled,volume,intensity] of [['off',false,1,1],['soft',true,1,0],['strong',true,1,1],['quiet',true,.25,.65],['loud',true,.75,.65]]){
 const rate=44100,context=new Tone.OfflineContext(new native.OfflineAudioContext(2,rate*3,rate));Tone.setContext(context);
 let oscillators=0;const create=context.createOscillator.bind(context);context.createOscillator=(...a)=>{oscillators++;return create(...a);};
 const output=new Tone.Gain(1).toDestination(),riser=new PreDropRiserEngine(output);await riser.load();riser.configure({enabled,volume,intensity});riser.play(.05);
 const audio=(await context.render()).get(),channels=[0,1].map(c=>audio.getChannelData(c));let peak=0,power=0,diff=0,tail=0;
 for(const c of channels)for(let i=0;i<c.length;i++){peak=Math.max(peak,Math.abs(c[i]));power+=c[i]*c[i];if(i)diff+=(c[i]-c[i-1])**2;if(i>rate*2.34)tail=Math.max(tail,Math.abs(c[i]));}
 assert.equal(oscillators,0);assert.equal(tail,0);assert.ok(peak<1);assert.equal(riser.sources.size,0);if(enabled)assert.ok(peak>.001);else assert.equal(peak,0);
 reports.push({name,enabled,volume,intensity,peakDb:peak?20*Math.log10(peak):null,rmsDb:power?10*Math.log10(power/(2*audio.length)):null,highFrequencyRatio:power?diff/power:0,oscillators,tailAfterEnd:tail});riser.dispose();output.dispose();await context.dispose();
}
assert.ok(reports[2].highFrequencyRatio>reports[1].highFrequencyRatio*2);assert.ok(Math.abs(reports[4].rmsDb-reports[3].rmsDb-20*Math.log10(3))<.01);
const out=process.env.RISER_QA_OUTPUT??'/private/tmp/mr-pink-hybrid-riser';await mkdir(out,{recursive:true});await writeFile(out+'/verification.json',JSON.stringify({renderer:'Actual Tone.js/native offline playback; not browser listening',reports},null,2)+'\n');console.log(JSON.stringify(reports));
