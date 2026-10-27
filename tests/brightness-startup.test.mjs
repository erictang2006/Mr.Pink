import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
const paramPath=resolve('node_modules/tone/build/esm/core/context/Param.js');
const runtime=`
export const clock={time:0};
export class NativeParam {
 defaultValue=0;minValue=-3.4028234663852886e38;maxValue=3.4028234663852886e38;
 setValueAtTime(value){if(!Number.isFinite(value))throw Error('Native parameter received '+value);}
 linearRampToValueAtTime(value){this.setValueAtTime(value);}
 exponentialRampToValueAtTime(value){this.setValueAtTime(value);}
 cancelScheduledValues(){}cancelAndHoldAtTime(){}
}
export class ToneWithContext {
 constructor(options){this.context=options.context;}
 static getDefaults(){return {context:{sampleRate:48000}};}
 now(){return clock.time;}toSeconds(time){return time===undefined?clock.time:Number(time);}
 get sampleTime(){return 1/48000;}log(){}dispose(){return this;}
}
export const isAudioParam=value=>value instanceof NativeParam;
export const isAudioNode=()=>false,isAudioBuffer=()=>false;
`;
const fakeTone=`
import {Param} from ${JSON.stringify(paramPath)};
import {NativeParam} from 'param-runtime';
export class Gain {
 constructor(value=1){this.gain=new Param({param:new NativeParam(),value});}
 connect(){return this;}toDestination(){return this;}dispose(){}
}
export class Filter extends Gain {
 constructor(){super();this.gain=new Param({param:new NativeParam(),units:'decibels',convert:false,value:0});}
}
export class ToneAudioBuffer {loaded=false;dispose(){}}
export class ToneBufferSource {}
export const immediate=()=>0;
`;
const bundle=await build({stdin:{contents:`export {Param} from ${JSON.stringify(paramPath)};export {RosesLoudStabsEngine} from './src/piano/rosesLoudStabsEngine';export {clock,NativeParam} from 'param-runtime';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'real-param',setup(b){
 b.onResolve({filter:/^(param-runtime|.*\/ToneWithContext\.js|.*\/AdvancedTypeCheck\.js)$/},()=>({path:'param-runtime',namespace:'runtime'}));
 b.onLoad({filter:/.*/,namespace:'runtime'},()=>({contents:runtime}));
 b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:fakeTone,resolveDir:process.cwd()}));
}}]});
const {Param,RosesLoudStabsEngine,clock,NativeParam}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
test('real Tone Param reproduces the reported NaN when an exponential dB ramp crosses zero',()=>{
 clock.time=0;
 const parameter=new Param({param:new NativeParam(),units:'decibels',convert:false,value:0});
 parameter.rampTo(-2,.025);
 clock.time=.0125;
 assert.ok(Number.isNaN(parameter.getValueAtTime(clock.time)));
 assert.throws(()=>parameter.rampTo(-2,.025),/Value must be within \[-Infinity, 3\.4028234663852886e\+38\], got: NaN/);
});
test('restored 2500 Hz brightness and repeated updates stay finite with Tone’s real automation math',()=>{
 clock.time=0;const engine=new RosesLoudStabsEngine();
 // Constructor default, restored settings, mount effects, and subsequent slider updates.
 for(const brightness of [2800,2500,2500,650,4000,2800,2500]){
  assert.doesNotThrow(()=>engine.setBrightness(brightness));
  for(let sample=0;sample<4;sample++){
   clock.time+=.004;
   assert.ok(Number.isFinite(engine.tone.gain.getValueAtTime(clock.time)),`nonfinite brightness at ${brightness}`);
  }
 }
 clock.time+=.1;assert.ok(engine.tone.gain.getValueAtTime(clock.time)<0);engine.dispose();
});
