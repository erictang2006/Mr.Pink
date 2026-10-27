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
   if(kind===9&&velocity)held.set(pitch,{tick,velocity,channel:status&15});
   if(kind===8||kind===9&&!velocity){const start=held.get(pitch);assert.ok(start);notes.push({beat:start.tick/ppq,midi:pitch,duration:(tick-start.tick)/ppq,velocity:start.velocity,channel:start.channel});held.delete(pitch);}
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
export class ToneAudioBuffer {async load(name){this.name=name;this.loaded=true;this.duration=name.includes('original-recording-8bars')?19.2:name.includes('subtle_echo_8bars')?19.2:name.includes('hwm-backing')?19.35:name.includes('chord-cache')?22.9:name.includes('HiHat')?.25:name.includes('Kick')?.5355102041:.5671201814;}dispose(){this.disposed=true;}}
export class ToneBufferSource extends Gain {constructor(options){super();this.options=options;this.context={isOffline:false};}start(at,offset,duration,gain){events.push({kind:this.options.url.name.includes('hwm-backing')?'hwm-backing':'drum',name:this.options.url.name,at,offset,duration,gain,source:this});}stop(at){this.stopAt=at;}dispose(){this.disposed=true;}}
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

const rosesEvents=()=>events.filter(e=>e.name?.includes('subtle_echo_8bars'));
test('approved finished Roses WAV is byte-identical to the supplied 24-bit stereo 8-bar render',()=>{
 const manifest=JSON.parse(readFileSync('reference/roses-drop-replacement/installed-audio.json'));
 const wav=readFileSync(manifest.file);
 assert.equal(createHash('sha256').update(wav).digest('hex'),'a0867b153a72ac813fc9e6951561f1968bc549ca4f647329f90be17ed4c1f600');
 assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt16LE(34),24);assert.equal(wav.readUInt32LE(24),44100);
 assert.equal(wav.readUInt32LE(40)/6,846720);near(846720/44100,(arrangement.endBeat-arrangement.startBeat)*.6);
 assert.ok(wav.subarray(-6).every(x=>x===0),'supplied end fade reaches silence without an extra tail');
 const bass=midiNotes('reference/roses-drop-replacement/roses_drop_chords_and_bass_8bars.mid').filter(n=>n.channel===1);
 assert.deepEqual([...new Set(bass.map(n=>n.midi%12))],[1,8,4],'C# → G# → E; no A bass');
});
test('Roses replaces every old instrumental route with one rate-1 finished mix; HWM lead remains separate',async()=>{
 const engine=await fresh();engine.setBackingSource('roses');engine.start();
 for(let beat=144;beat<=176;beat+=.25){engine.tick(beat,10+(beat-144)*.6,.6);engine.tick(beat,10+(beat-144)*.6,.6);}
 assert.equal(backingEvents().length,0);assert.equal(rosesEvents().length,1);
 const sample=rosesEvents()[0];near(sample.at,10);assert.equal(sample.offset,0);near(sample.duration,19.2);
 assert.equal(sample.source.options.playbackRate,1);assert.equal(sample.source.options.fadeIn,0);assert.equal(sample.source.options.fadeOut,0);
 assert.equal(sample.source.destination,engine.buses.get('chords'));
 assert.equal(events.some(e=>e.kind==='bass'||e.name?.includes('/chord-cache/')),false);
 assert.equal(events.filter(e=>e.source).length,1,'no old kick, clap, hat, stems or wet-only ambience underneath');
 assert.equal(events.filter(e=>e.kind==='lead').length,224);assert.equal(engine.snapshot().backingSource,'roses');assert.equal(engine.snapshot().status,'done');engine.dispose();
});
test('finished instrumental reuses existing gain/mute/solo controls and ignores hidden stem settings',async()=>{
 const engine=await fresh();engine.setRow('bass',{solo:true});engine.setBackingSource('roses');engine.setChordPreset('bright');engine.setChordLevel(0,1.5);
 engine.start();engine.tick(144,10,.6);const count=events.length;
 assert.equal(engine.buses.get('chords').gain.value,.32,'a hidden HWM bass solo cannot mute the Roses instrumental');
 for(const id of ['bass','bonkChords','drums'])assert.equal(engine.buses.get(id).gain.value,0);
 engine.setRow('chords',{volume:.7,solo:true});assert.equal(engine.buses.get('chords').gain.value,.7);assert.equal(engine.buses.get('lead').gain.value,0);
 engine.setChordPreset('original');engine.setChordLevel(1,0);engine.muteDrum('kick',true);engine.tick(144.25,10.15,.6);
 assert.equal(rosesEvents().length,1,'legacy timbre/percussion controls never restart or alter the finished WAV');
 engine.setRow('chords',{muted:true});assert.equal(engine.buses.get('chords').gain.value,0);
 engine.allOn();assert.equal(engine.buses.get('chords').gain.value,.7);engine.muteAll();assert.equal(engine.buses.get('chords').gain.value,0);
 engine.allOn();engine.resetVolumes();assert.equal(engine.buses.get('chords').gain.value,.32);assert.equal(events.length,count+4);engine.dispose();
});
test('Roses pause, seek, replay and source switches keep one instrumental and cancel queued old percussion',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,10,.6);const old=events.filter(e=>e.source);const banks=[...engine.lead.banks.values()];
 engine.setBackingSource('roses');assert.ok(old.every(e=>e.source.disposed));assert.deepEqual([...engine.lead.banks.values()],banks);
 engine.tick(145,10.6,.6);near(rosesEvents()[0].offset,.6);near(rosesEvents()[0].duration,18.6);
 engine.pause();assert.ok(rosesEvents()[0].source.disposed);engine.resume();engine.tick(145.25,11,.6);near(rosesEvents()[1].offset,.75);
 engine.pause();engine.setBackingSource('hwm');engine.setBackingSource('roses');assert.equal(rosesEvents().length,2,'no source starts while paused');
 engine.resume();engine.tick(145.5,12,.6);near(rosesEvents()[2].offset,.9);
 engine.setBackingSource('hwm');assert.ok(rosesEvents()[2].source.disposed);engine.tick(145.75,12.15,.6);backingEvents().slice(-2).forEach(e=>near(e.offset,1.05));
 engine.setBackingSource('roses');engine.stop();engine.start();engine.tick(144,20,.6);near(rosesEvents().at(-1).offset,0);
 engine.stop();const count=events.length;engine.tick(145,21,.6);assert.equal(events.length,count);assert.ok(rosesEvents().every(e=>e.source.disposed));engine.dispose();
});

