import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const tone=`
export const events=[];
export class Gain {
 constructor(value=1){this.gain={value,rampTo:(v)=>{assertFinite(v);this.gain.value=v;},cancelAndHoldAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setValueAtTime(){}};}
 connect(){return this;}disconnect(){return this;}dispose(){}chain(){return this;}
}
function assertFinite(value){if(!Number.isFinite(value))throw Error('Invalid audio parameter '+value);}
export class Limiter extends Gain {}
export class WaveShaper extends Gain {}
export class ToneAudioBuffer {loaded=false;async load(){this.loaded=true;}dispose(){}}
export class ToneBufferSource {constructor(){events.push('source');}connect(){return this;}start(){events.push('start');}stop(){}dispose(){}}
export const immediate=()=>0,now=()=>0;
`;
const bundle=await build({stdin:{contents:`export {PreDropRiserEngine} from './src/piano/preDropRiserEngine';export {HybridDrumEngine} from './src/piano/hybridDrumEngine';export {RosesBackingEngine} from './src/piano/rosesBackingEngine';export * from './src/piano/mixerPreferences';export {events} from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'audio-boundary',setup(b){
 b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:tone}));
 b.onResolve({filter:/\/rosesBuildupEngine$/},()=>({path:'buildup',namespace:'original'}));
 b.onLoad({filter:/.*/,namespace:'original'},()=>({contents:`export class RosesBuildupEngine {snapshot(){return {status:'NOT ARMED',layers:[],bass:false};}stop(){}dispose(){}}`}));
}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function local(run){const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}});try{run(data);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}}
test('pre-drop volume, intensity, and enabled switch restore on a fresh engine before any audio starts',()=>local(data=>{
 const first=new api.PreDropRiserEngine({});first.configure({volume:.87,intensity:.24,enabled:false});
 assert.deepEqual(JSON.parse(data.get(api.riserPreferenceKey)),{volume:.87,intensity:.24,enabled:false});first.dispose();
 const before=api.events.length,second=new api.PreDropRiserEngine({});
 assert.deepEqual(second.snapshot(),{volume:.87,intensity:.24,enabled:false});assert.equal(second.output.gain.value,0);
 assert.equal(second.blends.soft.gain.value,.76);assert.equal(second.blends.strong.gain.value,.24);assert.equal(api.events.length,before,'restoration never starts playback');second.dispose();
}));
test('hybrid drum levels and backing group gain/solo survive fresh instances',()=>local(()=>{
 const first=new api.HybridDrumEngine({});first.configure({hwmVolume:.36,rosesVolume:.72,balance:.8});first.dispose();
 const second=new api.HybridDrumEngine({});assert.deepEqual(second.snapshot(),{hwmVolume:.36,rosesVolume:.72,balance:.8});second.dispose();
 const bass={setBuildGain(){}};const backing=new api.RosesBackingEngine({},bass);
 backing.setMix({gain:.66,group:'fx',level:1.25,solo:'fx'});backing.dispose();
 const restored=new api.RosesBackingEngine({},bass),snapshot=restored.snapshot();
 assert.equal(snapshot.gain,.66);assert.equal(snapshot.levels.fx,1.25);assert.equal(snapshot.solo,'fx');assert.equal(restored.output.gain.value,.66);assert.equal(restored.groups.get('fx').gain.value,1.25);assert.equal(restored.groups.get('chords').gain.value,0);restored.dispose();
}));
test('corrupt storage falls back safely and nonfinite mixer values cannot reach audio parameters',()=>local(data=>{
 data.set(api.riserPreferenceKey,'{invalid');assert.equal(new api.PreDropRiserEngine({}).snapshot().volume,.35);
 data.set(api.riserPreferenceKey,JSON.stringify({volume:'bad',intensity:12,enabled:false}));const riser=new api.PreDropRiserEngine({});assert.deepEqual(riser.snapshot(),{enabled:false,volume:.35,intensity:1});riser.dispose();
 const drop=api.validDropMixer({rows:{lead:{volume:NaN,muted:true},recorded:{volume:20}},chordLevels:[NaN,-2]});assert.equal(drop.rows.lead.volume,.65);assert.equal(drop.rows.lead.muted,true);assert.equal(drop.rows.recorded.volume,2);assert.deepEqual(drop.chordLevels,[.3981071115,0]);
 assert.deepEqual(api.validBackingMix(null),{gain:1,levels:{chords:1,bass:1,drums:1,fx:1},solo:null});
}));
test('blocked browser storage cannot prevent engine configuration',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Storage denied');}});
 try{const riser=new api.PreDropRiserEngine({});assert.doesNotThrow(()=>riser.configure({volume:.9}));assert.equal(riser.snapshot().volume,.9);riser.dispose();}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
