import test from 'node:test';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export * from './src/piano/liveKeyHistory';export {default as LiveKeysHud} from './src/components/LiveKeysHud';export {default as PerformanceHeader} from './src/components/PerformanceHeader';export {starlightColor} from './src/components/starlight';export * from './src/opening/pianoTyping';export {default as PianoTypingReveal,pianoTypingStyle} from './src/opening/PianoTypingReveal';export * from './src/piano/liveNotes';export * from './src/piano/noteMapping';export * from './src/piano/interstellarPresentation';
export {levelsEMajor} from './src/piano/levelsRealPiano';
export {default as OfflineErrorScreen,offlineErrorStyle} from './src/opening/OfflineErrorScreen';export * from './src/opening/typingTest';export {default as TypingTestScreen} from './src/opening/TypingTestScreen';export * from './src/opening/sequence';export * from './src/opening/fragments';export * from './src/opening/choreography';export * from './src/opening/fractureRenderer';export * from './src/opening/renderBudget';export * from './src/opening/fractureRuntime';
export {default as OpeningReveal,csaLogoMask,openingStyle} from './src/opening/OpeningReveal';
export * from './src/piano/keyboardInput';export * from './src/piano/interstellarPerformance';
export * from './src/piano/interstellarMix';export * from './src/piano/pedalInput';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:createRequire(import.meta.url).resolve(args.path),external:true}));}}]});
const output='/private/tmp/mr-pink-opening-sequence-test.mjs';writeFileSync(output,bundle.outputFiles[0].text);
const api=await import(pathToFileURL(output).href);
const {OpeningSequence,openingCues,openingTiming,logoFragments,OpeningReveal,csaLogoMask,openingStyle,KeyboardInputManager,mapForInterstellarSection,moveInterstellarSection,planInterstellarPress,defaultInterstellarMix,PedalInput}=api;
function clock(){let now=0,next=1;const pending=new Map();return {now:()=>now,request:fn=>{const id=next++;pending.set(id,fn);return id;},cancel:id=>pending.delete(id),advance:value=>{now=value;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);},count:()=>pending.size};}
const key=(value,code=value===' '?'Space':`Key${value.toUpperCase()}`)=>({key:value,code,repeat:false,metaKey:false,ctrlKey:false,altKey:false,isComposing:false});
function type(sequence,value){for(const character of value){const event=key(character);sequence.keyDown(event);sequence.keyUp(event);}}

test('real typing normalizes case, permits Backspace and requires the complete intended message',()=>{
 const time=clock(),sequence=new OpeningSequence(time);sequence.start();
 type(sequence,'i love csx');assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');
 sequence.keyDown(key('Backspace','Backspace'));sequence.keyUp(key('Backspace','Backspace'));
 assert.equal(sequence.getSnapshot().message,'I LOVE CS');
 sequence.keyDown(key('a'));assert.equal(sequence.getSnapshot().scene,'MESSAGE_COMPLETE');
 assert.equal(sequence.getSnapshot().message,'I LOVE CSA');assert.equal(time.count(),1);
 sequence.keyDown({...key('a'),repeat:true});assert.equal(time.count(),1);
});

test('one configurable timeline holds the recognizable logo, intentionally overlaps fracture/reveal, and activates once',()=>{
 const time=clock(),sequence=new OpeningSequence(time),scenes=[];sequence.subscribe(state=>scenes.push(state.scene));
 sequence.start();type(sequence,'I LOVE CSA');
 for(const [at,expected] of [[499,'MESSAGE_COMPLETE'],[500,'LOGO_FORMATION'],[1649,'LOGO_FORMATION'],[1650,'LOGO_HOLD'],[3649,'LOGO_HOLD'],[3650,'LOGO_FRACTURE'],[openingCues.reveal,'PIANO_REVEAL'],[openingCues.active,'TYPING_PIANO_REVEAL']]){
  time.advance(at);assert.equal(sequence.getSnapshot().scene,expected);assert.ok(time.count()<=1);
 }
 assert.equal(time.count(),0);time.advance(9999);assert.equal(scenes.filter(scene=>scene==='TYPING_PIANO_REVEAL').length,1);
 assert.equal(openingCues.active,6450);assert.ok(openingCues.reveal<openingCues.fracture+openingTiming.fracture);
 assert.equal(sequence.capturing,false);
});

test('replays, cancellation, duplicate crash hooks and long frame stalls cannot overlap or reactivate old runs',()=>{
 const time=clock(),sequence=new OpeningSequence(time);sequence.crashComplete();type(sequence,'I LO');
 const run=sequence.getSnapshot().run;sequence.crashComplete();assert.equal(sequence.getSnapshot().run,run);assert.equal(sequence.getSnapshot().message,'I LO');
 sequence.start('full');time.advance(600);assert.equal(sequence.getSnapshot().scene,'LOGO_FORMATION');
 sequence.start('logo');assert.equal(time.count(),1);assert.equal(sequence.getSnapshot().animationOffset,openingCues.hold);
 sequence.cancel();assert.equal(time.count(),0);time.advance(10000);assert.equal(sequence.getSnapshot().scene,'IDLE');
 sequence.start('full');time.advance(20000);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');assert.equal(time.count(),0);
 const activeRun=sequence.getSnapshot().run;sequence.crashComplete();assert.equal(sequence.getSnapshot().run,activeRun,'stale crash cannot restart a live performance');
 sequence.reset();assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.equal(sequence.getSnapshot().message,'');
 sequence.start('full');sequence.dispose();assert.equal(time.count(),0);
});

class Target{listeners=new Map();addEventListener(name,fn){this.listeners.set(name,[...(this.listeners.get(name)??[]),fn]);}removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)??[]).filter(x=>x!==fn));}dispatch(name,event){for(const fn of this.listeners.get(name)??[])fn(event);}}

test('the existing input manager routes typing silently, quarantines held keys, and hands off the real section maps and sustain',()=>{
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 const time=clock(),sequence=new OpeningSequence(time),attacks=[],released=[],cue=new api.FirstNoteCue();let section=1,cursor=0,pedal=0,ripples=0;
 const manager=new KeyboardInputManager(mapForInterstellarSection(1),{
  routeKeyDown:event=>sequence.keyDown(event),routeKeyUp:event=>sequence.keyUp(event),
  pitchForKey:(event,transpose)=>sequence.pianoTyping?api.pianoTypingPitch(event.code,event.shiftKey,transpose):undefined,
  noteOn:(midi,code)=>{const plan=planInterstellarPress(section,code,midi,cursor,defaultInterstellarMix);cursor=plan.nextCursor;attacks.push({code,midi,pitches:plan.voices.map(voice=>voice.midi)});if(cue.consume())ripples++;},
  noteOff:(midi,code)=>released.push({midi,code}),change:()=>{},
 });
 manager.setReservedCodes(['Space','ArrowLeft','ArrowRight']);manager.setEnabled(false);
 sequence.subscribe(state=>{if(state.scene==='TYPING_PIANO_REVEAL')manager.setEnabled(true);if(state.scene==='INTERSTELLAR_ACTIVE'){manager.setEnabled(true);cue.arm();}});
 const pedalInput=new PedalInput(()=>pedal++);
 window.addEventListener('keydown',event=>{
  if(event.defaultPrevented||sequence.capturing||sequence.isQuarantined(event.code))return;
  pedalInput.keydown(event);
  if(event.code==='ArrowRight') {section=moveInterstellarSection(section,1);cursor=0;manager.setMap(mapForInterstellarSection(section),true);}
 });
 window.addEventListener('keyup',event=>pedalInput.keyup(event));
 const dispatch=(type,event)=>{event.preventDefault=()=>{event.defaultPrevented=true;};window.dispatch(type,event);};
 try{
  sequence.start();
  for(const character of 'i love cs'){dispatch('keydown',key(character));dispatch('keyup',key(character));}
  dispatch('keydown',key('a'));assert.equal(pedal,0);assert.deepEqual(attacks,[]);
  dispatch('keydown',key('f'));dispatch('keydown',key('ArrowRight','ArrowRight'));
  time.advance(openingCues.active);assert.equal(section,1);assert.deepEqual(attacks,[]);
  dispatch('keydown',{...key('f'),repeat:true});assert.deepEqual(attacks,[]);
  dispatch('keyup',key('f'));dispatch('keyup',key('a'));dispatch('keyup',key('ArrowRight','ArrowRight'));sequence.finishPianoTyping();
  assert.equal(ripples,0);dispatch('keydown',key(' '));dispatch('keyup',key(' '));assert.equal(ripples,0,'sustain is not a piano note');pedal=0;
  dispatch('keydown',key('f'));dispatch('keyup',key('f'));assert.deepEqual(attacks.at(-1).pitches,[76]);assert.equal(ripples,1);
  dispatch('keydown',key('ArrowRight','ArrowRight'));dispatch('keyup',key('ArrowRight','ArrowRight'));assert.equal(section,2);
  dispatch('keydown',key('c'));dispatch('keyup',key('c'));assert.deepEqual(attacks.at(-1).pitches,[69,64]);
  dispatch('keydown',key(' '));dispatch('keyup',key(' '));assert.equal(pedal,1);
  dispatch('keydown',key('ArrowRight','ArrowRight'));dispatch('keyup',key('ArrowRight','ArrowRight'));assert.equal(section,3);
  dispatch('keydown',key('f'));dispatch('keyup',key('f'));assert.deepEqual(attacks.at(-1).pitches,[76,88]);
  assert.equal(released.length,attacks.length);assert.equal(ripples,1);
 }finally{manager.dispose();sequence.dispose();}
});

