import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

test('Ableton confirms the bar-25 guitar repeat and the unrestarted bar-23 chop tail', () => {
  const xml = gunzipSync(readFileSync('docs/roses-reference/roses_bars25_to28_source.als')).toString();
  const tracks = [...xml.matchAll(/<AudioTrack\b[^>]*>[\s\S]*?<\/AudioTrack>/g)].map(match => match[0]);
  const value = (block, tag) => block.match(new RegExp(`<${tag}\\s+Value="([^"]+)"`))?.[1];
  for (const [name, pan, end] of [['Guitar L', -.6, 112.03121696012322], ['Guitar R', .605, 112]]) {
    const track = tracks.find(track => value(track, 'EffectiveName') === name);
    assert.ok(track, name);
    const clip = [...track.matchAll(/<AudioClip\b[^>]*>[\s\S]*?<\/AudioClip>/g)].map(match => match[0]).find(clip => Number(value(clip, 'CurrentStart')) === 96);
    assert.ok(clip);
    assert.ok(Math.abs(Number(value(clip, 'CurrentEnd')) - end) < 1e-7);
    assert.equal(value(clip, 'IsWarped'), 'false');
    assert.equal(value(clip, 'PitchCoarse'), '0');
    assert.ok(Math.abs(Number(track.match(/<Pan>[\s\S]*?<Manual Value="([^"]+)"/)?.[1]) - pan) < 1e-6);
  }
  const chopTrack = tracks.find(track => value(track, 'EffectiveName') === '25-Audio');
  const clips = [...chopTrack.matchAll(/<AudioClip\b[^>]*>[\s\S]*?<\/AudioClip>/g)].map(match => match[0]);
  assert.equal(clips.some(clip => Number(value(clip, 'CurrentStart')) === 96), false, 'there is no new chop clip at bar 25');
  assert.ok(Number(value(clips.find(clip => Number(value(clip, 'CurrentStart')) === 88), 'CurrentEnd')) > 96);
  assert.equal(Number(value(clips.find(clip => Number(value(clip, 'CurrentStart')) === 104), 'CurrentEnd')), 112);
  for (const [file, hash] of [
    ['Guitar build up bass compliment.wav', 'c065cfaaa4cb678332b32d323cbd91db7aebdc7cc9014d7516681712b0935056'],
    ['aah vocal chop loop 2.wav', '2cd6845e18fa44de33505d67da2ea895b9995c9a57f1e289141d265f8665ddbe'],
  ]) assert.equal(createHash('sha256').update(readFileSync(`public/roses/${file}`)).digest('hex'), hash);
});

const toneMock = `
export const events = [], sampleSources = [];
let time = 0, repeat;
let draws = [];
export const immediate = () => time;
export const now = () => time;
export function clearEvents() { events.length = 0; sampleSources.length = 0; time = 0; draws = []; }
export function flushDraw(at) { time = at; const due = draws.filter(d => d.at <= at); draws = draws.filter(d => d.at > at); for(const draw of due) draw.callback(); }
export function advance(at) { time = at; repeat?.(at); flushDraw(at); }
class Param {
  rampTo(value, duration) { this.value=value; events.push({ kind:'gain-ramp', value, duration }); }
  cancelScheduledValues() {}
  setValueAtTime() {}
  cancelAndHoldAtTime() {}
  linearRampToValueAtTime(value, at) { events.push({ kind:'gain-linear', value, at }); }
}
export class Gain { constructor(value=1) { this.gain = new Param(); this.gain.value=value; } connect(destination) { this.destination=destination; return this; } chain() { return this; } toDestination() { return this; } disconnect() {this.destination=undefined;return this;} dispose() { this.disposed=true; } }
export class Volume extends Gain { constructor() { super(); this.volume = new Param(); } toDestination() { return this; } }
export class ToneAudioNode extends Gain {}
export const getContext=()=>({lookAhead:.1,updateInterval:.05,isOffline:false});
export class CrossFade extends Gain { constructor() { super(); this.a = new Gain(); this.b = new Gain(); } }
export class Split extends Gain {} export class Merge extends Gain {} export class Delay extends Gain {}
export class Filter extends Gain {constructor(){super();this.frequency=new Param();}} export class EQ3 extends Gain {} export class Compressor extends Gain {} export class WaveShaper extends Gain {} export class Limiter extends Gain {} export class Distortion extends Gain {} export class JCReverb extends Gain {}
export class ToneAudioBuffer {
 constructor() { this.duration=0; }
 async load(name) {this.name=name;this.loaded=true;this.duration=name.includes('original-recording-8bars')?19.2:name.includes('subtle_echo_8bars')?19.2:name.includes('/hybrid/riser-')?2.28:name.includes('/hybrid/')?19.2:name.includes('hwm-backing')?19.35:name.includes('chord-cache')?22.9:name.includes('single-E4')?.785011:name.includes('Vox')?10.987506:name.includes('aah')?6.868753:name.includes('spacy')?.876485:name.includes('snap')?.474694:.179955;}
 dispose() {}
}
export class ToneBufferSource extends Gain {
 constructor(options){super();this.options=options;sampleSources.push(this);}
 start(at,offset,duration,gain){events.push({kind:'buildup-sample',name:this.options.url.name,at,offset,gain,rate:this.options.playbackRate,dropBacking:!!this.destination?.dropBacking});}
 stop(at){events.push({kind:'buildup-stop',name:this.options.url.name,at});} 
}
export class Panner extends Gain { constructor(pan) { super(); this.pan = pan; } }
export class Player {
  constructor(options) {
    const url = options.url;
    this.name = typeof url === 'string' ? url : url.name;
    this.buffer = typeof url === 'object' ? url : { name:url, duration:url.includes('Guitar') ? 9.6187301587 : url.includes('chop loop') ? 6.868752834 : url.includes('vocals_original') ? 226.76898 : 32 };
    events.push({kind:'load', name:this.name});
    this.volume = options.volume ?? 0; this.playbackRate = options.playbackRate ?? 1;
    queueMicrotask(() => options.onload?.());
  }
  connect(destination) { this.destination = destination; return this; }
  start(at, offset=0, duration) { events.push({ kind:'start', name:this.name, at, offset, duration, rate:this.playbackRate, pan:this.destination?.pan }); }
  stop(at=time) { events.push({ kind:'stop', name:this.name, at }); }
  dispose() {}
}
export class Players extends Gain {
  constructor(options) { super(); queueMicrotask(options.onload); }
  player(name) { return { start(at) { events.push({ kind:'drum', name, at }); } }; }
  stopAll() {}
}
export class Sampler extends Gain { constructor(options) { super(); events.push({kind:'sampler-load'}); queueMicrotask(options.onload); } triggerAttackRelease() { events.push({kind:'sample-trigger'}); } releaseAll() {} }
export class Synth extends Gain { triggerAttackRelease() {} }
export class PolySynth extends Gain {
  constructor(type, options) { super(); this.options=options; this.volume=new Param(); }
  triggerAttackRelease(note, duration, at, velocity) { events.push({kind:'drop-lead', note, duration, at, velocity, voice:this}); }
  triggerAttack(note,at,velocity){events.push({kind:'manual-build-lead-on',note,at,velocity,voice:this});}
  triggerRelease(note,at){events.push({kind:'manual-build-lead-off',note,at,voice:this});}
  dispose() { this.disposed=true; }
  set() {}
}
export const Draw = { schedule(callback, at) { draws.push({callback, at}); } };
export const Transport = {
  PPQ:192, ticks:0, position:0, timeSignature:4,
  bpm:{ value:100, rampTo(value) { this.value=value; } },
  scheduleRepeat(callback) { repeat=callback; return 1; }, clear() { repeat=undefined; },
  start(at) { events.push({kind:'transport-start', at}); },
  stop(at=time) { events.push({kind:'transport-stop', at}); }, pause() {}
};
`;
const bassMock = `
import { events } from 'tone';
export class RosesBassEngine {
  setMaster() {} setVolumes() {} dispose() {}
  setBuildGain(value,at) { events.push({kind:'build-gain',value,at}); }
  releaseAll(at) { events.push({kind:'bass-release', at}); }
  attackManual(midi) { events.push({kind:'manual-bass-on',midi}); }
  releaseManual(midi) { events.push({kind:'manual-bass-off',midi}); }
  releaseManualNotes(at) { events.push({kind:'manual-bass-release',at}); }
  trigger() {}
  triggerExact(notes, at, spb) {for(const note of notes)events.push({kind:'audition-bass',midi:note.midi,at,duration:note.durationBeats*spb});}
  triggerBuild(notes, at, secondsPerBeat) { for(const note of notes) events.push({kind:'build-note', midi:note.midi, at, beats:note.durationBeats, secondsPerBeat}); }
}
`;
const bundled = await build({
  stdin: { contents: 'export { finalizedRosesBuildup, finalizedRosesDrop } from "./src/piano/rosesAudioSelection"; export { RosesIntroEngine } from "./src/piano/rosesIntroEngine.ts"; export { validBuildupSettings, defaultBuildupSettings } from "./src/piano/rosesBuildup.ts"; export { events, sampleSources, clearEvents, advance, flushDraw, Transport } from "tone";', resolveDir: process.cwd() },
  bundle:true, platform:'node', format:'esm', write:false,
  plugins:[{ name:'audio-clock', setup(build) {
    build.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));
    build.onResolve({filter:/rosesBassEngine$/},()=>({path:'bass',namespace:'mock'}));
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='tone'?toneMock:bassMock,loader:'js'}));
  }}],
});
const audio = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const dropSamples=()=>audio.events.filter(e=>e.kind==='buildup-sample'&&e.dropBacking);
const bassSamples=()=>dropSamples().filter(e=>e.name.endsWith('/drop-bass.wav'));

async function createEngine(finalized = false) {
  audio.clearEvents();
  const engine = new audio.RosesIntroEngine({ isPlayable:()=>true, stopLoop() {}, triggerLoopNote() {} },()=>{},()=>4);
  if(finalized){
    engine.setBackingMode(audio.finalizedRosesBuildup.value);
    engine.setDropBackingSource(audio.finalizedRosesDrop.value);
  }
  await engine.load();
  if(!finalized)engine.setBackingMode("roses");
  const startDrop=engine.drop.start.bind(engine.drop);
  engine.drop.start=(...args)=>{startDrop(...args);for(const bus of engine.drop.buses.values())bus.dropBacking=true;};
  return engine;
}

test('removed F6 build stays silent across bars 21–28 while the vocal and transport continue', async () => {
  const engine=await createEngine();
  engine.armBuild(); engine.startAt(21,'performance');
  let bar25;
  for(let tick=0;tick<=128;tick++) {
    audio.advance(10+tick*.15);
    if(tick===64) bar25=engine.snapshot();
  }
  const guitars=audio.events.filter(event=>event.kind==='start'&&event.name.includes('Guitar'));
  assert.equal(guitars.length,0);
  assert.equal(audio.events.some(event => event.kind === 'start' && (event.name?.includes('chop loop') || event.name?.includes('ah intro sample')) || event.kind === 'sampler-load' || event.kind === 'sample-trigger'), false, 'neither chop layer is loaded or played');
  assert.equal(bar25.buildActive,false);assert.equal(bar25.buildPending,false);
  assert.deepEqual(audio.events.filter(event=>event.kind==='build-note').map(event=>[event.midi,event.beats,Number(event.at.toFixed(2))]),[]);
  assert.equal(audio.events.filter(event=>event.kind==='transport-start').length,1);
  assert.equal(audio.events.filter(event=>event.kind==='transport-stop'&&event.at>0).length,0);
  assert.equal(audio.events.filter(event=>event.kind==='drum').length,0);
  assert.equal(engine.snapshot().measure,29);
  assert.equal(engine.snapshot().status,'running');
  assert.equal(engine.snapshot().closerStatus,'PLAYING','the vocal continues across the section boundary');
  assert.equal(audio.events.some(event=>event.kind==='stop'&&event.at>=10&&event.name.includes('Guitar')),false,'guitar tails are not truncated by FINISHED');
  engine.dispose();
});

