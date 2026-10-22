import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/piano/hybridBacking';export * from './src/piano/backingVisuals';export {backingChoices,defaultBackingMode} from './src/piano/rosesBacking';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const model=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base='public/roses/hybrid/',manifest=JSON.parse(readFileSync(base+'manifest.json'));
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
function wave(file){const bytes=readFileSync(file),format=bytes.readUInt16LE(20),bits=bytes.readUInt16LE(34),channels=bytes.readUInt16LE(22),rate=bytes.readUInt32LE(24);assert.equal(bytes.toString('ascii',36,40),'data');const size=bits/8;return {bytes,rate,frames:(bytes.length-44)/(size*channels),sample:(i,c)=>format===3?bytes.readFloatLE(44+(i*channels+c)*size):bytes.readInt16LE(44+(i*channels+c)*size)/32768};}
test('Hybrid is a fourth option; source recordings and old choices remain unchanged',()=>{
 assert.deepEqual(model.backingChoices.map(c=>c.label),['Original Roses Buildup','Here With Me — Buildup','Here With Me — Drop Backing','Hybrid — Here With Me + Roses Drum Build']);assert.equal(model.defaultBackingMode,'hwm-drop');
 assert.equal(manifest.key,'E major / C♯ minor');assert.equal(manifest.transposeApplied,0);assert.equal(manifest.bpm,100);
 for(const [file,expected] of Object.entries({...manifest.inputs,...manifest.sourceHashes}))assert.equal(hash(file),expected,`stale source ${file}`);
 for(const file of manifest.files){assert.equal(hash(base+file.file),file.sha256);assert.ok(file.peakDb<0);}
});
test('Hybrid uses the exact existing pitched waveform before bar 35, only fades its amplitude, and is silent in bar 36',()=>{
 for(const group of ['chords','bass']){
  const original=wave(`public/roses/hwm-backing/drop-${group}.wav`),hybrid=wave(base+group+'.wav');assert.equal(hybrid.frames,19.2*44100);
  for(let i=0;i<hybrid.frames;i+=17)for(let c=0;c<2;c++)assert.ok(Math.abs(hybrid.sample(i,c)-original.sample(i,c)*model.hybridHarmonyGain(112+i/44100/.6))<1e-7);
  for(let i=Math.ceil(16.8*44100);i<hybrid.frames;i++)for(let c=0;c<2;c++)assert.ok(hybrid.sample(i,c)===0);
  assert.equal(model.hybridHarmonyGain(135.9),1);assert.ok(model.hybridHarmonyGain(138)<1);assert.ok(model.hybridHarmonyGain(139.99)<.1);assert.equal(model.hybridHarmonyGain(140),0);
 }
});
test('Hybrid percussion borrows exactly the original timed Spacy, pitched snare roll and snap, with a real final gap',()=>{
 const original=JSON.parse(readFileSync('src/piano/roses_buildup_manifest.json')).events.filter(e=>['spacy','roll','snap'].includes(e.layer));
 assert.equal(manifest.percussion.length,73);assert.deepEqual(manifest.percussion.map(({layer,beat,end,offset,gain})=>({layer,beat,end,offset,gain})),original);
 assert.equal(manifest.percussion.filter(e=>e.layer==='spacy').length,40);assert.equal(manifest.percussion.filter(e=>e.layer==='roll').length,32);assert.equal(manifest.percussion.filter(e=>e.layer==='snap')[0].beat,143);
 const drum=wave(base+'drums.wav');let breakPower=0,snapPower=0;
 for(let i=16.8*44100;i<18.6*44100;i++)for(let c=0;c<2;c++)breakPower+=drum.sample(Math.round(i),c)**2;
 for(let i=Math.round(18.6*44100);i<Math.round(19.075*44100);i++)for(let c=0;c<2;c++)snapPower+=drum.sample(i,c)**2;
 assert.equal(breakPower,0);assert.ok(snapPower>0);
 for(let i=Math.ceil((143.8-112)*.6*44100);i<drum.frames;i++)for(let c=0;c<2;c++)assert.equal(drum.sample(i,c),0);
});
test('both prepared risers rise in energy, are equally loud at unity, and end before the drop',()=>{
 for(const side of ['soft','strong']){
  const data=wave(base+`riser-${side}.wav`);assert.equal(data.frames,100548);assert.equal(data.frames/data.rate,2.28);
  const power=(from,to)=>{let n=0;for(let i=Math.round(from*data.rate);i<Math.round(to*data.rate);i++)for(let c=0;c<2;c++)n+=data.sample(i,c)**2;return n/((to-from)*data.rate*2);};
  assert.ok(power(1.7,2.1)>power(.1,.5)*8);assert.ok(Math.abs(manifest.files.find(f=>f.file===`riser-${side}.wav`).rmsDb+25)<.001);
 }
 assert.equal(model.hybridRiserEndBeat,143.8);assert.equal(model.validRiserSettings({intensity:2,volume:-1}).intensity,1);assert.equal(model.validRiserSettings({volume:-1}).volume,0);
});
test('Hybrid visuals use HWM pitches and only Roses percussion, then show a real breakdown/riser with no piano hits',()=>{
 const source=model.backingVisualEvents['hwm-drop'],hybrid=model.backingVisualEvents.hybrid;
 for(const event of hybrid.filter(e=>e.pitches.length)){const original=source.find(e=>`hybrid:${e.id}`===event.id);assert.ok(original);assert.deepEqual(event.pitches,original.pitches);assert.equal(event.start,original.start);assert.equal(event.end,Math.min(original.end,140));}
 assert.equal(hybrid.filter(e=>e.layer==='drums').length,73);assert.ok(hybrid.filter(e=>e.layer==='drums'||e.layer==='riser').every(e=>e.pitches.length===0));
 for(const beat of [112,128,136])assert.equal(model.backingFrame('hybrid',beat).chord,model.backingFrame('hwm-drop',beat).chord);
 for(const beat of [140,141,143]){const frame=model.backingFrame('hybrid',beat);assert.equal(frame.breakdown,true);assert.equal(frame.chord,undefined);assert.ok(frame.events.every(e=>e.pitches.length===0));assert.match(frame.role,/Breakdown/);assert.ok(frame.intensity<.3);}
 assert.equal(model.backingFrame('hybrid',143.9).riserProgress,0);assert.equal(model.backingFrame('hybrid',144,'hwm').intensity,1);
 const mix={gain:1,levels:{chords:1,bass:1,drums:1,fx:1},solo:null,riser:{enabled:false,volume:1,intensity:1}};
 assert.ok(model.backingFrame('hybrid',142,undefined,mix).events.every(e=>e.layer!=='riser'));
});
