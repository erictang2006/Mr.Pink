import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const arrangement=JSON.parse(readFileSync('src/piano/rosesDropArrangement.json'));
function midiNotes(path) {
 const b=readFileSync(path),ppq=b.readUInt16BE(12),notes=[];let offset=14;
 const variable=()=>{let n=0,v;do{v=b[offset++];n=(n<<7)|(v&127);}while(v&128);return n;};
 while(offset<b.length){
  const end=offset+8+b.readUInt32BE(offset+4);offset+=8;let tick=0,running=0;const held=new Map();
  while(offset<end){
   tick+=variable();let status=b[offset];if(status&128){offset++;if(status<240)running=status;}else status=running;
   if(status===255){offset++;const n=variable();offset+=n;continue;}
   if(status===240||status===247){const n=variable();offset+=n;continue;}
   const kind=status>>4,pitch=b[offset++],velocity=kind===12||kind===13?0:b[offset++];
   if(kind===9&&velocity)held.set(pitch,{tick,velocity});
   if(kind===8||kind===9&&!velocity){const start=held.get(pitch);assert.ok(start);notes.push({beat:start.tick/ppq,midi:pitch,duration:(tick-start.tick)/ppq,velocity:start.velocity});held.delete(pitch);}
  }
  assert.equal(held.size,0);
 }
 return notes;
}
const tuple=n=>[n.beat,n.midi,n.duration,n.velocity].join(':');

test('bass and both chord tracks match independent source MIDI including the second-half trim',()=>{
 const bass=midiNotes('reference/roses-drop-bass/Roses_Actual_Drop_Bass_Bars37-44_100BPM.mid').map(n=>({...n,beat:n.beat+144}));
 assert.deepEqual(arrangement.notes.filter(n=>n.group==='bass').map(tuple).sort(),bass.map(tuple).sort());
 for(const [track,file] of [[39,'39_drop_chords_layer_A_first_clip.mid'],[53,'53_drop_chords_layer_B_first_clip.mid']]){
  const first=midiNotes('reference/roses-drop/exported_als_midi/'+file);
  const expected=[...first.map(n=>({...n,beat:n.beat+144})),...first.filter(n=>n.beat>=1).map(n=>({...n,beat:n.beat+160}))];
  assert.deepEqual(arrangement.notes.filter(n=>n.track===track).map(tuple).sort(),expected.map(tuple).sort());
 }
 assert.equal(arrangement.notes.filter(n=>n.beat>=160&&n.beat<161).length,0,'gap is not filled by a blind repeat');
 assert.deepEqual([45,39,53].map(t=>arrangement.notes.filter(n=>n.track===t).length),[35,142,177]);
});

test('the actual hi-hat sample and all 38 source notes preserve the late entry and 64th-note rolls',()=>{
 const reference=readFileSync('reference/roses-drop-drums/HiHat Closed 004 Crunk.wav');
 assert.deepEqual(readFileSync('public/roses/drop/HiHat Closed 004 Crunk.wav'),reference);
 assert.equal(createHash('sha256').update(reference).digest('hex'),'c9f30ff2b4d73b03f41960e504e03c54e9a59697af666fe4d155bab9cd1ccae6');
 const pattern=[.5,1,1.5,2,2.5,3,3.5,3.5625,3.625,3.6875,3.75,4.5,5,5.5,6,6.5,6.75,7,7.5];
 const hats=arrangement.drums.filter(n=>n.kind==='hat');
 assert.ok(hats.every(n=>n.midi===60&&n.velocity===100),'the root-60 sample plays at its original pitch');
 assert.deepEqual(readFileSync('public/roses/Roses Kick.wav'),readFileSync('reference/roses-bars29-36/original_samples/Roses Kick.wav'));
 assert.deepEqual(hats.map(n=>n.beat),[...pattern.map(b=>b+160),...pattern.map(b=>b+168)]);
 assert.equal(hats.length,38);assert.equal(hats[0].beat*.6,96.3);
 assert.equal(arrangement.drums.filter(n=>n.kind==='kick').length,24);
 assert.equal(arrangement.drums.filter(n=>n.kind==='clap').length,16);
 assert.ok(arrangement.drums.every(n=>n.beat>=144&&n.beat<176));
});