const recordedEvents=()=>events.filter(e=>e.name?.includes('original-recording-8bars'));
test('recording optionally adds the exact four-bank HWM melody with separate level, mute and solo',async()=>{
 const engine=await fresh();engine.setBackingSource('recording');assert.equal(engine.snapshot().rows.lead.enabled,false);
 engine.setRow('lead',{enabled:true,volume:.7});engine.start();
 for(let beat=144;beat<=176;beat+=.25)engine.tick(beat,10+(beat-144)*.6,.6);
 const notes=events.filter(e=>e.kind==='lead');assert.equal(notes.length,224);assert.equal(recordedEvents().length,1);
 assert.equal(events.length,225,'one recording and the existing lead, with no added bass/chords/drums');
 assert.equal(new Set(notes.map(e=>e.voice)).size,4);
 const source=JSON.parse(readFileSync('reference/here-with-me-drop-lead/roses_37_52_here_with_me_lead_16bar_events.json')).events.filter(e=>e.repeat_index<2);
 source.forEach((n,i)=>{assert.equal(notes[i].note,midiName(n.midi_pitch+1));near(notes[i].at,10+n.start_seconds_relative_to_rose_bar37);near(notes[i].duration,n.duration_seconds);});
 near(engine.buses.get('lead').gain.value,.7);engine.setRow('lead',{muted:true});near(engine.buses.get('lead').gain.value,0);
 engine.setRow('lead',{muted:false,solo:true});near(engine.buses.get('recorded').gain.value,0);
 engine.setRow('lead',{solo:false});near(engine.buses.get('recorded').gain.value,.8);
 engine.stop();engine.start();assert.equal(engine.snapshot().rows.lead.enabled,true);engine.dispose();
});

