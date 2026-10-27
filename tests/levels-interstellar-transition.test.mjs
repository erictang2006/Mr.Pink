import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export * from './src/piano/levelsInterstellarTransition';export * from './src/components/LevelsInterstellarScene';
export * from './src/components/levelsOrb';export * from './src/components/performanceAtmosphere';
export {KeyboardInputManager} from './src/piano/keyboardInput';export {mapForInterstellarSection} from './src/piano/interstellarPerformance';export {levelsEMajor} from './src/piano/levelsRealPiano';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function clock(){let now=0,next=0;const timers=new Map();return {now:()=>now,set:at=>{now=at;},setTimer:(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;},clearTimer:id=>timers.delete(id),advance:at=>{now=at;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}},pending:()=>[...timers.values()].map(timer=>timer.fn),count:()=>timers.size};}
const event=(code,key=code)=>({code,key,repeat:false,metaKey:false,ctrlKey:false,altKey:false,isComposing:false,shiftKey:false,target:null,preventDefault(){}});

test('the five-second transition starts only explicitly, switches once at 3.6s and activates independently of animation frames',()=>{
 const time=clock(),calls=[],warp=new api.LevelsWarpController({switchSong:()=>calls.push('switch'),ready:()=>calls.push('ready')},time);
 time.advance(20000);assert.deepEqual(calls,[]);assert.equal(warp.getSnapshot().active,false);
 assert.equal(warp.start(),true);assert.equal(warp.start(),false);assert.equal(time.count(),2);
 time.advance(23599);assert.deepEqual(calls,[]);time.advance(23600);assert.deepEqual(calls,['switch']);assert.equal(warp.getSnapshot().active,true);
 time.advance(24999);assert.deepEqual(calls,['switch']);time.advance(25000);assert.deepEqual(calls,['switch','ready']);assert.equal(time.count(),0);assert.equal(warp.getSnapshot().active,false);
 warp.finish();assert.deepEqual(calls,['switch','ready']);warp.dispose();
});

test('input deadlines fail open without a timer tick and quarantined keys wait for physical release',()=>{
 const time=clock(),calls=[],warp=new api.LevelsWarpController({switchSong:()=>calls.push('switch'),ready:()=>calls.push('ready')},time);
 warp.start();assert.equal(warp.keyDown(event('KeyW','w')),true);assert.equal(warp.keyDown(event('Space',' ')),true);
 assert.equal(warp.keyDown(event('Escape')),false);assert.equal(warp.keyDown(event('F9')),false);
 time.set(5005);assert.equal(warp.keyDown(event('KeyA','a')),false);assert.deepEqual(calls,['switch','ready']);assert.equal(time.count(),0);
 assert.equal(warp.keyDown(event('KeyW','w')),true);assert.equal(warp.keyUp(event('KeyW','w')),true);assert.equal(warp.keyDown(event('KeyW','w')),false);
 assert.equal(warp.keyUp(event('Space')),true);warp.dispose();
});

test('cancel, focus/panic completion and rapid replay dispose old deadlines without duplicate scene switches',()=>{
 const time=clock(),calls=[],warp=new api.LevelsWarpController({switchSong:()=>calls.push('switch'),ready:()=>calls.push('ready')},time);
 for(let i=0;i<6;i++){
  warp.start();const stale=time.pending();warp.cancel();assert.equal(time.count(),0);warp.start();for(const callback of stale)callback();assert.equal(warp.getSnapshot().switched,false);
  warp.finish();assert.equal(warp.getSnapshot().active,false);assert.equal(time.count(),0);
 }
 assert.equal(calls.filter(x=>x==='switch').length,6);assert.equal(calls.filter(x=>x==='ready').length,6);
 warp.start();warp.dispose();time.advance(90000);assert.equal(time.count(),0);assert.equal(calls.length,12);
});

test('a reset during a scene notification cannot leave a stale active transition',()=>{
 const time=clock(),warp=new api.LevelsWarpController({switchSong:()=>assert.fail('cancelled run cannot switch'),ready:()=>assert.fail('cancelled run cannot activate')},time);
 const stop=warp.subscribe(()=>{if(warp.getSnapshot().active)warp.cancel();});assert.equal(warp.start(),false);assert.equal(time.count(),0);stop();warp.dispose();
});