test('jumping directly to bar 25 cannot revive removed guitar or build bass', async () => {
  const engine=await createEngine();
  engine.armBuild(); engine.startAt(25,'performance');
  for(let tick=0;tick<=64;tick++)audio.advance(10+tick*.15);
  assert.equal(audio.events.some(event=>event.kind==='start'&&event.name.includes('chop loop')),false);
  assert.equal(audio.events.filter(event=>event.kind==='build-note').length,0);
  assert.equal(audio.events.some(event=>event.kind==='start'&&event.name.includes('Guitar')),false);
  engine.dispose();
});

test('explicit bar-25 backing and lead audition hands off at bars 29 and 37 with the vocal cue intact', async () => {
  const engine = await createEngine();
  assert.equal(await engine.rehearseFrom25('timed'), true);
  assert.equal(engine.snapshot().buildPending, false);
  assert.equal(engine.snapshot().buildup.status, 'ARMED');
  assert.equal(engine.snapshot().lead.status, 'OFF');
  assert.equal(engine.snapshot().drop.status, 'running');
  for (let tick = 0; tick <= 192; tick++) audio.advance(10 + tick * .15);
  const guitar = audio.events.filter(e => e.kind === 'start' && e.name.includes('Guitar'));
  assert.equal(guitar.length, 0);
  const build = audio.events.filter(e => e.kind === 'buildup-sample');
  assert.ok(Math.abs(build[0].at - 19.6) < 1e-9, 'buildup starts at bar 29, four bars after 25');
  assert.equal(build.filter(e => e.name.includes('Vox synth')).length, 2);
  assert.equal(build.filter(e => e.name.includes('spacy drum')).length, 40);
  assert.equal(build.filter(e => e.name.includes('Snare Drum')).length, 32);
  assert.deepEqual(audio.events.filter(e => e.kind === 'build-note').map(e => e.midi), [49, 45, 40, 49, 45, 40]);
  const vocal = audio.events.filter(e => e.kind === 'start' && e.name.includes('here_with_me'));
  assert.equal(vocal.length, 1);
  assert.ok(Math.abs(vocal[0].at - 14.98) < 1e-9, 'default bar-27 pickup stays at its original cue');
  assert.equal(engine.snapshot().buildup.status, 'FINISHED');
  assert.equal(engine.snapshot().lead.status, 'OFF');
  assert.equal(engine.snapshot().drop.status, 'running');
  const lead = audio.events.filter(e => e.kind === 'drop-lead');
  assert.equal(lead.length, 4);
  assert.ok(lead.every(e => Math.abs(e.at - 38.8) < 1e-9), 'lead enters at bar 37 after the full buildup');
  for (let tick = 193; tick <= 448; tick++) audio.advance(10 + tick * .15);
  assert.equal(audio.events.filter(e => e.kind === 'drop-lead').length, 224);
  assert.equal(engine.snapshot().drop.status, 'done');
  assert.equal(engine.snapshot().status, 'finished');
  assert.equal(bassSamples().length, 1);
  assert.equal(audio.events.filter(e => e.kind === 'buildup-sample' && e.name.includes('Roses Kick')).length, 24);
  engine.dispose();
});

test('all four Vox instrument options replay the Vox melody with identical backing and independent drop lead', async () => {
 const engine=await createEngine(),takes=[];
 const phrase=JSON.parse(readFileSync('src/piano/voxMelody.json')).notes;
 const expected=[...phrase,...phrase.filter(n=>n.beat<12).map(n=>({...n,beat:n.beat+16}))];
 const noteName=midi=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+(Math.floor(midi/12)-1);
 for(const [index,mode] of ['original','light','stabs','lead','lead','original'].entries()) {
   engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode:mode});
   const first=audio.events.length,start=10+index*100;
   assert.equal(await engine.rehearseFrom25('timed'),true);
   for(let tick=0;tick<=320;tick++)audio.advance(start+tick*.15);
   const events=audio.events.slice(first),samples=events.filter(e=>e.kind==='buildup-sample');
   assert.equal(samples.filter(e=>e.name.includes('Vox synth')).length,['original','light'].includes(mode)?2:0);
   const stabs=samples.filter(e=>e.name.includes('single-E4'));
   assert.equal(stabs.length,mode==='stabs'?30:0);
   assert.equal(samples.filter(e=>e.name.includes('spacy drum')).length,40);
   assert.equal(samples.filter(e=>e.name.includes('Snare Drum')).length,32);
   const lead=events.filter(e=>e.kind==='drop-lead');
   const vox=lead.filter(e=>e.at<start+28.8-1e-8),drop=lead.filter(e=>e.at>=start+28.8-1e-8);
   assert.equal(vox.length,mode==='lead'?120:0,'the four banks play the 30 Vox notes, not the 224-event drop melody');
   assert.equal(drop.length,224);
   assert.equal(lead.filter(e=>Math.abs(e.at-(start+28.8))<1e-8).length,4);
   assert.deepEqual(drop.slice(0,4).map(e=>e.note),['E4','E5','E5','E5']);
   if(mode==='lead'||mode==='stabs')expected.forEach((note,i)=>{
     const group=mode==='lead'?vox.slice(i*4,i*4+4):[stabs[i]];
     group.forEach(event=>{
       assert.ok(Math.abs(event.at-(start+9.6+note.beat*.6))<1e-8);
       if(mode==='lead'){assert.equal(event.note,noteName(note.midi));assert.equal(event.duration,.15);}
       else assert.ok(Math.abs(event.rate-2**((note.midi-64)/12))<1e-8);
       assert.ok(event.at<start+26.4,'bar 36 retains the Vox break');
     });
   });
   if(mode==='lead')assert.equal(new Set(vox.map(e=>e.voice)).size,4);
   const backing=events.filter(e=>['start','buildup-sample','build-note','drum'].includes(e.kind)&&!e.name?.includes('Vox synth')&&!e.name?.includes('single-E4'))
     .map(e=>({...e,at:Number((e.at-start).toFixed(8))}));
   takes.push({backing,lead});assert.equal(engine.snapshot().drop.status,'done');
 }
 for(const take of takes.slice(1))assert.deepEqual(take.backing,takes[0].backing);
 engine.reset();engine.dispose();assert.ok(takes.flatMap(take=>take.lead).every(e=>e.voice.disposed));
});

test('the cued Roses vocal preserves bar 28 and finishes its short fade exactly at bar 29', async () => {
  const engine=await createEngine();
  engine.setVocalOffset(9.6,true); engine.armVocal(); engine.armBuild(); engine.startAt(5,'performance');
  const envelope=engine.vocalHandoffGain.gain,levels=[],setLevel=envelope.setValueAtTime.bind(envelope);
  envelope.setValueAtTime=(value,at)=>{levels.push({value,at});return setLevel(value,at);};
  for(let tick=0;tick<=384;tick++)audio.advance(10+tick*.15);
  const stops=audio.events.filter(event=>event.kind==='stop'&&event.name.includes('vocals_original')&&event.at>10);
  assert.equal(stops.length,1);
  assert.ok(Math.abs(stops[0].at-67.6)<1e-8,'stop at the bar-29 downbeat');
  assert.ok(levels.some(event=>event.value===1&&Math.abs(event.at-67.3)<1e-8),'full level through bar 28 until its final eighth note');
  assert.ok(audio.events.some(event=>event.kind==='gain-linear'&&event.value===0&&Math.abs(event.at-67.6)<1e-8),'300 ms fade ends at bar 29');
  assert.equal(engine.snapshot().vocalStatus,'FINISHED');
  assert.equal(engine.snapshot().status,'running');
  assert.equal(engine.snapshot().measure,29);
  engine.dispose();
});

test('19–28 practice loops keep the removed guitar and build bass silent', async () => {
  const engine=await createEngine();
  engine.setPracticeLoop({start:19,end:28}); engine.armBuild(); engine.startAt(19,'timed');
  for(let tick=0;tick<320;tick++) {
    audio.advance(10+tick*.15);
  }
  assert.equal(audio.events.filter(event=>event.kind==='start'&&event.name.includes('chop loop')).length,0,'no chop clips play on either cycle');
  assert.equal(audio.events.filter(event=>event.kind==='start'&&event.name.includes('Guitar')).length,0,'the removed guitar never restarts on a loop');
  engine.dispose();
});


test('after the handoff the clock continues and Pause/Resume never resurrects the finished Roses vocal', async()=>{
  const engine=await createEngine();
  engine.setVocalOffset(9.6,true);engine.armVocal();engine.startAt(5,'performance');
  for(let tick=0;tick<=400;tick++)audio.advance(10+tick*.15);
  assert.equal(engine.snapshot().measure,30);
  assert.equal(engine.snapshot().status,'running');
  const pulse=engine.snapshot().pulse;
  engine.pause();
  assert.equal(engine.snapshot().status,'paused');
  audio.advance(70.5);
  assert.equal(engine.snapshot().pulse,pulse);
  const starts=audio.events.filter(event=>event.kind==='start'&&event.name.includes('vocals_original')).length;
  engine.resume();
  assert.equal(audio.events.filter(event=>event.kind==='start'&&event.name.includes('vocals_original')).length,starts);
  assert.equal(engine.snapshot().vocalStatus,'FINISHED');
  assert.equal(engine.snapshot().status,'running');
  engine.dispose();
});


test('new buildup remains silent until armed and rejects late arming',async()=>{
 const engine=await createEngine();engine.startAt(29,'performance');
 for(let tick=0;tick<32;tick++)audio.advance(10+tick*.15);
 assert.equal(audio.events.filter(e=>e.kind==='buildup-sample').length,0);
 assert.equal(engine.armBuildup(),false);
 assert.equal(engine.snapshot().buildup.status,'NOT ARMED');engine.dispose();
});

test('armed buildup follows all source events and ends before bar 37 without automatic kick/clap',async()=>{
 const engine=await createEngine();assert.equal(engine.armBuildup(),true);engine.startAt(28,'performance');
 for(let tick=0;tick<=148;tick++)audio.advance(10+tick*.15);
 const played=audio.events.filter(e=>e.kind==='buildup-sample');
 for(const [name,count] of [['Vox synth',2],['spacy drum',40],['Snare Drum',32],['aah vocal',5],['snap for drop',1]]) assert.equal(played.filter(e=>e.name.includes(name)).length,count,name);
 const snap=played.find(e=>e.name.includes('snap for drop'));assert.ok(Math.abs(snap.at-(10+35*.6))<1e-8);
 assert.ok(played.every(e=>e.at<10+36*.6));
 assert.equal(audio.events.filter(e=>e.kind==='drum').length,0);
 assert.deepEqual(audio.events.filter(e=>e.kind==='build-note').map(e=>[e.midi,e.beats]),[[49,4],[45,4],[40,8],[49,4],[45,4],[40,4]]);
 assert.equal(engine.snapshot().buildup.status,'FINISHED');assert.equal(engine.snapshot().status,'running');
 engine.dispose();
});