test('the original logo asset retains its aspect and a full, contiguous source-mask fracture mesh',()=>{
 const bytes=readFileSync('public'+csaLogoMask);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),798);assert.equal(bytes.readUInt32BE(20),824);
 assert.equal(logoFragments.length,14);
 let area=0;
 for(const fragment of logoFragments){const points=fragment.polygon;area+=Math.abs(points.reduce((sum,[x,y],i)=>sum+x*points[(i+1)%points.length][1]-y*points[(i+1)%points.length][0],0))/2;}
 assert.equal(area,10000,'geometric regions exactly cover the complete original image plane');
 const sequence=new OpeningSequence(clock());sequence.start('logo');const snapshot=sequence.getSnapshot();
 const html=renderToStaticMarkup(createElement(OpeningReveal,{snapshot}));
 assert.equal((html.match(/class="csa-fracture-canvas"/g)??[]).length,1);assert.doesNotMatch(html,/csa-fragment-clip/);assert.match(html,/Original CSA logo/);
 assert.match(html,/logo-mask.png/);assert.equal(openingStyle(snapshot)['--opening-logo-hold-at'],'0ms');
});


test('Escape and the existing F9 panic cancel every pending transition and preserve release quarantine',()=>{
 for(const code of ['Escape','F9']) {
  const time=clock(),sequence=new OpeningSequence(time);sequence.start('full');
  assert.equal(sequence.keyDown(key(code,code)),true);assert.equal(sequence.getSnapshot().scene,'IDLE');assert.equal(time.count(),0);
  assert.equal(sequence.isQuarantined(code),true);assert.equal(sequence.keyUp(key(code,code)),true);assert.equal(sequence.isQuarantined(code),false);
  time.advance(10000);assert.equal(sequence.getSnapshot().scene,'IDLE');
 }
});

test('reset during a scene notification cannot leave the previous run scheduled',()=>{
 const time=clock(),sequence=new OpeningSequence(time);
 sequence.subscribe(state=>{if(state.scene==='LOGO_FORMATION')sequence.reset();});
 sequence.start('full');time.advance(500);
 assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.equal(time.count(),0);
 time.advance(9999);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');
});

const {fractureSettings,fragmentPose,fragmentStart,revealBounds,createRevealParticles,particlePose,FirstNoteCue}=api;
function contains(polygon,x,y){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
test('natural logo cut regions partition the source with no holes or overlapping fragments',()=>{
 for(let x=.37;x<100;x+=.83)for(let y=.29;y<100;y+=.79){assert.equal(logoFragments.filter(f=>contains(f.polygon,x,y)).length,1,`source ${x},${y}`);}
 const b=revealBounds(1920,1080);
 for(const f of logoFragments){const pose=fragmentPose(f,0,b);assert.equal(pose.x,0);assert.equal(pose.y,0);assert.equal(pose.alpha,1);assert.equal(pose.scaleX,1);assert.equal(pose.scaleY,1);}
});
test('center separation precedes the outer arcs, with accelerating travel and clean final dissolution',()=>{
 const b=revealBounds(1920,1080),center=logoFragments.find(f=>f.id==='letter-s'),ring=logoFragments.find(f=>f.id==='upper-right-arc');
 assert.equal(fragmentStart(center),250);assert.ok(fragmentStart(ring)>=500);
 const central=fragmentPose(center,450,b),outer=fragmentPose(ring,450,b);
 assert.ok(Math.hypot(central.x,central.y)>4);assert.equal(outer.x,0);assert.equal(outer.y,0);assert.equal(outer.alpha,1);
 assert.ok(fragmentPose(center,800,b).flight>fragmentPose(center,650,b).flight);
 for(const f of logoFragments){assert.equal(fragmentPose(f,fractureSettings.duration,b).alpha,0);}
});
test('seeded particles are bounded, reproducible, expire before handoff and stay finite across laptop/projector sizes',()=>{
 const particles=createRevealParticles();assert.deepEqual(particles,createRevealParticles());
 assert.equal(particles.length,fractureSettings.shards+fractureSettings.energyParticles+fractureSettings.atmosphereParticles);
 assert.ok(particles.length<200);
 for(const [w,h] of [[1366,768],[1920,1080],[3840,2160],[1024,768]]){
  const b=revealBounds(w,h);assert.equal(b.keyboardY,h*.7);assert.equal(b.galaxy[0],w*.8);
  for(let ms=0;ms<=fractureSettings.duration;ms+=40){
   for(const f of logoFragments){const pose=fragmentPose(f,ms,b);assert.ok(Object.values(pose).every(Number.isFinite));assert.ok(pose.scaleX>0&&pose.scaleY>0);assert.ok(pose.alpha>=0&&pose.alpha<=1);}
   for(const p of particles){const pose=particlePose(p,ms,b);assert.ok(Object.values(pose).every(Number.isFinite));assert.ok(pose.alpha>=0&&pose.alpha<=1);}
  }
 }
 for(const p of particles){assert.ok(p.born+p.life<fractureSettings.duration);assert.equal(particlePose(p,fractureSettings.duration,revealBounds(1366,768)).alpha,0);}
});
test('first-note acknowledgement is armed only at handoff, fires once, and rearms cleanly for rehearsal',()=>{
 const cue=new FirstNoteCue();assert.equal(cue.consume(),false);cue.arm();assert.equal(cue.consume(),true);assert.equal(cue.consume(),false);
 cue.arm();cue.reset();assert.equal(cue.consume(),false);cue.arm();assert.equal(cue.consume(),true);
});

test('the actual fracture renderer stays bounded, balances canvas state and draws nothing after handoff',()=>{
 const calls=[],stack=[];
 const makeContext=()=>new Proxy({
  save(){stack.push(1);},restore(){assert.ok(stack.length);stack.pop();},
  createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};},
  getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(255)};},
 },{get(target,name){if(name in target)return target[name];return (...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(name));calls.push([name,...args]);};},set(target,name,value){target[name]=value;return true;}});
 const prior=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:makeContext})};
 try{
  const artwork=api.makeFractureArtwork({naturalWidth:798,naturalHeight:824});
  assert.equal(artwork.pieces.length,14);assert.equal(artwork.sprites.length,4);
  const b=revealBounds(1920,1080),ctx=makeContext();
  for(const ms of [0,125,250,410,550,700,900,1100,1399]){calls.length=0;api.drawFracture(ctx,ms,b,artwork);assert.equal(stack.length,0);if(ms<1365)assert.ok(calls.some(call=>call[0]==='drawImage'),`visible artwork at ${ms}`);assert.ok(calls.length<1600,'bounded canvas commands');}
  calls.length=0;api.drawFracture(ctx,600,b,artwork,true);assert.equal(calls.filter(call=>call[0]==='drawImage').length,1,'reduced motion uses one intact fading logo');
  calls.length=0;api.drawFracture(ctx,1400,b,artwork);assert.equal(calls.length,0,'final scene has no residual opening render work');
 }finally{globalThis.document=prior;}
});

test('secondary emission samples the real alpha contours and remains bounded per logo region',()=>{
 const w=120,h=120,alpha=new Uint8ClampedArray(w*h*4);
 // A perforated source silhouette puts real contours inside every cut region.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x%12<8&&y%12<8)alpha[(y*w+x)*4+3]=255;
 const edges=api.sourceEdgeAnchors(alpha,w,h);
 assert.deepEqual(edges,api.sourceEdgeAnchors(alpha,w,h));assert.equal(edges.length,14);
 for(let index=0;index<edges.length;index++) {
  assert.ok(edges[index].length>1&&edges[index].length<=96);
  for(const [x,y] of edges[index]) {
   assert.ok(api.pointInFragment(logoFragments[index].polygon,x,y));
   const px=Math.round(x/100*w),py=Math.round(y/100*h);
   assert.equal(alpha[(py*w+px)*4+3],255,'anchors stay on source artwork');
   const neighbor=(dx,dy)=>px+dx<0||py+dy<0||px+dx>=w||py+dy>=h?0:alpha[((py+dy)*w+px+dx)*4+3];
   assert.equal(Math.min(neighbor(-3,0),neighbor(3,0),neighbor(0,-3),neighbor(0,3)),0,'an actual contour, not a piece center');
  }
 }
 const particles=createRevealParticles(),b=revealBounds(1920,1080);
 for(let i=0;i<particles.length;i++) {
  const particle=particles[i],anchors=edges[particle.fragment];
  const pose=particlePose(particle,particle.born+20,b,anchors[i%anchors.length]);
  assert.ok(Object.values(pose).every(Number.isFinite));
 }
});
test('fragment/trail colors pass smoothly through violet into blue-white without threshold jumps',()=>{
 const channels=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 assert.equal(api.fractureLightColor(0),'#ef4a5e');assert.equal(api.fractureLightColor(1),'#f5f9ff');
 const violet=channels(api.fractureLightColor(1/3));assert.ok(violet[0]>violet[1]&&violet[2]>violet[0]);
 let previous=channels(api.fractureLightColor(0));
 for(let i=1;i<=300;i++){const next=channels(api.fractureLightColor(i/300));assert.ok(next.every((value,index)=>Math.abs(value-previous[index])<=2));previous=next;}
});

