import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const mock=`
export const audio={now:10,sources:[],loads:[],starts:0,fail:false,wait:null};
export const immediate=()=>audio.now;
export const start=async()=>{audio.starts++;};
export class Gain{gain={events:[],rampTo(){},cancelScheduledValues(time){this.events.push(["cancel",time]);},setValueAtTime(value,time){this.events.push(["set",value,time]);},linearRampToValueAtTime(value,time){this.events.push(["ramp",value,time]);}};connect(target){this.target=target;return this;}toDestination(){return this;}dispose(){}}
export class ToneAudioBuffer{duration=0;loaded=false;async load(url){this.url=url;audio.loads.push(url);if(audio.wait)await audio.wait;if(audio.fail)throw Error('missing');this.duration=url.endsWith('.mp3')?151:.3;this.loaded=true;}dispose(){this.disposed=true;}}
export class ToneBufferSource extends Gain{constructor(options){super();this.options=options;audio.sources.push(this);}start(at,offset,duration,level){Object.assign(this,{at,offset,duration,level});}dispose(){this.disposed=true;}}
`;
const bundle=await build({stdin:{contents:`export * from './src/finale/sodaPopEngine';export * from './src/finale/sodaPopTimeline';export {drawSodaPop} from './src/finale/SodaPopFinale';export {audio} from 'tone';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false,loader:{'.css':'empty'},plugins:[{name:'audio-clock',setup(builder){builder.onResolve({filter:/^tone$/},()=>({path:'tone',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:mock,loader:'js'}));}}]});
const {SodaPopEngine,defaultSodaPopSettings,validSodaPopSettings,sodaPopFrame,drawSodaPop,audio}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ~= ${b}`);
function setup(legacy=true){audio.now=10;audio.sources=[];audio.loads=[];audio.starts=0;audio.fail=false;audio.wait=null;let before=0,rehearsals=0,back=0;const engine=new SodaPopEngine();engine.attach({beforeStart:()=>before++,rehearse:async()=>{rehearsals++;},back:()=>back++});if(legacy&&!globalThis.localStorage)engine.configure({start:45,end:75,countIn:false,firstBeat:.1,transition:1.6});return {engine,before:()=>before,rehearsals:()=>rehearsals,back:()=>back};}
const songs=()=>audio.sources.filter(source=>source.options.url.url.endsWith('.mp3'));

test('cut and cue settings are finite, ordered, bounded and restore from storage',()=>{
 const bad=validSodaPopSettings({start:Infinity,end:NaN,transition:-1,bpm:999,scratch:.4,glitch:.3,can:.55},151);
 assert.equal(bad.start,41);assert.equal(bad.end,82);assert.equal(bad.transition,1.2);assert.equal(bad.bpm,200);assert.ok(bad.scratch<bad.glitch&&bad.glitch<bad.can&&bad.can<1);
 const truncated=validSodaPopSettings({start:200,end:10},151);assert.equal(truncated.start,150.75);assert.equal(truncated.end,151);
 const saved=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 try{const first=setup().engine;first.configure({start:46.23,end:70.4,transition:1.9});first.dispose();const second=setup().engine;assert.equal(second.snapshot().settings.start,46.23);assert.equal(second.snapshot().settings.end,70.4);assert.equal(second.snapshot().settings.transition,1.9);second.dispose();}finally{if(saved===undefined)delete globalThis.localStorage;else globalThis.localStorage=saved;}
});

test('preload is silent and one original-pitch excerpt starts at the exact visual reveal clock',async()=>{
 const state=setup(),engine=state.engine;
 assert.equal(audio.sources.length,0);await engine.prepare();assert.equal(audio.sources.length,0);assert.equal(audio.loads.length,7);
 await engine.launch();const song=songs()[0];near(song.at,11.53);assert.equal(song.offset,45);near(song.duration,35.988);assert.equal(song.level,1);assert.equal(song.options.playbackRate,undefined,'native 1x pitch/speed');
 assert.equal(state.before(),1);await engine.launch();assert.equal(engine.automatic(11),false);assert.equal(songs().length,1);
 audio.now=song.at+.099;assert.equal(engine.frame().phase,'pop');audio.now=song.at+.100001;assert.equal(engine.frame().phase,'playing');near(engine.frame().music,.100001);
 const cueStarts=audio.sources.filter(source=>source!==song).map(source=>source.at);assert.ok(cueStarts.every(time=>time<song.at));
 engine.dispose();assert.ok(audio.sources.every(source=>source.disposed));
});

test('pausing and resuming a transition resumes remaining cues and never repeats completed scratch',async()=>{
 const {engine}=setup();await engine.launch();audio.now=10.83;engine.pause();near(engine.elapsed(),.8);assert.ok(audio.sources.every(source=>source.disposed));
 audio.now=50;near(engine.elapsed(),.8);engine.resume();const live=audio.sources.filter(source=>!source.disposed);
 assert.equal(live.some(source=>source.options.url.url.endsWith('scratch.wav')),false);
 const song=live.find(source=>source.options.url.url.endsWith('.mp3'));near(song.at,50.715);assert.equal(song.offset,45);
 audio.now=song.at+5;engine.pause();near(engine.frame().music,5);audio.now=100;engine.resume();const resumed=songs().at(-1);near(resumed.offset,50);near(resumed.duration,30.988);engine.dispose();
});

test('seek, stop, restart and exact chorus cutoff cannot leave duplicate playback or continue the MP3',async()=>{
 const state=setup(),engine=state.engine;await engine.launch();engine.seek(11.5);near(songs().at(-1).offset,55);near(songs().at(-1).duration,25.988);
 engine.pause();const count=audio.sources.length;engine.seek(37.6);assert.equal(audio.sources.length,count);engine.resume();assert.equal(songs().length,2,'seeking past the fade schedules no more song');
 audio.now+=.1;engine.update();assert.equal(engine.snapshot().status,'finished');assert.equal(engine.automatic(audio.now),false);
 engine.restart();await new Promise(resolve=>setImmediate(resolve));assert.equal(state.before(),2);assert.equal(songs().length,3);assert.equal(songs().filter(source=>!source.disposed).length,1);
 engine.back();assert.equal(state.back(),1);assert.equal(engine.snapshot().status,'idle');assert.ok(audio.sources.every(source=>source.disposed));engine.dispose();
});

test('disabled auto finale preserves the DJ show; explicit rehearsal can still arm one automatic handoff',async()=>{
 const state=setup(),engine=state.engine;engine.configure({automatic:false});await engine.prepare();assert.equal(engine.readyForAutomatic(),false);assert.equal(engine.automatic(20),false);assert.equal(state.before(),0);
 await engine.rehearse();assert.equal(state.rehearsals(),1);assert.equal(engine.readyForAutomatic(),true);assert.equal(engine.automatic(20),true);assert.equal(engine.automatic(20),false);assert.equal(state.before(),1);engine.dispose();
});

test('load failures retry and cancelling a pending launch cannot start stale music',async()=>{
 const {engine}=setup();audio.fail=true;await engine.launch();assert.equal(engine.snapshot().ready,false);assert.match(engine.snapshot().error,/could not load/);assert.equal(audio.sources.length,0);
 audio.fail=false;let resolve;audio.wait=new Promise(done=>resolve=done);const pending=engine.launch();await Promise.resolve();engine.stop();resolve();await pending;assert.equal(audio.sources.length,0);audio.wait=null;
 await engine.launch();assert.equal(songs().length,1);engine.dispose();
});

test('timeline and bounded renderer rebuild from the audio position across transition, seek and ending',()=>{
 const settings={...defaultSodaPopSettings,start:45,end:75,countIn:false,firstBeat:.1,transition:1.6};
 assert.equal(sodaPopFrame(0,settings).phase,'braking');assert.equal(sodaPopFrame(.4,settings).phase,'scratch');assert.equal(sodaPopFrame(.7,settings).phase,'glitch');assert.equal(sodaPopFrame(1,settings).phase,'anticipation');assert.equal(sodaPopFrame(1.2,settings).phase,'pop');assert.equal(sodaPopFrame(1.6,settings).phase,'playing');assert.equal(sodaPopFrame(31.5,settings).phase,'fading');assert.equal(sodaPopFrame(37.5,settings).phase,'finished');
 for(const reduced of [false,true])for(const [w,h] of [[1280,720],[3840,2160],[390,844]])for(const elapsed of [0,.4,.7,1,1.2,1.6,10,31.6,37.5]){
  let arcs=0,depth=0;const ctx=new Proxy({save(){depth++;},restore(){depth--;},createRadialGradient(){return {addColorStop(){}};}},{get:(target,key)=>key in target?target[key]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));if(key==='arc')arcs++;}});
  drawSodaPop(ctx,w,h,sodaPopFrame(elapsed,settings),reduced);assert.equal(depth,0);assert.ok(arcs<=160,'particle count never grows with song duration');
 }
});

