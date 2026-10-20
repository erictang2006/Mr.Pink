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
export class ToneAudioBuffer {async load(name){this.name=name;this.loaded=true;this.duration=name.includes('chord-cache')?22.9:name.includes('HiHat')?.25:name.includes('Kick')?.5355102041:.5671201814;}dispose(){this.disposed=true;}}
export class ToneBufferSource extends Gain {constructor(options){super();this.options=options;this.context={isOffline:false};}start(at,offset,duration,gain){events.push({kind:this.options.url.name.includes('chord-cache')?'chord-cache':'drum',name:this.options.url.name,at,offset,gain,source:this});}stop(at){this.stopAt=at;}dispose(){this.disposed=true;}}
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

test('original and Keys 6–8 chord rows play together and have independent volume, enable, mute and solo',async()=>{
 const engine=await fresh('cached');engine.start();engine.tick(144,10,.6);
 const original=engine.buses.get('chords'),bonk=engine.buses.get('bonkChords');
 assert.equal(original.gain.value,.32);assert.equal(bonk.gain.value,.32);
 const count=events.length;
 engine.setRow('bonkChords',{volume:.21});assert.equal(bonk.gain.value,.21);assert.equal(original.gain.value,.32);
 engine.setRow('chords',{muted:true});assert.equal(original.gain.value,0);assert.equal(bonk.gain.value,.21);
 engine.setRow('chords',{muted:false,solo:true});assert.equal(original.gain.value,.32);assert.equal(bonk.gain.value,0);
 engine.setRow('bonkChords',{solo:true});assert.equal(original.gain.value,0);assert.equal(bonk.gain.value,.21);
 assert.equal(engine.snapshot().rows.chords.solo,false);
 engine.setRow('bonkChords',{solo:false,enabled:false});assert.equal(bonk.gain.value,0);assert.equal(original.gain.value,.32);
 engine.allOn();assert.equal(original.gain.value,.32);assert.equal(bonk.gain.value,.21);
 engine.setChordLevel(1,.25);assert.equal(engine.chordBuses[1].gain.value,.25);assert.equal(engine.bonkChordBuses[1].gain.value,.25);
 engine.muteAll();assert.equal(original.gain.value,0);assert.equal(bonk.gain.value,0);
 engine.allOn();engine.resetVolumes();assert.equal(original.gain.value,.32);assert.equal(bonk.gain.value,.32);
 assert.equal(events.length,count,'mix changes do not restart either chord track or other instruments');
 engine.dispose();
});

test('default playback keeps both sound options synchronized with no real-time chord synth allocation',async()=>{
 events.length=0;setClock(0);
 const engine=new RosesDropAuditionEngine(()=>{});await engine.prepare();engine.start();
 assert.equal(engine.snapshot().chordPlayback,'cached');assert.equal(engine.chords.length,0);
 for(let beat=144;beat<=176;beat+=.25)engine.tick(beat,10+(beat-144)*.6,.6);
 const tracks=events.filter(e=>e.kind==='chord-cache');assert.equal(tracks.length,4);
 tracks.forEach((e,i)=>{near(e.at,10);assert.equal(e.offset,0);assert.equal(e.source.destination,engine.cachedChordBuses[i]);assert.equal(e.source.options.playbackRate,1);});
 assert.equal(events.filter(e=>e.kind==='chords').length,0);
 assert.ok(tracks.every(e=>!e.source.disposed),'tails finish after the bar-45 clock boundary');
 const count=events.length;engine.setChordLevel(0,.25);engine.setRow('chords',{muted:true});engine.setRow('chords',{muted:false});
 assert.equal(engine.chordBuses[0].gain.value,.25);assert.equal(events.length,count);
 engine.dispose();assert.ok(tracks.every(e=>e.source.disposed));
});

