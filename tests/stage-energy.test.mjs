import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/components/stageEnergy';export * from './src/components/cosmicStage';export {drawEnergyOrb} from './src/components/PerformanceEnergyOrb';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {StageEnergy,stageOrbGeometry,drawCosmicStage,drawEnergyOrb}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('idle orb breathes gently and reduced motion has a stable radius',()=>{
 const energy=new StageEnergy();
 const a=stageOrbGeometry(900,380,0,energy,false),b=stageOrbGeometry(900,380,1800,energy,false);
 assert.notEqual(a.radius,b.radius);assert.ok(Math.abs(a.radius-b.radius)<a.radius*.02);
 assert.deepEqual(stageOrbGeometry(900,380,0,energy,true),stageOrbGeometry(900,380,9000,energy,true));
 assert.equal(energy.level,0);assert.equal(energy.rings.length,0);
});

test('pitch biases opposite sides and chords create more energy than quiet notes',()=>{
 const low=new StageEnergy(),high=new StageEnergy(),chord=new StageEnergy();
 low.update(33,[{id:1,midi:37}],{});high.update(33,[{id:1,midi:85}],{});
 chord.update(33,[37,49,61,68,73,78].map((midi,i)=>({id:i+1,midi})),{});
 assert.ok(low.bias<0&&high.bias>0);assert.ok(chord.level>low.level);assert.ok(chord.pulse>low.pulse);
 assert.equal(low.rings.length,1);assert.equal(chord.rings.length,1);
 const before=chord.rings.length;chord.update(33,[{id:1,midi:37}],{});
 assert.equal(chord.rings.length,before,'a held note or old event never retriggers rings');
});

test('beat pulses follow provided playback IDs without creating a new music clock',()=>{
 const energy=new StageEnergy();energy.update(33,[],{playing:true,beatKey:'9:1'});
 assert.equal(energy.rings.length,1);
 const pulse=energy.pulse;
 for(let i=0;i<8;i++)energy.update(33,[],{playing:true,beatKey:'9:1'});
 assert.ok(energy.pulse<pulse);assert.equal(energy.rings.length,1);
 energy.update(33,[],{playing:true,beatKey:'9:2'});assert.equal(energy.rings.length,2);
 const silent=new StageEnergy();for(let i=0;i<10;i++)silent.update(33,[],{playing:false,beatKey:`1:${i}`});
 assert.equal(silent.pulse,0);assert.equal(silent.rings.length,0);
 silent.update(33,[],{hitKey:'manual:1'});assert.ok(silent.pulse>0,'manual hits react independently of automatic transport');
});

test('drops respond more strongly and audio intensity settles after music stops',()=>{
 const quiet=new StageEnergy(),drop=new StageEnergy();
 for(let i=0;i<12;i++){
  quiet.update(33,[],{playing:true,beatKey:`1:${Math.floor(i/6)}`,intensity:.05},.03);
  drop.update(33,[],{playing:true,drop:true,beatKey:`37:${Math.floor(i/6)}`,intensity:1},.8);
 }
 assert.ok(drop.level>quiet.level);assert.ok(drop.pulse>quiet.pulse);assert.ok(drop.drop>.4);
 for(let i=0;i<240;i++)drop.update(33,[],{},0);
 assert.ok(drop.level<.001);assert.ok(drop.pulse<.001);assert.ok(drop.drop<.001);assert.equal(drop.rings.length,0);
});

test('record geometry and ripples remain bounded during rapid playing without the retired mesh simulation',()=>{
 const energy=new StageEnergy();
 for(let i=0;i<320;i++){
  energy.update(i%30===0?800:33,Array.from({length:8},(_,j)=>({id:i*8+j+1,midi:33+(i+j)%68})),{playing:true,drop:true,beatKey:String(i),intensity:1},1);
  assert.ok(energy.level>=0&&energy.level<=1);assert.ok(energy.pulse<=1);
  assert.ok(energy.rings.length<=8);assert.equal('orb' in energy,false,'the vinyl renderer does not allocate the old Levels spring mesh');
  for(const [width,height] of [[320,90],[900,380],[2200,900]]){
   const g=stageOrbGeometry(width,height,i*33,energy,false);
   assert.ok(g.radius>0&&g.radius<height*.4);assert.ok(g.x-g.radius>0&&g.x+g.radius<width);
  }
 }
});

test('cosmic atmosphere uses sparse particles, bounded alpha and no expensive blur filters',()=>{
 const alphas=[],arcs=[];let filters=0;
 const ctx=new Proxy({
  globalAlpha:1,
  createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),
  arc(...args){arcs.push(args);},
 },{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){if(key==='globalAlpha')alphas.push(value);if(key==='filter')filters++;target[key]=value;return true;}});
 for(const reduced of [false,true])drawCosmicStage(ctx,1920,700,2000,2,reduced);
 assert.equal(arcs.length,76,'38 sparse dust points per frame');assert.ok(alphas.every(a=>a>=0&&a<=1));assert.equal(filters,0);
});