function reliableClock(){
 let now=0,next=1;const frames=new Map(),timers=new Map();
 return {now:()=>now,request:fn=>{const id=next++;frames.set(id,fn);return id;},cancel:id=>frames.delete(id),
  setTimer:(fn,ms)=>{const id=next++;timers.set(id,{at:now+ms,fn});return id;},clearTimer:id=>timers.delete(id),
  set:value=>{now=value;},timers:value=>{now=value;for(const [id,item] of [...timers])if(item.at<=now){timers.delete(id);item.fn();}},
  frames:()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},
  counts:()=>({frames:frames.size,timers:timers.size}),pending:()=>[...timers.values()].map(item=>item.fn),
 };
}
test('the input deadline activates without animation frames and cancels stale timers across reset/replay',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time),active=[];
 sequence.subscribe(state=>{if(state.scene==='TYPING_PIANO_REVEAL')active.push(state.run);});
 sequence.start('full');const stale=time.pending()[0];time.timers(openingCues.active-1);assert.equal(sequence.capturing,true);
 time.timers(openingCues.active);assert.equal(sequence.capturing,false);assert.equal(active.length,1);assert.deepEqual(time.counts(),{frames:0,timers:0});
 time.frames();assert.equal(active.length,1);
 sequence.start('full');stale();assert.equal(time.counts().timers,1,'a stale callback cannot lose the new timer handle');sequence.reset();stale();assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.deepEqual(time.counts(),{frames:0,timers:0});
 type(sequence,'I LOVE CSA');assert.equal(time.counts().timers,1);sequence.cancel();assert.deepEqual(time.counts(),{frames:0,timers:0});
 sequence.start('logo');assert.equal(sequence.getSnapshot().scene,'LOGO_HOLD');assert.equal(sequence.timelineElapsed(),openingCues.hold);
 sequence.dispose();assert.deepEqual(time.counts(),{frames:0,timers:0});
});
test('the first physical event after a blocked event loop uses the deadline without swallowing a fresh note',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start();type(sequence,'I LOVE CS');sequence.keyDown(key('a'));
 time.set(openingCues.active+30);assert.equal(sequence.keyDown(key('f')),false);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');
 assert.equal(sequence.keyDown({...key('a'),repeat:true}),true,'the closing message key stays quarantined');sequence.keyUp(key('a'));
 assert.equal(sequence.keyDown(key('a')),false);assert.deepEqual(time.counts(),{frames:0,timers:0});
});
test('visual failures hand off once to the same active state and retain held-key quarantine',()=>{
 for(const fallback of ['asset','render','slow','focus']){
  const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start('full');sequence.keyDown(key('f'));
  const run=sequence.getSnapshot().run;sequence.revealPiano(fallback);
  assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');assert.equal(sequence.getSnapshot().fallback,fallback);assert.equal(sequence.getSnapshot().run,run);
  assert.equal(sequence.keyDown({...key('f'),repeat:true}),true);sequence.keyUp(key('f'));assert.equal(sequence.keyDown(key('f')),false);
  sequence.revealPiano('render');assert.equal(sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(sequence.getSnapshot().fallback,'render');assert.deepEqual(time.counts(),{frames:0,timers:0});
 }
 const sequence=new OpeningSequence(reliableClock());sequence.start();sequence.revealPiano('asset');assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY','missing artwork still permits message entry');
 sequence.revealPiano('render');assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL','an entry UI exception cannot trap input');
});
test('quality drops secondary effects before a prolonged severe overload requests a live-piano fallback',()=>{
 const budget=new api.OpeningRenderBudget();for(let i=0;i<20;i++)assert.equal(budget.observe(16.7,3),false);assert.equal(budget.quality,0);
 for(let i=0;i<4;i++)assert.equal(budget.observe(38,12),false);assert.equal(budget.quality,1);
 for(let i=0;i<4;i++)assert.equal(budget.observe(38,12),false);assert.equal(budget.quality,2);
 assert.equal(budget.observe(130,46),false);assert.equal(budget.observe(130,46),false);assert.equal(budget.observe(130,46),true);
});

function visualRuntimeHarness(run){
 const names=['window','document','ResizeObserver','Image','performance','requestAnimationFrame','cancelAnimationFrame'];
 const saved=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 let now=0,id=0,images=[],observers=[],drawThrows=false,rectThrows=false;const frames=new Map(),listeners=new Map(),failures=[];
 const ctx=new Proxy({getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(255)}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},
 {get:(target,name)=>name in target?target[name]:(...args)=>{if(drawThrows)throw Error('injected canvas failure');for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));},set:(target,name,value)=>{target[name]=value;return true;}});
 const canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>{if(rectThrows)throw Error('injected resize failure');return {width:1920,height:1080};},closest:()=>({querySelector:()=>({getBoundingClientRect:()=>({height:324})})}),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const mocks={window:{devicePixelRatio:2,matchMedia:()=>({matches:false})},document:{createElement:()=>({width:0,height:0,getContext:()=>ctx})},
 ResizeObserver:class{constructor(fn){this.callback=fn;this.active=true;observers.push(this);}observe(){}disconnect(){this.active=false;}},
 Image:class{naturalWidth=798;naturalHeight=824;onload=null;onerror=null;constructor(){images.push(this);}},
 performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 try {
  for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:mocks[name]});
  run({canvas,failures,ctx,start:()=>api.startFracture(canvas,0,'logo.png',reason=>failures.push(reason)),
   images:()=>images,observers:()=>observers,throwDraw:()=>{drawThrows=true;},throwRect:()=>{rectThrows=true;},
   advance:ms=>{now=ms;const list=[...frames.values()];frames.clear();list.forEach(fn=>fn(ms));},
   lost:()=>listeners.get('contextlost')?.({preventDefault(){}}),
   assertClean:()=>{assert.equal(frames.size,0);assert.equal(listeners.size,0);assert.ok(observers.every(item=>!item.active));assert.ok(images.every(image=>image.onload===null&&image.onerror===null));assert.equal(canvas.width,1);assert.equal(canvas.height,1);},
  });
 }finally{for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
}
test('null contexts, asset errors, cache failures, draw failures, resize failures and context loss all release visual resources',()=>{
 for(const kind of ['context','asset','cache','draw','resize','lost'])visualRuntimeHarness(h=>{
  if(kind==='context')h.canvas.getContext=()=>null;
  const stop=h.start();
  if(kind==='asset')h.images()[0].onerror();
  if(kind==='cache'){h.throwDraw();h.images()[0].onload();}
  if(kind==='draw'){h.images()[0].onload();h.throwDraw();h.advance(openingCues.fracture+10);}
  if(kind==='resize'){h.throwRect();h.observers()[0].callback();}
  if(kind==='lost')h.lost();
  assert.deepEqual(h.failures,[kind==='asset'?'asset':'render']);h.assertClean();stop();h.assertClean();
 });
});
test('rehearsal cancels frames, observers, source callbacks and buffers after repeated partial and complete runs',()=>{
 visualRuntimeHarness(h=>{
  for(let i=0;i<8;i++){
   const stop=h.start();h.images().at(-1).onload();h.advance(i%2?openingCues.active:openingCues.fracture+500);stop();h.assertClean();
  }
  assert.deepEqual(h.failures,[]);
 });
});
test('sustained slow rendering reduces canvas resolution before requesting an early piano handoff',()=>{
 visualRuntimeHarness(h=>{
  h.start();h.images()[0].onload();assert.ok(h.canvas.width>1920);
  h.advance(openingCues.fracture);
  for(let i=1;i<=4;i++)h.advance(openingCues.fracture+i*40);
  assert.equal(h.canvas.width,1920);assert.deepEqual(h.failures,[]);
  for(let i=1;i<=8&&h.failures.length===0;i++)h.advance(openingCues.fracture+160+i*150);
  assert.deepEqual(h.failures,['slow']);h.assertClean();
 });
});