class Target{listeners=new Map();addEventListener(type,fn){this.listeners.set(type,[...(this.listeners.get(type)??[]),fn]);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)??[]).filter(item=>item!==fn));}send(type,event){for(const fn of this.listeners.get(type)??[])fn(event);}}
test('the actual physical input manager releases a held Levels note and accepts the first fresh Interstellar note at the deadline',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window=new Target();window.setInterval=setInterval;window.clearInterval=clearInterval;globalThis.document=new Target();document.hidden=false;
 const time=clock(),attacks=[],releases=[];let manager;
 const warp=new api.LevelsWarpController({switchSong:()=>manager.setMap(api.mapForInterstellarSection(1)),ready:()=>manager.setEnabled(true)},time);
 try{
  manager=new api.KeyboardInputManager(api.levelsEMajor,{routeKeyDown:e=>warp.keyDown(e),routeKeyUp:e=>warp.keyUp(e),noteOn:(midi,code)=>attacks.push({midi,code}),noteOff:(midi,code)=>releases.push({midi,code}),change(){}});
  manager.setEnabled(true);window.send('keydown',event('KeyT','t'));assert.equal(attacks.length,1);manager.setEnabled(false);assert.equal(releases.length,1);
  warp.start();window.send('keydown',event('KeyW','w'));assert.equal(attacks.length,1);time.set(5001);window.send('keydown',event('KeyT','t'));
  assert.deepEqual(attacks.at(-1),{midi:60,code:'KeyT'});assert.equal(attacks.length,2);window.send('keyup',event('KeyT','t'));assert.equal(releases.length,2);
  window.send('keydown',event('KeyW','w'));assert.equal(attacks.length,2);window.send('keyup',event('KeyW','w'));window.send('keydown',event('KeyW','w'));assert.equal(attacks.at(-1).midi,55);window.send('keyup',event('KeyW','w'));assert.equal(attacks.length,releases.length);
 }finally{manager?.dispose();warp.dispose();assert.equal(time.count(),0);assert.equal(window.listeners.get('keydown').length,0);globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

function context(){const calls=[],stack=[];const gradient={addColorStop(at){assert.ok(at>=0&&at<=1);}};const ctx=new Proxy({globalAlpha:1,save(){stack.push(1);},restore(){assert.ok(stack.length);stack.pop();},createRadialGradient(){return gradient;},createLinearGradient(){return gradient;}},{get(t,name){if(name in t)return t[name];return(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));calls.push([name,...args]);};},set(t,name,value){if(typeof value==='number')assert.ok(Number.isFinite(value));t[name]=value;return true;}});return {ctx,calls,stack};}

test('the original Levels frame and final Interstellar frame are exact renderer endpoints',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context().ctx})};
 try{
  const orb=new api.LevelsOrb();orb.impulse(.4,1,.7);orb.update(16);
  for(const [width,height] of [[1366,538],[1920,756],[3840,1512]]){
   const source=context(),start=context();api.drawLevelsScene(source.ctx,width,height,9000,.5,false,orb);api.drawLevelsInterstellar(start.ctx,width,height,9000,0,.5,orb,false);assert.deepEqual(start.calls,source.calls);assert.equal(start.stack.length,0);
   const end=context(),normal=context();api.drawLevelsInterstellar(end.ctx,width,height,14000,4700,0,orb,false);api.drawCosmicScene(normal.ctx,width,height,14000,false);assert.deepEqual(end.calls,normal.calls);assert.equal(end.stack.length,0);
  }
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

test('all six visual phases stay finite and bounded through laptop/projector sizes and reduced motion',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;let buffers=0;globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>{buffers++;return {width:0,height:0,getContext:()=>context().ctx};}};
 try{for(const [width,height] of [[1366,538],[1920,756],[3840,1512]]){
  const orb=new api.LevelsOrb(),{ctx,calls,stack}=context();const before=buffers;
  for(const reduced of [false,true])for(const ms of [0,500,1000,1300,1700,2200,2700,3100,3600,4100,4500,4700,5000]){
   const pose=api.levelsWarpPose(ms,width,height);assert.ok(Object.values(pose).every(value=>typeof value==='boolean'||Number.isFinite(value)));assert.ok(pose.radius>0);calls.length=0;api.drawLevelsInterstellar(ctx,width,height,10000+ms,ms,.2,orb,reduced);assert.equal(stack.length,0);assert.ok(calls.length<5000);
  }
  assert.ok(buffers-before<=1,'galaxy sprite is cached per resolution, never per morph radius');const final=api.levelsWarpPose(4700,width,height);assert.equal(final.x,width*.8);assert.equal(final.y,height*.49);assert.equal(final.squash,.53);assert.equal(final.overlay,0);
 }}finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