const toneMock=`
export const events=[],nodes=[];
class Param {constructor(value=0){this.value=value;} rampTo(value){this.value=value;} setValueAtTime(value){this.value=value;this.attackValue=value;} linearRampToValueAtTime(value){this.value=value;} cancelAndHoldAtTime(){}}
export class Gain {constructor(value){this.gain=new Param(value);nodes.push(this);}connect(dest){this.destination=dest;return this;}toDestination(){return this;}disconnect(){this.destination=undefined;return this;}dispose(){this.disposed=true;}}
export class Compressor extends Gain {} export class Volume extends Gain {constructor(value){super();this.volume=new Param(value);}}
export class Limiter extends Gain {} export class WaveShaper extends Gain {} export class Filter extends Gain {} export class Panner extends Gain {} export class Synth {}
export class PolySynth extends Gain {constructor(type,options){super();this.options=options;this.volume=new Param(options.volume);}triggerAttackRelease(note,duration,at,velocity){events.push({kind:'lead',note,duration,at,velocity,voice:this});}}
export class ToneAudioBuffer {async load(name){this.name=name;this.loaded=true;this.duration=name.includes('hwm-backing')?19.35:name.includes('chord-cache')?22.9:name.includes('HiHat')?.25:name.includes('Kick')?.5355102041:.5671201814;}dispose(){this.disposed=true;}}
export class ToneBufferSource extends Gain {constructor(options){super();this.options=options;this.context={isOffline:false};}start(at,offset,duration,gain){events.push({kind:this.options.url.name.includes('hwm-backing')?'hwm-backing':'drum',name:this.options.url.name,at,offset,gain,source:this});}stop(at){this.stopAt=at;}dispose(){this.disposed=true;}}
export let clockTime=0;export const setClock=value=>clockTime=value;
export const immediate=()=>clockTime,now=immediate;
export const context={lookAhead:.1,updateInterval:.05,isOffline:false},getContext=()=>context;
`;
const bassMock=`import {events} from 'tone';export class RosesBassEngine {constructor(output){this.output=output;}setMaster(){}setVolumes(){}triggerExact(notes,at,spb){for(const n of notes)events.push({kind:'bass',note:n.midi,duration:n.durationBeats*spb,at,velocity:n.velocity,voice:this});}dispose(){this.disposed=true;}}`;
const chordMock=`import {events} from 'tone';let id=0;export class RosesDropLayers {constructor(){this.id=id++%2;}connect(output){this.output=output;}setSettings(){}triggerAttackRelease(note,duration,at,velocity){events.push({kind:'chords',track:this.id===0?39:53,note,duration,at,velocity,voice:this});}dispose(){this.disposed=true;}}`;
const bundle=await build({stdin:{contents:`export { RosesDropAuditionEngine } from './src/piano/rosesDropAuditionEngine'; export * from 'tone';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'audio',setup(b){b.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));b.onResolve({filter:/rosesBassEngine$/},()=>({path:'bass',namespace:'mock'}));b.onResolve({filter:/rosesDropLayers$/},()=>({path:'chords',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='tone'?toneMock:a.path==='bass'?bassMock:chordMock}));}}]});
const {RosesDropAuditionEngine,events,context,setClock}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} == ${b}`);
const midiName=n=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12]+(Math.floor(n/12)-1);
async function fresh(mode='synth'){events.length=0;setClock(0);const engine=new RosesDropAuditionEngine(()=>{},mode);await engine.prepare();return engine;}

test('prepared chord tracks match the source MIDI and synth inputs, with unmodified float audio and finished tails',()=>{
 for(const [mode,track] of [['chordA',39],['chordB',53],['bonkA',39],['bonkB',53],['brightA',39],['brightB',53]]){
  const root='public/roses/drop/chord-cache/';
  const manifest=JSON.parse(readFileSync(root+mode+'-verification.json'));
  assert.deepEqual(manifest.notes,arrangement.notes.filter(n=>n.track===track));
  for(const [file,hash] of Object.entries(manifest.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,file+' requires cache regeneration');
  const audio=readFileSync(root+mode+'.wav');
  assert.equal(createHash('sha256').update(audio).digest('hex'),manifest.audioSha256);
  assert.equal(audio.readUInt16LE(20),3,'float WAV retains synth peaks without normalization or clipping');
  assert.equal(audio.readUInt16LE(22),2);assert.equal(audio.readUInt32LE(24),44100);
  assert.equal(manifest.prerollRemovedSeconds,.1);assert.equal(manifest.seconds,mode.startsWith('bright')?25.9:22.9);
  assert.ok(manifest.finite&&manifest.tail<1e-6);
  if(mode.startsWith('bonk')){
   const notes=arrangement.notes.filter(n=>n.track===track);
   const expected=[...new Set(notes.map(n=>n.beat))].map(beat=>({beat,root:Math.min(...notes.filter(n=>n.beat===beat).map(n=>n.midi)),velocity:.9}));
   assert.deepEqual(manifest.impacts,expected,'one recorded Bonk per source chord onset, not per chord tone');
  }
 }
});

const backingEvents=()=>events.filter(e=>e.kind==='hwm-backing');
test('final drop plays E-major HWM source harmony and bass, one four-bank lead and unchanged Roses percussion',async()=>{
 const engine=await fresh();engine.tick(144,0,.6);assert.equal(events.length,0);
 engine.start();for(let beat=144;beat<=180;beat+=.25){engine.tick(beat,10+(beat-144)*.6,.6);engine.tick(beat,10+(beat-144)*.6,.6);}
 const lead=events.filter(e=>e.kind==='lead');assert.equal(lead.length,224);
 const original=JSON.parse(readFileSync('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json')).events.filter(e=>e.repeat_index<2);
 original.forEach((note,i)=>{assert.equal(lead[i].note,midiName(note.midi_pitch+1));near(lead[i].at,10+note.start_seconds_relative_to_rose_bar37);near(lead[i].duration,note.duration_seconds);});
 assert.equal(new Set(lead.map(e=>e.voice)).size,4);
 assert.deepEqual(backingEvents().map(e=>e.name),['/roses/hwm-backing/drop-instrumental-chords.wav','/roses/hwm-backing/drop-bass.wav']);
 backingEvents().forEach(e=>{near(e.at,10);assert.equal(e.offset,0);assert.equal(e.source.options.playbackRate,1);});
 assert.equal(events.some(e=>['bass','chords','chord-cache'].includes(e.kind)),false,'no original Roses harmonic scheduling');
 const drums=events.filter(e=>e.kind==='drum');assert.equal(drums.length,78);
 arrangement.drums.forEach((n,i)=>{near(drums[i].at,10+(n.beat-144)*.6);near(drums[i].gain,n.gain*n.velocity/127);assert.equal(drums[i].source.options.playbackRate,undefined);});
 assert.equal(engine.snapshot().status,'done');engine.dispose();assert.ok(lead.every(e=>e.voice.disposed));
});
test('stale stabs, Bonk and chord preset requests cannot add conflicting harmony',async()=>{
 const engine=await fresh();engine.setLeadSound('loud-stabs');engine.setChordPreset('bright');engine.setRow('bonkChords',{enabled:true,solo:true});engine.allOn();
 engine.start();engine.tick(144,10,.6);engine.setLeadSound('loud-stabs');engine.tick(144.25,10.15,.6);
 assert.equal(engine.snapshot().leadSound,'original');assert.equal(engine.snapshot().rows.bonkChords.enabled,false);
 assert.equal(events.filter(e=>e.kind==='lead').length,8);assert.equal(new Set(events.filter(e=>e.voice).map(e=>e.voice)).size,4);
 assert.equal(events.some(e=>e.name?.includes('loud-stabs')||e.name?.includes('chord-cache')),false);engine.dispose();
});
test('pause, resume, stop and replay cancel sources and preserve the phrase offset without duplicate notes',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,10,.6);const first=events.slice();
 engine.pause();assert.ok(first.filter(e=>e.source).every(e=>e.source.disposed));assert.ok(first.filter(e=>e.voice).every(e=>e.voice.disposed));
 engine.resume();engine.tick(144,11,.6);assert.equal(backingEvents().length,2);
 engine.tick(144.25,11.15,.6);assert.equal(backingEvents().length,4);backingEvents().slice(2).forEach(e=>near(e.offset,.15));
 assert.equal(events.filter(e=>e.kind==='lead').length,8);
 engine.stop();const count=events.length;engine.tick(145,12,.6);assert.equal(events.length,count);
 engine.start();engine.tick(144,20,.6);assert.equal(backingEvents().length,6);backingEvents().slice(4).forEach(e=>assert.equal(e.offset,0));engine.dispose();
});
test('mute, solo, enable, volume and drum controls operate without replaying audio',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,10,.6);const count=events.length;
 engine.setRow('bass',{muted:true});assert.equal(engine.buses.get('bass').gain.value,0);
 engine.setRow('bass',{muted:false,volume:.4});assert.equal(engine.buses.get('bass').gain.value,.4);
 engine.setRow('drums',{solo:true});for(const id of ['lead','bass','chords','bonkChords'])assert.equal(engine.buses.get(id).gain.value,0);
 engine.setRow('lead',{solo:true});assert.equal(engine.snapshot().rows.drums.solo,false);
 engine.setRow('lead',{solo:false});assert.ok(engine.buses.get('chords').gain.value>0);
 engine.muteDrum('hat',true);assert.equal(engine.drumBuses.get('hat').gain.value,0);assert.equal(engine.drumBuses.get('kick').gain.value,1);
 engine.muteAll();for(const bus of engine.buses.values())assert.equal(bus.gain.value,0);
 engine.allOn();engine.resetVolumes();assert.equal(engine.drumBuses.get('hat').gain.value,1);assert.equal(events.length,count);engine.dispose();
});
test('scheduling margin restores on finish, stop and replay and diagnostics report late callbacks',async()=>{
 context.lookAhead=.1;context.updateInterval=.05;
 const engine=await fresh();engine.start();assert.equal(context.lookAhead,.2);assert.equal(context.updateInterval,.025);
 setClock(10.05);engine.tick(144,10,.6);near(engine.snapshot().maxLatenessMs,50);
 engine.start();engine.tick(176,20,.6);assert.equal(context.lookAhead,.1);assert.equal(context.updateInterval,.05);
 engine.start();engine.pause();engine.resume();engine.stop();assert.equal(context.lookAhead,.1);assert.equal(context.updateInterval,.05);engine.dispose();setClock(0);
});