test('simultaneous notes, repeated keydowns, rapid sequences, focus loss and resets stay balanced across live handoffs',()=>{
 const priorWindow=globalThis.window,priorDocument=globalThis.document;
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 const time=reliableClock(),sequence=new OpeningSequence(time),held=new Map();let attacks=0,releases=0,sustain=false;
 const manager=new KeyboardInputManager(mapForInterstellarSection(1),{
  routeKeyDown:event=>sequence.keyDown(event),routeKeyUp:event=>sequence.keyUp(event),
  pitchForKey:(event,transpose)=>sequence.pianoTyping?api.pianoTypingPitch(event.code,event.shiftKey,transpose):undefined,
  noteOn:(midi,code)=>{assert.equal(held.has(code),false);held.set(code,midi);attacks++;},
  noteOff:(midi,code)=>{assert.equal(held.get(code),midi);held.delete(code);releases++;},change:()=>{},
 });
 const pedal=new PedalInput(()=>{sustain=!sustain;});manager.setReservedCodes(['Space','ArrowLeft','ArrowRight']);
 sequence.subscribe(state=>{if(state.scene==='INTERSTELLAR_ACTIVE'){manager.releaseAll();manager.setEnabled(true);pedal.reset();}});
 window.addEventListener('keydown',event=>{if(!event.defaultPrevented&&!sequence.capturing&&!sequence.isQuarantined(event.code))pedal.keydown(event);});
 window.addEventListener('keyup',event=>pedal.keyup(event));
 const focusLoss=()=>{sequence.releasePhysicalKeys();if(sequence.capturing)sequence.revealPiano('focus');manager.releaseAll();pedal.reset();sustain=false;};
 window.addEventListener('blur',focusLoss);document.addEventListener('visibilitychange',()=>{if(document.hidden)focusLoss();});
 const dispatch=(name,event)=>{event.preventDefault=()=>{event.defaultPrevented=true;};window.dispatch(name,event);};
 const down=(value,extra={})=>dispatch('keydown',{...key(value),...extra}),up=value=>dispatch('keyup',key(value));
 const begin=()=>{manager.setEnabled(false);pedal.reset();sustain=false;sequence.start();};
 try{
  for(let run=0;run<5;run++){
   begin();const origin=time.now();
   for(const character of 'I LOVE CS'){down(character);up(character);}down('a');down('f');
   time.timers(origin+openingCues.active);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL',JSON.stringify(sequence.getSnapshot()));sequence.finishPianoTyping();down('f',{repeat:true});assert.equal(held.size,0);up('f');up('a');
   const before=attacks;down('u');down('p');down('f');down('u',{repeat:true});assert.equal(attacks-before,3);assert.equal(held.size,3);
   down(' ');up(' ');assert.equal(sustain,true);up('u');up('f');assert.equal(held.size,1,'physical releases dispatch immediately while sustained');
   begin();assert.equal(held.size,0,'reset releases the remaining active note');up('p');
   sequence.start('piano');
   for(let i=0;i<24;i++){down('u');up('u');}assert.equal(held.size,0);
   down('p');down('f');window.dispatch('blur',{});assert.equal(held.size,0);assert.equal(sustain,false);
   down('p',{repeat:true});assert.equal(held.size,0,'a held key returning from Alt-Tab cannot retrigger on repeat');up('p');up('f');
   down('u');document.hidden=true;document.dispatch('visibilitychange',{});assert.equal(held.size,0);document.hidden=false;up('u');
  }
  assert.equal(attacks,releases);assert.deepEqual(time.counts(),{frames:0,timers:0});
 }finally{manager.dispose();sequence.dispose();globalThis.window=priorWindow;globalThis.document=priorDocument;}
});