test('optional recorded lead toggles and resumes in place without restarting audio or changing other modes enable state',async()=>{
 const engine=await fresh();engine.setRow('lead',{enabled:false});engine.setBackingSource('recording');engine.start();
 engine.tick(144,10,.6);engine.tick(152,14.8,.6);
 engine.setRow('lead',{enabled:true});const original=engine.lead;
 for(let b=152.25;b<=153;b+=.25)engine.tick(b,10+(b-144)*.6,.6);
 assert.ok(events.some(e=>e.kind==='lead'&&e.at>=14.95));assert.equal(recordedEvents().length,1);
 engine.setRow('lead',{enabled:false});assert.equal(engine.lead,undefined);assert.equal(original.banks.size,0);
 engine.setRow('lead',{enabled:true});engine.pause();engine.resume(153,16);
 engine.tick(153.25,16.15,.6);assert.equal(recordedEvents().length,2,'resume joins exactly one recording source');
 near(recordedEvents()[1].offset,5.4);
 engine.setBackingSource('hwm');assert.equal(engine.snapshot().rows.lead.enabled,false,'the separate original-mode enable setting was retained');
 engine.setBackingSource('recording');assert.equal(engine.snapshot().rows.lead.enabled,true);engine.dispose();
});
test('original recording is preloaded and plays alone at the selected offset with no live lead or old percussion',async()=>{
 for(const offset of [-500,-80,0,120,500]){
  const engine=await fresh();engine.setBackingSource('recording');engine.setRecordedOffset(offset);engine.start();
  for(let beat=140;beat<=176;beat+=.25){engine.tick(beat,10+(beat-144)*.6,.6);engine.tick(beat,10+(beat-144)*.6,.6);}
  assert.equal(recordedEvents().length,1);assert.equal(events.length,1,'exactly one prerecorded instrumental and zero synth notes or drum hits');
  const e=recordedEvents()[0];near(e.at,10+offset/1000);near(e.offset,0);near(e.duration+e.source.options.fadeOut,Math.min(19.2,19.2-offset/1000));
  assert.equal(e.source.options.playbackRate,1);assert.equal(e.source.destination,engine.buses.get('recorded'));assert.equal(engine.lead,undefined);
  assert.equal(engine.snapshot().status,'done');engine.dispose();assert.ok(e.source.disposed);
 }
});
test('direct starts at 37, 39 and 41 join the correct source position for every offset; mid-take edits wait for restart',async()=>{
 for(const entry of [144,152,160])for(const offset of [-500,0,500]){
  const engine=await fresh();engine.setBackingSource('recording');engine.setRecordedOffset(offset);engine.start();
  for(let beat=entry;beat<=entry+1;beat+=.25)engine.tick(beat,10+(beat-entry)*.6,.6);
  assert.equal(recordedEvents().length,1);const e=recordedEvents()[0];
  near(e.at,10+Math.max(0,offset/1000-(entry-144)*.6));near(e.offset,Math.max(0,(entry-144)*.6-offset/1000));
  engine.setRecordedOffset(200);assert.equal(engine.snapshot().activeRecordedOffsetMs,offset);assert.equal(recordedEvents().length,1);
  engine.pause();assert.ok(e.source.disposed);engine.resume();engine.tick(entry+1.25,11,.6);
  near(recordedEvents()[1].offset,(entry+1.25-144)*.6-offset/1000);
  engine.stop();engine.start();engine.tick(144,20,.6);engine.tick(144.25,20.15,.6);
  near(recordedEvents().at(-1).at,20.2);engine.dispose();
 }
});
test('switching to original recording cancels old instruments and switching back restores the same four lead banks',async()=>{
 const engine=await fresh();engine.start();engine.tick(144,10,.6);const old=events.slice();
 engine.setBackingSource('recording');assert.ok(old.filter(e=>e.source).every(e=>e.source.disposed));assert.ok(old.filter(e=>e.voice).every(e=>e.voice.disposed));
 engine.tick(145,10.6,.6);near(recordedEvents()[0].offset,.6);assert.equal(engine.lead,undefined);
 engine.setRow('recorded',{volume:.4,solo:true});assert.equal(engine.buses.get('recorded').gain.value,.4);
 engine.muteAll();assert.equal(engine.buses.get('recorded').gain.value,0);engine.allOn();assert.equal(engine.buses.get('recorded').gain.value,.4);
 engine.setBackingSource('hwm');assert.ok(recordedEvents()[0].source.disposed);engine.tick(145.25,10.75,.6);assert.equal(engine.lead.banks.size,4);
 backingEvents().slice(-2).forEach(e=>near(e.offset,.75));assert.equal(engine.buses.get('recorded').gain.value,0);engine.dispose();
});
test('recorded-drop offset, volume, and operator solo settings survive a fresh engine without changing backing modes',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}});
 try{
  const first=await fresh();first.setBackingSource('recording');first.setRecordedOffset(-83);first.setRow('recorded',{volume:2,solo:true});first.start();assert.equal(first.buses.get('recorded').gain.value,2);first.dispose();
  const second=await fresh();assert.equal(second.snapshot().recordedOffsetMs,-80);assert.equal(second.snapshot().rows.recorded.volume,2);assert.equal(second.snapshot().rows.recorded.solo,true);assert.equal(second.snapshot().backingSource,'hwm');second.setRow('chords',{volume:2});assert.equal(second.snapshot().rows.chords.volume,1);second.dispose();
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('official WAV extraction preserves source samples, stereo PCM24 level and the measured eight-bar phrase',()=>{
 const analysis=JSON.parse(readFileSync('reference/roses-original-recording/analysis.json'));
 const wav=readFileSync(analysis.output);
 assert.equal(createHash('sha256').update(wav).digest('hex'),analysis.sha256);
 assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt16LE(34),24);assert.equal(wav.readUInt32LE(24),44100);
 near(wav.readUInt32LE(40)/6/44100,19.2);assert.equal(analysis.inPointFrame,3833743);assert.equal(analysis.outPointFrame,4680463);
 assert.equal(analysis.normalization,false);assert.equal(analysis.pitchShiftSemitones,0);assert.equal(analysis.playbackRate,1);
 assert.equal(analysis.clapOnsetsSeconds.length,16);assert.ok(Math.abs(analysis.measuredBpm-100)<.01);assert.ok(analysis.maxTimingResidualSeconds<.001);
 assert.ok(wav.subarray(-6).every(x=>x===0));assert.ok(wav.subarray(44,50).every(x=>x===0));
 assert.equal(analysis.bodyDifferenceFromSource,0);assert.equal(analysis.sourceFullScaleSamplesInExtract,452,'existing source peaks are reported, not silently processed');
 const source=readFileSync(analysis.storedSource);assert.equal(createHash('sha256').update(source).digest('hex'),analysis.sourceSha256);
 // Independently compare native PCM16 source frames to the packed PCM24 body.
 const view=new DataView(source.buffer,source.byteOffset,source.byteLength);let at=12,dataOffset;
 while(at<source.length){const name=source.toString('ascii',at,at+4),size=view.getUint32(at+4,true);if(name==='data'){dataOffset=at+8;break;}at+=8+size+(size%2);}
 assert.ok(dataOffset);
 for(let frame=analysis.startRampSamples;frame<analysis.frames-441;frame+=997)for(let channel=0;channel<2;channel++){
  const sourceSample=source.readInt16LE(dataOffset+((analysis.inPointFrame+frame)*2+channel)*2);
  const index=44+(frame*2+channel)*3;
  const outputSample=(wav[index]|wav[index+1]<<8|wav[index+2]<<16)<<8>>8;
  assert.equal(outputSample,sourceSample*256,'source stereo body is preserved without DSP or resampling');
 }
});

test('the new source resets legacy MOV sync calibration once while retaining recorded volume',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const saved=new Map([['stage-piano-roses-recorded-drop-v1',JSON.stringify({offsetMs:-250,volume:1.25})]]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}});
 try{
  const first=await fresh();assert.equal(first.snapshot().recordedOffsetMs,0);assert.equal(first.snapshot().rows.recorded.volume,1.25);
  first.setRecordedOffset(120);first.dispose();const second=await fresh();assert.equal(second.snapshot().recordedOffsetMs,120);assert.equal(second.snapshot().rows.recorded.volume,1.25);second.dispose();
  assert.equal(JSON.parse(saved.get('stage-piano-roses-recorded-drop-v1')).offsetMs,-250);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
