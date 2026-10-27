import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export {SynthEngine} from './src/piano/synthEngine';export {clock} from 'tone';
export * from './src/components/cosmicStage';export * from './src/components/stageEnergy';export * from './src/components/recordOrb';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'separate-audio-clocks',setup(b){
 b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const clock={time:42,lookAhead:.2};export const immediate=()=>clock.time,now=()=>clock.time+clock.lookAhead;export const start=async()=>{};
 export class PolySynth{} export class Sampler{} export class Synth{} export class Gain{} export class Filter{} export class Chorus{} export class FeedbackDelay{} export class ToneAudioNode{} export class JCReverb{} export class Volume{}`,loader:'js'}));
}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('Roses live attacks, keyups, pedal-up and panic bypass transport look-ahead while scheduled notes retain exact times',()=>{
 const calls=[],engine=Object.assign(Object.create(api.SynthEngine.prototype),{
  ready:true,loading:false,held:new Map(),sustained:new Set(),pedal:false,loopStopTimer:null,loopLevel:.55,
  voice:{triggerAttack:(...args)=>calls.push(['attack',...args]),triggerRelease:(...args)=>calls.push(['release',...args]),releaseAll:(...args)=>calls.push(['all',...args])},
  loopGain:{gain:{setValueAtTime:(...args)=>calls.push(['loopGain',...args])}},loopVoice:{triggerAttackRelease:(...args)=>calls.push(['loop',...args])},
 });
 api.clock.time=42;assert.equal(engine.noteOn('KeyL',64),true);assert.deepEqual(calls.at(-1),['attack','E4',42,.65]);
 assert.equal(engine.noteOn('KeyL',64),false);engine.noteOff('KeyL');assert.deepEqual(calls.at(-1),['release','E4',42]);
 engine.setSustain(true);engine.noteOn('KeyL',64);const count=calls.length;engine.noteOff('KeyL');assert.equal(calls.length,count);
 api.clock.time=42.05;engine.setSustain(false);assert.deepEqual(calls.at(-1),['release','E4',42.05]);
 engine.noteOn('KeyL',64,43.75,.8);assert.deepEqual(calls.at(-1),['attack','E4',43.75,.8]);
 assert.equal(engine.triggerLoopNote(64,44.5,.3),true);assert.deepEqual(calls.at(-1),['loop','E4',.3,44.5,.58]);
 engine.stopLoop=()=>{};engine.releaseAll();assert.deepEqual(calls.at(-1),['all',42.05]);assert.equal(engine.held.size,0);
});

function context(){
 const calls=[],stack=[];const ctx=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){assert.ok(stack.length);this.globalAlpha=stack.pop();},
  createRadialGradient(...args){calls.push(['radial',...args]);return {addColorStop(){}};},createLinearGradient(...args){calls.push(['linear',...args]);return {addColorStop(){}};}
 },{get:(t,k)=>k in t?t[k]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));calls.push([k,...args]);}});
 return {ctx,calls,stack};
}

test('Roses atmosphere reuses one bounded surface and refreshes only slow background motion, including after resize/reset',()=>{
 const original=globalThis.document;let created=0;const rendered=context();
 globalThis.document={createElement(){created++;return {width:0,height:0,getContext:()=>rendered.ctx};}};
 try{
  const cache=new api.CosmicStageCache();
  for(const [w,h] of [[1366,768],[1920,1080],[3840,2160]]){
   const image=cache.get(w,h,1000,.2,false);assert.ok(image.width*image.height<602000);const initial=rendered.calls.length;
   for(let now=1001;now<1150;now+=10)assert.equal(cache.get(w,h,now,.9,false),image);
   assert.equal(rendered.calls.length,initial,'live notes do not rebuild large gradients');
   cache.get(w,h,1150,.9,false);assert.ok(rendered.calls.length>initial);assert.equal(created,1,'resize reuses the buffer');
   const before=rendered.calls.length;cache.get(w,h,0,.1,false);assert.ok(rendered.calls.length>before,'rehearsal clock reset refreshes safely');
  }
  assert.equal(rendered.stack.length,0);cache.release();
  let failures=0;globalThis.document={createElement(){failures++;return {width:0,height:0,getContext:()=>null};}};
  const fallback=new api.CosmicStageCache();for(let i=0;i<50;i++)assert.equal(fallback.get(1920,1080,i*160,0,false),undefined);assert.equal(failures,1);fallback.release();
 }finally{globalThis.document=original;}
});

test('record spectrum keeps all 144 original waveform endpoints with far fewer stroke submissions',()=>{
 const {ctx,stack}=context(),segments=[],strokes=[];let path=[],from;
 ctx.beginPath=()=>{path=[];};ctx.moveTo=(x,y)=>{from=[x,y];};ctx.lineTo=(x,y)=>{path.push([...from,x,y]);};
 ctx.stroke=()=>{if(path.length){strokes.push(path.length);if(ctx.lineWidth>=4)segments.push(...path);}};
 const energy=new api.StageEnergy(),waveform=Float32Array.from({length:256},(_,i)=>Math.sin(i*.3)*.17);
 api.drawRecordOrb(ctx,900,650,1000,energy,false,{geometry:{x:450,y:320,radius:200},waveform});
 assert.equal(segments.length,144,'all spectrum spokes retain a halo and crisp core');assert.ok(strokes.length<=40,'was 288 separate strokes for the spectrum alone');
 const expected=Array.from({length:144},(_,i)=>{
  const a=i/144*Math.PI*2-Math.PI/2,index=Math.floor(i/144*waveform.length),wave=Math.min(1,Math.max(Math.abs(waveform[index]),Math.abs(waveform[(index+1)%waveform.length]))*5);
  const inner=200*1.035,outer=inner+200*(.026+wave*.31);
  return [450+Math.cos(a)*inner,320+Math.sin(a)*inner,450+Math.cos(a)*outer,320+Math.sin(a)*outer];
 });
 const order=(a,b)=>a[0]-b[0]||a[1]-b[1];segments.sort(order);expected.sort(order);
 for(let i=0;i<144;i++)for(let j=0;j<4;j++)assert.ok(Math.abs(segments[i][j]-expected[i][j])<1e-9);
 assert.equal(stack.length,0);
});

test('busy Roses drawing removes expensive blur without changing artwork, rings or the 144 spectrum endpoints',()=>{
 const render=economical=>{
  const {ctx,calls,stack}=context(),blurs=[];let blur=0;
  Object.defineProperty(ctx,'shadowBlur',{get:()=>blur,set:value=>{blurs.push(value);blur=value;}});
  const artwork={width:600,height:600},energy=new api.StageEnergy();energy.level=.8;energy.shock=.5;
  api.drawRecordOrb(ctx,900,650,1000,energy,false,{economical,artwork,geometry:{x:450,y:320,radius:200},waveform:new Float32Array(256).fill(.12)});
  assert.equal(stack.length,0);return {calls,blurs};
 };
 const regular=render(false),lean=render(true);
 assert.ok(regular.blurs.some(value=>value>20));assert.ok(lean.blurs.every(value=>value===0));
 for(const command of ['drawImage','arc','moveTo','lineTo'])assert.deepEqual(lean.calls.filter(call=>call[0]===command),regular.calls.filter(call=>call[0]===command),`${command} preserves the existing scene geometry`);
});
