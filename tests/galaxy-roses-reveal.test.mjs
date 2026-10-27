import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle=await build({stdin:{contents:`
export {CosmicBackdropCache,drawCosmicScene} from './src/components/performanceAtmosphere';export * from './src/piano/rosesReveal';export * from './src/components/stageEnergy';
export * from './src/components/recordOrb';export * from './src/components/rosesBlackHole';
export {drawGalaxyVinyl} from './src/components/GalaxyVinylTransition';export {drawCosmicGalaxy} from './src/components/cosmicGalaxy';
export {default as PerformanceHeader} from './src/components/PerformanceHeader';
export {default as PerformanceEnergyOrb} from './src/components/PerformanceEnergyOrb';
export {default as RosesPerformanceTransport} from './src/components/RosesPerformanceTransport';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},plugins:[{name:'react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:createRequire(import.meta.url).resolve(args.path),external:true}));}}]});
const path='/private/tmp/mr-pink-galaxy-roses-test.mjs';writeFileSync(path,bundle.outputFiles[0].text);const api=await import(pathToFileURL(path).href);

test('hidden freestyle and bars 1–4 wait indefinitely for actual transport bar 5, reveal once, and reset cleanly',()=>{
 const reveal=new api.RosesReveal();let notifications=0;const stop=reveal.subscribe(()=>notifications++);
 reveal.enable();const run=reveal.getSnapshot().run;
 for(const status of ['idle','paused'])for(const now of [0,20000,900000])reveal.update({status,measure:1,beat:1},now);
 assert.equal(reveal.getSnapshot().revealedAt,null);assert.equal(notifications,1);
 for(let bar=1;bar<=4;bar++)for(let beat=1;beat<5;beat+=.25)reveal.update({status:'running',measure:bar,beat},900000+bar*2400+beat*600);
 assert.equal(reveal.getSnapshot().revealedAt,null);
 reveal.update({status:'paused',measure:5,beat:1},1000000);assert.equal(reveal.getSnapshot().revealedAt,null);
 reveal.update({status:'running',measure:5,beat:1},1001000);assert.equal(reveal.getSnapshot().revealedAt,1001000);
 for(let bar=5;bar<=44;bar++)reveal.update({status:'running',measure:bar,beat:4},2000000);
 assert.equal(notifications,2);assert.equal(reveal.getSnapshot().revealedAt,1001000);
 reveal.update({status:'paused',measure:7},2001000);assert.equal(reveal.getSnapshot().revealedAt,1001000);
 reveal.update({status:'idle',measure:1},2002000);assert.equal(reveal.getSnapshot().revealedAt,null);assert.equal(reveal.getSnapshot().run,run+1);
 reveal.update({status:'running',measure:5,beat:1},2003000);assert.equal(reveal.getSnapshot().revealedAt,2003000);
 reveal.disable();reveal.update({status:'running',measure:5},2005000);assert.equal(reveal.getSnapshot().enabled,false);assert.equal(reveal.getSnapshot().revealedAt,null);stop();
});

test('buildup follows actual beat progress and stops increasing during indefinite freestyle or pauses',()=>{
 assert.equal(api.introRevealBuild({status:'idle',measure:1}),0);assert.equal(api.introRevealBuild({status:'paused',measure:4,beat:4}),0);
 assert.equal(api.introRevealBuild({status:'running',measure:1,beat:1}),0);
 assert.ok(api.introRevealBuild({status:'running',measure:4,beat:4})>.9);
 assert.equal(api.introRevealBuild({status:'running',measure:5,beat:1}),1);
});

test('one galaxy center moves right to left and lands on the unchanged record geometry at laptop/projector sizes',()=>{
 for(const [width,height] of [[1366,768],[1920,1080],[3840,2160]]){
  const from={x:width*.8,y:height*.7*.49,radius:Math.min(width*.21,height*.7*.37)},to={x:width*.25,y:height*.48,radius:height*.24};
  const first=api.galaxyVinylPose(0,from,to),last=api.galaxyVinylPose(3600,from,to);
  assert.equal(first.x,from.x);assert.equal(first.y,from.y);assert.equal(first.radius,from.radius);assert.equal(first.rings,0);
  assert.equal(last.x,to.x);assert.equal(last.y,to.y);assert.equal(last.radius,to.radius);assert.equal(last.rings,1);assert.equal(last.sky,0);
  let previous=first;for(let ms=16;ms<=3600;ms+=16){const pose=api.galaxyVinylPose(ms,from,to);assert.ok(pose.x<=previous.x);assert.ok(pose.y>=previous.y);assert.ok(pose.radius>0);assert.ok(Math.abs(pose.x-previous.x)<width*.02);previous=pose;}
  assert.ok(api.galaxyVinylPose(700,from,to).radius<from.radius,'the galaxy contracts before becoming the record');
 }
});

function context(){
 const stack=[],calls=[];
 const base={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){assert.ok(stack.length);this.globalAlpha=stack.pop();},createRadialGradient(...args){calls.push(['createRadialGradient',...args]);return {addColorStop(at){assert.ok(at>=0&&at<=1);}};},createLinearGradient(...args){calls.push(['createLinearGradient',...args]);return {addColorStop(at){assert.ok(at>=0&&at<=1);}};}};
 const ctx=new Proxy(base,{get(target,name){if(name in target)return target[name];return(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${String(name)} received a finite coordinate`);calls.push([name,...args]);};},set(target,name,value){if(typeof value==='number')assert.ok(Number.isFinite(value),String(name));target[name]=value;return true;}});
 return {ctx,calls,stack};
}

