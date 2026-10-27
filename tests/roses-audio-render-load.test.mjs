import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const mock=`
export const nodes=[];export const context={sampleRate:48000};export const getContext=()=>context;
export const now=()=>42.2,immediate=()=>42,start=async()=>{};
export class Signal {constructor(value=0){this.value=value;}rampTo(value){this.value=value;}linearRampTo(value){this.value=value;}setValueAtTime(value){this.value=value;}cancelScheduledValues(){}}
export class ToneAudioNode {
 constructor(options){this.options=options;this.connections=[];this.context=context;this.disposed=false;nodes.push(this);}
 connect(node,output=0,input=0){this.connections.push({node,output,input});return this;}
 chain(...nodes){let prior=this;for(const node of nodes){prior.connect(node);prior=node;}return this;}
 toDestination(){return this;}dispose(){this.disposed=true;return this;}
 set(options){this.options={...this.options,...options};return this;}get(){return this.options?.options??this.options??{};}
}
export class Gain extends ToneAudioNode {constructor(value=1){super(value);this.gain=new Signal(value);}}
export class Volume extends ToneAudioNode {constructor(value=0){super(value);this.volume=new Signal(value);}}
export class Filter extends ToneAudioNode {constructor(options){super(options);this.frequency=new Signal(options?.frequency);this.Q=new Signal(options?.Q);this.gain=new Signal(options?.gain);}}
export class CrossFade extends ToneAudioNode {constructor(wet){super(wet);this.a=new Gain();this.b=new Gain();this.fade=new Signal(wet);}dispose(){super.dispose();this.a.dispose();this.b.dispose();return this;}}
export class Split extends ToneAudioNode {} export class Merge extends ToneAudioNode {}
export class Delay extends ToneAudioNode {constructor(delayTime,maxDelay){super({delayTime,maxDelay});}}
export class Synth extends ToneAudioNode {} export class MonoSynth extends Synth {} export class PolySynth extends Synth {} export class Sampler extends Synth {}
export class Chorus extends ToneAudioNode {constructor(options){super(options);this.wet=new Signal(options.wet);}start(){}}
export class FeedbackDelay extends Chorus {} export class JCReverb extends Chorus {}
export class Panner extends ToneAudioNode {constructor(value){super(value);this.pan=new Signal(value);}}
export class EQ3 extends ToneAudioNode {} export class Compressor extends ToneAudioNode {} export class Limiter extends ToneAudioNode {} export class WaveShaper extends ToneAudioNode {} export class Distortion extends ToneAudioNode {}
export class ToneBufferSource extends ToneAudioNode {} export class ToneAudioBuffer extends ToneAudioNode {} export class FrequencyEnvelope extends ToneAudioNode {} export class AmplitudeEnvelope extends ToneAudioNode {}
`;
const result=await build({stdin:{contents:`export {NativeRoomReverb} from './src/piano/nativeRoomReverb';export {DropChordAmbience} from './src/piano/dropChordAmbience';export {SynthEngine,presetSettings} from './src/piano/synthEngine';export {RosesChordStabEngine} from './src/piano/rosesChordStabEngine';export * as audio from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'audio-graph-audit',setup(b){b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock}));}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function nodesFor(create){const at=api.audio.nodes.length;const room=create();return {room,nodes:api.audio.nodes.slice(at)};}

test('native room retains the JC room topology, stereo routing, feedback and wet/dry control',()=>{
 for(const [roomSize,wet] of [[.42,.12],[.12,.025]]){
  const {room,nodes}=nodesFor(()=>new api.NativeRoomReverb({roomSize,wet}));
  const allpass=nodes.filter(node=>node instanceof api.audio.Filter);
  assert.deepEqual(allpass.map(node=>node.options),[347,113,37].map(frequency=>({type:'allpass',frequency,Q:1})));
  const delays=nodes.filter(node=>node instanceof api.audio.Delay);
  assert.deepEqual(delays.map(node=>node.options.delayTime),[1687/25000,1601/25000,2053/25000,2251/25000]);
  for(const [index,delay] of delays.entries()){
   const gain=delay.connections.find(edge=>edge.node instanceof api.audio.Gain).node;
   assert.ok(Math.abs(gain.gain.value-([.773,.802,.753,.733][index]-.733+roomSize*.93))<1e-12);
   assert.equal(gain.connections[0].node,delay,'feedback returns through a native Delay');
   assert.equal(delay.connections.find(edge=>edge.node instanceof api.audio.Merge).input,index<2?0:1);
  }
  assert.equal(room.input.connections[0].node,room.output.a,'dry path stays connected');
  assert.equal(room.wet,room.output.fade);assert.equal(room.wet.value,wet);
  room.wet.value=.3;assert.equal(room.output.fade.value,.3);
  room.dispose();assert.ok(nodes.every(node=>node.disposed),'all room and mix nodes are disposed');
 }
});
test('drop room wrapper retains its existing defaults',()=>{
 const {room,nodes}=nodesFor(()=>new api.DropChordAmbience());
 assert.equal(room.name,'DropChordAmbience');assert.equal(room.output.fade.value,.025);
 const first=nodes.find(node=>node instanceof api.audio.Delay);
 assert.ok(Math.abs(first.connections.find(edge=>edge.node instanceof api.audio.Gain).node.gain.value-(.773-.733+.12*.93))<1e-12);
});
test('the actual Roses live engines allocate no JS comb-filter reverbs, including the muted alternative chord bus',()=>{
 const {room:synth,nodes:synthNodes}=nodesFor(()=>new api.SynthEngine(api.presetSettings.roses));
 const {nodes:chordNodes}=nodesFor(()=>new api.RosesChordStabEngine());
 for(const nodes of [synthNodes,chordNodes])assert.equal(nodes.filter(node=>node instanceof api.audio.JCReverb).length,0);
 assert.equal(synthNodes.filter(node=>node instanceof api.audio.Delay).length,4);
 assert.equal(chordNodes.filter(node=>node instanceof api.audio.Delay).length,8,'native rooms for both original and Bonk choices');
 synth.setSettings({...api.presetSettings.roses,reverb:.27});
 const room=synthNodes.find(node=>node instanceof api.NativeRoomReverb);assert.equal(room.wet.value,.27);
});
