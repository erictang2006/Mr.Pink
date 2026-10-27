import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const bundle=await build({stdin:{contents:`export * from './src/piano/rosesHwmVisuals';export {drawRecordOrb} from './src/components/recordOrb';export {StageEnergy,stageOrbGeometry} from './src/components/stageEnergy';export {default as Header} from './src/components/PerformanceHeader';export {default as Orb} from './src/components/PerformanceEnergyOrb';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},a=>({path:pathToFileURL(createRequire(import.meta.url).resolve(a.path)).href,external:true}));}}]});
const output='/private/tmp/mr-pink-hwm-vinyl-test.mjs';writeFileSync(output,bundle.outputFiles[0].text);const api=await import(pathToFileURL(output).href);
function context(){
 const stack=[],calls=[];const target={globalAlpha:1,angle:0,save(){stack.push([this.globalAlpha,this.angle]);},restore(){[this.globalAlpha,this.angle]=stack.pop();},rotate(angle){this.angle+=angle;calls.push(['rotate',angle]);},createRadialGradient(){return {addColorStop(at){assert.ok(at>=0&&at<=1);}};},createLinearGradient(){return {addColorStop(at){assert.ok(at>=0&&at<=1);}};},drawImage(...args){calls.push(['drawImage',...args,{alpha:this.globalAlpha,angle:this.angle}]);}};
 const ctx=new Proxy(target,{get(t,key){if(key in t)return t[key];return (...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));calls.push([key,...args]);};},set(t,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),String(key));t[key]=value;return true;}});
 return {ctx,calls,stack};
}
test('bars 1–28 keep Roses; bars 29–36 morph continuously; bar 37 opens the blue drop',()=>{
 for(const beat of [0,16,80,111.99])assert.equal(api.rosesHwmVisuals(beat).mix,0);
 const start=api.rosesHwmVisuals(112);assert.equal(start.artworkMix,0);assert.equal(start.mix,0);
 let previous=start;
 for(let beat=112;beat<144;beat+=.0625){const frame=api.rosesHwmVisuals(beat);assert.ok(frame.mix>=previous.mix);assert.ok(frame.artworkMix>=previous.artworkMix);assert.ok(frame.mix-previous.mix<.004);assert.equal(frame.drop,false);previous=frame;}
 const drop=api.rosesHwmVisuals(144);assert.equal(drop.mix,1);assert.equal(drop.artworkMix,1);assert.equal(drop.titleMix,1);assert.equal(drop.drop,true);assert.equal(drop.dropFlash,1);assert.equal(drop.bassPulse,1);
 assert.equal(api.rosesHwmVisuals(176).drop,false);
});
test('pause, seek, restart, and direct jumps derive the same visual state from score position',()=>{
 const paused=api.rosesHwmVisuals(127.125);
 for(let i=0;i<100;i++)assert.deepEqual(api.rosesHwmVisuals(127.125),paused);
 assert.equal(api.rosesHwmVisuals(152).dropFlash,0,'jumping deep into the drop never replays its entrance flash');
 assert.equal(api.rosesHwmVisuals(144.66).dropFlash,0);
 assert.equal(api.rosesHwmVisuals(148).dropWave,-1);
 assert.deepEqual(api.rosesHwmVisuals(0),api.rosesHwmVisuals(NaN));assert.equal(api.rosesHwmVisuals(0).mix,0);
 assert.deepEqual(api.rosesHwmVisuals(127.125),paused);
 assert.ok(api.rosesHwmVisuals(144.5).bassPulse<api.rosesHwmVisuals(144).bassPulse);
 assert.equal(api.rosesHwmVisuals(122).labelWave,2/3);
});
test('helmet crop preserves both X eyes and excludes cover typography without changing aspect ratio',()=>{
 const crop=api.helmetCrop(600,600);assert.equal(crop.size,400);assert.equal(crop.x,90);assert.equal(crop.y,105);
 // Left and right eyes of the supplied cover stay comfortably inside the circular mask.
 for(const [x,y]of [[210,310],[345,310]])assert.ok(Math.hypot(x-(crop.x+200),y-(crop.y+200))<200);
 assert.ok(crop.y>105-1);assert.ok(crop.y+crop.size<=505);
 assert.deepEqual(api.helmetCrop(1200,1200),{x:180,y:210,size:800});
});
test('artwork crossfades on the same upright label and keeps geometry unchanged through buildup',()=>{
 const roses={width:600,height:600,id:'roses'},helmet={naturalWidth:600,naturalHeight:600,width:600,height:600,id:'helmet'},energy=new api.StageEnergy();
 for(const beat of [0,112,120,128,136,143.99,144,148,175]){
  const {ctx,calls,stack}=context(),frame=api.rosesHwmVisuals(beat),geometry={x:400,y:280,radius:140};
  api.drawRecordOrb(ctx,900,650,12000,energy,false,{artwork:roses,hwmArtwork:helmet,hwm:frame,geometry,rotation:.8,particleClock:beat*600});
  const images=calls.filter(call=>call[0]==='drawImage'),cover=images.find(call=>call[1]===helmet);
  assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,1);assert.ok(calls.length<2200,'effects keep a fixed draw budget');
  assert.ok(images.every(call=>Math.abs(call.at(-1).angle)<1e-12),'neither artwork rotates');
  if(frame.artworkMix===0)assert.equal(cover,undefined);else{
   assert.deepEqual(cover.slice(2,6),[90,105,400,400]);assert.equal(cover[8],cover[9]);assert.equal(cover.at(-1).alpha,frame.artworkMix);
  }
  if(!frame.drop){const image=images.find(call=>call[1]===roses);assert.equal(image[2],400-140*.64);assert.equal(image[3],280-140*.64);assert.equal(image[4],140*1.28);}
 }
});
test('missing cover and reduced motion retain a functional record without forged replacement artwork',()=>{
 for(const reduced of [false,true]){
  const {ctx,calls,stack}=context();api.drawRecordOrb(ctx,900,650,12000,new api.StageEnergy(),reduced,{artwork:{width:600,height:600},hwm:api.rosesHwmVisuals(144)});
  assert.equal(stack.length,0);assert.equal(calls.filter(call=>call[0]==='drawImage').length,1);
 }
 const html=renderToStaticMarkup(createElement(api.Orb,{notes:{},activity:{},audioLevel:{current:0},stageLevel:{current:0},vinylTimeline:{beat:144,getBeat:()=>144,playing:false}}));
 assert.match(html,/\/assets\/here-with-me-cover.jpg/);assert.equal((html.match(/<canvas/g)||[]).length,1);assert.match(html,/original Marshmello and CHVRCHES artwork/);
 const header=renderToStaticMarkup(createElement(api.Header,{song:'roses',measure:33,bpm:100,sustain:false,showPedal:false,titleTransition:{from:'Roses',to:'Here With Me',mix:.75}}));
 assert.match(header,/stage-song-morph/);assert.match(header,/aria-label="Here With Me"/);
});


test('the matching official cover is a local unchanged JPEG with recorded provenance',()=>{
 const bytes=readFileSync('public/assets/here-with-me-cover.jpg');
 const source=JSON.parse(readFileSync('public/assets/here-with-me-cover.source.json','utf8'));
 assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
 assert.equal(source.releasePage,'https://marshmello.lnk.to/herewithme');assert.equal(source.width,source.height);assert.ok(bytes.length<150000);
});