test('explicit rehearsal restores source offsets, including the silent-bass bar-36 break',async()=>{
 const engine=await createEngine();engine.rehearseBuildup(33,'performance');audio.advance(10);
 let played=audio.events.filter(e=>e.kind==='buildup-sample');
 assert.equal(played.find(e=>e.name.includes('Vox')).offset,0);
 engine.reset();audio.clearEvents();engine.rehearseBuildup(36,'performance');
 for(let tick=0;tick<=16;tick++)audio.advance(10+tick*.15);
 played=audio.events.filter(e=>e.kind==='buildup-sample');
 assert.deepEqual(played.map(e=>e.name.split('/').at(-1)),['aah vocal chop loop 2.wav','riser-soft.wav','riser-strong.wav','snap for drop.wav']);
 assert.equal(audio.events.filter(e=>e.kind==='build-note').length,0);
 assert.ok(Math.abs(played.find(e=>e.name.endsWith('snap for drop.wav')).at-11.8)<1e-8);engine.dispose();
});

test('saved instrument choices and the reverted melody selector migrate to Vox instrument options', () => {
 const levels={vox:.7,spacy:.4,roll:.2,chops:.5,chopsMuted:true};
 for(const mode of ['original','light','stabs','lead'])assert.deepEqual(audio.validBuildupSettings({...levels,voxMode:mode}),{...levels,voxMode:mode});
 assert.equal(audio.validBuildupSettings({melodySource:'lead'}).voxMode,'lead');
 assert.equal(audio.validBuildupSettings({melodySource:'vox'}).voxMode,'original');
 assert.equal(audio.validBuildupSettings({voxMode:'stabs',melodySource:'lead'}).voxMode,'stabs');
 assert.equal(audio.validBuildupSettings({voxMode:'lead',vox:1.5}).vox,1.5);
});

test('switching Vox instruments, pause and reset cancel old voices without repeating notes', async () => {
 const engine=await createEngine(),settings={...audio.defaultBuildupSettings,voxMode:'lead'};
 engine.setBuildupSettings(settings);engine.rehearseBuildup(29,'performance');
 for(let tick=0;tick<=3;tick++)audio.advance(10+tick*.15);
 const old=audio.events.filter(e=>e.kind==='drop-lead');assert.equal(old.length,8);
 engine.pause();assert.ok(old.every(e=>e.voice.disposed));
 engine.resume();audio.advance(11);assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,8);
 engine.setBuildupSettings({...settings,voxMode:'original'});audio.advance(11.15);
 const restored=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('Vox synth'));
 assert.equal(restored.length,1);assert.ok(Math.abs(restored[0].offset-.75)<1e-9);
 engine.setBuildupSettings(settings);
 assert.ok(audio.sampleSources.filter(s=>s.options.url.name.includes('Vox synth')).every(s=>s.disposed));
 assert.ok(audio.sampleSources.some(s=>s.options.url.name.includes('spacy')&&!s.disposed));
 audio.advance(11.3);audio.advance(11.45);
 const joined=audio.events.filter(e=>e.kind==='drop-lead').slice(8);
 assert.equal(joined.length,4);assert.deepEqual(joined.map(e=>e.note),['B4','B4','B4','B4']);
 engine.reset();assert.ok(audio.events.filter(e=>e.kind==='drop-lead').every(e=>e.voice.disposed));
 audio.advance(12);assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,12);engine.dispose();
});

test('Vox instrument rehearsal seeks retain the phrase position and silent bar-36 break',async()=>{
 const engine=await createEngine();engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode:'lead'});
 for(const [bar,expected] of [[33,56],[36,0]]) {
   engine.reset();audio.clearEvents();engine.rehearseBuildup(bar,'performance');
   for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
   const lead=audio.events.filter(e=>e.kind==='drop-lead');assert.equal(lead.length,expected);
   assert.ok(lead.every(e=>e.at<10+(36-bar)*2.4));
   assert.equal(audio.events.some(e=>e.kind==='buildup-sample'&&e.name.includes('Vox synth')),false);
   assert.equal(engine.snapshot().lead.status,'OFF');
 }
 engine.dispose();
});

test('the existing Roses clock places the armed four-layer lead at bar 37 and ends scheduling at 45', async () => {
 const engine=await createEngine();
 assert.equal(engine.armLead(),true);assert.equal(engine.armLead(),false);
 engine.startAt(1,'performance');
 for(let tick=0;tick<=832;tick++) {
   audio.advance(tick*.15);
   if(tick<576)assert.equal(audio.events.some(e=>e.kind==='drop-lead'),false);
 }
 const lead=audio.events.filter(e=>e.kind==='drop-lead');
 assert.equal(lead.length,224);assert.ok(Math.abs(lead[0].at-86.4)<1e-9);
 assert.deepEqual(lead.slice(0,4).map(e=>e.note),['E4','E5','E5','E5']);
 assert.ok(lead.every(e=>e.at<105.6));
 assert.equal(engine.snapshot().lead.status,'DONE');
 assert.ok(lead.every(e=>!e.voice.disposed),'the final tails are allowed to decay');
 assert.equal(audio.events.some(e=>e.kind==='drum'||e.kind==='buildup-sample'),false,'no other backing is implicitly armed');
 engine.dispose();assert.ok(lead.every(e=>e.voice.disposed));
});

test('lead audition, pause/resume, late seeks, backing stop and reset cancel the correct take', async () => {
 const engine=await createEngine();
 assert.equal(engine.rehearseLead(36,'timed'),true);
 for(let tick=0;tick<=17;tick++)audio.advance(10+tick*.15);
 let lead=audio.events.filter(e=>e.kind==='drop-lead');
 assert.equal(lead.length,8);assert.ok(Math.abs(lead[0].at-12.4)<1e-9);
 engine.pause();assert.ok(lead.every(e=>e.voice.disposed));
 engine.resume();audio.advance(20);
 assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,8,'resume continues rather than repeating the first attack');
 engine.startAt(41,'timed');audio.advance(21);
 assert.equal(engine.snapshot().lead.status,'OFF');assert.equal(engine.armLead(),false);
 assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,8);
 engine.reset();engine.armLead();engine.startAt(37,'performance');audio.advance(30);
 lead=audio.events.filter(e=>e.kind==='drop-lead');assert.equal(lead.length,12);
 engine.stopLoop();audio.advance(30.15);
 assert.equal(engine.snapshot().lead.status,'OFF');assert.ok(lead.every(e=>e.voice.disposed));
 assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,12);
 engine.rehearseLead(37,'timed');audio.advance(40);engine.reset();
 assert.ok(audio.events.filter(e=>e.kind==='drop-lead').every(e=>e.voice.disposed));
 engine.dispose();
});

test('Play Drop uses the existing clock, stops at 45 and leaves manual performance opt-in', async () => {
 const engine=await createEngine();
 assert.equal(await engine.playDrop(),true);
 assert.equal(engine.snapshot().drop.status,'running');assert.equal(engine.snapshot().lead.status,'OFF');
 for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.snapshot().drop.status,'done');assert.equal(engine.snapshot().status,'finished');
 assert.equal(bassSamples().length,1);
 const samples=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('HiHat'));
 assert.equal(samples.length,38);assert.ok(Math.abs(samples[0].at-19.9)<1e-9);
 const atEnd=audio.events.length;audio.advance(40);assert.equal(audio.events.length,atEnd);
 engine.reset(37);assert.equal(engine.snapshot().drop.status,'idle');
 engine.startAt(37,'performance');audio.advance(50);
 assert.equal(bassSamples().length,1,'normal performance does not turn audition on');
 engine.dispose();
});

test('the fixed-tempo drop cannot desynchronize its prepared chord tracks via practice speed changes',async()=>{
 const engine=await createEngine();await engine.playDrop();engine.setSpeed(.75);
 assert.equal(engine.tempo(),100);engine.pause();engine.setSpeed(1.25);assert.equal(engine.tempo(),100);
 engine.reset(37);engine.setSpeed(.75);assert.equal(engine.tempo(),75);engine.dispose();
});

test('drop graph and lead banks are ready before the transport can fire its first callback', async () => {
 const engine=await createEngine(), start=audio.Transport.start;
 audio.Transport.start=at=>{
  assert.equal(engine.snapshot().drop.status,'running');
  assert.equal(engine.drop.lead.banks.size,4);
  start(at);audio.advance(10);
 };
 try {
  assert.equal(await engine.playDrop(),true);
  assert.equal(bassSamples().length,1,'the entrance is not skipped');
 } finally { audio.Transport.start=start;engine.dispose(); }
});

test('Stop during drop sample loading prevents a deferred surprise start', async () => {
 const engine=await createEngine();const pending=engine.playDrop();engine.reset(37);
 assert.equal(await pending,false);assert.equal(engine.snapshot().drop.status,'idle');
 assert.equal(engine.snapshot().status,'idle');engine.dispose();
});


test('three backing sources isolate bars 29–36 without the removed bar-25 build and preserve vocal/drop timing',async()=>{
 const engine=await createEngine();assert.equal(engine.snapshot().buildup.mode,'roses');
 const takes=[];
 for(const [index,mode] of ['roses','hwm-build','hwm-drop','hwm-build','roses'].entries()){
  engine.setBackingMode(mode);const first=audio.events.length,start=10+index*100;
  assert.equal(await engine.rehearseFrom25('timed'),true);
  for(let tick=0;tick<=320;tick++)audio.advance(start+tick*.15);
  const events=audio.events.slice(first),samples=events.filter(e=>e.kind==='buildup-sample');
  const prepared=samples.filter(e=>e.name.includes('/hwm-backing/')&&!e.dropBacking);
  const old=samples.filter(e=>!e.name.includes('/hwm-backing/')&&e.at<start+28.8-1e-8);
  assert.equal(prepared.length,mode==='roses'?0:4);
  if(mode!=='roses'){
   assert.equal(old.length,0,'no original Vox, percussion, chops or snap is layered underneath');
   const prefix=mode==='hwm-build'?'build':'drop';
   assert.deepEqual(prepared.map(e=>e.name.split('/').at(-1)),['chords','bass','drums','fx'].map(g=>`${prefix}-${g}.wav`));
   prepared.forEach(e=>{assert.ok(Math.abs(e.at-(start+9.6))<1e-8);assert.equal(e.offset,0);assert.equal(e.rate,1);});
  }else assert.equal(old.filter(e=>e.name.includes('Vox synth')).length,2);
  assert.equal(events.filter(e=>e.kind==='build-note').length,mode==='roses'?6:0,'only original bars 29–36 buildup bass remains; bars 25–28 have no build bass');
  const vocal=events.filter(e=>e.kind==='start'&&e.name.includes('here_with_me'));
  assert.equal(vocal.length,1);assert.ok(Math.abs(vocal[0].at-(start+4.98))<1e-8);assert.equal(vocal[0].offset,0);assert.equal(vocal[0].rate,1);
  assert.equal(events.some(e=>e.name?.includes('ACAPELLA')),false);
  const lead=events.filter(e=>e.kind==='drop-lead');assert.equal(lead.length,224);
  assert.ok(lead.every(e=>e.at>=start+28.8-1e-8&&e.at<start+48));
  assert.equal(lead.filter(e=>Math.abs(e.at-(start+28.8))<1e-8).length,4);
  assert.equal(engine.snapshot().buildup.status,'FINISHED');
  takes.push({vocal: {...vocal[0],at:Number((vocal[0].at-start).toFixed(8))},guitars:events.filter(e=>e.kind==='start'&&e.name.includes('Guitar')).map(e=>({...e,at:Number((e.at-start).toFixed(8))}))});
 }
 for(const take of takes.slice(1))assert.deepEqual(take,takes[0]);
 engine.reset();assert.ok(audio.sampleSources.filter(s=>s.options.url.name.includes('hwm-backing')).every(s=>s.disposed));engine.dispose();
});

test('direct bar-29 auditions join the existing vocal timeline identically in every backing mode',async()=>{
 const engine=await createEngine();
 for(const mode of ['roses','hwm-build','hwm-drop']){
  engine.reset();audio.clearEvents();engine.setBackingMode(mode);assert.equal(await engine.rehearseFrom29('timed'),true);audio.advance(10);
  const vocal=audio.events.filter(e=>e.kind==='start'&&e.name.includes('here_with_me'));
  assert.equal(vocal.length,1);assert.equal(vocal[0].at,10);assert.ok(Math.abs(vocal[0].offset-4.62)<1e-8);
  assert.equal(engine.snapshot().closerStatus,'PLAYING');
 }
 engine.dispose();
});