test('hidden record has no cover, fallback title or petals; circular artwork reveal is bounded and expires',()=>{
 const {ctx,calls,stack}=context(),energy=new api.StageEnergy(),art={artwork:true};
 api.drawRecordOrb(ctx,900,650,90000,energy,false,{artwork:art,concealed:true,introBuild:.8});
 assert.equal(calls.filter(call=>call[0]==='drawImage'&&call[1]===art).length,0);assert.equal(calls.filter(call=>call[0]==='fillText').length,0);assert.equal(stack.length,0);
 calls.length=0;api.drawRecordOrb(ctx,900,650,90100,energy,false,{artwork:art,revealMs:100});assert.equal(calls.filter(call=>call[0]==='drawImage'&&call[1]===art).length,1);
 const center=api.stageOrbGeometry(900,650,90100,energy,false);assert.ok(calls.some(call=>call[0]==='arc'&&call[3]===0),'cover starts inside a zero-sized mask before expansion');
 calls.length=0;api.drawRecordOrb(ctx,900,650,90800,energy,false,{artwork:art,revealMs:800});assert.ok(calls.some(call=>call[0]==='arc'&&Math.abs(call[3]-api.stageOrbGeometry(900,650,90800,energy,false).radius*.64)<.001));assert.equal(stack.length,0);
 calls.length=0;api.drawAlbumReveal(ctx,center.x,center.y,center.radius,2000,false);assert.equal(calls.length,0);
 calls.length=0;api.drawAlbumReveal(ctx,center.x,center.y,center.radius,400,true);assert.equal(calls.filter(call=>call[0]==='bezierCurveTo').length,0,'reduced motion skips petal travel');
});