test('MP3 asset stays original and local; short DJ cues are real bounded PCM assets',()=>{
 const meta=JSON.parse(readFileSync('public/audio/soda-pop/source.json'));const mp3=readFileSync('public/audio/soda-pop/soda-pop.mp3');assert.equal(createHash('sha256').update(mp3).digest('hex'),meta.sha256);assert.equal(mp3.length,2677707);
 for(const name of ['brake','scratch','glitch','can','fizz','click']){const bytes=readFileSync(`public/audio/soda-pop/${name}.wav`);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),44100);assert.ok(bytes.length<50000);}
});

test('disposing during decode cannot resurrect finale readiness or sources',async()=>{
 const {engine}=setup();let resolve;audio.wait=new Promise(done=>resolve=done);
 const pending=engine.launch();await Promise.resolve();engine.dispose();resolve();await pending;
 assert.equal(engine.snapshot().ready,false);assert.equal(audio.sources.length,0);audio.wait=null;
});

test('editing timestamps while preload is pending cannot clamp the cut to an empty buffer',async()=>{
 const {engine}=setup();let resolve;audio.wait=new Promise(done=>resolve=done);
 const pending=engine.prepare();engine.configure({start:47.12,end:71.32});
 assert.equal(engine.snapshot().settings.start,47.12);assert.equal(engine.snapshot().settings.end,71.32);assert.ok(engine.snapshot().settings.firstBeat>=0);
 resolve();await pending;assert.equal(engine.snapshot().settings.start,47.12);assert.equal(engine.snapshot().settings.end,71.32);engine.dispose();audio.wait=null;
});