test('alternative backing pause, seek, source switches and stop retain phase and clear queued sources',async()=>{
 const engine=await createEngine();engine.setBackingMode('hwm-build');await engine.rehearseFrom29('timed');audio.advance(10);audio.advance(10.15);
 const first=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('hwm-backing'));
 engine.pause();assert.ok(audio.sampleSources.filter(s=>s.options.url.name.includes('hwm-backing')).every(s=>s.disposed));
 engine.resume();let samples=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('hwm-backing'));
 assert.equal(samples.length,8);samples.slice(4).forEach(e=>assert.ok(Math.abs(e.offset-.15)<1e-8));
 engine.setBackingMode('hwm-drop');audio.advance(11);
 samples=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('hwm-backing'));
 assert.equal(samples.length,12);assert.ok(samples.slice(8).every(e=>e.name.includes('/drop-')));samples.slice(8).forEach(e=>assert.ok(Math.abs(e.offset-.3)<1e-8));
 engine.rehearseBuildup(33,'timed');audio.advance(20);
 samples=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('hwm-backing'));
 samples.slice(-4).forEach(e=>assert.equal(e.offset,9.6));
 engine.reset();const count=audio.events.length;audio.advance(21);assert.equal(audio.events.length,count);
 assert.ok(audio.sampleSources.filter(s=>s.options.url.name.includes('hwm-backing')).every(s=>s.disposed));
 assert.equal(first.length,4);engine.dispose();
});


test('backing gain leaves bars 25–28 intact, and alternative submix solo/gains never restart sources',async()=>{
 const engine=await createEngine();engine.setBackingMix({gain:.5});await engine.rehearseFrom25('timed');
 for(let tick=0;tick<64;tick++)audio.advance(10+tick*.15);
 assert.equal(audio.events.some(e=>e.kind==='build-gain'),false,'backing gain does not alter bar-25 bass');
 for(let tick=64;tick<=192;tick++)audio.advance(10+tick*.15);
 assert.deepEqual(audio.events.filter(e=>e.kind==='build-gain').map(e=>[e.value,Number(e.at.toFixed(2))]),[[.5,19.6],[1,38.8]]);
 engine.setBackingMode('hwm-drop');await engine.rehearseFrom29('timed');audio.advance(50);
 const samples=audio.sampleSources.filter(s=>s.options.url.name.includes('hwm-backing')).slice(-4),count=audio.events.length;
 engine.setBackingMix({group:'bass',level:.8,solo:'bass',gain:1.2});
 samples.forEach(s=>assert.equal(s.destination.gain.value,s.options.url.name.includes('-bass.wav')?.8:0));
 assert.equal(audio.events.slice(count).some(e=>e.kind==='buildup-sample'||e.kind==='drop-lead'),false);
 engine.setBackingMix({solo:null});assert.equal(engine.snapshot().buildup.levels.bass,.8);
 samples.forEach(s=>assert.equal(s.destination.gain.value,s.options.url.name.includes('-bass.wav')?.8:1));
 assert.equal(engine.snapshot().buildup.gain,1.2);engine.dispose();
});

test('the new prepared backing remains at 100 BPM during its audition',async()=>{
 const engine=await createEngine();engine.setBackingMode('hwm-build');await engine.rehearseFrom25('timed');
 engine.setSpeed(.5);assert.equal(audio.Transport.bpm.value,100);
 engine.setBackingMode('roses');engine.setSpeed(.75);assert.equal(audio.Transport.bpm.value,100,'the queued drop also fixes tempo');
 engine.reset(25);engine.setSpeed(.75);assert.equal(audio.Transport.bpm.value,75);
 engine.dispose();
});

test('all full-take starts hand off to exactly the Play Drop arrangement in every backing mode',async()=>{
 const engine=await createEngine();engine.setDropChordPreset('bright');
 const isDropSample=e=>e.kind==='buildup-sample'&&(e.dropBacking||/Roses Kick|Roses SnareClap|HiHat/.test(e.name));
 const dropEvents=start=>audio.events.filter(e=>['drop-lead','audition-bass'].includes(e.kind)||isDropSample(e))
  .map(({voice,...e})=>({...e,at:Number((e.at-start).toFixed(8))}));
 await engine.playDrop();for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
 const reference=dropEvents(10);
 for(const bar of [1,25,29])for(const mode of ['roses','hwm-build','hwm-drop']){
  engine.reset();audio.clearEvents();engine.setBackingMode(mode);
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed')),true);
  assert.equal(engine.drop.lead.banks.size,4,'lead graph is prepared before transport callbacks');
  assert.equal(engine.snapshot().lead.status,'OFF','the standalone lead must not double the mixer lead');
  assert.equal(engine.armLead(),false,'manual arming cannot add a duplicate while the mixer owns the lead');
  const boundary=(37-bar)*16,dropTime=10+boundary*.15;
  for(let tick=0;tick<boundary;tick++)audio.advance(10+tick*.15);
  assert.deepEqual(dropEvents(dropTime),[],'drop instruments stay silent throughout the selected buildup');
  for(let tick=boundary;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  assert.deepEqual(dropEvents(dropTime),reference,`bar ${bar}, ${mode}: same timing, notes, samples and preset as Play Drop`);
  assert.equal(audio.events.filter(e=>e.kind==='drop-lead'&&Math.abs(e.at-dropTime)<1e-8).length,4);
  assert.equal(bassSamples().length,1);
  assert.equal(audio.events.filter(isDropSample).length,80,'two HWM tracks plus 24 kicks, 16 claps and 38 hats');
  assert.equal(engine.snapshot().status,'finished');assert.equal(engine.snapshot().drop.status,'done');
  assert.equal(engine.snapshot().drop.chordPreset,'bright');
 }
 engine.dispose();
});

test('automatic handoffs preserve mixer choices and permit edits before the drop entrance',async()=>{
 const engine=await createEngine();
 engine.setDropRow('lead',{enabled:false,volume:.31});engine.setDropRow('bass',{muted:true});
 engine.setDropRow('chords',{solo:true,volume:.47});engine.muteDropDrum('hat',true);
 engine.setDropChordLevel(0,.7);engine.setDropChordPreset('bright');
 const expected=engine.snapshot().drop;
 for(const bar of [1,25,29]){
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed')),true);
  const actual=engine.snapshot().drop;
  for(const key of ['rows','drumMutes','chordLevels','chordPreset'])assert.deepEqual(actual[key],expected[key]);
  for(const id of ['lead','bass','bonkChords','drums'])assert.equal(engine.drop.buses.get(id).gain.value,0);
  assert.equal(engine.drop.buses.get('chords').gain.value,.47);
 }
 engine.setDropRow('chords',{solo:false});engine.setDropRow('lead',{enabled:true,volume:.42});
 engine.setDropRow('bass',{muted:false,volume:.51});engine.setDropChordPreset('original');
 for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.drop.buses.get('lead').gain.value,.42);assert.equal(engine.drop.buses.get('bass').gain.value,.51);
 assert.equal(engine.drop.drumBuses.get('hat').gain.value,0);
 const chords=dropSamples().filter(e=>e.name.endsWith('drop-instrumental-chords.wav'));
 assert.equal(chords.length,1);assert.ok(chords.some(e=>e.name.endsWith('drop-instrumental-chords.wav')));assert.ok(chords.every(e=>!e.name.includes('bright')));
 engine.dispose();
});

test('section auditions cancel during loading or before 37, and resume without duplicating the entrance',async()=>{
 const engine=await createEngine();
 for(const bar of [1,25,29]){
  const pending=bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed');engine.reset();
  assert.equal(await pending,false);assert.equal(engine.snapshot().status,'idle');assert.equal(engine.snapshot().drop.status,'idle');
  await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed'));
  audio.advance(10);engine.pause();assert.equal(engine.snapshot().drop.status,'paused');
  audio.advance(11);assert.equal(bassSamples().length,0);
  engine.resume();assert.equal(engine.snapshot().drop.status,'running');
  for(let tick=1;tick<=(37-bar)*16;tick++)audio.advance(20+tick*.15);
  assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,4);
  assert.equal(bassSamples().length,1);
  engine.reset();const count=audio.events.length;audio.advance(100);assert.equal(audio.events.length,count);
  audio.clearEvents();
  await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed'));
  audio.advance(10);engine.reset();const stopped=audio.events.length;
  for(let tick=1;tick<=200;tick++)audio.advance(10+tick*.15);
  assert.equal(audio.events.length,stopped,'reset removes the pending drop');audio.clearEvents();
 }
 engine.dispose();
});

test('starting from bar 1 preserves the original earlier arming and audio in Timed and Performance',async()=>{
 const engine=await createEngine();
 for(const mode of ['timed','performance']){
  const takes=[];
  for(const fullDrop of [false,true]){
   engine.reset(1);audio.clearEvents();engine.setVocalOffset(9.6,true);
   engine.armSynth();engine.armBass();engine.armBuild();engine.armVocal();engine.armBuildup();
   const armed=engine.snapshot();
   assert.equal(fullDrop?await engine.startWithDrop(1,mode):engine.startAt(1,mode),true);
   for(const flag of ['synthPending','bassPending','buildPending','vocalStatus'])assert.equal(engine.snapshot()[flag],armed[flag]);
   for(let tick=0;tick<576;tick++)audio.advance(10+tick*.15);
   takes.push(audio.events.filter(e=>['start','buildup-sample','build-note','drum','build-gain'].includes(e.kind)));
   assert.equal(audio.events.filter(e=>e.kind==='drop-lead'||e.kind==='audition-bass').length,0,'the drop stays silent until 37');
   assert.equal(engine.snapshot().vocalStatus,'FINISHED');assert.equal(engine.snapshot().buildup.status,'BREAK');
   if(fullDrop){
    audio.advance(96.4);
    assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,4);
    assert.equal(bassSamples().length,1);
    assert.equal(engine.snapshot().lead.status,'OFF');
   }
  }
  assert.deepEqual(takes[1],takes[0],'bars 1–36 retain the same notes, guitar, bass, vocal and buildup scheduling');
 }
 engine.dispose();
});

test('full-song preparation fixes tempo before starting and a newer seek cancels it',async()=>{
 const engine=await createEngine();
 const pending=engine.startWithDrop(1,'timed');engine.setSpeed(.75);
 assert.equal(await pending,true);assert.equal(engine.tempo(),100);
 engine.pause();engine.resume();assert.equal(engine.snapshot().drop.status,'running');
 const superseded=engine.startWithDrop(1,'timed');engine.startAt(9,'timed');
 assert.equal(await superseded,false);assert.equal(engine.snapshot().measure,9);assert.equal(engine.snapshot().drop.status,'idle');
 engine.reset(1);engine.setPracticeLoop({start:1,end:4});engine.startAt(1,'timed');
 for(let tick=0;tick<=80;tick++)audio.advance(20+tick*.15);
 assert.equal(engine.snapshot().cycle,1);assert.equal(engine.snapshot().drop.status,'idle','short practice loops do not queue a full take');
 engine.dispose();
});