test('cached chords stop on pause/reset and resume at the current phrase offset without replaying the entrance',async()=>{
 const engine=await fresh('cached');engine.start();engine.tick(144,10,.6);
 const old=events.filter(e=>e.kind==='chord-cache');engine.pause();assert.ok(old.every(e=>e.source.disposed));
 engine.resume();engine.tick(144,11,.6);assert.equal(events.filter(e=>e.kind==='chord-cache').length,4);
 engine.tick(144.25,11.15,.6);
 const resumed=events.filter(e=>e.kind==='chord-cache').slice(4);assert.equal(resumed.length,4);
 resumed.forEach(e=>{near(e.offset,.15);near(e.at,11.15);});
 engine.stop();assert.ok(resumed.every(e=>e.source.disposed));
 engine.start();engine.tick(144,20,.6);assert.equal(events.filter(e=>e.kind==='chord-cache').length,12);
 engine.dispose();
});

test('playback diagnostics capture missed scheduling deadlines without stopping the clock',async()=>{
 const engine=await fresh('cached');engine.start();setClock(10.05);engine.tick(144,10,.6);
 near(engine.snapshot().maxLatenessMs,50);assert.equal(engine.snapshot().lateCallbacks,1);
 setClock(10.14);engine.tick(144.25,10.15,.6);assert.equal(engine.snapshot().lateCallbacks,1);
 assert.equal(engine.snapshot().status,'running');engine.stop();engine.start();
 assert.equal(engine.snapshot().lateCallbacks,0);assert.equal(engine.snapshot().maxLatenessMs,0);engine.dispose();setClock(0);
});

test('automatic playback buffers scheduling and restores the original clock after finish, stop and replay',async()=>{
 const engine=await fresh();
 engine.start();assert.equal(context.lookAhead,.2);assert.equal(context.updateInterval,.025);
 engine.start();engine.tick(176,20,.6);
 assert.equal(context.lookAhead,.1);assert.equal(context.updateInterval,.05);
 engine.start();engine.pause();engine.resume();engine.stop();
 assert.equal(context.lookAhead,.1);assert.equal(context.updateInterval,.05);
 context.lookAhead=.3;context.updateInterval=.01;
 engine.start();assert.equal(context.lookAhead,.3);assert.equal(context.updateInterval,.01);
 engine.dispose();assert.equal(context.lookAhead,.3);assert.equal(context.updateInterval,.01);
 context.lookAhead=.1;context.updateInterval=.05;
 context.isOffline=true;
 const offline=await fresh();offline.start();assert.equal(context.lookAhead,.1);assert.equal(context.updateInterval,.05);
 offline.dispose();context.isOffline=false;
});

test('explicit audition schedules four independent groups at exact source timestamps, including off-grid hats',async()=>{
 const engine=await fresh();engine.tick(144,0,.6);assert.equal(events.length,0,'never autoplays merely by loading');
 engine.start();for(let b=144;b<=180;b+=.25){engine.tick(b,(b-144)*.6,.6);engine.tick(b,(b-144)*.6,.6);}
 assert.deepEqual(['lead','bass','chords','drum'].map(k=>events.filter(e=>e.kind===k).length),[224,35,319,78]);
 const notes=events.filter(e=>e.kind==='bass'||e.kind==='chords');
 arrangement.notes.forEach((n,i)=>{const actual=notes[i];near(actual.at,(n.beat-144)*.6);near(actual.duration,n.duration*.6);assert.equal(actual.note,n.group==='bass'?n.midi:midiName(n.midi));if(n.group==='chords')assert.equal(actual.track,n.track);});
 const drums=events.filter(e=>e.kind==='drum');
 arrangement.drums.forEach((n,i)=>{near(drums[i].at,(n.beat-144)*.6);near(drums[i].gain,n.gain*n.velocity/127);});
 assert.ok(drums.filter(e=>e.name.includes('HiHat')).every(e=>e.at>=9.9-1e-9));
 assert.ok(events.every(e=>e.at<19.2));assert.equal(engine.snapshot().status,'done');
 assert.ok(events.filter(e=>e.voice).every(e=>!e.voice.disposed),'voices may finish their natural tails');
 engine.dispose();assert.ok(events.filter(e=>e.voice).every(e=>e.voice.disposed));
});