test('new finale starts at 41 seconds after exactly four audio-clocked metronome beats',async()=>{
 const {engine}=setup(false);assert.equal(engine.snapshot().settings.start,41);assert.equal(engine.snapshot().settings.end,82);assert.equal(engine.snapshot().settings.countIn,true);
 await engine.launch();const song=songs()[0],clicks=audio.sources.filter(source=>source.options.url.url.endsWith('/click.wav'));
 assert.equal(song.offset,41);near(song.duration,46.988);assert.equal(clicks.length,4);near(song.at,10.03+240/128);
 clicks.forEach((click,i)=>near(click.at,10.03+i*60/128));
 audio.now=clicks[0].at+.01;assert.equal(engine.frame().countBeat,1);
 audio.now=clicks[3].at+.01;assert.equal(engine.frame().countBeat,4);
 audio.now=song.at+.000001;assert.equal(engine.frame().countBeat,0);assert.equal(engine.frame().phase,'playing');
 engine.dispose();
});

test('the song stays full through 01:22, fades for six seconds, and resumes at the matching gain',async()=>{
 const {engine}=setup(false);await engine.launch();const song=songs()[0],gain=song.target.gain;
 near(song.offset+song.duration+.012,88);
 const ramps=gain.events.filter(event=>event[0]==='ramp');
 near(ramps.at(-1)[1],0);near(ramps.at(-1)[2],song.at+47);
 near(gain.events.find(event=>event[0]==='set'&&event[1]===1&&event[2]>song.at)[2],song.at+41);
 engine.seek(engine.snapshot().settings.transition+44);
 const resumed=songs().at(-1);near(resumed.offset,85);near(resumed.target.gain.events.at(-2)[1],.5);
 near(resumed.target.gain.events.at(-1)[2],resumed.at+3);
 engine.dispose();
});

