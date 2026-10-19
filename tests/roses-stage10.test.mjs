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
export const events = [];
let time = 0, repeat;
let draws = [];
export const immediate = () => time;
export const now = () => time;
export function clearEvents() { events.length = 0; time = 0; draws = []; }
export function flushDraw(at) { time = at; const due = draws.filter(d => d.at <= at); draws = draws.filter(d => d.at > at); for(const draw of due) draw.callback(); }
export function advance(at) { time = at; repeat?.(at); flushDraw(at); }
class Param {
  rampTo(value, duration) { events.push({ kind:'gain-ramp', value, duration }); }
  cancelScheduledValues() {}
  setValueAtTime() {}
  cancelAndHoldAtTime() {}
  linearRampToValueAtTime(value, at) { events.push({ kind:'gain-linear', value, at }); }
}
export class Gain { constructor() { this.gain = new Param(); } connect() { return this; } chain() { return this; } dispose() {} }
export class Volume extends Gain { constructor() { super(); this.volume = new Param(); } toDestination() { return this; } }
export class Filter extends Gain {} export class EQ3 extends Gain {} export class Compressor extends Gain {} export class WaveShaper extends Gain {} export class Limiter extends Gain {}
export class ToneAudioBuffer {
 constructor() { this.duration=0; }
 async load(name) {this.name=name;this.loaded=true;this.duration=name.includes('Vox')?10.987506:name.includes('aah')?6.868753:name.includes('spacy')?.876485:name.includes('snap')?.474694:.179955;}
 dispose() {}
}
export class ToneBufferSource extends Gain {
 constructor(options){super();this.options=options;}
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
  releaseAll(at) { events.push({kind:'bass-release', at}); }
  trigger() {}
  triggerBuild(notes, at, secondsPerBeat) { for(const note of notes) events.push({kind:'build-note', midi:note.midi, at, beats:note.durationBeats, secondsPerBeat}); }
}
`;
const bundled = await build({
  stdin: { contents: 'export { RosesIntroEngine } from "./src/piano/rosesIntroEngine.ts"; export { events, clearEvents, advance, flushDraw } from "tone";', resolveDir: process.cwd() },
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
