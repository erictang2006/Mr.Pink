import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(options){const result=await build({bundle:true,platform:'node',format:'esm',write:false,...options});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);}
const tone=await load({stdin:{contents:`export {FatOscillator,Param,Oscillator,Synth} from 'tone';`,resolveDir:process.cwd()}});
const fixed=await load({stdin:{contents:`export {PitchFirstSynth} from './src/piano/pitchFirstSynth';export {Context} from 'tone';`,resolveDir:process.cwd()},plugins:[{name:'construction-boundary',setup(b){
 b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'probe'}));
 b.onLoad({filter:/.*/,namespace:'probe'},()=>({contents:`
 export class Context {
  time=42;_lookAhead=.2;updateInterval=.037;writes=[];
  get lookAhead(){return this._lookAhead;}
  set lookAhead(value){this.writes.push(value);this._lookAhead=value;this.updateInterval=value?value/2:.01;}
  now(){return this.time+this.lookAhead;}
  immediate(){return this.time;}
 }
 export const getContext=()=>{throw Error('Explicit context required by this test');};
 export class Synth {
  constructor(options){this.context=options.context;options.build?.(this.context);}
  _triggerEnvelopeAttack(time,velocity){this.events.push(['envelope',time,velocity]);}
 }`,loader:'js'}));
}}]});
const paramValue=Object.getOwnPropertyDescriptor(tone.Param.prototype,'value').set;
const spreadValue=Object.getOwnPropertyDescriptor(tone.FatOscillator.prototype,'spread').set;
function detunedPair(context){
 const children=[0,1].map(()=>{
  const signal={events:[],now:()=>context.now(),cancelScheduledValues(time){this.events=this.events.filter(event=>event.time<time);},setValueAtTime(value,time){this.events.push({value,time});}};
  Object.defineProperty(signal,'value',{set(value){paramValue.call(this,value);}});
  return {detune:signal};
 });
 const fat={_oscillators:children,_forEach:callback=>children.forEach(callback)};
 spreadValue.call(fat,24);
 return children.map(child=>child.detune.events.at(-1));
}
function context(){return {time:42,lookAhead:.2,immediate(){return this.time;},now(){return this.time+this.lookAhead;}};}

test('installed Tone spread setter defers cold detuning by the scheduler look-ahead',()=>{
 const events=detunedPair(context());
 assert.deepEqual(events,[{value:-12,time:42.2},{value:12,time:42.2}]);
});
test('installed saw-wave coefficients cancel the fundamental but retain the octave at zero spread',()=>{
 const [realA,imagA]=tone.Oscillator.prototype._getRealImaginary.call({},'sawtooth',0);
 const [realB,imagB]=tone.Oscillator.prototype._getRealImaginary.call({},'sawtooth',Math.PI);
 const amplitude=n=>Math.hypot(realA[n]+realB[n],imagA[n]+imagB[n]);
 assert.ok(amplitude(1)<1e-12);assert.ok(amplitude(2)>.6);
});
test('each cold Roses voice initializes spread immediately without altering the shared clock',()=>{
 const ctx=context();
 for(const note of ['E4','G#4','E4','F#4']){
  let detune;
  new fixed.PitchFirstSynth({context:ctx,build(voiceContext){assert.equal(ctx.now(),42.2);detune=detunedPair(voiceContext);}});
  assert.deepEqual(detune,[{value:-12,time:42},{value:12,time:42}],note);
  assert.equal(ctx.lookAhead,.2);
 }
});
test('construction failure restores the shared context clock',()=>{
 const ctx=context();assert.throws(()=>new fixed.PitchFirstSynth({context:ctx,build(){throw Error('failed');}}),/failed/);
 assert.equal(ctx.lookAhead,.2);
});
test('pitch and the unchanged envelope use exactly the requested time, with no startup delay',()=>{
 const voice={events:[],toSeconds:time=>time??42,setNote(note,time){this.events.push(['pitch',note,time]);},_triggerEnvelopeAttack:fixed.PitchFirstSynth.prototype._triggerEnvelopeAttack};
 // The subclass inherits Tone's normal envelope implementation unchanged.
 assert.equal(Object.hasOwn(fixed.PitchFirstSynth.prototype,'_triggerEnvelopeAttack'),false);
 for(const time of [42,88.25]){
  voice.events.length=0;fixed.PitchFirstSynth.prototype.triggerAttack.call(voice,'E4',time,.65);
  assert.deepEqual(voice.events,[['pitch','E4',time],['envelope',time,.65]]);
 }
});

test('voice creation never writes the shared clock or ticker, including failures and repeated notes',()=>{
 const ctx=new fixed.Context();
 for(let i=0;i<24;i++){
  const fail=i%2===0;let captured;
  const create=()=>new fixed.PitchFirstSynth({context:ctx,build(voiceContext){
   captured=voiceContext;
   assert.equal(voiceContext.now(),42);assert.equal(ctx.now(),42.2);
   assert.equal(voiceContext.lookAhead,.2);assert.equal(ctx.updateInterval,.037);
   if(fail)throw Error('failed');
  }});
  if(fail)assert.throws(create,/failed/);else create();
  assert.equal(ctx.lookAhead,.2);assert.equal(ctx.updateInterval,.037);
  assert.deepEqual(ctx.writes,[],'do not post any ticker changes while allocating voices');
  assert.equal(captured.now(),42.2,'after construction voice clocks follow the normal scheduler');
  const now=captured.now;assert.equal(now(),42.2,'detached calls preserve the underlying context');
 }
});

test('initialized voice context forwards later clock changes and binds native context methods to their owner',()=>{
 const ctx=new fixed.Context();let captured;
 const owned=new WeakSet([ctx]);
 ctx.createGain=function(){assert.ok(owned.has(this));return 'gain';};
 new fixed.PitchFirstSynth({context:ctx,build(voiceContext){captured=voiceContext;}});
 ctx.time=64;ctx.lookAhead=.15;
 assert.equal(captured.now(),64.15);assert.equal(captured.immediate(),64);
 assert.equal(captured.createGain(),'gain');
 assert.equal(captured.createGain,captured.createGain,'bind each method once');
});