test('metronome resumes remaining beats only and can be disabled without changing the audio cut',async()=>{
 const {engine}=setup(false);await engine.launch();audio.now=10.03+.7;engine.pause();audio.now=50;engine.resume();
 const clicks=audio.sources.filter(source=>!source.disposed&&source.options.url.url.endsWith('/click.wav'));
 assert.equal(clicks.length,2);near(clicks[0].at,50.015+(120/128-.7));near(clicks[1].at-clicks[0].at,60/128);
 engine.stop();engine.configure({countIn:false,transition:1.6});await engine.launch();
 assert.equal(audio.sources.filter(source=>!source.disposed&&source.options.url.url.endsWith('/click.wav')).length,0);assert.equal(songs().at(-1).offset,41);engine.dispose();
});

test('half speed doubles transition and excerpt duration while all four clicks follow the same slowed clock',async()=>{
 const {engine}=setup(false);engine.configure({speed:.5});await engine.launch();
 const song=songs()[0],clicks=audio.sources.filter(source=>source.options.url.url.endsWith('/click.wav'));
 assert.equal(song.options.playbackRate,.5);assert.equal(song.offset,41);near(song.duration,93.988);
 near(song.at,10.03+2*240/128);assert.equal(clicks.length,4);
 clicks.forEach((click,i)=>{near(click.at,10.03+i*120/128);assert.equal(click.options.playbackRate,undefined,'clicks retain their crisp normal pitch');});
 audio.now=song.at+.02;assert.equal(engine.frame().phase,'playing');near(engine.frame().music,.01);
 audio.now=song.at+10;engine.pause();near(engine.frame().music,5);
 audio.now=100;engine.resume();const resumed=songs().at(-1);assert.equal(resumed.options.playbackRate,.5);near(resumed.offset,46);near(resumed.duration,83.988);
 engine.seek(engine.snapshot().settings.transition+20);near(songs().at(-1).offset,61);near(songs().at(-1).duration,53.988);
 engine.seek(engine.snapshot().settings.transition+47);const count=songs().length;
 audio.now+=1.4;engine.update();assert.equal(engine.snapshot().status,'finished');assert.equal(songs().length,count,'the slowed excerpt cannot run beyond 01:28');
 engine.stop();engine.configure({speed:1});await engine.launch();assert.equal(songs().at(-1).options.playbackRate,undefined);near(songs().at(-1).duration,46.988);engine.dispose();
});

test('practice speed restores from storage and unsupported values fall back to normal speed',()=>{
 assert.equal(validSodaPopSettings({speed:.75}).speed,1);
 const saved=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 try{const first=setup(false).engine;first.configure({speed:.5});first.dispose();const second=setup(false).engine;assert.equal(second.snapshot().settings.speed,.5);second.dispose();}finally{if(saved===undefined)delete globalThis.localStorage;else globalThis.localStorage=saved;}
});

test('Soda Pop stays manual-only even with an older saved automatic setting; the manual launch still works',async()=>{
 const saved=globalThis.localStorage,values=new Map([['stage-piano-soda-pop-v1',JSON.stringify({...defaultSodaPopSettings,automatic:true})]]);
 globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const state=setup(false),engine=state.engine;
 try{
  assert.equal(engine.snapshot().settings.automatic,false);
  assert.equal(JSON.parse(values.get('stage-piano-soda-pop-v1')).automatic,false,'migrate the saved profile');
  await engine.prepare();engine.configure({automatic:true});
  assert.equal(engine.readyForAutomatic(),false);
  assert.equal(engine.automatic(20),false);assert.equal(state.before(),0);assert.equal(songs().length,0);
  await engine.launch();assert.equal(state.before(),1);assert.equal(songs().length,1);
 }finally{engine.dispose();if(saved===undefined)delete globalThis.localStorage;else globalThis.localStorage=saved;}
});
