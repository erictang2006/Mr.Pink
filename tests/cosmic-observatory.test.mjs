import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export * from './src/components/cosmicObservatory';
export * from './src/components/cosmicGalaxy';
export * from './src/components/performanceAtmosphere';
export * from './src/piano/cosmicGeometry';
export {levelsWarpPose} from './src/piano/levelsInterstellarTransition';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function context(){
 const calls=[],stack=[];const gradient=()=>({addColorStop(at,color){assert.ok(at>=0&&at<=1);calls.push(['stop',at,color]);}});
 const ctx=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){assert.ok(stack.length);this.globalAlpha=stack.pop();},createRadialGradient(...args){calls.push(['radial',...args]);return gradient();},createLinearGradient(...args){calls.push(['linear',...args]);return gradient();}},
 {get(target,key){return key in target?target[key]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${String(key)} is finite`);calls.push([key,...args]);};}});
 return {ctx,calls,stack};
}

test('low live notes energize the core, high notes create local stars, and reactions expire without sustain reads',()=>{
 const response=new api.CosmicResponse();assert.deepEqual(response.frame(1000),{core:0,light:0,pulses:[]});
 response.impulse(43,.2,1000);const low=response.frame(1000);assert.ok(low.core>0);assert.ok(low.light>0);
 const l=context();api.drawObservatoryMotion(l.ctx,1920,756,1000,true,low);assert.equal(l.calls.length,0,'low notes have no high-register sparkle');
 response.clear();response.impulse(81,.72,1000);const high=response.frame(1000);assert.equal(high.core,0);
 const h=context();api.drawObservatoryMotion(h.ctx,1920,756,1000,false,high);const reduced=context();api.drawObservatoryMotion(reduced.ctx,1920,756,1000,true,high);
 assert.equal(reduced.calls.filter(call=>call[0]==='arc').length,1,'reduced motion retains one stationary high-note response');
 assert.equal(h.stack.length,0);assert.equal(reduced.stack.length,0);
 assert.ok(response.frame(1300).light<high.light);assert.deepEqual(response.frame(1850),{core:0,light:0,pulses:[]});
 for(let i=0;i<1000;i++)response.impulse(36+i%60,i%10/9,2000);assert.equal(response.frame(2000).pulses.length,api.observatorySettings.responses);
 response.clear();assert.equal(response.frame(2000).pulses.length,0);
});

test('a shooting star is occasional, bounded to one streak, and disabled for reduced motion',()=>{
 const idle=context(),active=context(),reduced=context();
 api.drawObservatoryMotion(idle.ctx,1920,756,4000,false);
 api.drawObservatoryMotion(active.ctx,1920,756,api.observatorySettings.meteorPeriod+500,false);
 api.drawObservatoryMotion(reduced.ctx,1920,756,api.observatorySettings.meteorPeriod+500,true);
 assert.equal(idle.calls.filter(call=>call[0]==='stroke').length,0);assert.equal(active.calls.filter(call=>call[0]==='stroke').length,1);
 assert.equal(active.calls.filter(call=>call[0]==='arc').length,29,'28 drifting motes and a single meteor core');assert.equal(reduced.calls.length,0);
});

test('the larger galaxy shares exact incoming/outgoing geometry and reuses one bounded texture through contraction',()=>{
 const originals={window:globalThis.window,document:globalThis.document};let created=0;const textures=[];
 globalThis.window={devicePixelRatio:2};globalThis.document={createElement(){created++;const c={width:0,height:0,getContext:()=>context().ctx};textures.push(c);return c;}};
 try{
  for(const [w,h] of [[1366,538],[1920,756],[3840,1512]]){
   const geometry=api.cosmicGalaxyGeometry(w,h),pose=api.levelsWarpPose(4700,w,h);
   assert.ok(geometry.radius>Math.min(w*.21,h*.37)*1.5);assert.equal(pose.radius,geometry.radius);assert.equal(pose.x,geometry.x);assert.equal(pose.y,geometry.y);
   const before=created;api.prepareCosmicGalaxy(w,h);const calls=context();
   for(let i=0;i<20;i++)api.drawCosmicGalaxy(calls.ctx,w,h,10000+i*100,false,{...geometry,radius:geometry.radius*(1-i*.03)});
   assert.ok(created-before<=1);assert.equal(calls.calls.filter(call=>call[0]==='drawImage').length,20);assert.equal(calls.stack.length,0);
   assert.ok(textures.at(-1).width<=1200);assert.ok(textures.at(-1).height<=1200);
  }
  assert.ok(textures.slice(0,-1).every(c=>c.width===1&&c.height===1),'replaced sprites release their backing stores');
  const w=1920,h=756,a=context(),b=context();api.drawCosmicGalaxy(a.ctx,w,h,10000,false);api.drawCosmicGalaxy(b.ctx,w,h,110000,false);
  assert.notDeepEqual(a.calls.filter(c=>c[0]==='rotate'),b.calls.filter(c=>c[0]==='rotate'),'arms rotate inside a stable tilted projection');
  const ra=context(),rb=context();api.drawCosmicGalaxy(ra.ctx,w,h,10000,true);api.drawCosmicGalaxy(rb.ctx,w,h,110000,true);
  assert.deepEqual(ra.calls,rb.calls,'reduced-motion galaxy is stationary');
  const bare=context(),pulse=context();api.drawCosmicGalaxy(bare.ctx,w,h,10000,true);api.drawCosmicGalaxy(pulse.ctx,w,h,10000,true,undefined,.8);
  assert.equal(pulse.calls.filter(c=>c[0]==='radial').length,bare.calls.filter(c=>c[0]==='radial').length+1);
 }finally{Object.assign(globalThis,originals);}
});

test('the textured band and planets build once per resize, leaving a small live command budget at laptop and projector sizes',()=>{
 const original=globalThis.document;let created=0;const textures=[];
 globalThis.document={createElement(){created++;const source=context(),canvas={width:0,height:0,getContext:()=>source.ctx};textures.push({source,canvas});return canvas;}};
 try{
  const cache=new api.CosmicBackdropCache();
  for(const [w,h] of [[1366,538],[1920,756],[3840,1512]]){
   const sky=cache.get(w,h),buildCount=textures[0].source.calls.length;assert.ok(sky.width*sky.height<602000);
   assert.ok(textures[0].source.calls.filter(c=>c[0]==='fillRect').length>=api.observatorySettings.dust,'detailed dust is baked, not respawned');
   for(let i=0;i<30;i++){
    const {ctx,calls,stack}=context();api.drawCosmicScene(ctx,w,h,5000+i*16,false,true,1,cache.get(w,h));
    assert.equal(stack.length,0);assert.ok(calls.length<700,'live starfield remains bounded');
   }
   assert.equal(textures[0].source.calls.length,buildCount,'no nebula rebuild during live frames');assert.equal(created,1);
  }
  cache.release();assert.equal(textures[0].canvas.width,1);assert.equal(textures[0].canvas.height,1);
 }finally{globalThis.document=original;}
});

test('missing galaxy texture falls back without stopping frames or retrying allocation on every frame',()=>{
 const saved={document:globalThis.document,window:globalThis.window};let attempts=0;
 globalThis.window={devicePixelRatio:1};globalThis.document={createElement(){attempts++;return {width:0,height:0,getContext:()=>null};}};
 try{
  const {ctx,calls,stack}=context();for(let i=0;i<30;i++)api.drawCosmicGalaxy(ctx,1100,400,i*16,false);
  assert.equal(attempts,1);assert.equal(calls.filter(c=>c[0]==='drawImage').length,0);assert.ok(calls.some(c=>c[0]==='radial'));assert.equal(stack.length,0);
 }finally{Object.assign(globalThis,saved);}
});
