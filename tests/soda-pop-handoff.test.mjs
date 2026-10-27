import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const mock=`
export const getContext=()=>({}); export class Panner{} export class EQ3{} export class Compressor{} export class Gain{} export class Volume{} export class Player{} export class Players{} export class Synth{} export class PolySynth{} export class Sampler{} export class Filter{} export class Chorus{} export class FeedbackDelay{} export class ToneAudioNode{} export class JCReverb{} export class Distortion{} export class ToneAudioBuffer{} export class ToneBufferSource{} export class Limiter{} export class WaveShaper{}
export const Transport={stops:[],stop(time){this.stops.push(time);}},Draw={schedule(fn){fn();}},immediate=()=>10,now=()=>10;
`;
const result=await build({stdin:{contents:`export {RosesIntroEngine} from './src/piano/rosesIntroEngine';export {RosesDropAuditionEngine} from './src/piano/rosesDropAuditionEngine';export {Transport} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'clock-only',setup(builder){builder.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock}));}}]});
const {RosesIntroEngine,RosesDropAuditionEngine,Transport}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function take(mode='performance',available=true){
 const called=[];let dropStatus='running';
 const engine=Object.assign(Object.create(RosesIntroEngine.prototype),{state:{status:'running',mode,measure:44,beat:1},step:0,anchorBar:44,practiceLoop:null,finale:{ready:()=>available,start:time=>{called.push(['finale',time]);engine.state.status='finished';return true;}},tickVocalHandoff(){},drop:{snapshot:()=>({status:dropStatus}),tick(beat){if(beat>=176)dropStatus='done';}},lead:{tick(){}},buildup:{tick(){}},closer:{tick(){}},emitAt(){},audibleClick:false});
 return {engine,called};
}
test('real Roses tick hands off only after all sixteen subdivisions of bar 44 and never twice',()=>{
 const {engine,called}=take();for(let i=0;i<16;i++)engine.tick(100+i*.15);
 assert.deepEqual(called,[]);engine.tick(102.4);assert.deepEqual(called,[['finale',102.4]]);engine.tick(102.55);assert.equal(called.length,1);
});
test('paused, practice and unavailable finales preserve existing DJ transport behavior',()=>{
 for(const [mode,ready] of [['timed',true],['performance',false]]){const {engine,called}=take(mode,ready);engine.step=16;engine.tick(20);assert.deepEqual(called,[]);}
 const {engine,called}=take();engine.state.status='paused';engine.step=16;engine.tick(20);assert.deepEqual(called,[]);assert.equal(engine.step,16);
});
test('finale handoff schedules existing audio stops at the musical boundary, with only a short intentional brake tail',()=>{
 const calls=[],at=24.7;
 const engine=Object.assign(Object.create(RosesIntroEngine.prototype),{generation:0,state:{},ready:true,clipSources:new Map(),pausedClips:new Map(),
  drop:{turntableStop:time=>calls.push(['brake',time])},lead:{stop(){}},closer:{stop:time=>calls.push(['closer',time])},buildup:{stop:time=>calls.push(['buildup',time])},players:{stopAll:time=>calls.push(['drums',time])},synth:{stopLoop:time=>calls.push(['synth',time])},bass:{releaseAll:time=>calls.push(['bass',time])},stopClip:(_player,time)=>calls.push(['vocal',time]),emitAt:time=>calls.push(['visual',time])});
 engine.stopForFinale(at);assert.equal(Transport.stops.at(-1),at);assert.ok(calls.every(([,time])=>time===at));assert.equal(engine.state.status,'finished');assert.equal(engine.state.measure,44);
 const rates=[],stops=[],source={playbackRate:{value:1,cancelScheduledValues(){},setValueAtTime:(...args)=>rates.push(args),linearRampToValueAtTime:(...args)=>rates.push(args)},stop:time=>stops.push(time)};
 const drop=Object.assign(Object.create(RosesDropAuditionEngine.prototype),{sources:new Set([source]),lead:{pause(){}}});drop.turntableStop(at);assert.deepEqual(rates,[[1,at],[.07,at+.24]]);assert.deepEqual(stops,[at+.26]);assert.equal(drop.status,'done');
});