test('restored Roses backing schedules its original bass MIDI and both cached chord sounds without HWM harmony',async()=>{
 const engine=await fresh();engine.setBackingSource('roses');engine.start();
 for(let beat=144;beat<=176;beat+=.25)engine.tick(beat,10+(beat-144)*.6,.6);
 assert.equal(backingEvents().length,0);
 const bass=events.filter(e=>e.kind==='bass');const expected=arrangement.notes.filter(e=>e.group==='bass');assert.equal(bass.length,35);
 expected.forEach((n,i)=>{assert.equal(bass[i].note,n.midi);near(bass[i].at,10+(n.beat-144)*.6);near(bass[i].duration,n.duration*.6);});
 const tracks=events.filter(e=>e.name?.includes('/chord-cache/'));assert.deepEqual(tracks.map(e=>e.name.split('/').at(-1)),['chordA.wav','chordB.wav','bonkA.wav','bonkB.wav']);
 tracks.forEach(e=>{near(e.at,10);assert.equal(e.offset,0);assert.equal(e.source.options.playbackRate,1);});
 assert.equal(events.filter(e=>e.kind==='lead').length,224);assert.equal(engine.snapshot().backingSource,'roses');
 engine.dispose();assert.ok(bass.every(e=>e.voice.disposed));
});
test('Roses preset, separate chord-row controls and replay retain source choice and timing',async()=>{
 const engine=await fresh();engine.setBackingSource('roses');engine.setChordPreset('bright');engine.setChordLevel(0,.7);engine.start();engine.tick(144,10,.6);
 assert.equal(engine.chordBuses[0].gain.value,.7);assert.equal(engine.chordBuses[2].gain.value,.7);
 assert.equal(engine.buses.get('bonkChords').gain.value,.32);engine.setRow('bonkChords',{solo:true,volume:.4});assert.equal(engine.buses.get('chords').gain.value,0);assert.equal(engine.buses.get('bonkChords').gain.value,.4);
 engine.setRow('bonkChords',{solo:false,enabled:false});assert.equal(engine.buses.get('bonkChords').gain.value,0);
 engine.stop();engine.start();engine.tick(144,20,.6);assert.equal(engine.snapshot().backingSource,'roses');assert.equal(engine.snapshot().chordPreset,'bright');
 assert.deepEqual(events.filter(e=>e.name?.includes('/chord-cache/')).slice(-4).map(e=>e.name.split('/').at(-1)),['brightA.wav','brightB.wav','bonkA.wav','bonkB.wav']);engine.dispose();
});
test('backing source changes and paused changes cancel old harmony, retain lead voices and join at the current offset',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,10,.6);const old=backingEvents();const banks=[...engine.lead.banks.values()];
 engine.setBackingSource('roses');assert.ok(old.every(e=>e.source.disposed));assert.deepEqual([...engine.lead.banks.values()],banks);
 engine.tick(145,10.6,.6);events.filter(e=>e.name?.includes('/chord-cache/')).forEach(e=>near(e.offset,.6));
 engine.pause();engine.setBackingSource('hwm');engine.setBackingSource('roses');const bass=engine.rosesBass;
 engine.resume();assert.equal(engine.rosesBass,bass,'resume cannot create a second bass engine');engine.tick(145.25,11,.6);
 engine.setBackingSource('hwm');assert.ok(bass.disposed);engine.tick(145.5,11.15,.6);backingEvents().slice(-2).forEach(e=>near(e.offset,.9));
 assert.equal(engine.buses.get('bonkChords').gain.value,0);assert.equal(engine.snapshot().leadSound,'original');engine.dispose();
});
