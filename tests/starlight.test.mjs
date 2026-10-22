import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/components/starlight';export * from './src/components/interstellarPiano';export * from './src/piano/interstellarPresentation';export * from './src/piano/interstellarRoblox';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {StarlightKeys,StarlightScene,starlightColor,starlightNoteShape,starlightLimits,starlightBeamStops,starlightParticleOpacity,drawInterstellarPiano,interstellarKeyGuide,interstellarPianoGeometry,interstellarRobloxMap}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const empty=new Set();
const note=(id,start=0,midi=60)=>({id,code:`Key${id}`,midi,startMs:start,physicalEndMs:null,endMs:null,assisted:false,octave:false});

test('pitch palette hits its cosmic anchors and blends continuously between neighboring notes',()=>{
 assert.equal(starlightColor(36),'#76c9ff');assert.equal(starlightColor(56),'#78dfff');assert.equal(starlightColor(72),'#8b9eff');assert.equal(starlightColor(88),'#c59bff');
 for(let midi=36;midi<96;midi++){
  const a=starlightColor(midi),b=starlightColor(midi+1);
  for(const index of [1,3,5])assert.ok(Math.abs(parseInt(a.slice(index,index+2),16)-parseInt(b.slice(index,index+2),16))<=6);
 }
});

test('keys attack smoothly, reset physical depth on keyup and fade completely after 480ms',()=>{
 const keys=new StarlightKeys();
 const first=keys.update(new Set([60]),empty,0).get(60);
 const middle=keys.update(new Set([60]),empty,60).get(60);
 const held=keys.update(new Set([60]),empty,200).get(60);
 assert.ok(first.level>0&&first.level<middle.level&&middle.level<held.level);
 const released=keys.update(empty,empty,220).get(60);
 assert.equal(released.held,false);assert.equal(released.depth,0);assert.ok(released.level>.9);
 assert.ok(keys.update(empty,empty,460).get(60).level<released.level);
 assert.equal(keys.update(empty,empty,701).size,0);assert.equal(keys.needsFrame,false);
});

test('sustain keeps a dim afterglow independent of held appearance and fades away on pedal release',()=>{
 const keys=new StarlightKeys();keys.update(new Set([76]),new Set([76]),0);keys.update(new Set([76]),new Set([76]),200);
 keys.update(empty,new Set([76]),220);
 const tail=keys.update(empty,new Set([76]),1000).get(76);
 assert.equal(tail.depth,0);assert.equal(tail.held,false);assert.equal(tail.level,.12);assert.equal(keys.needsFrame,false);
 keys.update(empty,empty,1100);assert.equal(keys.update(empty,empty,1581).size,0);
});

test('rapid retriggers preserve existing light; reduced motion skips breathing, particles and sustained frame loops',()=>{
 const keys=new StarlightKeys();keys.update(new Set([60]),empty,0);keys.update(new Set([60]),empty,180);keys.update(empty,empty,200);
 const fading=keys.update(empty,empty,300).get(60).level;
 assert.ok(keys.update(new Set([60]),empty,310).get(60).level>=fading*.99);
 const reduced=new StarlightKeys();const held=reduced.update(new Set([60]),empty,0,true).get(60);
 assert.deepEqual(held,{level:1,depth:1,held:true});assert.equal(reduced.needsFrame,false);
 const scene=new StarlightScene();scene.update([note(1)],0,true);assert.equal(scene.particles.length,0);assert.equal(scene.pulses.length,1);
});

test('contact effects fire once per attack/release, scale for chords and remain bounded under rapid playing',()=>{
 const scene=new StarlightScene(),voice=note(1);
 scene.update([voice],0);const count=scene.particles.length;
 assert.ok(count>=3);assert.equal(scene.pulses.length,1);
 scene.update([voice],16);assert.equal(scene.particles.length,count);
 voice.physicalEndMs=20;scene.update([voice],20);assert.equal(scene.particles.length,count+4);
 scene.update([voice],30);assert.equal(scene.particles.length,count+4);
 const chord=new StarlightScene();chord.update(Array.from({length:8},(_,i)=>note(i+1,0,48+i)),0);
 assert.ok(chord.particles.length/8>count,'chord intensity scales through density rather than invented velocity');
 for(let frame=0;frame<120;frame++){
  scene.update(Array.from({length:20},(_,i)=>note(frame*20+i+100,frame*16,36+i)),frame*16);
  assert.ok(scene.particles.length<=starlightLimits.particles);assert.ok(scene.pulses.length<=starlightLimits.pulses);
 }
 assert.ok(scene.particles.every(star=>star.life>=720&&star.life<=1750));
 scene.update([],10000);assert.equal(scene.particles.length,0);assert.equal(scene.pulses.length,0);
 scene.clear();assert.equal(scene.particles.length,0);
});

test('afterglow does not keep physical labels pressed or change any of the 61 mappings',()=>{
 const map=interstellarRobloxMap,serialized=JSON.stringify(map),guide=interstellarKeyGuide(map,0,3,true),geometry=interstellarPianoGeometry(1920,0,36,96);
 const keys=new StarlightKeys();keys.update(new Set([61]),empty,0);keys.update(new Set([61]),empty,200);const lights=keys.update(empty,empty,220);
 const labels=[];const ctx=new Proxy({fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),fillText(label){labels.push({label,color:this.fillStyle});}},{get(target,key){return key in target?target[key]:()=>{};}});
 drawInterstellarPiano(ctx,1920,324,geometry,guide,empty,empty,new Map(),undefined,1,undefined,[],lights);
 assert.ok(lights.get(61).level>.9);assert.equal(labels.find(label=>label.label==='T').color,'#e1f5ff');
 assert.equal(labels.length,62);assert.equal(JSON.stringify(map),serialized);
});


