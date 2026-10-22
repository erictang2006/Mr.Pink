import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const mock=`
export const nodes=[],sources=[];
export class Gain {constructor(options={}){Object.assign(this,options);this.connections=[];nodes.push(this);}connect(node){this.connections.push(node);return this;}chain(){return this;}disconnect(){this.connections=[];}set(options){Object.assign(this,options);}dispose(){this.disposed=true;}}
export class Filter extends Gain {frequency={};}
export class FrequencyEnvelope extends Gain {triggerAttack(){}triggerRelease(){}}
export class AmplitudeEnvelope extends FrequencyEnvelope {}
export class Volume extends Gain {volume={value:0};}
export class ToneAudioBuffer {loaded=false;async load(){this.loaded=true;}dispose(){this.disposed=true;}}
export class ToneBufferSource extends Gain {constructor(options){super(options);this.context={isOffline:false};this.stopAt=Infinity;sources.push(this);}start(time){this.startAt=time;return this;}getStateAtTime(time){return time>=this.startAt&&time<this.stopAt?'started':'stopped';}stop(time){this.stopAt=time;}cancelStop(){this.stopAt=Infinity;}end(){this.onended();}}
`;
const bundle=await build({stdin:{contents:`export {SampledBonkVoice} from './src/piano/sampledBonkVoice';export {nodes,sources} from 'tone';export {rosesChordShortcuts} from './src/piano/rosesChords';export {hereWithMeChordShortcuts} from './src/piano/hereWithMeChords';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'tone',setup(b){b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock}));}}]});
const {SampledBonkVoice,nodes,sources,rosesChordShortcuts,hereWithMeChordShortcuts}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const options={filter:{},filterEnvelope:{},envelope:{release:.85},volume:-14};
test('rapid Bonk retriggers reuse their source, disconnect after release and reconnect cleanly',async()=>{
 const voice=new SampledBonkVoice(options,'sample.wav'),destination={};voice.connect(destination);
 const output=voice.output;assert.equal(output.connections.length,0,'idle filter graph must be disconnected');
 voice.triggerAttack('C4',0,.86);assert.equal(voice.source,undefined,'no unloaded audio');await voice.load();
 const count=sources.length;
 for(let i=0;i<200;i++){voice.triggerAttack('C4',1+i*.05,.86);voice.triggerRelease(1+i*.05+.025);}
 assert.equal(sources.length,count+1,'one buffer source, not 200 overlapping tails');assert.deepEqual(output.connections,[destination]);
 const source=voice.source;assert.ok(Number.isFinite(source.stopAt));source.end();assert.equal(source.disposed,true);assert.equal(voice.sources.size,0);assert.equal(output.connections.length,0);
 voice.triggerAttack('C4',20,.86);assert.deepEqual(output.connections,[destination]);assert.notEqual(voice.source,source);
 voice.set({envelope:{release:1.2},filterEnvelope:{baseFrequency:400},filter:{Q:1},volume:-10});voice.triggerRelease(20.1);
 assert.equal(voice.source.stopAt,21.32);assert.equal(voice.filterEnvelope.baseFrequency,400);assert.equal(voice.filter.Q,1);assert.equal(output.volume.value,-10);
 voice.dispose();assert.ok(voice.buffer.disposed&&voice.filter.disposed&&voice.envelope.disposed&&voice.output.disposed);assert.equal(voice.sources.size,0);
});
test('an old source ending cannot disconnect a new Bonk attack',async()=>{
 const voice=new SampledBonkVoice(options,'sample.wav').connect({});await voice.load();voice.triggerAttack('C4',1,.8);voice.triggerRelease(1.05);
 const old=voice.source;voice.triggerAttack('C4',3,.8);const current=voice.source;assert.notEqual(old,current);old.end();assert.equal(voice.source,current);assert.equal(voice.output.connections.length,1);voice.dispose();
});
test('prepared Bonk waves cover every current chord pitch, retain bank tuning and match renderer provenance',()=>{
 const base='public/roses/live-bonk-waves/',manifest=JSON.parse(readFileSync(base+'manifest.json'));
 const pitches=[...new Set(Object.values({...rosesChordShortcuts,...hereWithMeChordShortcuts}).flat())];
 const hash=data=>createHash('sha256').update(data).digest('hex');
 assert.equal(manifest.files.length,pitches.length*3);
 for(const [file,expected] of Object.entries(manifest.sourceHashes))assert.equal(hash(readFileSync(file)),expected,`stale source: ${file}`);
 for(const bank of ['left','right','center'])for(const midi of pitches){const entry=manifest.files.find(f=>f.bank===bank&&f.midi===midi);assert.ok(entry);const wave=readFileSync(base+entry.file);assert.equal(hash(wave),entry.sha256);assert.equal(wave.readUInt16LE(20),3,'float WAV preserves original over-unity oscillator peaks');assert.equal(wave.readUInt32LE(24),44100);assert.equal(entry.loopStart,1);assert.equal(entry.loopEnd,2.8);}
});