const {IntroTypingTest,introTypingConfig,typingMetrics,TypingTestScreen}=api;
const introToMessage=introTypingConfig.completionHold+introTypingConfig.crashDuration;
const introduction="Hi, my name is Eric, and I can type relatively fast. I'm a junior and I represent CSA. I made this entire program for you guys, so I hope you enjoy the show";
const physicalKey=value=>({...key(value,({' ':"Space",'.':'Period','!':'Digit1',',':'Comma',"'":'Quote'})[value]??`Key${value.toUpperCase()}`),shiftKey:/[A-Z!]/.test(value)});
function physicalType(sequence,value){for(const character of value){const event=physicalKey(character);sequence.keyDown(event);sequence.keyUp(event);}}
test('the exact configurable passage is fully visible, dim and waiting before any physical typing',()=>{
 assert.equal(introTypingConfig.passage,introduction);
 const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start('typing');
 assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');assert.equal(sequence.getSnapshot().typing.startedAt,null);assert.deepEqual(time.counts(),{frames:0,timers:0});
 time.timers(600000);assert.equal(sequence.getSnapshot().scene,'TYPING_TEST','a fixed timer cannot trigger the crash');
 const html=renderToStaticMarkup(createElement(TypingTestScreen,{snapshot:sequence.getSnapshot()}));
 assert.equal((html.match(/is-upcoming/g)??[]).length,introduction.length);assert.match(html,/Words per minute/);assert.match(html,/Typing accuracy/);
 assert.doesNotMatch(html,/INTERSTELLAR|galaxy|csa-logo|is-crashing/);
 const displayed=[...html.matchAll(/class="intro-character[^"]*"[^>]*>([^<]*)</g)].map(match=>match[1].replaceAll('&#x27;',"'")).join('');assert.equal(displayed,introduction);
});
test('typing preserves punctuation/case, starts on the first printable character and retains error history after Backspace',()=>{
 const model=new IntroTypingTest('Hello');assert.equal(model.input('Shift',100),false);assert.equal(model.input('Backspace',1000),false);assert.equal(model.snapshot().startedAt,null);
 model.input('h',2000);assert.equal(model.snapshot().startedAt,2000);assert.equal(model.snapshot().finishedAt,null);assert.equal(typingMetrics(model.snapshot(),3000).accuracy,0);
 model.input('Backspace',3100);assert.equal(model.snapshot().input,'');assert.equal(model.snapshot().startedAt,2000);
 model.input('H',4000);model.input('e',5000);model.input('l',6000);model.input('l',7000);model.input('o',8000);
 const state=model.snapshot();assert.equal(state.finishedAt,8000);assert.equal(state.correctAttempts,5);assert.equal(state.attempts,6);
 assert.equal(typingMetrics(state,8000).wpm,10);assert.ok(Math.abs(typingMetrics(state,8000).accuracy-500/6)<1e-10);
 assert.deepEqual(typingMetrics(state,800000),typingMetrics(state,8000),'final WPM and accuracy freeze');assert.equal(model.input('Backspace',9000),false);
 const custom=new IntroTypingTest("Hi, I'm Eric.");for(const character of custom.snapshot().passage)custom.input(character,1000);assert.notEqual(custom.snapshot().finishedAt,null);
});
test('live WPM uses five-character words and elapsed time, includes pauses and never fabricates a speed',()=>{
 const model=new IntroTypingTest('Hello world.');for(const character of 'Hello')model.input(character,1000);
 assert.equal(typingMetrics(model.snapshot(),1000).wpm,0);assert.equal(typingMetrics(model.snapshot(),7000).wpm,10);assert.equal(typingMetrics(model.snapshot(),13000).wpm,5);
 assert.equal(typingMetrics(model.snapshot(),13000).accuracy,100);
});
test('only an exactly completed introduction starts the 400 ms hold, then crash, then empty CSA message entry',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time),scenes=[];sequence.subscribe(state=>scenes.push(state.scene));sequence.start('typing');
 time.set(10000);physicalType(sequence,introduction.slice(0,-1));assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');
 time.timers(70000);assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');
 physicalType(sequence,introduction.at(-1));const finished=sequence.getSnapshot().typing;assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');
 assert.equal(typingMetrics(finished,70000).wpm,introduction.length/5);
 time.timers(70399);assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');time.timers(70400);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');
 assert.deepEqual(typingMetrics(sequence.getSnapshot().typing,71200),typingMetrics(finished,70000));
 time.timers(70000+introToMessage);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.equal(sequence.getSnapshot().message,'');assert.equal(sequence.capturing,true);
 assert.deepEqual(time.counts(),{frames:0,timers:0});assert.ok(scenes.includes('SIMULATED_CRASH'));
 physicalType(sequence,'I LOVE CSA');assert.equal(sequence.getSnapshot().scene,'MESSAGE_COMPLETE');
 time.set(70000+introToMessage+openingCues.hold);time.frames();assert.equal(sequence.getSnapshot().scene,'LOGO_HOLD');
 time.set(70000+introToMessage+openingCues.fracture);time.frames();assert.equal(sequence.getSnapshot().scene,'LOGO_FRACTURE');
 time.timers(70000+introToMessage+openingCues.active);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');
 physicalType(sequence,api.pianoTypingConfig.message);time.timers(time.now()+api.pianoTypingConfig.duration);assert.equal(sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');
});
test('an incorrect character cannot trigger crash even when the last period was physically entered',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time,'Hi.');sequence.start('typing');physicalType(sequence,'hi.');
 time.timers(100000);assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');assert.equal(sequence.getSnapshot().typing.finishedAt,null);assert.equal(time.counts().timers,0);
 for(let i=0;i<3;i++){sequence.keyDown(physicalKey('Backspace'));sequence.keyUp(physicalKey('Backspace'));}
 physicalType(sequence,'Hi.');assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');assert.equal(sequence.getSnapshot().typing.attempts,6);
});
test('uppercase, wrong-character rendering, repeated input and passage replay remain physical and deterministic',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time,'Hi.');sequence.start('typing');sequence.keyDown({...physicalKey('H'),repeat:true});assert.equal(sequence.getSnapshot().typing.startedAt,null);
 sequence.keyDown(physicalKey('Shift'));sequence.keyUp(physicalKey('Shift'));assert.equal(sequence.getSnapshot().typing.startedAt,null);
 physicalType(sequence,'h');const html=renderToStaticMarkup(createElement(TypingTestScreen,{snapshot:sequence.getSnapshot()}));assert.match(html,/is-incorrect/);assert.match(html,/Typed h; expected H/);
 sequence.start('typing');assert.equal(sequence.getSnapshot().typing.input,'');assert.equal(sequence.getSnapshot().typing.attempts,0);assert.equal(sequence.getSnapshot().typing.startedAt,null);
 physicalType(sequence,'Hi.');const stale=time.pending()[0];sequence.start('typing');stale();assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');assert.deepEqual(time.counts(),{frames:0,timers:0});
 physicalType(sequence,'Hi.');time.timers(400);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');sequence.cancel();time.timers(9000);assert.equal(sequence.getSnapshot().scene,'IDLE');assert.deepEqual(time.counts(),{frames:0,timers:0});
});
test('the actual keyboard manager keeps passage typing, punctuation, crash and CSA entry silent until live handoff',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;globalThis.document=new Target();document.hidden=false;
 const time=reliableClock(),sequence=new OpeningSequence(time,"Hi, I'm Eric."),notes=[];let pedal=0;
 const manager=new KeyboardInputManager(mapForInterstellarSection(1),{routeKeyDown:event=>sequence.keyDown(event),routeKeyUp:event=>sequence.keyUp(event),
  pitchForKey:(event,transpose)=>sequence.pianoTyping?api.pianoTypingPitch(event.code,event.shiftKey,transpose):undefined,noteOn:(midi,code)=>notes.push({midi,code}),noteOff:()=>{},change:()=>{}});
 manager.setEnabled(false);manager.setReservedCodes(['Space']);sequence.subscribe(state=>{if(state.scene==='INTERSTELLAR_ACTIVE')manager.setEnabled(true);});
 const sustain=new PedalInput(()=>pedal++);window.addEventListener('keydown',event=>{if(!event.defaultPrevented&&!sequence.capturing)sustain.keydown(event);});window.addEventListener('keyup',event=>sustain.keyup(event));
 const dispatch=(name,event)=>{event.preventDefault=()=>{event.defaultPrevented=true;};window.dispatch(name,event);};
 const type=value=>{for(const character of value){dispatch('keydown',physicalKey(character));dispatch('keyup',physicalKey(character));}};
 try{
  sequence.start('typing');time.set(1000);type("Hi, I'm Eric");dispatch('keydown',physicalKey('.'));assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');assert.deepEqual(notes,[]);assert.equal(pedal,0);
  time.timers(1400);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');dispatch('keydown',physicalKey('f'));assert.deepEqual(notes,[]);
  time.timers(1000+introToMessage);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');dispatch('keydown',{...physicalKey('.'),repeat:true});dispatch('keyup',physicalKey('.'));assert.equal(sequence.getSnapshot().message,'');
  type('I LOVE CS');dispatch('keydown',physicalKey('A'));time.timers(1000+introToMessage+openingCues.active);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');sequence.finishPianoTyping();
  dispatch('keydown',{...physicalKey('f'),repeat:true});assert.deepEqual(notes,[]);dispatch('keyup',physicalKey('f'));dispatch('keyup',physicalKey('A'));
  dispatch('keydown',physicalKey('f'));dispatch('keyup',physicalKey('f'));assert.deepEqual(notes,[{midi:76,code:'KeyF'}]);assert.equal(pedal,0);
 }finally{manager.dispose();sequence.dispose();globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

test('asset/focus failures and duplicate external crash hooks cannot bypass an active typing test',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time,'Hi.');sequence.start('typing');physicalType(sequence,'H');
 sequence.crashComplete();sequence.revealPiano('asset');sequence.revealPiano('focus');assert.equal(sequence.getSnapshot().scene,'TYPING_TEST');assert.equal(sequence.getSnapshot().typing.input,'H');
 physicalType(sequence,'i.');sequence.revealPiano('asset');assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');
 time.timers(400);sequence.crashComplete();assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');time.timers(introToMessage);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');
});


test('the Chrome-style error is entirely local, unbranded and includes the recognizable reference content',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time,'Hi.');sequence.start('typing');physicalType(sequence,'Hi.');time.timers(introTypingConfig.completionHold);
 const html=renderToStaticMarkup(createElement(api.OfflineErrorScreen,{snapshot:sequence.getSnapshot()}));
 assert.match(html,/class="offline-error-screen"/);assert.match(html,/<h1>No internet<\/h1>/);assert.match(html,/>Try:<\/p>/);
 assert.match(html,/Checking the network cables, modem, and router/);assert.match(html,/Reconnecting to Wi-Fi/);assert.match(html,/ERR_INTERNET_DISCONNECTED/);
 assert.match(html,/shape-rendering="crispEdges"/);assert.match(html,/viewBox="0 0 48 52"/);
 assert.doesNotMatch(html,/mr pink|Words per minute|Typing accuracy|piano|iframe|<script|href=|src=/i);
 const css=readFileSync('src/opening/offlineError.css','utf8');assert.match(css,/background:#fff/);assert.doesNotMatch(css,/@import|url\(/);
});
test('the error remains clean for its full recognition hold before glitch, fade and final blackout',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time,'Hi.');sequence.start('typing');physicalType(sequence,'Hi.');
 const hold=introTypingConfig.completionHold,clean=introTypingConfig.offlineHold,glitch=introTypingConfig.offlineGlitch,fade=introTypingConfig.offlineFade;
 assert.ok(hold>=300&&hold<=400);assert.ok(clean>=1500&&clean<=2000);
 time.timers(hold-1);assert.equal(sequence.getSnapshot().scene,'TYPING_COMPLETE');time.timers(hold);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');
 const error=sequence.getSnapshot();assert.equal(api.offlineErrorStyle(error,hold)['--offline-glitch-at'],`${clean}ms`);assert.equal(api.offlineErrorStyle(error,hold)['--offline-fade-at'],`${clean+glitch}ms`);
 time.timers(hold+clean-1);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');assert.equal(api.offlineErrorStyle(error,hold+clean-1)['--offline-glitch-at'],'1ms');
 assert.equal(api.offlineErrorStyle(error,hold+clean)['--offline-glitch-at'],'0ms');assert.equal(api.offlineErrorStyle(error,hold+clean+glitch)['--offline-fade-at'],'0ms');
 time.timers(hold+clean+glitch+fade);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH','blackout precedes message entry');
 time.timers(introToMessage-1);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');time.timers(introToMessage);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.equal(sequence.getSnapshot().message,'');
 assert.deepEqual(time.counts(),{frames:0,timers:0});
});