test('stale Recorded Loud Stabs requests cannot replace the finalized four-layer lead on any start or replay',async()=>{
 const engine=await createEngine();engine.setDropLeadSound('loud-stabs');
 for(const bar of [1,25,29,37])for(let replay=0;replay<2;replay++){
  engine.reset(bar);audio.clearEvents();
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):bar===29?engine.rehearseFrom29('timed'):engine.playDrop()),true);
  const boundary=10+(37-bar)*2.4;
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const hits=audio.events.filter(e=>e.kind==='drop-lead');
  assert.equal(hits.length,224);assert.equal(hits.filter(e=>Math.abs(e.at-boundary)<1e-8).length,4);
  assert.ok(hits.every(e=>e.at>=boundary-1e-8));assert.equal(audio.events.some(e=>e.name?.endsWith('/loud-stabs-recorded-fm7.wav')&&e.kind==='buildup-sample'),false);
  assert.equal(bassSamples().length,1);assert.equal(engine.snapshot().drop.leadSound,'original');
  assert.equal(engine.snapshot().status,'finished');assert.equal(engine.snapshot().lead.status,'OFF');
 }
 engine.dispose();
});

test('default full HWM arrangement arms E-major backing without changing earlier Roses arming',async()=>{
 const engine=await createEngine();engine.setBackingMode('hwm-build');
 assert.equal(await engine.startWithDrop(1,'timed'),true);
 assert.equal(engine.snapshot().buildup.status,'ARMED');
 assert.equal(engine.snapshot().synthActive,false);assert.equal(engine.snapshot().bassActive,false);
 for(let tick=0;tick<=704;tick++)audio.advance(10+tick*.15);
 const prepared=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('/hwm-backing/'));
 assert.equal(prepared.length,6);assert.equal(prepared.filter(e=>e.at<96.4-1e-8).length,4);
 assert.equal(bassSamples().length,1);assert.equal(engine.snapshot().status,'finished');engine.dispose();
});

test('Roses replacement survives every section start as one finished instrumental with no duplicate percussion',async()=>{
 const engine=await createEngine();engine.setDropBackingSource('roses');engine.setDropChordPreset('bright');
 for(const bar of [1,25,29,37]){
  engine.reset(bar);audio.clearEvents();
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):bar===29?engine.rehearseFrom29('timed'):engine.playDrop()),true);
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const boundary=10+(37-bar)*2.4;
  assert.equal(engine.snapshot().drop.backingSource,'roses');assert.equal(engine.snapshot().drop.chordPreset,'bright');
  assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,0);
  const tracks=audio.events.filter(e=>e.kind==='buildup-sample'&&e.at>=boundary-1e-8);
  assert.equal(tracks.length,1);assert.ok(tracks[0].name.endsWith('roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav'));assert.ok(Math.abs(tracks[0].at-boundary)<1e-8);assert.equal(tracks[0].rate,1);assert.equal(tracks[0].offset,0);
  assert.equal(audio.events.filter(e=>e.kind==='drop-lead'&&Math.abs(e.at-boundary)<1e-8).length,4);
 }
 engine.dispose();
});

test('bar-1 full starts arm exactly the selected buildup source on fresh starts, restarts, completion and reset',async()=>{
 const engine=await createEngine();
 for(const source of ['roses','hwm-build','hwm-drop']){
  engine.reset(1);engine.setBackingMode(source);
  for(const previousState of ['fresh','armed','playing','finished','after-finish','reset']){
   if(previousState==='armed'){engine.reset(1);engine.armBuildup();}
   if(previousState==='reset')engine.reset(1);
   if(previousState==='after-finish')assert.equal(engine.snapshot().status,'finished');
   audio.clearEvents();
   assert.equal(await engine.startWithDrop(1,'timed'),true,`${source}/${previousState}`);
   assert.equal(engine.snapshot().buildup.mode,source);assert.equal(engine.snapshot().buildup.status,'ARMED');
   for(let tick=0;tick<448;tick++)audio.advance(10+tick*.15);
   assert.equal(audio.events.some(e=>e.kind==='buildup-sample'&&!e.dropBacking),false,'buildup must stay silent through bar 28');
   audio.advance(77.2);
   const samples=audio.events.filter(e=>e.kind==='buildup-sample'&&!e.dropBacking);
   assert.equal(engine.snapshot().buildup.status,'PLAYING');
   if(source==='roses'){
    assert.ok(samples.some(e=>e.name.includes('/roses/buildup/')));assert.equal(samples.some(e=>e.name.includes('/hwm-backing/')),false);
   }else{
    const prefix=source==='hwm-build'?'build':'drop';
    assert.deepEqual(samples.map(e=>e.name.split('/').at(-1)),['chords','bass','drums','fx'].map(group=>`${prefix}-${group}.wav`));
    samples.forEach(e=>{assert.ok(Math.abs(e.at-77.2)<1e-8);assert.equal(e.offset,0);});
   }
   // Leave different real lifecycle states behind for the next full restart.
   if(previousState==='playing')engine.pause();
   if(previousState==='finished')for(let tick=449;tick<=704;tick++)audio.advance(10+tick*.15);
  }
 }
 engine.dispose();
});

test('switching buildup source during the bar-1 lead-in uses the latest selection at bar 29',async()=>{
 const engine=await createEngine();
 for(const [from,to] of [['roses','hwm-build'],['hwm-build','hwm-drop'],['hwm-drop','roses']]){
  engine.reset(1);engine.setBackingMode(from);audio.clearEvents();assert.equal(await engine.startWithDrop(1,'performance'),true);
  for(let tick=0;tick<224;tick++)audio.advance(10+tick*.15);
  engine.setBackingMode(to);assert.equal(engine.snapshot().buildup.status,'ARMED');
  for(let tick=224;tick<=448;tick++)audio.advance(10+tick*.15);
  const samples=audio.events.filter(e=>e.kind==='buildup-sample'&&!e.dropBacking);
  assert.equal(engine.snapshot().buildup.mode,to);
  if(to==='roses'){assert.ok(samples.some(e=>e.name.includes('/roses/buildup/')));assert.equal(samples.some(e=>e.name.includes('/hwm-backing/')),false);}
  else {const prefix=to==='hwm-build'?'build':'drop';assert.deepEqual(samples.map(e=>e.name.split('/').at(-1)),['chords','bass','drums','fx'].map(group=>`${prefix}-${group}.wav`));}
 }
 engine.dispose();
});

test('Hybrid starts from 25/29/33/36 and preserves the exact existing drop at 37, including replay',async()=>{
 const engine=await createEngine();engine.setBackingMode('hybrid');
 for(const bar of [25,29,33,36,37])for(let take=0;take<2;take++){
  engine.reset(bar);audio.clearEvents();
  assert.equal(await(bar===25?engine.rehearseFrom25('timed'):bar===29?engine.rehearseFrom29('timed'):bar===37?engine.playDrop():engine.rehearseBuildup(bar,'timed')),true);
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const samples=audio.events.filter(e=>e.kind==='buildup-sample'),hybrid=samples.filter(e=>e.name.includes('/roses/hybrid/')),riser=hybrid.filter(e=>e.name.includes('riser-'));
  assert.equal(samples.filter(e=>e.name.endsWith('/hwm-backing/drop-drums.wav')).length,bar>=35?0:1);
  assert.equal(hybrid.length,bar===37?0:5);assert.equal(riser.length,bar===37?0:2);
  if(bar!==37){
   for(const event of hybrid.filter(e=>!e.name.includes('riser-'))){assert.ok(Math.abs(event.at-(10+Math.max(0,29-bar)*2.4))<1e-8);assert.ok(Math.abs(event.offset-Math.max(0,bar-29)*2.4)<1e-8);}
   riser.forEach(e=>assert.ok(Math.abs(e.at-(10+(36-bar)*2.4))<1e-8));
   const voices=audio.events.filter(e=>e.kind==='start'&&e.name.includes('here_with_me_chorus_e_major'));assert.equal(voices.length,1);assert.ok(Math.abs(voices[0].offset-(bar<29?0:4.62+(bar-29)*2.4))<1e-8);
  }
  assert.equal(samples.some(e=>e.name.includes('/roses/buildup/')||e.name.includes('/hwm-backing/')&&!e.dropBacking&&!e.name.endsWith('/drop-drums.wav')),false);
  assert.equal(audio.events.filter(e=>e.kind==='build-note'&&e.at>=10+Math.max(0,29-bar)*2.4).length,0);
  const leads=audio.events.filter(e=>e.kind==='drop-lead');assert.equal(leads.length,224);assert.equal(leads.filter(e=>Math.abs(e.at-(10+(37-bar)*2.4))<1e-8).length,4);
  assert.equal(bassSamples().length,1);assert.equal(engine.snapshot().status,'finished');
 }
 engine.dispose();
});

test('Hybrid pause/seek/reset and mode changes remove old sources; riser controls remain separate from the drop',async()=>{
 const engine=await createEngine();engine.setBackingMode('hybrid');engine.setPreDropRiser({volume:.8,intensity:.2,enabled:false});
 assert.deepEqual(engine.snapshot().buildup.riser,{enabled:false,volume:.8,intensity:.2});
 await engine.rehearseBuildup(36,'timed');audio.advance(10);
 const first=audio.sampleSources.filter(source=>source.options.url.name.includes('/hybrid/'));assert.equal(first.length,5);
 assert.equal(engine.snapshot().buildup.status,'BREAK');assert.equal(engine.snapshot().buildup.bass,false);
 engine.previewPreDropRiser();assert.equal(audio.sampleSources.filter(source=>source.options.url.name.includes('/hybrid/')).length,5,'no preview can double the running riser');
 audio.Transport.ticks=2*audio.Transport.PPQ;audio.flushDraw(11.2);engine.pause();assert.ok(first.every(source=>source.disposed));
 engine.resume();const resumed=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('riser-')).slice(-2);assert.ok(resumed.every(e=>Math.abs(e.offset-1.2)<1e-8));
 const all=audio.sampleSources.filter(source=>source.options.url.name.includes('/hybrid/'));engine.setBackingMode('hwm-drop');assert.ok(all.every(source=>source.disposed));assert.equal(engine.snapshot().buildup.mode,'hwm-drop');
 engine.reset();const count=audio.events.length;audio.advance(100);assert.equal(audio.events.length,count);
 engine.setBackingMode('hybrid');engine.previewPreDropRiser();assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('riser-')).length,resumed.length+4); // first pair + resume pair + preview pair
 const preview=audio.sampleSources.slice(-2);engine.reset();assert.ok(preview.every(source=>source.disposed));engine.dispose();
});

test('Hybrid drum settings survive seek/replay and cancel both percussion sources on pause/reset without changing riser or drop',async()=>{
 const engine=await createEngine();engine.setBackingMode('hybrid');engine.setHybridDrums({hwmVolume:.8,rosesVolume:.6,balance:.25});
 const initial=engine.snapshot();
 for(const bar of [29,33,36]){
  engine.reset(bar);audio.clearEvents();await engine.rehearseBuildup(bar,'timed');audio.advance(10);
  assert.deepEqual(engine.snapshot().buildup.hybridDrums,{hwmVolume:.8,rosesVolume:.6,balance:.25});
  const sources=audio.sampleSources.filter(source=>source.options.url.name.endsWith('/hwm-backing/drop-drums.wav')||source.options.url.name.endsWith('/hybrid/drums.wav'));
  assert.equal(sources.length,bar>=35?1:2);sources.forEach(source=>assert.ok(Math.abs(audio.events.find(e=>e.kind==='buildup-sample'&&e.name===source.options.url.name).offset-(bar-29)*2.4)<1e-8));
  engine.pause();assert.ok(sources.every(source=>source.disposed));engine.resume();engine.reset();
  assert.ok(audio.sampleSources.filter(source=>source.options.url.name.endsWith('/hwm-backing/drop-drums.wav')||source.options.url.name.endsWith('/hybrid/drums.wav')).every(source=>source.disposed));
 }
 assert.deepEqual(engine.snapshot().buildup.riser,initial.buildup.riser);assert.deepEqual(engine.snapshot().drop.rows,initial.drop.rows);engine.dispose();
});