test('mixer mute, enable, solo, volume and individual drum controls update gains without retriggering',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,0,.6);const count=events.length;
 engine.setRow('bass',{muted:true});assert.equal(engine.buses.get('bass').gain.value,0);
 engine.setRow('bass',{muted:false,volume:.4});assert.equal(engine.buses.get('bass').gain.value,.4);
 engine.setRow('drums',{solo:true});
 for(const id of ['lead','bass','chords','bonkChords'])assert.equal(engine.buses.get(id).gain.value,0);
 assert.ok(engine.buses.get('drums').gain.value>0);
 engine.setRow('lead',{solo:true});assert.equal(engine.snapshot().rows.drums.solo,false);
 engine.setRow('lead',{solo:false});assert.ok(engine.buses.get('chords').gain.value>0);
 engine.muteDrum('hat',true);assert.equal(engine.drumBuses.get('hat').gain.value,0);assert.equal(engine.drumBuses.get('kick').gain.value,1);
 engine.setChordLevel(1,.25);assert.equal(engine.chordBuses[1].gain.value,.25);
 engine.setRow('chords',{enabled:false});assert.equal(engine.buses.get('chords').gain.value,0);
 engine.muteAll();for(const id of ['lead','bass','chords','bonkChords','drums'])assert.equal(engine.buses.get(id).gain.value,0);
 engine.allOn();engine.resetVolumes();assert.equal(engine.drumBuses.get('hat').gain.value,1);assert.equal(events.length,count,'mix changes do not replay any attack');
 assert.equal(engine.snapshot().rows.lead.volume,.65);engine.dispose();
});

test('stop/replay, pause/resume and late ticks cannot duplicate or retain voices',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,0,.6);const old=events.slice();
 engine.stop();assert.ok(old.filter(e=>e.voice).every(e=>e.voice.disposed));
 const count=events.length;engine.tick(145,.6,.6);assert.equal(events.length,count);
 engine.start();engine.tick(144,10,.6);const next=events.slice(count);assert.equal(next.length,old.length);
 engine.pause();engine.tick(144.25,11,.6);assert.equal(events.length,count+next.length);
 engine.resume();engine.tick(144,11.1,.6);assert.equal(events.length,count+next.length);
 engine.tick(144.25,11.25,.6);assert.ok(events.length>count+next.length);engine.dispose();
});


test('Brighter / Punchier selects only the prepared Original chord variant, including live A/B and replay', async()=>{
 const engine=await fresh('cached');
 assert.equal(engine.snapshot().chordPreset,'original');
 engine.setChordPreset('bright');engine.start();engine.tick(144,10,.6);
 let tracks=events.filter(e=>e.kind==='chord-cache');
 assert.deepEqual(tracks.map(e=>e.name.split('/').at(-1)),['brightA.wav','brightB.wav','bonkA.wav','bonkB.wav']);
 assert.equal(engine.chords.length,0,'the brighter preset never creates real-time chord synths');
 const bonk=tracks.slice(2),first=tracks.slice(0,2);
 engine.setChordPreset('original');engine.tick(144.25,10.15,.6);
 tracks=events.filter(e=>e.kind==='chord-cache');
 assert.equal(tracks.length,6,'only the two Original chord tracks change');
 assert.ok(first.every(e=>e.source.stopAt===10.15),'outgoing tracks fade at the handoff');
 assert.ok(bonk.every(e=>!e.source.disposed&&e.source.stopAt===undefined),'Bonk keeps playing uninterrupted');
 assert.deepEqual(tracks.slice(4).map(e=>e.name.split('/').at(-1)),['chordA.wav','chordB.wav']);
 tracks.slice(4).forEach(e=>{near(e.offset,.15);near(e.at,10.15);assert.equal(e.source.options.fadeIn,.01);});
 engine.setChordPreset('bright');engine.pause();engine.resume();engine.tick(144.5,11,.6);
 const resumed=events.filter(e=>e.kind==='chord-cache').slice(6);
 assert.deepEqual(resumed.map(e=>e.name.split('/').at(-1)),['brightA.wav','brightB.wav','bonkA.wav','bonkB.wav']);
 resumed.forEach(e=>near(e.offset,.3));
 engine.stop();engine.start();engine.tick(144,20,.6);
 const replay=events.filter(e=>e.kind==='chord-cache').slice(10);
 assert.equal(engine.snapshot().chordPreset,'bright');assert.equal(replay.length,4);replay.forEach(e=>near(e.offset,0));
 engine.dispose();assert.ok(events.filter(e=>e.kind==='chord-cache').every(e=>e.source.disposed));
});