function withPianoTyping(run){
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 const time=reliableClock(),sequence=new OpeningSequence(time),notes=new api.LiveNotes(),attacks=[],releases=[],held=new Map(),cue=new api.FirstNoteCue();
 const keystrokes=[];
 let snapshot={pressed:[]},section=1,cursor=0,sustain=false,ripples=0;
 const manager=new KeyboardInputManager(mapForInterstellarSection(section),{
  routeKeyDown:event=>sequence.keyDown(event),routeKeyUp:event=>sequence.keyUp(event),
  pitchForKey:(event,transpose)=>sequence.pianoTyping?api.pianoTypingPitch(event.code,event.shiftKey,transpose):undefined,
  mappedKeyDown:key=>keystrokes.push(key),
  noteOn:(midi,code,at)=>{
   const plan=planInterstellarPress(section,code,midi,cursor,defaultInterstellarMix);cursor=plan.nextCursor;
   const sources=plan.voices.map(voice=>({source:`${code}:${voice.midi}`,midi:voice.midi}));held.set(code,sources);
   for(const source of sources)notes.on(source.source,source.midi,at);
   attacks.push({code,midi,pitches:plan.voices.map(voice=>voice.midi),text:sequence.getSnapshot().pianoText});if(cue.consume())ripples++;
  },
  noteOff:(midi,code,at)=>{releases.push({midi,code});for(const source of held.get(code)??[])notes.off(source.source,at,sustain);held.delete(code);},
  change:value=>{snapshot=value;},
 });
 manager.setReservedCodes(['Space','ArrowLeft','ArrowRight','F7','F8','F9','Escape']);
 const unsub=sequence.subscribe(state=>{
  if(state.scene==='TYPING_PIANO_REVEAL'){manager.setEnabled(true);cue.reset();}
  if(state.scene==='INTERSTELLAR_ACTIVE'){manager.setEnabled(true);cue.arm();}
 });
 const pedal=new PedalInput(()=>{sustain=!sustain;if(!sustain)notes.pedalUp(performance.now());});
 const pedalDown=event=>{if(!event.defaultPrevented&&!sequence.capturing&&!sequence.isQuarantined(event.code))pedal.keydown(event);};
 const pedalUp=event=>pedal.keyup(event);
 const blur=()=>{sequence.releasePhysicalKeys();manager.releaseAll();pedal.reset();sustain=false;notes.pedalUp(performance.now());};
 window.addEventListener('keydown',pedalDown);window.addEventListener('keyup',pedalUp);window.addEventListener('blur',blur);
 const key=value=>({...physicalKey(value),code:({'?':'Slash',Backspace:'Backspace',Shift:'ShiftLeft',ArrowRight:'ArrowRight'})[value]??physicalKey(value).code,shiftKey:/[A-Z?!]/.test(value)});
 const dispatch=(name,event)=>{event.preventDefault=()=>{event.defaultPrevented=true;};window.dispatch(name,event);};
 const down=(value,extra={})=>dispatch('keydown',{...key(value),...extra}),up=value=>dispatch('keyup',key(value));
 const type=value=>{for(const character of value){down(character);up(character);}};
 const reset=()=>{manager.setEnabled(false);notes.clear();sustain=false;pedal.reset();sequence.start('pianoTyping');};
 try{
  reset();run({time,sequence,manager,notes,attacks,releases,held,keystrokes,down,up,type,reset,blur,snapshot:()=>snapshot,sustain:()=>sustain,ripples:()=>ripples,section:value=>{section=value;cursor=0;manager.setMap(mapForInterstellarSection(value),true);}});
 }finally{
  unsub();manager.dispose();sequence.dispose();window.removeEventListener('keydown',pedalDown);window.removeEventListener('keyup',pedalUp);window.removeEventListener('blur',blur);
  assert.equal((window.listeners.get('keydown')??[]).length,0);assert.equal((window.listeners.get('keyup')??[]).length,0);
  globalThis.window=oldWindow;globalThis.document=oldDocument;
 }
}