test('Original Roses schedules the existing bar-36 sweep once, resumes its phase, and keeps snap/drop timing',async()=>{
 const engine=await createEngine();
 for(const bar of [25,29]){
  engine.reset(bar);audio.clearEvents();await(bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed'));
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const risers=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('/hybrid/riser-'));
  assert.equal(risers.length,2);risers.forEach(e=>{assert.ok(Math.abs(e.at-(10+(36-bar)*2.4))<1e-8);assert.equal(e.offset,0);});
  const snap=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.endsWith('/snap for drop.wav'));assert.equal(snap.length,1);assert.ok(Math.abs(snap[0].at-(10+(36-bar)*2.4+1.8))<1e-8);
  assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,224);
 }
 engine.reset(36);audio.clearEvents();engine.rehearseBuildup(36,'timed');audio.advance(10);
 const old=audio.sampleSources.filter(s=>s.options.url.name.includes('/hybrid/riser-'));assert.equal(old.length,2);
 audio.Transport.ticks=2*audio.Transport.PPQ;audio.flushDraw(11.2);engine.pause();assert.ok(old.every(s=>s.disposed));engine.resume();
 const resumed=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('/hybrid/riser-')).slice(-2);resumed.forEach(e=>assert.ok(Math.abs(e.offset-1.2)<1e-8));
 engine.reset();assert.ok(audio.sampleSources.filter(s=>s.options.url.name.includes('/hybrid/riser-')).every(s=>s.disposed));
 engine.setBackingMix({solo:'bass',group:'fx',level:0});assert.equal(engine.buildup.riser.output.destination,engine.buildup.output,'Original riser does not inherit hidden HWM FX solo/mute');
 engine.setBackingMode('hybrid');assert.equal(engine.buildup.riser.output.destination,engine.buildup.groups.get('fx'));
 engine.dispose();
});

test('third recorded drop enters once from 1, 25, 29 and 37, seeks at 39, with both buildup sources untouched',async()=>{
 const engine=await createEngine();engine.setDropBackingSource('recording');
 for(const mode of ['roses','hybrid'])for(const bar of [1,25,29,37,39,41])for(const offset of [-500,0,500]){
  engine.reset(bar);audio.clearEvents();engine.setBackingMode(mode);engine.setRecordedDropOffset(offset);
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):bar===29?engine.rehearseFrom29('timed'):engine.playDrop(bar)),true);
  const boundary=10+(37-bar)*2.4,target=boundary+offset/1000;
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const tracks=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('original-recording-8bars'));
  assert.equal(tracks.length,1);assert.ok(Math.abs(tracks[0].at-Math.max(10,target))<1e-8);assert.ok(Math.abs(tracks[0].offset-Math.max(0,10-target))<1e-8);
  assert.equal(tracks[0].rate,1);assert.equal(audio.events.some(e=>e.kind==='drop-lead'||e.kind==='audition-bass'),false);
  assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&/Roses Kick|Roses SnareClap|HiHat|chord-cache|drop-instrumental-chords|drop-bass/.test(e.name)).length,0);
  assert.equal(engine.snapshot().buildup.mode,mode);assert.equal(engine.snapshot().status,'finished');
 }
 engine.dispose();
});
test('recorded practice loops stop at their scheduled boundary, restart once and honor changed offset on the next cycle',async()=>{
 const engine=await createEngine();engine.setDropBackingSource('recording');engine.setPracticeLoop({start:37,end:44});
 await engine.playDrop(37,'timed',true);audio.advance(10);engine.setRecordedDropOffset(120);
 for(let tick=1;tick<=132;tick++)audio.advance(10+tick*.15);
 const tracks=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('original-recording-8bars'));
 assert.equal(tracks.length,2);assert.equal(tracks[0].at,10);assert.ok(Math.abs(tracks[1].at-29.32)<1e-8);assert.equal(engine.snapshot().cycle,1);
 assert.equal(engine.snapshot().drop.activeRecordedOffsetMs,120);assert.ok(audio.events.some(e=>e.kind==='buildup-stop'&&e.name.includes('original-recording-8bars')&&Math.abs(e.at-29.19)<1e-8));
 engine.reset();assert.equal(engine.snapshot().drop.status,'idle');engine.dispose();
});

test('optional recorded lead follows all section starts and mid-drop seeks without duplicate instrumental layers',async()=>{
 const engine=await createEngine();engine.setDropBackingSource('recording');engine.setDropRow('lead',{enabled:true});
 const source=JSON.parse(readFileSync('reference/here-with-me-drop-lead/lead-events-e-major.json'));
 for(const bar of [1,25,29,37,39,41]){
  engine.reset(bar);audio.clearEvents();
  await(bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):bar===29?engine.rehearseFrom29('timed'):engine.playDrop(bar));
  for(let tick=0;tick<=(45-bar)*16;tick++)audio.advance(10+tick*.15);
  const boundary=10+(37-bar)*2.4;
  const notes=audio.events.filter(e=>e.kind==='drop-lead'&&e.at>=Math.max(10,boundary)-1e-8);
  const expected=source.events.filter(e=>e.start_tick_relative_to_rose_bar37>=Math.max(0,bar-37)*4*source.source_ppq&&e.start_tick_relative_to_rose_bar37<32*source.source_ppq);
  assert.equal(notes.length,expected.length);expected.forEach((e,i)=>assert.ok(Math.abs(notes[i].at-(boundary+e.start_tick_relative_to_rose_bar37/source.source_ppq*.6))<1e-8));
  assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('original-recording-8bars')).length,1);
  assert.equal(audio.events.some(e=>e.kind==='audition-bass'||e.kind==='buildup-sample'&&e.dropBacking&&!e.name.includes('original-recording-8bars')),false);
 }
 engine.reset(37);audio.clearEvents();engine.setPracticeLoop({start:37,end:44});await engine.playDrop(37,'timed',true);
 for(let tick=0;tick<256;tick++)audio.advance(10+tick*.15);
 assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,448,'one complete lead phrase per loop');
 assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('original-recording-8bars')).length,2);
 engine.dispose();
});

test('vocal handoff: full take finishes one L-armed Roses vocal; shortcuts omit it without duplicating chops',async()=>{
 const engine=await createEngine();const takes=[];
 for(const start of [1,25]){
  engine.reset();audio.clearEvents();engine.setVocalOffset(9.6,true);
  if(start===1){engine.armVocal();engine.armBuild();await engine.startWithDrop(1,'timed');}
  else await engine.rehearseFrom25('timed');
  for(let tick=0;tick<=(29-start)*16;tick++)audio.advance(10+tick*.15);
  const bar25=10+(25-start)*2.4;
  const roses=audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original'));
  assert.equal(roses.length,start===1?1:0);
  assert.equal(audio.events.some(e=>e.kind==='start'&&e.name.includes('chop loop')),false,'no early automatic chop player');
  const guitars=audio.events.filter(e=>e.kind==='start'&&e.name.includes('Guitar')&&e.at>=bar25-1e-8).map(e=>({...e,at:Number((e.at-bar25).toFixed(8))}));
  assert.equal(guitars.length,0,'the removed guitar is absent from both starts');
  const hwm=audio.events.filter(e=>e.kind==='start'&&e.name.includes('here_with_me_chorus'));
  assert.equal(hwm.length,1,'the HWM vocal itself never double-triggers');
  assert.ok(Math.abs(hwm[0].at-bar25-4.98)<1e-8);
  if(start===1){assert.equal(engine.snapshot().vocalStatus,'FINISHED');const stops=audio.events.filter(e=>e.kind==='stop'&&e.name.includes('vocals_original')&&e.at>roses[0].at);assert.equal(stops.length,1);assert.ok(Math.abs(stops[0].at-(10+28*2.4))<1e-8);}
  takes.push(guitars);
 }
 assert.deepEqual(takes[0],takes[1]);engine.dispose();
});

test('the sung-vocal handoff survives pause, mix edits, late seeks and a fresh full take',async()=>{
 const engine=await createEngine();engine.setVocalOffset(9.6,true);engine.armVocal();engine.startAt(5,'timed');
 const envelope=engine.vocalHandoffGain.gain,automation=[];
 for(const method of ['setValueAtTime','linearRampToValueAtTime','cancelAndHoldAtTime']){
  const original=envelope[method].bind(envelope);
  envelope[method]=(...args)=>{automation.push({method,args});return original(...args);};
 }
 assert.equal(engine.vocal.destination,engine.vocalGain);
 assert.equal(engine.vocalGain.destination,engine.vocalHandoffGain);
 assert.equal(engine.closer.gain.destination,engine.output,'HWM bypasses the Roses-only envelope');
 for(let tick=0;tick<=383;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.snapshot().vocalStatus,'FADING');
 audio.Transport.ticks=383/4*audio.Transport.PPQ;
 engine.pause();assert.equal(automation.at(-1).method,'cancelAndHoldAtTime');
 const beforeMix=automation.length;
 engine.setCloserSettings({enabled:true,preset:'27-1-and',offsetMs:0,rosesLevel:1.5,closerLevel:.75,fadeSeconds:.25});
 assert.equal(automation.length,beforeMix,'the Roses volume slider cannot override the handoff envelope');
 const playedBeforeResume=audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original')).length;
 engine.resume();
 assert.equal(audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original')).length,playedBeforeResume+1);
 assert.ok(automation.some(e=>e.method==='setValueAtTime'&&e.args[0]>0&&e.args[0]<1),'resume restores the faded gain, not full level');
 await engine.rehearseFrom29('timed');audio.Transport.ticks=0;
 const startsAfterSeek=audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original')).length;
 for(let tick=0;tick<32;tick++)audio.advance(80+tick*.15);
 assert.equal(audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original')).length,startsAfterSeek,'late seek cannot revive the old vocal');
 assert.equal(automation.filter(e=>e.method==='setValueAtTime').at(-1).args[0],0);
 engine.reset(1);audio.Transport.ticks=0;assert.equal(engine.armVocal(),true);
 await engine.startWithDrop(1,'timed');
 assert.equal(automation.filter(e=>e.method==='setValueAtTime').at(-1).args[0],1,'restart clears the old handoff');
 for(let tick=0;tick<=64;tick++)audio.advance(100+tick*.15);
 assert.equal(engine.snapshot().vocalStatus,'PLAYING');
 engine.stopLoop();const stopped=audio.events.length;
 audio.advance(200);assert.equal(audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original')).length,startsAfterSeek+1);
 assert.equal(audio.events.length,stopped);engine.dispose();
});

test('fully armed full run retains early V/N notes and uses the same 29–36 melody gain and backing events as both shortcuts',async()=>{
 const engine=await createEngine();
 for(const mode of ['roses','hwm-build','hwm-drop','hybrid']){
  const takes=[];
  for(const start of [1,25,29]){
   engine.reset(1);audio.clearEvents();engine.setBackingMode(mode);engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode:'lead'});
   const earlyNotes=[],earlyBass=[],earlyStops=[];
   engine.synth.triggerLoopNote=(midi,time,duration)=>earlyNotes.push({midi,time,duration});
   engine.synth.stopLoop=time=>earlyStops.push(time);
   engine.bass.trigger=(bass,sub,time)=>earlyBass.push(...[...bass,...sub].map(n=>({...n,time})));
   if(start===1){engine.setVocalOffset(9.6,true);engine.armSynth();engine.armBass();engine.armBuild();engine.armVocal();await engine.startWithDrop(1,'timed');}
   else if(start===25)await engine.rehearseFrom25('timed');else await engine.rehearseFrom29('timed');
   for(let tick=0;tick<(37-start)*16;tick++)audio.advance(10+tick*.15);
   if(start===1){
    assert.equal(earlyNotes.length,32);assert.equal(earlyBass.length,48);
    assert.ok(earlyNotes.every(n=>n.time+n.duration<=58+1e-8));assert.ok(earlyBass.every(n=>n.time+n.durationBeats*.6<=58+1e-8));assert.ok(earlyStops.includes(58));
   }else{assert.equal(earlyNotes.length,0);assert.equal(earlyBass.length,0);}
   const entry=10+(29-start)*2.4;
   const notes=audio.events.filter(e=>e.kind==='drop-lead'&&e.at>=entry-1e-8).map(({voice,...e})=>({...e,at:Number((e.at-entry).toFixed(8))}));
   const stems=audio.events.filter(e=>e.kind==='buildup-sample'&&e.at>=entry-1e-8).map(e=>({...e,at:Number((e.at-entry).toFixed(8))}));
   takes.push({notes,stems,melodyGain:engine.buildup.original.alternateGain.gain.value,chordGain:engine.buildup.groups.get('chords').gain.value});
  }
  assert.deepEqual(takes[0],takes[1],mode+': full run matches 25');assert.deepEqual(takes[0],takes[2],mode+': full run matches 29');
 }
 engine.dispose();
});


test('finalized Roses source choices survive fresh app sessions and every performance start without resetting recorded preferences', async()=>{
 const previousStorage=globalThis.localStorage;
 const saved=new Map([['stage-piano-roses-recorded-drop-official-wav-v2',JSON.stringify({offsetMs:-220,volume:1.13})]]);
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 try{
  for(let session=0;session<2;session++){
   const engine=await createEngine(true);
   for(const start of [1,25,29,37]){
    engine.reset(start);audio.clearEvents();
    if(start===1)engine.armBuild();
    await(start===1?engine.startWithDrop(1,'performance'):start===25?engine.rehearseFrom25('timed'):start===29?engine.rehearseFrom29('timed'):engine.playDrop());
    const state=engine.snapshot();
    assert.equal(state.buildup.mode,'roses');assert.equal(state.drop.backingSource,'recording');
    assert.equal(state.drop.recordedOffsetMs,-220);assert.equal(state.drop.rows.recorded.volume,1.13);
    for(let tick=0;tick<=(45-start)*16;tick++)audio.advance(10+tick*.15);
    const recordings=audio.events.filter(e=>e.kind==='buildup-sample'&&e.dropBacking);
    assert.equal(recordings.length,1);
    assert.ok(recordings[0].name.endsWith('/roses-original-recording-8bars-100bpm.wav'));
    assert.equal(audio.events.some(e=>e.kind==='drop-lead'||e.kind==='audition-bass'),false,'recording retains its existing optional-lead-off default with no duplicated backing');
    assert.equal(audio.events.some(e=>e.name?.includes('/hwm-backing/')||/\/hybrid\/(?:chords|bass|drums)\.wav$/.test(e.name??'')),false);
    if(start<37)assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('aah vocal chop loop')).length,5,'original Roses buildup retains its five chop clips');
   }
   engine.dispose();
  }
 }finally{if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;}
});