test('the real morph renderer keeps coordinates finite, balances saves and caches galaxy dust across changing radii',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;let buffers=0;
 globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>{buffers++;return {width:0,height:0,getContext:()=>context().ctx};}};
 try{
  for(const [w,h] of [[1366,768],[1920,1080],[3840,2160]]){
   const from={x:w*.8,y:h*.7*.49,radius:Math.min(w*.21,h*.7*.37),width:w,height:h,skyHeight:h*.7,piano:{x:0,y:h*.7,width:w,height:h*.3}},to={x:w*.25,y:h*.48,radius:h*.24};
   const {ctx,calls,stack}=context();const before=buffers;
   for(const ms of [0,300,900,1800,2700,3500,3600]){calls.length=0;api.drawGalaxyVinyl(ctx,w,h,10000+ms,ms,from,to,false);assert.equal(stack.length,0);assert.ok(calls.length<7000);}
   assert.ok(buffers-before<=1,'one cached galaxy sprite per resolution, never one per radius/frame');
  }
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

test('concealed UI omits title, art identity and footer while retaining actual instruments and transport',()=>{
 const hidden={state:{enabled:true,revealedAt:null,run:1},clock:{status:'idle',measure:1}};
 const render=node=>renderToStaticMarkup(node);
 const header=render(createElement(api.PerformanceHeader,{song:'roses',concealed:true,bpm:100,measure:1,sustain:false,showPedal:true,audience:true}));assert.doesNotMatch(header,/Roses|ROSES|<h1/);assert.match(header,/MR PINK/);
 const orb=render(createElement(api.PerformanceEnergyOrb,{notes:{},activity:{},audioLevel:{current:0},stageLevel:{current:0},reveal:hidden}));assert.doesNotMatch(orb,/ROSES · LIVE RECORD|alt="Roses|Dynamic Roses/);assert.match(orb,/Black-hole vinyl/);
 const transport=render(createElement(api.RosesPerformanceTransport,{engine:null,clock:null,ready:false,concealed:true,audience:true}));assert.match(transport,/START PERFORMANCE/);
 const normal=render(createElement(api.PerformanceHeader,{song:'roses',bpm:100,measure:5,sustain:false,showPedal:true}));assert.match(normal,/Roses/);
});


test('Start remains available after the morph and its button cannot begin the count-in during the morph',()=>{
 const engine={isReady:()=>true,snapshot:()=>({status:'idle'})},clock={status:'idle',measure:1,vocalReady:true,closerReady:true,pulse:0};
 const render=disabled=>renderToStaticMarkup(createElement(api.RosesPerformanceTransport,{engine,clock,ready:true,concealed:true,audience:true,disabled}));
 assert.match(render(true),/stage-arm-start[^>]*disabled/);assert.doesNotMatch(render(false),/stage-arm-start[^>]*disabled/);assert.match(render(false),/FOUR-BEAT COUNTDOWN/);
});


test('vinyl caches all forty original grooves into eight reusable paths without changing their geometry',()=>{
 const original=globalThis.Path2D;let created=0;
 class RecordedPath{arcs=[];constructor(){created++;}moveTo(){}arc(...args){this.arcs.push(args);}}
 try{
  globalThis.Path2D=RecordedPath;const paths=api.recordGroovePaths();assert.equal(paths.length,8);assert.equal(created,8);
  const radii=paths.flatMap(group=>group.path.arcs.map(arc=>arc[2])).sort((a,b)=>a-b);assert.equal(radii.length,40);
  radii.forEach((radius,i)=>assert.ok(Math.abs(radius-(.657+i*.00825))<1e-12));
  const energy=new api.StageEnergy(),{ctx,calls,stack}=context();api.drawRecordOrb(ctx,900,650,1000,energy,false,{concealed:true});
  assert.equal(calls.filter(call=>call[0]==='stroke'&&call[1] instanceof RecordedPath).length,8);assert.equal(stack.length,0);
  api.drawRecordOrb(ctx,1800,1300,5000,energy,false,{concealed:true});assert.equal(created,8,'resizing and breathing reuse normalized paths');
 }finally{globalThis.Path2D=original;}
});

test('transition caches only static haze, preserves the live star positions, bounds the buffer and frees it',()=>{
 const original=globalThis.document;let created=0;const sources=[];
 globalThis.document={createElement:()=>{created++;const source=context();sources.push(source);return {width:0,height:0,getContext:()=>source.ctx};}};
 try{
  const cache=new api.CosmicBackdropCache(),sky=cache.get(1920,756);assert.ok(sky.width*sky.height<=602000);const warm=sources[0].calls.length;
  for(let i=0;i<100;i++)assert.equal(cache.get(1920,756),sky);assert.equal(created,1);assert.equal(sources[0].calls.length,warm,'haze is not rebuilt by the frame loop');
  const regular=context(),cached=context();api.drawCosmicScene(regular.ctx,1920,756,12345,false,true,1);api.drawCosmicScene(cached.ctx,1920,756,12345,false,true,1,sky);
  assert.equal(regular.calls.filter(call=>call[0]==='createRadialGradient').length,3);assert.equal(cached.calls.filter(call=>call[0]==='createRadialGradient').length,0);
  assert.deepEqual(cached.calls.filter(call=>call[0]==='arc'),regular.calls.filter(call=>call[0]==='arc'),'star motion, positions and density stay live');
  cache.get(3840,1512);assert.equal(created,1,'resize reuses one bounded surface');cache.release();assert.equal(sky.width,1);assert.equal(sky.height,1);
  assert.notEqual(cache.get(1920,756),sky);cache.release();
  let failedAttempts=0;globalThis.document={createElement:()=>{failedAttempts++;return {width:0,height:0,getContext:()=>null};}};const failure=new api.CosmicBackdropCache();
  for(let i=0;i<50;i++)assert.equal(failure.get(1920,756),undefined);assert.equal(failedAttempts,1,'failed cache falls back without allocating again every frame');failure.release();
 }finally{globalThis.document=original;}
});

test('precomputed accretion geometry preserves the original animated spiral positions and particle budgets',()=>{
 for(const [now,level,reduced] of [[12345,0,false],[90000,.8,false],[90000,.8,true]]){
  const {ctx,calls}=context();api.drawBlackHole(ctx,200,200,150,now,level,.8,reduced);
  const points=calls.filter(call=>call[0]==='moveTo'||call[0]==='lineTo');assert.equal(points.length,225);
  const spin=(reduced?0:now)*.00012*(1+level*.5);
  for(let arm=0;arm<5;arm++)for(let i=0;i<=44;i++){
   const t=i/44,r=150*(.19+t*.76),angle=arm*Math.PI*2/5+t*6.4+spin,point=points[arm*45+i];
   assert.ok(Math.abs(point[1]-Math.cos(angle)*r)<1e-8);assert.ok(Math.abs(point[2]-Math.sin(angle)*r*.76)<1e-8);
  }
 }
 assert.equal(api.rosesRevealSettings.dust,144);assert.equal(api.rosesRevealSettings.petals,32);assert.equal(api.rosesRevealSettings.transition,3600);assert.equal(api.rosesRevealSettings.albumReveal,800);
});


test('the record and nested black hole preserve transition opacity instead of popping opaque',()=>{
 for(const opacity of [.01,.15,.45,.8,1]){
  const {ctx,stack}=context(),alphas=[];
  ctx.globalAlpha=opacity;
  const faded=new Proxy(ctx,{set(target,key,value){if(key==='globalAlpha')alphas.push(value);return Reflect.set(target,key,value);}});
  api.drawRecordOrb(faded,900,650,12000,new api.StageEnergy(),false,{concealed:true});
  assert.ok(alphas.length>40);assert.ok(alphas.every(value=>value>=0&&value<=opacity+1e-12));
  assert.equal(ctx.globalAlpha,opacity);assert.equal(stack.length,0);
 }
});
test('the original galaxy projection gradually rounds out into the destination circle',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window={devicePixelRatio:1};globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context().ctx})};
 try{
  for(const roundness of [0,.25,.5,.75,1]){
   const {ctx,calls,stack}=context();
   api.drawCosmicGalaxy(ctx,1366,538,12000,false,{x:700,y:300,radius:220},0,true,roundness);
   const tilt=calls.find(call=>call[0]==='rotate'),projection=calls.find(call=>call[0]==='scale');
   assert.equal(tilt[1],-.48*(1-roundness));assert.deepEqual(projection.slice(1),[1,.53+.47*roundness]);assert.equal(stack.length,0);
  }
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