test('buildup concentration follows transport progress and the drop burst fires once per entrance',()=>{
 const energy=new StageEnergy();
 for(let i=0;i<90;i++)energy.update(16.7,[],{playing:true,buildProgress:.9});
 assert.ok(energy.build>.88&&energy.build<.9);assert.equal(energy.shock,0);
 energy.update(16.7,[],{playing:true,drop:true,buildProgress:0});
 assert.equal(energy.shock,1);assert.equal(energy.rings.length,1);
 for(let i=0;i<120;i++)energy.update(16.7,[],{playing:true,drop:true});
 assert.ok(energy.shock<.05,'entrance burst settles while the drop keeps playing');
 assert.equal(energy.rings.length,0);assert.ok(energy.build<.005);
 energy.update(16.7,[],{playing:false});energy.update(16.7,[],{playing:true,drop:true});
 assert.equal(energy.shock,1,'restarting or seeking into a new drop can release energy again');
});

test('orb artwork stays finite and bounded at projector and compact sizes',()=>{
 const energy=new StageEnergy(),alphas=[];let operations=0,filters=0;
 const finite=(...values)=>{operations++;assert.ok(values.every(Number.isFinite));};
 const ctx=new Proxy({
  globalAlpha:1,
  createRadialGradient:(...v)=>{finite(...v);return {addColorStop(at){finite(at);}};},
  createLinearGradient:(...v)=>{finite(...v);return {addColorStop(at){finite(at);}};},
  arc:finite,ellipse:finite,moveTo:finite,lineTo:finite,bezierCurveTo:finite,quadraticCurveTo:finite,fillRect:finite,translate:finite,scale:finite,rotate:finite,
 },{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){if(key==='globalAlpha')alphas.push(value);if(key==='filter')filters++;target[key]=value;return true;}});
 for(const [width,height] of [[220,210],[850,650],[1220,900]])for(const reduced of [false,true]){
  for(let i=0;i<30;i++)energy.update(33,Array.from({length:8},(_,j)=>({id:i*8+j+1,midi:40+j*7})),{playing:true,drop:true,beatKey:String(i)},.8);
  const before=operations;drawEnergyOrb(ctx,width,height,3200,energy,reduced);
  assert.ok(operations-before<1500,'fixed mesh/filament/satellite budgets, independent of viewport');
 }
 assert.ok(alphas.every(a=>a>=0&&a<=1));assert.equal(filters,0);
});

test('record cover stays upright while grooves rotate; radial waveform follows real sample amplitude',()=>{
 const energy=new StageEnergy();energy.update(33,[{id:1,midi:49}],{},.2);
 function render(rotation,reduced,waveform){
  let angle=0,stack=[],lastPoint;const images=[],lengths=[],rotations=[];
  const ctx=new Proxy({
  globalAlpha:1,
   save(){stack.push(angle);},restore(){angle=stack.pop();},rotate(value){angle+=value;rotations.push(value);},
   createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),
   drawImage(...args){images.push({angle,args});},moveTo(x,y){lastPoint=[x,y];},
   lineTo(x,y){if(lastPoint)lengths.push(Math.hypot(x-lastPoint[0],y-lastPoint[1]));lastPoint=[x,y];},
  },{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
  const cover={};drawEnergyOrb(ctx,850,650,3200,energy,reduced,{artwork:cover,rotation,waveform});
  assert.equal(images.length,1);assert.equal(images[0].angle,0,'the original cover and lettering never rotate');assert.equal(images[0].args[0],cover);
  const [,x,y,w,h]=images[0].args;assert.equal(w,h);assert.ok(x>0&&y>0&&x+w<850&&y+h<650);
  return {lengths,rotations};
 }
 const quiet=render(.8,false,new Float32Array(256));const loud=render(1.9,false,new Float32Array(256).fill(.3));
 assert.ok(quiet.rotations.includes(.8));assert.ok(Math.max(...loud.lengths)>Math.max(...quiet.lengths)*2,'actual audio samples increase radial spokes');
 const reduced=render(1.9,true,new Float32Array(256));assert.ok(reduced.rotations.every(angle=>angle===0));
});

test('bass and drum hits release stronger record energy than a single upper piano note, then decay',()=>{
 const piano=new StageEnergy(),bass=new StageEnergy(),drum=new StageEnergy();
 piano.update(33,[{id:1,midi:76}],{});bass.update(33,[{id:1,midi:40}],{});drum.update(33,[],{hitKey:'kick:1'});
 assert.equal(piano.rings.length,1,'single piano input produces a gentle ripple');assert.ok(bass.pulse>piano.pulse);assert.ok(drum.pulse>bass.pulse);
 for(let i=0;i<250;i++){bass.update(33,[],{});drum.update(33,[],{hitKey:'kick:1'});}
 assert.ok(bass.level<.001&&drum.level<.001);assert.equal(drum.rings.length,0,'a held snapshot does not generate a continuing shockwave');
});

test('kick and clap accents have separate visual envelopes without retriggering held events',()=>{
 const energy=new StageEnergy();
 energy.update(16,[],{hitKey:'kick:1',hitKind:'kick',drumKey:1});
 assert.equal(energy.thump,1);assert.equal(energy.flash,0);
 energy.update(16,[],{hitKey:'kick:1',hitKind:'kick',drumKey:1});
 assert.ok(energy.thump<1,'the same kick snapshot does not retrigger');
 energy.update(16,[],{hitKey:'clap:2',hitKind:'clap',drumKey:2});
 assert.equal(energy.flash,1);
 energy.update(16,[],{hitKey:'clap:2:accent',hitKind:'clap',drumKey:2});
 assert.ok(energy.flash<1,'a later vocal accent does not replay the last clap flash');
 for(let i=0;i<90;i++)energy.update(16,[],{});
 assert.ok(energy.thump<.01&&energy.flash<.01,'both accents settle after playing');
});