test('manual bass mode replaces only the early bass/sub pattern and preserves backing/drop scheduling',async()=>{
 const takes=[];
 for(const mode of ['auto','manual']){
  const engine=await createEngine(true);assert.equal(engine.setBassPlaybackMode(mode),true);
  engine.armBass();engine.armBuild();audio.clearEvents();await engine.startWithDrop(13,'timed');
  const earlyBass=[];engine.bass.trigger=(bass,sub,at)=>earlyBass.push(...bass,...sub);
  audio.advance(10);
  assert.equal(engine.manualBassNoteOn('Comma'),mode==='manual');
  if(mode==='manual'){
   assert.equal(engine.manualBassPitch('Comma'),49);assert.equal(engine.manualBassPitch('Period'),45);assert.equal(engine.manualBassPitch('Slash'),40);
   engine.manualBassNoteOff('Comma');assert.ok(audio.events.some(e=>e.kind==='manual-bass-off'&&e.midi===49));
   assert.equal(engine.setBassPlaybackMode('auto'),false,'mode cannot change underneath queued notes');
  }
  for(let tick=1;tick<=512;tick++)audio.advance(10+tick*.15);
  assert.equal(earlyBass.length,mode==='auto'?48:0);
  const backing=audio.events.filter(e=>['start','buildup-sample','build-note','drum','drop-lead'].includes(e.kind));takes.push(backing);
  assert.equal(engine.manualBassNoteOn('Period'),mode==='manual','stopped performance permits free play');
  engine.reset(13);engine.startAt(13,'timed');
  if(mode==='manual'){engine.manualBassNoteOn('Slash');engine.pause();assert.ok(audio.events.some(e=>e.kind==='manual-bass-release'));}
  engine.reset(21);engine.startAt(21,'timed');assert.equal(engine.manualBassNoteOn('Comma'),false,'buildup does not accept early-section manual bass');
  engine.dispose();
 }
 assert.deepEqual(takes[0],takes[1],'guitar, build bass, Vox/chops, risers, vocals and recording are unchanged');
});

test('manual bass mode persists across restart/reload while reset and N never re-arm its automatic notes',async()=>{
 const previousStorage=globalThis.localStorage;const saved=new Map();
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 try{
  let engine=await createEngine();assert.equal(engine.snapshot().bassPlaybackMode,'auto');
  engine.setBassPlaybackMode('manual');engine.armBass();assert.equal(engine.snapshot().bassPending,undefined);
  engine.reset(1);assert.equal(engine.snapshot().bassPlaybackMode,'manual');engine.dispose();
  engine=await createEngine();assert.equal(engine.snapshot().bassPlaybackMode,'manual');
  engine.setBassPlaybackMode('auto');engine.armBass();assert.equal(engine.snapshot().bassPending,true);engine.dispose();
 }finally{if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;}
});

test('armed stage start queues every configured section once, respects manual bass and preserves optional drop lead',async()=>{
 for(const bassMode of ['auto','manual'])for(const optionalLead of [false,true]){
  const engine=await createEngine(true);engine.setBassPlaybackMode(bassMode);engine.setVocalOffset(9.6,true);
  engine.setDropRow('lead',{enabled:optionalLead,volume:.41});engine.setDropRow('recorded',{volume:1.12});engine.setRecordedDropOffset(-220);
  const synth=[],bass=[];engine.synth.triggerLoopNote=(midi,at,duration)=>synth.push({midi,at,duration});
  engine.bass.trigger=(a,b)=>bass.push(...a,...b);
  for(let take=0;take<2;take++){
   synth.length=0;bass.length=0;audio.clearEvents();
   assert.equal(await engine.startArmedPerformance(),true);
   const armed=engine.snapshot();assert.equal(armed.mode,'performance');assert.equal(armed.measure,1);
   assert.equal(armed.synthPending,true);assert.equal(armed.buildPending,false);assert.equal(armed.vocalStatus,'ARMED');
   assert.equal(armed.bassPending,bassMode==='auto'?true:undefined);assert.equal(armed.bassPlaybackMode,bassMode);
   for(let tick=0;tick<=704;tick++)audio.advance(10+tick*.15);
   assert.equal(synth.length,32);assert.equal(synth[0].at,19.6,'existing synth entrance stays at bar 5');
   assert.equal(bass.length,bassMode==='auto'?48:0);
   assert.equal(audio.events.some(e=>e.kind==='start'&&e.name.includes('Guitar')),false,'full performance never loads a guitar passage into playback');
   const buildupBass=audio.events.filter(e=>e.kind==='build-note');
   assert.equal(buildupBass.length,6,'the original bars 29–36 bass remains intact');
   assert.ok(buildupBass.every(e=>e.at>=10+28*2.4-1e-8),'no build bass before bar 29');
   const roses=audio.events.filter(e=>e.kind==='start'&&e.name.includes('vocals_original'));
   assert.equal(roses.length,1);assert.equal(roses[0].at,19.6);assert.equal(roses[0].offset,9.6);
   assert.equal(audio.events.filter(e=>e.kind==='start'&&e.name.includes('here_with_me_chorus')).length,1);
   assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('original-recording-8bars')).length,1);
   assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,optionalLead?224:0,'only the existing mixer lead can play');
   assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('aah vocal chop loop')).length,5);
   const state=engine.snapshot();assert.equal(state.drop.recordedOffsetMs,-220);assert.equal(state.drop.rows.recorded.volume,1.12);assert.equal(state.drop.rows.lead.volume,.41);assert.equal(state.drop.rows.lead.enabled,optionalLead);
   assert.equal(state.status,'finished');
  }
  engine.dispose();
 }
});

test('armed performance requires confirmed loaded vocals and a stopped pending preparation cannot restart the clock',async()=>{
 const engine=await createEngine(true);audio.clearEvents();
 assert.equal(await engine.startArmedPerformance(),false);assert.equal(audio.events.some(e=>e.kind==='transport-start'),false);
 engine.setVocalOffset(9.6,true);
 const start=engine.startArmedPerformance();engine.reset(1);assert.equal(await start,false);
 assert.equal(engine.snapshot().status,'idle');assert.equal(audio.events.some(e=>e.kind==='transport-start'),false);
 engine.dispose();
});


test('manual buildup lead silences only automatic melody from starts 1/25/29, preserving all backing and the drop',async()=>{
 for(const start of [1,25,29]){
  const takes=[];
  for(const mode of ['auto','manual']){
   const engine=await createEngine(true);engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode:'lead'});engine.setVocalOffset(9.6,true);
   assert.equal(engine.setBuildupLeadPlaybackMode(mode),true);
   if(start===1)assert.equal(await engine.startArmedPerformance(),true);else assert.equal(await engine.rehearseIntoDrop(start,'performance'),true);
   for(let tick=0;tick<=704-(start-1)*16;tick++)audio.advance(10+tick*.15);
   assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,mode==='auto'?120:0,'only the scheduled buildup melody is removed');
   assert.equal(audio.events.some(e=>e.kind==='buildup-sample'&&e.name.includes('Vox synth')),false,'no underlying Vox WAV leaks through');
   takes.push(audio.events.filter(e=>['start','stop','buildup-sample','build-note','drum','audition-bass'].includes(e.kind)).map(e=>({...e})));
   assert.equal(engine.snapshot().status,'finished');engine.dispose();
  }
  assert.deepEqual(takes[1],takes[0],`non-melody arrangement from bar ${start} is identical`);
 }
});