test('wider note beams stay centered, fit their keys and preserve the physical release endpoint',()=>{
 for(const width of [1366,1920,2560]) {
  const geometry=interstellarPianoGeometry(width,0,36,96);
  for(const key of geometry.keys.values()) {
   const oldWidth=Math.max(3,Math.min(12,key.width*.28));
   const shape=starlightNoteShape(key,100,102);
   assert.ok(shape.width>=oldWidth*2,'at least twice the previous skinny beam width');
   assert.ok(shape.width<key.width);assert.ok(shape.radius>0);
   assert.ok(Math.abs(shape.x+shape.width/2-(key.x+key.width/2))<.0001);
   assert.equal(shape.height,10);assert.equal(shape.top+shape.height,102);
   const long=starlightNoteShape(key,100,350);assert.equal(long.height,250);assert.equal(long.top,100);
  }
 }
});

test('held notes replenish visible shimmer at a fixed cadence and stop emitting after audio release',()=>{
 const scene=new StarlightScene(),voice=note(1);
 scene.update([voice],0);const burst=scene.particles.length;
 assert.ok(burst>=17,'clearly stronger initial burst');
 scene.update([voice],80);assert.equal(scene.particles.length,burst);
 scene.update([voice],100);assert.ok(scene.particles.length>burst);
 scene.update([voice],1000);assert.ok(scene.particles.some(star=>star.born===1000),'held voice keeps shimmering');
 voice.physicalEndMs=1010;voice.endMs=1010;scene.update([voice],1010);
 scene.update([voice],1300);assert.ok(scene.particles.every(star=>star.born<=1010));
 scene.update([],3000);assert.equal(scene.particles.length,0);
 const sustained=new StarlightScene(),held=note(2);sustained.update([held],0);held.physicalEndMs=100;
 sustained.update([held],200);assert.ok(sustained.particles.some(star=>star.born===200),'pedal-held sound retains shimmer without lengthening the bar');
});


test('blue and violet beams progress from darker tops through body color to near-white bases',()=>{
 const luminance=hex=>[1,3,5].reduce((sum,index,i)=>sum+parseInt(hex.slice(index,index+2),16)*[.2126,.7152,.0722][i],0);
 for(const color of ['#76c9ff','#78dfff','#8b9eff','#c59bff']) {
  const stops=starlightBeamStops(color);
  assert.equal(stops[0].offset,0);assert.equal(stops.at(-1).offset,1);
  assert.equal(stops.find(stop=>stop.offset===.55).color,color,'middle retains the actual body color');
  for(let i=1;i<stops.length;i++) {
   assert.ok(stops[i].offset>stops[i-1].offset);
   assert.ok(luminance(stops[i].color)>luminance(stops[i-1].color),'energy increases toward the bottom');
  }
  assert.ok(luminance(stops[0].color)<luminance(color)*.75);
  assert.ok(luminance(stops.at(-1).color)>235,'impact edge approaches white');
 }
});


test('collision emits twice the previous density at the exact note timestamp, brightest immediately',()=>{
 const scene=new StarlightScene(),voice=note(1);
 scene.update([voice],16);
 const formerCount=Math.round(12+(.48+.18)*14);
 assert.equal(scene.particles.length,formerCount*2);
 assert.ok(scene.particles.every(star=>star.kind==='impact'&&star.born===voice.startMs));
 for(const star of scene.particles){
  assert.ok(starlightParticleOpacity(star,0)>0);
  assert.ok(starlightParticleOpacity(star,0)>starlightParticleOpacity(star,100));
  assert.equal(starlightParticleOpacity(star,star.life),0);
 }
});

test('burst mixes fine dust, medium sparkles and rare large cores with wider drift and longer rise',()=>{
 const scene=new StarlightScene();scene.update([note(1),note(2,0,72),note(3,0,88)],0);
 const burst=scene.particles;
 assert.ok(burst.some(star=>star.size<1.2));
 assert.ok(burst.some(star=>star.size>=1.6&&star.size<3));
 assert.ok(burst.some(star=>star.size>3));
 assert.ok(burst.filter(star=>star.size>3).length<burst.length*.15,'larger stars remain occasional');
 assert.ok(burst.some(star=>star.drift<-35)&&burst.some(star=>star.drift>35));
 assert.ok(burst.some(star=>star.speed>110));
 assert.ok(burst.some(star=>star.life>1500));
 assert.ok(burst.every(star=>Number.isFinite(star.phase)&&star.sway>0));
 scene.update([note(1),note(2,0,72),note(3,0,88)],100);
 const shimmer=scene.particles.filter(star=>star.kind==='shimmer');
 assert.ok(shimmer.length>0&&shimmer.length<burst.length*.15,'ongoing shimmer stays lighter than the collision');
 assert.ok(shimmer.every(star=>star.strength<burst[0].strength));
});