test('one physical keydown edits actual text and dispatches the original pitch, key highlight and physical note trail',()=>{
 withPianoTyping(h=>{
  h.down('w');assert.equal(h.sequence.getSnapshot().pianoText,'W');assert.deepEqual(h.attacks,[{code:'KeyW',midi:55,pitches:[55],text:'W'}]);
  assert.deepEqual(h.snapshot().pressed.map(key=>({code:key.code,midi:key.midi})),[{code:'KeyW',midi:55}]);
  assert.equal(h.notes.visible(performance.now(),10000).at(-1).physicalEndMs,null);assert.deepEqual(api.interstellarDisplayPressedKeys(h.snapshot().pressed).map(key=>key.midi),[55]);
  h.down('w',{repeat:true});h.down('w');assert.equal(h.sequence.getSnapshot().pianoText,'W');assert.equal(h.attacks.length,1,'a held key cannot duplicate letters or notes');
  h.down('a');assert.equal(h.held.size,2);assert.equal(h.sequence.getSnapshot().pianoText,'WA');assert.equal(h.attacks.at(-1).midi,71);
  h.down('Backspace');h.up('Backspace');assert.equal(h.sequence.getSnapshot().pianoText,'W');assert.equal(h.held.size,2,'Backspace is not a synthetic keyup');
  h.up('a');h.up('w');assert.equal(h.held.size,0);assert.equal(h.snapshot().pressed.length,0);assert.ok(h.notes.visible(performance.now(),10000).every(note=>note.physicalEndMs!==null));
 });
});
test('WAIT!!! I CAN PLAY PIANO? is physically entered with original letter notes and three Roblox Shift+1 notes',()=>{
 withPianoTyping(h=>{
  const phrase=api.pianoTypingConfig.message.toLowerCase();
  h.type(phrase);assert.equal(h.sequence.getSnapshot().pianoText,api.pianoTypingConfig.message);assert.equal(h.sequence.getSnapshot().pianoCompletedAt,0);
  const map=mapForInterstellarSection(1),expected=[...phrase].flatMap(char=>{
   const code=({' ':'Space','.':'Period','?':'Slash','!':'Digit1'})[char]??`Key${char.toUpperCase()}`;
   const midi=api.pianoTypingPitch(code,char==='!'||char==='?')??api.getPitch(map,code,char==='?');return midi===null?[]:[{code,midi}];
  });
  assert.deepEqual(h.attacks.map(({code,midi})=>({code,midi})),expected);assert.equal(h.attacks.length,16);assert.deepEqual(h.attacks.filter(note=>note.code==='Digit1').map(note=>note.midi),[37,37,37]);
  assert.equal(api.getPitch(map,'KeyC',false),null);assert.equal(api.getPitch(map,'KeyN',false),null);assert.equal(api.getPitch(map,'KeyL',false),null);
  assert.equal(h.sustain(),false,'spaces type without toggling the sustain pedal');assert.equal(h.ripples(),0,'typing notes do not consume the real performance cue');
  assert.equal(h.releases.length,h.attacks.length);assert.equal(h.snapshot().pressed.length,0);
  h.time.timers(api.pianoTypingConfig.hold-1);assert.equal(h.sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');
  h.time.timers(api.pianoTypingConfig.duration-1);assert.equal(h.sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');
  const before=h.attacks.length;h.time.timers(api.pianoTypingConfig.duration);assert.equal(h.sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(h.attacks.length,before,'no automatic Interstellar note');
  h.down('f');assert.equal(h.attacks.at(-1).midi,76);assert.equal(h.ripples(),1);h.up('f');
  h.down(' ');h.up(' ');assert.equal(h.sustain(),true,'Space regains its existing pedal behavior');
  h.down('f');h.up('f');assert.equal(h.snapshot().pressed.length,0);const sustained=h.notes.visible(performance.now(),10000).at(-1);assert.notEqual(sustained.physicalEndMs,null);assert.equal(sustained.endMs,null);
  h.down(' ');h.up(' ');assert.equal(h.sustain(),false);assert.notEqual(sustained.endMs,null);
  h.section(2);h.down('c');assert.deepEqual(h.attacks.at(-1).pitches,[69,64]);h.up('c');h.section(3);h.down('f');assert.deepEqual(h.attacks.at(-1).pitches,[76,88]);h.up('f');
 });
});
test('wrong characters are actual input, Shift punctuation is preserved and completion never advances on a timer',()=>{
 withPianoTyping(h=>{
  h.down('Shift');h.up('Shift');assert.equal(h.attacks.length,0);assert.equal(h.sequence.getSnapshot().pianoText,'');
  h.down('w',{ctrlKey:true});h.up('w');assert.equal(h.attacks.length,0);assert.equal(h.sequence.getSnapshot().pianoText,'');
  h.type('wait!!p');assert.equal(h.sequence.getSnapshot().pianoText,'WAIT!!P');assert.equal(h.sequence.getSnapshot().pianoCompletedAt,undefined);
  assert.equal(h.attacks.at(-1).midi,69,'the wrong physical P plays P, never a preset next melody note');
  h.time.timers(300000);assert.equal(h.sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');assert.deepEqual(h.time.counts(),{frames:0,timers:0});
  h.down('Backspace');h.up('Backspace');h.type('! i can play piano?');assert.equal(h.sequence.getSnapshot().pianoText,api.pianoTypingConfig.message);
  assert.equal(h.sequence.getSnapshot().pianoCompletedAt,300000);assert.equal(h.attacks.at(-1).midi,67);assert.equal(h.sustain(),false);
 });
});
test('an active note survives sentence dissolution and its later physical keyup releases it exactly once',()=>{
 withPianoTyping(h=>{
  h.type('wait!!');h.down('!');h.type(' i can play piano?');assert.equal(h.held.has('Digit1'),true);
  const before=h.releases.length;h.time.timers(api.pianoTypingConfig.duration);
  assert.equal(h.sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(h.releases.length,before);assert.ok(h.snapshot().pressed.some(key=>key.code==='Digit1'));
  h.down('!',{repeat:true});assert.equal(h.releases.length,before);h.up('!');assert.equal(h.releases.length,before+1);assert.equal(h.held.size,0);
  h.down('f');h.up('f');assert.equal(h.ripples(),1);
 });
});
test('focus loss, rapid replay/reset, skipped visuals and stale completion timers never strand notes or duplicate listeners',()=>{
 withPianoTyping(h=>{
  for(let i=0;i<6;i++){
   h.type('wa');h.down('i');window.dispatch('blur',{});assert.equal(h.held.size,0);assert.equal(h.snapshot().pressed.length,0);assert.equal(h.sequence.getSnapshot().pianoText,'WAI');
   h.down('i',{repeat:true});assert.equal(h.held.size,0);h.up('i');h.reset();assert.equal(h.sequence.getSnapshot().pianoText,'');
   h.type(api.pianoTypingConfig.message);const stale=h.time.pending()[0];h.down('f');h.reset();assert.equal(h.held.size,0);stale();assert.equal(h.sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');assert.equal(h.sequence.getSnapshot().pianoText,'');
   assert.deepEqual(h.time.counts(),{frames:0,timers:0});assert.equal(window.listeners.get('keydown').length,2);assert.equal(window.listeners.get('keyup').length,2);
  }
  h.down('f');const released=h.releases.length;h.sequence.revealPiano('render');assert.equal(h.sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(h.releases.length,released);h.up('f');assert.equal(h.releases.length,released+1);
 });
});
test('the new overlay starts with only a cursor and finishes as bounded stardust without replacing the piano',()=>{
 const sequence=new OpeningSequence(reliableClock());sequence.start('pianoTyping');
 const render=()=>renderToStaticMarkup(createElement(api.PianoTypingReveal,{snapshot:sequence.getSnapshot(),map:mapForInterstellarSection(1)}));
 const empty=render();assert.match(empty,/piano-typing-caret/);assert.doesNotMatch(empty,/WAIT|PLAY|PIANO\?|<input|<canvas|<button/);
 physicalType(sequence,'w');const typed=render();assert.match(typed,/>W<\/span>/);assert.match(typed,new RegExp(api.starlightColor(55)));
 sequence.start('pianoTyping');physicalType(sequence,api.pianoTypingConfig.message);
 const complete=render();assert.match(complete,/is-complete/);assert.equal((complete.match(/--dust-x/g)??[]).length,api.pianoTypingConfig.particles);assert.ok(api.pianoTypingConfig.particles<=48);
 assert.equal(api.pianoTypingStyle(sequence.getSnapshot(),api.pianoTypingConfig.hold)['--piano-text-dissolve-at'],'0ms');
 const css=readFileSync('src/opening/pianoTyping.css','utf8');assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);
});

test('the fully revealed piano waits indefinitely for physical discovery typing, including deliberately slow input',()=>{
 const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start('full');time.timers(openingCues.active);
 assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');assert.equal(sequence.getSnapshot().pianoText,'');assert.equal(sequence.capturing,false);
 time.timers(300000);assert.equal(sequence.getSnapshot().pianoText,'');assert.deepEqual(time.counts(),{frames:0,timers:0});
 for(const character of api.pianoTypingConfig.message){time.set(time.now()+2000);physicalType(sequence,character);}
 const end=time.now();assert.equal(sequence.getSnapshot().pianoCompletedAt,end);time.timers(end+api.pianoTypingConfig.duration-1);assert.equal(sequence.getSnapshot().scene,'TYPING_PIANO_REVEAL');
 time.timers(end+api.pianoTypingConfig.duration);assert.equal(sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');
});
test('a delayed dissolution timer cannot swallow the first actual Interstellar key or truncate an earlier held note',()=>{
 withPianoTyping(h=>{
  h.type(api.pianoTypingConfig.message);h.down('w');const before=h.attacks.length;
  h.time.set(api.pianoTypingConfig.duration+50);h.down('f');
  assert.equal(h.sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(h.attacks.length,before+1);assert.equal(h.attacks.at(-1).midi,76);assert.equal(h.ripples(),1);
  assert.equal(h.held.size,2);h.up('w');h.up('f');assert.equal(h.held.size,0);assert.deepEqual(h.time.counts(),{frames:0,timers:0});
 });
 const time=clock(),sequence=new OpeningSequence(time);sequence.start('pianoTyping');physicalType(sequence,api.pianoTypingConfig.message);
 time.advance(api.pianoTypingConfig.duration);assert.equal(sequence.getSnapshot().scene,'INTERSTELLAR_ACTIVE');assert.equal(time.count(),0);
});

test('Enter completes only the initial typing test and continues through the existing crash without inflating WPM',()=>{
 for(const code of ['Enter','NumpadEnter']){
  const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start('typing');time.set(5000);
  sequence.keyDown(key('Enter',code));const complete=sequence.getSnapshot();
  assert.equal(complete.scene,'TYPING_COMPLETE');assert.equal(complete.typing.input,introduction);assert.equal(typingMetrics(complete.typing,99999).wpm,0);assert.equal(complete.typing.attempts,0);
  sequence.keyDown({...key('Enter',code),repeat:true});assert.equal(time.counts().timers,1);
  time.timers(5400);assert.equal(sequence.getSnapshot().scene,'SIMULATED_CRASH');time.timers(5000+introToMessage);assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');
  sequence.keyUp(key('Enter',code));sequence.keyDown(key('Enter',code));assert.equal(sequence.getSnapshot().scene,'MESSAGE_ENTRY');assert.equal(sequence.getSnapshot().message,'');
  sequence.start('pianoTyping');sequence.keyUp(key('Enter',code));sequence.keyDown(key('Enter',code));assert.equal(sequence.getSnapshot().pianoText,'');assert.equal(sequence.getSnapshot().pianoCompletedAt,undefined);sequence.dispose();
 }
 const time=reliableClock(),sequence=new OpeningSequence(time);sequence.start('typing');time.set(1000);physicalType(sequence,'Hi,');
 const before=typingMetrics(sequence.getSnapshot().typing,4000);time.set(4000);sequence.keyDown(key('Enter','Enter'));
 assert.equal(sequence.getSnapshot().typing.input,introduction);assert.deepEqual(typingMetrics(sequence.getSnapshot().typing,99999),before,'only physically typed characters contribute to frozen metrics');
});


test('reveal Shift+1 uses C sharp 2, suppresses repeats, releases after Shift, and leaves normal mappings untouched',()=>{
 withPianoTyping(h=>{
  h.down('!',{shiftKey:true});assert.equal(h.attacks.at(-1).midi,37);
  assert.deepEqual(h.snapshot().pressed.map(key=>({code:key.code,label:key.label,midi:key.midi})),[{code:'Digit1',label:'!',midi:37}]);
  h.down('!',{shiftKey:true,repeat:true});h.down('!',{shiftKey:true});assert.equal(h.attacks.length,1);assert.equal(h.sequence.getSnapshot().pianoText,'!');
  h.up('Shift');h.up('!');assert.equal(h.snapshot().pressed.length,0);assert.equal(h.releases.length,1);
  h.sequence.finishPianoTyping();h.down('!',{shiftKey:true});h.up('!');assert.equal(h.attacks.length,1,'the reveal override is absent in normal performance');
  assert.equal(api.getPitch(mapForInterstellarSection(1),'Digit1',true),null);
 });
 assert.equal(api.pianoTypingPitch('Digit1',true,2),39);assert.equal(api.pianoTypingPitch('Digit1',false),undefined);assert.equal(api.pianoTypingPitch('KeyW',true),undefined);
});

test('Levels opening typing and the post-reveal stage use the same E-major physical notes',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;
 globalThis.document=new Target();document.hidden=false;
 const map=api.levelsEMajor,time=clock(),sequence=new OpeningSequence(time),attacks=[],releases=[];
 const manager=new KeyboardInputManager(map,{
  routeKeyDown:event=>sequence.keyDown(event),routeKeyUp:event=>sequence.keyUp(event),
  pitchForKey:(event,transpose)=>sequence.pianoTyping?api.pianoTypingPitch(event.code,event.shiftKey,transpose,map):undefined,
  noteOn:(midi,code)=>attacks.push({midi,code}),noteOff:(midi,code)=>releases.push({midi,code}),change:()=>{},
 });
 const dispatch=(name,event)=>{event.preventDefault=()=>{event.defaultPrevented=true;};window.dispatch(name,event);};
 const letter=key('w');
 try{
  sequence.start('pianoTyping');manager.setEnabled(true);
  dispatch('keydown',letter);dispatch('keyup',letter);
  assert.equal(attacks.at(-1).midi,api.getPitch(map,'KeyW',false));
  assert.notEqual(attacks.at(-1).midi,api.getPitch(mapForInterstellarSection(1),'KeyW',false));
  sequence.finishPianoTyping();dispatch('keydown',letter);dispatch('keyup',letter);
  assert.deepEqual(attacks.map(item=>item.midi),[api.getPitch(map,'KeyW',false),api.getPitch(map,'KeyW',false)]);
  assert.equal(releases.length,2);
  assert.equal(api.pianoTypingPitch('Digit1',true,0,map),api.getPitch(map,'Digit1',true));
 }finally{manager.dispose();sequence.dispose();globalThis.window=oldWindow;globalThis.document=oldDocument;}
});


test('the major logo mass descends to the actual keyboard while only small inlays drift into the stars',()=>{
 const down=logoFragments.filter(api.fragmentFeedsPiano);assert.equal(down.length,12);
 const area=fragment=>Math.abs(fragment.polygon.reduce((sum,[x,y],i,points)=>sum+x*points[(i+1)%points.length][1]-y*points[(i+1)%points.length][0],0))/2;
 assert.ok(down.reduce((sum,f)=>sum+area(f),0)>8000,'more than 80 percent of the source regions feed the piano');
 for(const [w,h] of [[1366,768],[1920,1080],[3840,2160],[1024,768]])for(const keyboardY of [h*.68,h*.82]){
  const b=revealBounds(w,h,keyboardY);
  for(const fragment of down){
   const origin=api.sourcePoint(fragment.origin,b),landing=api.fragmentLandingAt(fragment),pose=fragmentPose(fragment,landing,b);
   assert.ok(Math.abs(origin[1]+pose.y-keyboardY)<.001,'stream arrives exactly at the real keyboard boundary');
   assert.ok(pose.alpha>.05,'the arriving piece remains visible before dissolving');
   assert.ok(pose.scaleY>pose.scaleX,'descending pieces stretch vertically into light');
   assert.ok(pose.y>Math.abs(pose.x),'downward travel dominates sideways drift');
   let previous=0;
   for(let ms=api.fragmentStart(fragment);ms<=landing;ms+=20){const next=fragmentPose(fragment,ms,b).y;assert.ok(next>=previous-.01,'no bouncing or upward debris motion');previous=next;}
  }
  for(const p of createRevealParticles().filter(p=>api.fragmentFeedsPiano(logoFragments[p.fragment])))for(let ms=p.born;ms<p.born+p.life;ms+=40)assert.ok(particlePose(p,ms,b).y<keyboardY,'particles dissolve at the keyboard instead of obscuring keys');
 }
});


test('live key history expires independently of keyup, remains bounded and keeps simultaneous inputs',()=>{
 const time=reliableClock(),history=new api.LiveKeyHistory(time);let updates=0;const unsubscribe=history.subscribe(()=>updates++);
 const press=label=>history.append({code:`Key${label}`,label,midi:60,at:time.now()});
 press('W');press('A');assert.deepEqual(history.getSnapshot().map(key=>key.label),['W','A']);assert.equal(time.counts().timers,1);
 time.set(100);for(const letter of 'ITYOP')press(letter);assert.deepEqual(history.getSnapshot().map(key=>key.label),[...'ITYOP']);assert.equal(time.counts().timers,1);
 assert.equal(new Set(history.getSnapshot().map(key=>key.id)).size,5);
 time.timers(1099);assert.equal(history.getSnapshot().length,5);time.timers(1100);assert.equal(history.getSnapshot().length,0);assert.equal(time.counts().timers,0);
 press('F');history.clear();assert.equal(history.getSnapshot().length,0);assert.equal(time.counts().timers,0);
 const before=updates;unsubscribe();press('C');assert.equal(updates,before);history.clear();assert.equal(time.counts().timers,0);
});

test('physical input callbacks remain separate from the sounding piano voices',()=>{
 withPianoTyping(h=>{
  h.down('w');h.down('w',{repeat:true});h.down('w');h.down('a');h.up('w');h.up('a');
  assert.deepEqual(h.keystrokes.map(key=>key.label),['W','A']);
  h.down('Shift');h.up('Shift');h.type(' .?c');assert.equal(h.keystrokes.length,2,'controls and unmapped text never become live note pills');
  h.down('!');h.up('!');assert.equal(h.keystrokes.at(-1).label,'!');assert.equal(h.keystrokes.at(-1).midi,37);
  h.sequence.finishPianoTyping();h.section(2);const before=h.keystrokes.length;h.down('c');h.up('c');
  assert.deepEqual(h.attacks.at(-1).pitches,[69,64]);assert.equal(h.keystrokes.length,before+1,'one physical C pill despite the generated supporting voice');
  h.down('f',{ctrlKey:true});h.up('f');assert.equal(h.keystrokes.length,before+1);
 });
});

test('HUD stays compact in the header, emphasizes the reveal and reduces dense sections to three keys',()=>{
 const time=reliableClock(),history=new api.LiveKeyHistory(time);
 for(const label of 'WAIT!')history.append({code:'KeyW',label,midi:55,at:0});
 const hud=props=>createElement(api.LiveKeysHud,{history,...props});
 const render=props=>renderToStaticMarkup(hud(props));
 assert.equal((render({reveal:true,reduced:true}).match(/<kbd/g)??[]).length,5);assert.match(render({reveal:true}),/is-reveal/);
 assert.equal((render({reduced:true}).match(/<kbd/g)??[]).length,3);assert.match(render({reduced:true}),/is-reduced/);
 const header=renderToStaticMarkup(createElement(api.PerformanceHeader,{song:'interstellar',measure:1,bpm:100,sustain:false,showPedal:true,inputHud:hud({reveal:true})}));
 assert.match(header,/stage-status-stack/);assert.match(header,/BPM/);assert.match(header,/PEDAL OFF/);assert.doesNotMatch(header,/LIVE KEYS/);assert.doesNotMatch(header,/aria-live/);
 const other=renderToStaticMarkup(createElement(api.PerformanceHeader,{song:'levels',measure:1,bpm:126,sustain:false,showPedal:true}));assert.doesNotMatch(other,/LIVE KEYS|stage-status-stack/);
 history.clear();
});


test('live HUD labels follow the lit piano pitch rather than physical assisted keys or typed characters',()=>{
 assert.deepEqual(api.interstellarPianoNoteLabel(69),{note:'A4',keyLabel:'p'});
 assert.deepEqual(api.interstellarPianoNoteLabel(37),{note:'C♯2',keyLabel:'!'});
 assert.deepEqual(api.interstellarPianoNoteLabel(71,2),{note:'B4',keyLabel:'p'});
 const time=reliableClock(),history=new api.LiveKeyHistory(time);
 history.append({code:'KeyC',label:'C',midi:69,at:0});
 const markup=renderToStaticMarkup(createElement(api.LiveKeysHud,{history,reveal:true}));
 assert.doesNotMatch(markup,/A4/);assert.match(markup,/>p<\/kbd>/);assert.doesNotMatch(markup,/>C<\/kbd>/);
 history.clear();history.append({code:'Digit1',label:'!',midi:37,at:0});
 const shifted=renderToStaticMarkup(createElement(api.LiveKeysHud,{history,reveal:true}));assert.doesNotMatch(shifted,/C♯2/);assert.match(shifted,/>!<\/kbd>/);history.clear();
});


test('assisted gestures display every sounding piano key label without trigger letters or note names',()=>{
 const time=reliableClock(),history=new api.LiveKeyHistory(time);
 for(const code of ['KeyC','KeyV','KeyB','KeyM']){
  history.clear();
  const midi=api.getPitch(mapForInterstellarSection(2),code,false),plan=planInterstellarPress(2,code,midi,0,defaultInterstellarMix);
  const inputs=api.interstellarSoundingKeys(plan.voices.filter(voice=>voice.gain>0).map(voice=>voice.midi),code,0);
  assert.equal(inputs.length,plan.voices.length);history.appendMany(inputs);
  const markup=renderToStaticMarkup(createElement(api.LiveKeysHud,{history,reveal:true}));
  for(const input of inputs)assert.ok(markup.includes(`>${input.label}</kbd>`));
  assert.doesNotMatch(markup,/live-key-note|>A4<|>E4</);
  assert.equal((markup.match(/<kbd/g)??[]).length,plan.voices.length);
 }
 const c=planInterstellarPress(2,'KeyC',69,0,defaultInterstellarMix);assert.deepEqual(api.interstellarSoundingKeys(c.voices.map(voice=>voice.midi),'KeyC',0).map(key=>key.label),['p','u']);
 history.clear();let updates=0;const unsubscribe=history.subscribe(()=>updates++);history.appendMany(api.interstellarSoundingKeys([64,71],'KeyV',0));
 assert.deepEqual(history.getSnapshot().map(key=>key.label),['u','a']);assert.equal(updates,1);assert.equal(time.counts().timers,1);
 time.timers(1000);assert.equal(history.getSnapshot().length,0);unsubscribe();history.clear();
});