test('manual buildup keys reuse the automatic four-layer unison pitches and clean up across pause, bar 36 and replay',async()=>{
 const engine=await createEngine(true);engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode:'lead'});engine.setBuildupLeadPlaybackMode('manual');
 const keys=[['KeyW',59,'B3'],['KeyR',63,'D#4'],['KeyT',64,'E4'],['KeyY',66,'F#4'],['KeyU',68,'G#4'],['KeyO',71,'B4'],['KeyP',73,'C#5']];
 assert.equal(engine.snapshot().manualBuildupLeadActive,true,'stopped playback permits auditioning');
 for(const [code,midi,name] of keys){
  const before=audio.events.length;assert.equal(engine.manualBuildupLeadPitch(code),midi);assert.equal(engine.manualBuildupLeadNoteOn(code),true);assert.equal(engine.manualBuildupLeadNoteOn(code),false);
  const voices=audio.events.slice(before).filter(e=>e.kind==='manual-build-lead-on');assert.equal(voices.length,4);assert.ok(voices.every(e=>e.note===name&&e.velocity===.6),'exact unison voicing, not the drop octave chord voicing');
  engine.manualBuildupLeadNoteOff(code);assert.equal(audio.events.slice(before).filter(e=>e.kind==='manual-build-lead-off').length,4);
 }
 for(let take=0;take<2;take++){
  assert.equal(await engine.rehearseIntoDrop(25,'performance'),true);audio.advance(10);
  assert.equal(engine.manualBuildupLeadPitch('KeyP'),undefined,'bar 25 retains the original live chord sound');
  for(let tick=1;tick<=64;tick++)audio.advance(10+tick*.15);
  assert.equal(engine.snapshot().measure,29);assert.equal(engine.manualBuildupLeadNoteOn('KeyP'),true);
  let voices=audio.events.filter(e=>e.kind==='manual-build-lead-on').slice(-4);engine.pause();assert.ok(voices.every(e=>e.voice.disposed));engine.manualBuildupLeadNoteOff('KeyP');engine.resume();
  assert.equal(engine.manualBuildupLeadNoteOn('KeyT'),true);voices=audio.events.filter(e=>e.kind==='manual-build-lead-on').slice(-4);
  for(let tick=65;tick<=176;tick++)audio.advance(10+tick*.15);
  assert.equal(engine.snapshot().measure,36);assert.ok(voices.every(e=>e.voice.disposed),'bar-36 break clears held manual lead notes');assert.equal(engine.manualBuildupLeadPitch('KeyP'),undefined);
  engine.manualBuildupLeadNoteOff('KeyT');engine.reset();assert.equal(engine.snapshot().buildupLeadPlaybackMode,'manual');
 }
 assert.equal(engine.setBuildupLeadPlaybackMode('auto'),true);assert.equal(engine.manualBuildupLeadPitch('KeyP'),undefined);engine.dispose();
});

test('manual lead suppresses every automatic Vox instrument and persists without changing saved timbre',async()=>{
 const saved=new Map(),previous=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 try{
  for(const voxMode of ['original','light','stabs','lead']){
   const engine=await createEngine(true);engine.setBuildupSettings({...audio.defaultBuildupSettings,voxMode});engine.setBuildupLeadPlaybackMode('manual');
   await engine.rehearseIntoDrop(29,'timed');assert.equal(engine.setBuildupLeadPlaybackMode('auto'),false,'mode changes require stopped playback');
   for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
   assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,0);assert.equal(audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('Vox synth')).length,0);
   assert.equal(audio.events.filter(e=>e.kind==='build-note').length,6);assert.equal(engine.snapshot().buildup.layers.includes('vox'),false);engine.dispose();
  }
  const reloaded=await createEngine(true);assert.equal(reloaded.snapshot().buildupLeadPlaybackMode,'manual');assert.equal(reloaded.manualBuildupLeadPitch('KeyP'),73);reloaded.setBuildupLeadPlaybackMode('auto');reloaded.dispose();
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});


test('Intro Loop stage gestures are silent only while the armed bars 5–20 loop actually plays',async()=>{
 const engine=await createEngine(true);engine.armSynth();assert.equal(engine.startAt(1,'performance'),true);
 assert.equal(engine.isSilentIntroLoopGesture('KeyL'),false);
 for(let tick=0;tick<64;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.snapshot().measure,4);assert.equal(engine.isSilentIntroLoopGesture('Quote'),false);
 audio.advance(10+64*.15);
 assert.equal(engine.snapshot().measure,5);assert.equal(engine.snapshot().synthActive,true);
 for(const code of ['KeyL','Semicolon','Quote'])assert.equal(engine.isSilentIntroLoopGesture(code),true);
 assert.equal(engine.isSilentIntroLoopGesture('KeyS'),false);
 for(let tick=65;tick<=320;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.snapshot().measure,21);assert.equal(engine.isSilentIntroLoopGesture('KeyL'),false);
 engine.dispose();
});

test('HWM gestures include the A–W ending in auto mode while explicit manual W remains B3',async()=>{
 const engine=await createEngine(true);engine.setBuildupLeadPlaybackMode('auto');
 assert.equal(engine.isSilentBuildupLeadGesture('KeyJ'),false);
 await engine.rehearseIntoDrop(25,'performance');audio.advance(10);assert.equal(engine.isSilentBuildupLeadGesture('KeyJ'),false);
 for(let tick=1;tick<=64;tick++)audio.advance(10+tick*.15);
 for(const code of ['KeyJ','KeyH','KeyF','KeyD','KeyS','KeyA','KeyW'])assert.equal(engine.isSilentBuildupLeadGesture(code),true);
 assert.equal(engine.isSilentBuildupLeadGesture('KeyT'),false,'other input keeps its sound');
 for(let tick=65;tick<=176;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.snapshot().measure,36);assert.equal(engine.isSilentBuildupLeadGesture('KeyJ'),false);
 engine.reset();engine.setBuildupLeadPlaybackMode('manual');await engine.rehearseIntoDrop(29,'performance');audio.advance(10);
 for(const code of ['KeyJ','KeyH','KeyF','KeyD','KeyS','KeyA'])assert.equal(engine.isSilentBuildupLeadGesture(code),true);
 assert.equal(engine.isSilentBuildupLeadGesture('KeyW'),false,'explicit manual lead retains W');
 assert.equal(engine.manualBuildupLeadPitch('KeyW'),59);
 engine.dispose();
});

test('armed automatic bass exposes silent piano gestures only in bars 13–20',async()=>{
 const engine=await createEngine(true);
 try {
  engine.setBassPlaybackMode('auto');
  assert.equal(engine.bassInputPitch('Comma'),undefined,'stopped auto does not enable gesture notes');
  engine.armBass();await engine.startWithDrop(13,'timed');audio.advance(10);
  const before=audio.events.filter(e=>e.kind==='manual-bass-on').length;
  for(const [code,midi] of [['Comma',49],['Period',45],['Slash',40]]){
   assert.equal(engine.isSilentBassGesture(code),true);
   assert.equal(engine.bassInputPitch(code),midi);
   assert.equal(engine.manualBassNoteOn(code),false,'automatic gestures never attack manual bass');
  }
  assert.equal(audio.events.filter(e=>e.kind==='manual-bass-on').length,before);
  assert.equal(engine.isSilentBassGesture('KeyT'),false);
  for(let tick=1;tick<=128;tick++)audio.advance(10+tick*.15);
  assert.equal(engine.snapshot().measure,21);
  assert.equal(engine.isSilentBassGesture('Comma'),false);
  assert.equal(engine.bassInputPitch('Comma'),undefined);
  engine.reset(13);engine.startAt(13,'timed');audio.advance(10);
  assert.equal(engine.isSilentBassGesture('Comma'),false,'unarmed auto stays inactive');
  engine.reset();engine.setBassPlaybackMode('manual');
  assert.equal(engine.isSilentBassGesture('Comma'),false);
  assert.equal(engine.bassInputPitch('Comma'),49);
  assert.equal(engine.manualBassNoteOn('Comma'),true,'manual mode still sounds');
 }finally{engine.dispose();}
});

test('live X borrows the exact buildup Spacy sample in bars 29–35 and restores clap for the drop',async()=>{
 const engine=await createEngine(true);
 try{
  for(const bar of [5,28,29,33,35,36,37,44]){
   engine.reset(bar);assert.equal(engine.startAt(bar,'performance'),true);audio.advance(10);
   const before=audio.events.length;
   const hit=engine.hitDrum('clap');assert.ok(hit,`X is playable in bar ${bar}`);
   const events=audio.events.slice(before);
   const samples=events.filter(e=>e.kind==='buildup-sample');
   const clap=events.filter(e=>e.kind==='drum'&&e.name==='clap');
   const spacy=bar>=29&&bar<=35;
   assert.equal(samples.length,spacy?1:0);
   assert.equal(clap.length,spacy?0:1,'never layer original clap under Spacy');
   if(spacy){
    assert.equal(samples[0].name,'/roses/buildup/spacy drum.wav');
    assert.equal(samples[0].rate,1);assert.equal(samples[0].offset,0);assert.equal(samples[0].at,10);assert.equal(samples[0].gain,1);
    const source=audio.sampleSources.at(-1);
    assert.equal(source.destination,engine.buildup.original.gains.get('spacy'),'reuse existing sample mix');
   }
   assert.equal(engine.snapshot().lastDrum.kind,'clap','physical X keeps its pad and drum feedback identity');
   const kick=engine.hitDrum('kick');assert.equal(!!kick,bar<=36,'Z retains its prior playback region');
  }
  engine.reset(35);engine.startAt(35,'performance');audio.advance(10);
  for(let i=0;i<200;i++)engine.hitDrum('clap');
  assert.ok(engine.buildup.original.sources.size<=24,'rapid X taps respect the existing source cap');
  engine.reset(37);audio.clearEvents();assert.ok(engine.hitDrum('clap'));
  assert.deepEqual(audio.events.filter(e=>e.kind==='drum').map(e=>e.name),['clap'],'seek/reset restores original X without stale Spacy ownership');
 }finally{engine.dispose();}
});

test('negative synth lead delays only automatic intro notes by 5 or 10 ms',async()=>{
 const engine=await createEngine(true);
 try{
  for(const lead of [-5,-10]){
   engine.reset(1);engine.setVocalOffset(9.6,true);engine.setSynthLeadMs(lead);
   const notes=[];engine.synth.triggerLoopNote=(midi,at,duration)=>notes.push({midi,at,duration});
   audio.clearEvents();assert.equal(await engine.startArmedPerformance(),true);
   for(let tick=0;tick<=64;tick++)audio.advance(10+tick*.15);
   assert.equal(notes.length,1);assert.equal(notes[0].midi,64);
   assert.ok(Math.abs(notes[0].at-(19.6-lead/1000))<1e-9);
   assert.ok(Math.abs(notes[0].at+notes[0].duration-22)<1e-9,'written note ending stays unchanged');
   assert.equal(audio.events.find(e=>e.kind==='start'&&e.name.includes('vocals_original')).at,19.6,'vocal entrance stays unchanged');
   assert.equal(audio.Transport.bpm.value,100);
  }
 }finally{engine.dispose();}
});


test('pre-start Roses performance freestyle plays existing drums without starting the clock or changing the arrangement',async()=>{
 const engine=await createEngine(true);
 try{
  engine.reset(1);audio.clearEvents();
  assert.equal(engine.hitDrum('kick'),null,'practice and other callers retain the original bar gate');
  for(let i=0;i<4;i++){
   const kick=engine.hitDrum('kick',true),clap=engine.hitDrum('clap',true);assert.ok(kick);assert.ok(clap);assert.equal(kick.bar,1);assert.equal(kick.scoreBeat,0);
   assert.equal(engine.hitAccent(),true);
  }
  const sounds=audio.events.filter(e=>e.kind==='drum');assert.deepEqual(sounds.map(e=>e.name),Array(4).fill(['kick','clap','accent']).flat());
  assert.equal(audio.events.some(e=>e.kind==='transport-start'),false,'freestyle hits never start the backing clock');
  assert.equal(engine.snapshot().status,'idle');assert.equal(engine.snapshot().measure,1);assert.equal(engine.snapshot().beat,1);
  assert.equal(engine.snapshot().synthActive,false);assert.equal(engine.snapshot().bassActive,false);assert.equal(engine.snapshot().vocalStatus,'NOT ARMED');
  assert.equal(audio.events.some(e=>e.kind==='buildup-sample'),false,'freestyle X uses the original clap, never a backing layer');
  engine.startAt(1,'performance');audio.advance(10);assert.equal(engine.hitDrum('kick',true),null);assert.equal(engine.hitDrum('clap',true),null,'running bars 1–4 retain their existing gates');
  engine.reset(1);assert.ok(engine.hitDrum('kick',true),'reset restores pre-start freestyle');
  const ready=engine.ready;engine.ready=false;const before=audio.events.length;assert.equal(engine.hitDrum('kick',true),null);assert.equal(audio.events.length,before);engine.ready=ready;
 }finally{engine.dispose();}
});
