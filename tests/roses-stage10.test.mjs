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
 async load(name) {this.name=name;this.loaded=true;this.duration=name.includes('hwm-backing')?19.35:name.includes('chord-cache')?22.9:name.includes('single-E4')?.785011:name.includes('Vox')?10.987506:name.includes('aah')?6.868753:name.includes('spacy')?.876485:name.includes('snap')?.474694:.179955;}
 dispose() {}
}
export class ToneBufferSource extends Gain {
 constructor(options){super();this.options=options;sampleSources.push(this);}
 start(at,offset,duration,gain){events.push({kind:'buildup-sample',name:this.options.url.name,at,offset,gain,rate:this.options.playbackRate});}
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
  trigger() {}
  triggerExact(notes, at, spb) {for(const note of notes)events.push({kind:'audition-bass',midi:note.midi,at,duration:note.durationBeats*spb});}
  triggerBuild(notes, at, secondsPerBeat) { for(const note of notes) events.push({kind:'build-note', midi:note.midi, at, beats:note.durationBeats, secondsPerBeat}); }
}
`;
const bundled = await build({
  stdin: { contents: 'export { RosesIntroEngine } from "./src/piano/rosesIntroEngine.ts"; export { validBuildupSettings, defaultBuildupSettings } from "./src/piano/rosesBuildup.ts"; export { events, sampleSources, clearEvents, advance, flushDraw, Transport } from "tone";', resolveDir: process.cwd() },
  bundle:true, platform:'node', format:'esm', write:false,
  plugins:[{ name:'audio-clock', setup(build) {
    build.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'mock'}));
    build.onResolve({filter:/rosesBassEngine$/},()=>({path:'bass',namespace:'mock'}));
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='tone'?toneMock:bassMock,loader:'js'}));
  }}],
});
const audio = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
async function createEngine() {
  audio.clearEvents();
  const engine = new audio.RosesIntroEngine({ isPlayable:()=>true, stopLoop() {}, triggerLoopNote() {} },()=>{},()=>4);
  await engine.load();
  return engine;
}

test('one manual F6 arm carries 24→25 continuously, with exact bass/guitar timing and no vocal chops', async () => {
  const engine=await createEngine();
  engine.armBuild(); engine.startAt(21,'performance');
  let bar25;
  for(let tick=0;tick<=128;tick++) {
    audio.advance(10+tick*.15);
    if(tick===64) bar25=engine.snapshot();
  }
  const guitars=audio.events.filter(event=>event.kind==='start'&&event.name.includes('Guitar'));
  assert.equal(guitars.length,3);
  assert.ok(Math.abs(guitars[1].at-19.6)<1e-9);
  assert.deepEqual(guitars.slice(1).map(event=>event.pan),[-.6,.605]);
  assert.ok(Math.abs(guitars[1].duration-9.618730176)<1e-6);
  assert.ok(Math.abs(guitars[2].duration-9.6)<1e-9);
  assert.equal(audio.events.some(event => event.kind === 'start' && (event.name?.includes('chop loop') || event.name?.includes('ah intro sample')) || event.kind === 'sampler-load' || event.kind === 'sample-trigger'), false, 'neither chop layer is loaded or played');
  assert.equal(bar25.buildActive,true);
  assert.deepEqual(audio.events.filter(event=>event.kind==='build-note').map(event=>[event.midi,event.beats,Number(event.at.toFixed(2))]),[[49,4,10],[45,4,12.4],[40,8,14.8],[49,4,19.6],[45,4,22],[40,8,24.4]]);
  assert.equal(audio.events.filter(event=>event.kind==='transport-start').length,1);
  assert.equal(audio.events.filter(event=>event.kind==='transport-stop'&&event.at>0).length,0);
  assert.equal(audio.events.filter(event=>event.kind==='drum').length,0);
  assert.equal(engine.snapshot().measure,29);
  assert.equal(engine.snapshot().status,'running');
  assert.equal(engine.snapshot().closerStatus,'PLAYING','the vocal continues across the section boundary');
  assert.equal(audio.events.some(event=>event.kind==='stop'&&event.at>=10&&event.name.includes('Guitar')),false,'guitar tails are not truncated by FINISHED');
  engine.dispose();
});

test('jumping directly to bar 25 preserves build bass without vocal chops', async () => {
  const engine=await createEngine();
  engine.armBuild(); engine.startAt(25,'performance');
  for(let tick=0;tick<=64;tick++)audio.advance(10+tick*.15);
  assert.equal(audio.events.some(event=>event.kind==='start'&&event.name.includes('chop loop')),false);
  assert.equal(audio.events.filter(event=>event.kind==='build-note').length,3);
  engine.dispose();
});

test('explicit bar-25 backing and lead audition hands off at bars 29 and 37 with the vocal cue intact', async () => {
  const engine = await createEngine();
  assert.equal(await engine.rehearseFrom25('timed'), true);
  assert.equal(engine.snapshot().buildPending, true);
  assert.equal(engine.snapshot().buildup.status, 'ARMED');
  assert.equal(engine.snapshot().lead.status, 'OFF');
  assert.equal(engine.snapshot().drop.status, 'running');
  for (let tick = 0; tick <= 192; tick++) audio.advance(10 + tick * .15);
  const guitar = audio.events.filter(e => e.kind === 'start' && e.name.includes('Guitar'));
  assert.equal(guitar.length, 2);
  assert.ok(guitar.every(e => Math.abs(e.at - 10) < 1e-9));
  const build = audio.events.filter(e => e.kind === 'buildup-sample');
  assert.ok(Math.abs(build[0].at - 19.6) < 1e-9, 'buildup starts at bar 29, four bars after 25');
  assert.equal(build.filter(e => e.name.includes('Vox synth')).length, 2);
  assert.equal(build.filter(e => e.name.includes('spacy drum')).length, 40);
  assert.equal(build.filter(e => e.name.includes('Snare Drum')).length, 32);
  assert.deepEqual(audio.events.filter(e => e.kind === 'build-note').map(e => e.midi), [49, 45, 40, 49, 45, 40, 49, 45, 40]);
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
  assert.equal(audio.events.filter(e => e.kind === 'audition-bass').length, 35);
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
   assert.deepEqual(drop.slice(0,4).map(e=>e.note),['D#4','D#5','D#5','D#5']);
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

test('the cued Roses vocal keeps playing after the bar-28 boundary', async () => {
  const engine=await createEngine();
  engine.setVocalOffset(9.6,true); engine.armVocal(); engine.armBuild(); engine.startAt(5,'performance');
  for(let tick=0;tick<=384;tick++)audio.advance(10+tick*.15);
  const stops=audio.events.filter(event=>event.kind==='stop'&&event.name.includes('vocals_original')&&event.at>10);
  assert.equal(stops.length,0);
  assert.equal(audio.events.some(event=>event.kind==='gain-linear'&&event.value===0),false);
  assert.equal(engine.snapshot().vocalStatus,'PLAYING');
  assert.equal(engine.snapshot().status,'running');
  assert.equal(engine.snapshot().measure,29);
  engine.dispose();
});

test('19–28 practice loops repeat guitar backing without vocal chops', async () => {
  const engine=await createEngine();
  engine.setPracticeLoop({start:19,end:28}); engine.armBuild(); engine.startAt(19,'timed');
  for(let tick=0;tick<320;tick++) {
    audio.advance(10+tick*.15);
  }
  assert.equal(audio.events.filter(event=>event.kind==='start'&&event.name.includes('chop loop')).length,0,'no chop clips play on either cycle');
  assert.equal(audio.events.filter(event=>event.kind==='start'&&event.name.includes('Guitar')).length,6,'the build keeps repeating independently');
  engine.dispose();
});


test('after the score the clock continues and Pause/Resume holds recorded clips in place', async()=>{
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
  assert.ok(audio.events.some(event=>event.kind==='stop'&&event.name.includes('vocals_original')&&event.at===70));
  engine.resume();
  const resumed=audio.events.filter(event=>event.kind==='start'&&event.name.includes('vocals_original')).at(-1);
  assert.ok(Math.abs(resumed.offset-69.6)<1e-7);
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
 assert.deepEqual(played.map(e=>e.name.split('/').at(-1)),['aah vocal chop loop 2.wav','snap for drop.wav']);
 assert.equal(audio.events.filter(e=>e.kind==='build-note').length,0);
 assert.ok(Math.abs(played[1].at-11.8)<1e-8);engine.dispose();
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
 assert.deepEqual(lead.slice(0,4).map(e=>e.note),['D#4','D#5','D#5','D#5']);
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
 assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,35);
 const samples=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('HiHat'));
 assert.equal(samples.length,38);assert.ok(Math.abs(samples[0].at-19.9)<1e-9);
 const atEnd=audio.events.length;audio.advance(40);assert.equal(audio.events.length,atEnd);
 engine.reset(37);assert.equal(engine.snapshot().drop.status,'idle');
 engine.startAt(37,'performance');audio.advance(50);
 assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,35,'normal performance does not turn audition on');
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
  assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,1,'the entrance is not skipped');
 } finally { audio.Transport.start=start;engine.dispose(); }
});

test('Stop during drop sample loading prevents a deferred surprise start', async () => {
 const engine=await createEngine();const pending=engine.playDrop();engine.reset(37);
 assert.equal(await pending,false);assert.equal(engine.snapshot().drop.status,'idle');
 assert.equal(engine.snapshot().status,'idle');engine.dispose();
});


test('three backing sources isolate bars 29–36 while preserving bar-25 backing, the vocal cue and bar-37 lead',async()=>{
 const engine=await createEngine();assert.equal(engine.snapshot().buildup.mode,'roses');
 const takes=[];
 for(const [index,mode] of ['roses','hwm-build','hwm-drop','hwm-build','roses'].entries()){
  engine.setBackingMode(mode);const first=audio.events.length,start=10+index*100;
  assert.equal(await engine.rehearseFrom25('timed'),true);
  for(let tick=0;tick<=320;tick++)audio.advance(start+tick*.15);
  const events=audio.events.slice(first),samples=events.filter(e=>e.kind==='buildup-sample');
  const prepared=samples.filter(e=>e.name.includes('/hwm-backing/'));
  const old=samples.filter(e=>!e.name.includes('/hwm-backing/')&&e.at<start+28.8-1e-8);
  assert.equal(prepared.length,mode==='roses'?0:4);
  if(mode!=='roses'){
   assert.equal(old.length,0,'no original Vox, percussion, chops or snap is layered underneath');
   const prefix=mode==='hwm-build'?'build':'drop';
   assert.deepEqual(prepared.map(e=>e.name.split('/').at(-1)),['chords','bass','drums','fx'].map(g=>`${prefix}-${g}.wav`));
   prepared.forEach(e=>{assert.ok(Math.abs(e.at-(start+9.6))<1e-8);assert.equal(e.offset,0);assert.equal(e.rate,1);});
  }else assert.equal(old.filter(e=>e.name.includes('Vox synth')).length,2);
  assert.equal(events.filter(e=>e.kind==='build-note').length,mode==='roses'?9:3,'bars 25–28 are retained; original buildup bass is suppressed in alternatives');
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
 const isDropSample=e=>e.kind==='buildup-sample'&&/chord-cache|Roses Kick|Roses SnareClap|HiHat/.test(e.name);
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
  assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,35);
  assert.equal(audio.events.filter(isDropSample).length,82,'four chord tracks plus 24 kicks, 16 claps and 38 hats');
  assert.equal(engine.snapshot().status,'finished');assert.equal(engine.snapshot().drop.status,'done');
  assert.equal(engine.snapshot().drop.chordPreset,'bright');
 }
 engine.dispose();
});

test('automatic handoffs preserve mixer choices and permit edits before the drop entrance',async()=>{
 const engine=await createEngine();
 engine.setDropRow('lead',{enabled:false,volume:.31});engine.setDropRow('bass',{muted:true});
 engine.setDropRow('bonkChords',{solo:true,volume:.47});engine.muteDropDrum('hat',true);
 engine.setDropChordLevel(0,.7);engine.setDropChordPreset('bright');
 const expected=engine.snapshot().drop;
 for(const bar of [1,25,29]){
  assert.equal(await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed')),true);
  const actual=engine.snapshot().drop;
  for(const key of ['rows','drumMutes','chordLevels','chordPreset'])assert.deepEqual(actual[key],expected[key]);
  for(const id of ['lead','bass','chords','drums'])assert.equal(engine.drop.buses.get(id).gain.value,0);
  assert.equal(engine.drop.buses.get('bonkChords').gain.value,.47);
 }
 engine.setDropRow('bonkChords',{solo:false});engine.setDropRow('lead',{enabled:true,volume:.42});
 engine.setDropRow('bass',{muted:false,volume:.51});engine.setDropChordPreset('original');
 for(let tick=0;tick<=128;tick++)audio.advance(10+tick*.15);
 assert.equal(engine.drop.buses.get('lead').gain.value,.42);assert.equal(engine.drop.buses.get('bass').gain.value,.51);
 assert.equal(engine.drop.drumBuses.get('hat').gain.value,0);
 const chords=audio.events.filter(e=>e.kind==='buildup-sample'&&e.name.includes('chord-cache'));
 assert.equal(chords.length,4);assert.ok(chords.some(e=>e.name.endsWith('chordA.wav')));assert.ok(chords.every(e=>!e.name.includes('bright')));
 engine.dispose();
});

test('section auditions cancel during loading or before 37, and resume without duplicating the entrance',async()=>{
 const engine=await createEngine();
 for(const bar of [1,25,29]){
  const pending=bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed');engine.reset();
  assert.equal(await pending,false);assert.equal(engine.snapshot().status,'idle');assert.equal(engine.snapshot().drop.status,'idle');
  await (bar===1?engine.startWithDrop(1,'timed'):bar===25?engine.rehearseFrom25('timed'):engine.rehearseFrom29('timed'));
  audio.advance(10);engine.pause();assert.equal(engine.snapshot().drop.status,'paused');
  audio.advance(11);assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,0);
  engine.resume();assert.equal(engine.snapshot().drop.status,'running');
  for(let tick=1;tick<=(37-bar)*16;tick++)audio.advance(20+tick*.15);
  assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,4);
  assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,1);
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
   assert.equal(engine.snapshot().vocalStatus,'PLAYING');assert.equal(engine.snapshot().buildup.status,'BREAK');
   if(fullDrop){
    audio.advance(96.4);
    assert.equal(audio.events.filter(e=>e.kind==='drop-lead').length,4);
    assert.equal(audio.events.filter(e=>e.kind==='audition-bass').length,1);
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
