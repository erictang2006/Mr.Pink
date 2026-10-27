import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({stdin:{contents:`
export * from './src/piano/rosesIntroKeys';
export * from './src/piano/rosesPresentation';
export * from './src/piano/performancePresentation';
export * from './src/piano/geometry';
export * from './src/piano/noteMapping';
export * from './src/piano/roses';
export * from './src/piano/rosesChords';export * from './src/piano/rosesIndividualChords';
export * from './src/piano/visualDropChords';
export * from './src/piano/backingVisuals';
export * from './src/components/performancePiano';
export {samePianoFrame} from './src/components/PianoCanvas';
export {PianoGeometryCache} from './src/piano/pianoGeometryCache';
export {interstellarPianoGeometry} from './src/piano/interstellarPresentation';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { rosesMap, rosesIntroKeyPitch, rosesKeyGuide, rosesLiveChordShortcuts, rosesIndividualChordPitch, visualDropChordShortcuts, getPitch, pianoGeometry, backingFrame, drawPerformancePiano, stageKeyGuide, standardMap } = api;

test('every Roses keycap resolves to the actual routed pitch, including all chord aliases', () => {
  const chords = {...rosesLiveChordShortcuts,...visualDropChordShortcuts};
  for (const transpose of [0, 2, -3]) for (const vocal of ['KeyG']) {
    const guide = rosesKeyGuide(rosesMap, transpose, vocal);
    for (const [midi, entries] of Object.entries(guide)) for (const entry of entries) {
      assert.ok(!['KeyV','KeyN','KeyB','KeyC','KeyZ','KeyX',vocal].includes(entry.code));
      assert.ok(chords[entry.code] ? chords[entry.code].includes(+midi) : (rosesIntroKeyPitch(entry.code,transpose,vocal) ?? rosesIndividualChordPitch(entry.code) ?? getPitch(rosesMap,entry.code,entry.label.startsWith('⇧'),transpose)) === +midi);
    }
    for (const [code, pitches] of Object.entries(chords)) for (const pitch of pitches) assert.ok(guide[pitch].some(label=>label.code===code));
    for (const code of ['KeyH','KeyJ','KeyK']) assert.ok(Object.values(guide).some(entries=>entries.some(entry=>entry.code===code)), 'playable upper register remains labeled');
    assert.ok(!Object.keys(guide).some(midi=>+midi>87+transpose),'unmapped extra octave has no visual labels');
  }
});

test('white-key spacing and black-key boundaries stay aligned at laptop and projector widths', () => {
  for (const width of [1280,1440,1920,2560]) {
    const {keys,whites,whiteWidth} = pianoGeometry(width,0,40,99);
    whites.forEach((midi,i)=>{ assert.equal(keys.get(midi).width,whiteWidth); assert.equal(keys.get(midi).x,i*whiteWidth); });
    for (const [midi,key] of keys) if(key.black) {
      const next=keys.get(midi+1);
      assert.ok(Math.abs(key.x+key.width/2-next.x)<.0001);
    }
    assert.ok(keys.has(40), 'lowest physical chord pitch is visible');
  }
});

test('shifted labels illuminate only on the active pitch, then immediately reset on physical release', () => {
  const guide=stageKeyGuide(standardMap,0), geometry=pianoGeometry(1280,0,48,84);
  const render=(active)=>{
    const labels=[];
    const ctx=new Proxy({fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),fillText(label){labels.push({label,color:this.fillStyle});}}, {get(target,key){return key in target?target[key]:()=>{};}});
    drawPerformancePiano(ctx,1280,230,geometry,guide,new Set(active),new Set(['KeyZ']),'roses');
    return labels;
  };
  const down=render([60]);
  assert.equal(down.find(item=>item.label==='⇧Z').color,'#06111f');
  assert.notEqual(down.find(item=>item.label==='Z').color,'#06111f');
  assert.ok(render([]).every(item=>item.color!=='#06111f'), 'sustained audio cannot retain pressed styling');
});

test('drop visual context comes from HWM drop source even when original Roses buildup is selected', () => {
  const drop=backingFrame('roses',144,'hwm');
  assert.equal(drop.title,'HERE WITH ME');
  assert.equal(drop.chord,'C♯m');
  assert.ok(drop.events.length>0 && drop.events.every(event=>event.id.startsWith('drop:') && event.start>=144));
  assert.equal(backingFrame('hwm-build',144,'roses').events.length,0);
  assert.notDeepEqual(backingFrame('hwm-build',112).events,backingFrame('hwm-drop',112).events);
});

test('audience piano shows all physical key labels with the pressed-note highlight',()=>{
 const guide=rosesKeyGuide(rosesMap,0,'KeyC'),geometry=pianoGeometry(1280,0,40,88),active=new Set([64,68]),codes=new Set(['Equal','KeyL']);
 const labels=[],attacks=[];
 const ctx=new Proxy({fillStyle:'',shadowBlur:0,createLinearGradient:()=>({addColorStop(){}}),fillText(label){labels.push(label);},fillRect(x,y,w,h){if(h===4)attacks.push([x,y,w,h]);}},{get(target,key){return key in target?target[key]:()=>{};}});
 drawPerformancePiano(ctx,1280,230,geometry,guide,active,codes,'roses',undefined,new Set(),new Set(),false,1,true);
 for(const key of ['=','L',';'])assert.ok(labels.includes(key),`${key} stays visible`);
 assert.equal(attacks.length,2,'held notes keep their pressed-key highlights');
});

test('Roses key gaps reveal the cosmic backdrop while other piano backgrounds stay unchanged',()=>{
 const geometry=pianoGeometry(1280,0,48,84),guide=stageKeyGuide(standardMap,0);
 const render=(presentation,cinematic=true)=>{
  const cleared=[],opaque=[],keys=[];
  const ctx=new Proxy({
   fillStyle:'',createLinearGradient:()=>({addColorStop(){}}),clearRect:(...rect)=>cleared.push(rect),
   fillRect(x,y,w,h){if(x===0&&y===0&&w===1280&&h===230)opaque.push(this.fillStyle);},
   roundRect:(...rect)=>keys.push(rect),
  },{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
  drawPerformancePiano(ctx,1280,230,geometry,guide,new Set([64]),new Set(['KeyT']),presentation,undefined,new Set(),new Set(),false,1,true,cinematic);
  return {cleared,opaque,keys};
 };
 const roses=render('roses');assert.deepEqual(roses.cleared,[[0,0,1280,230]]);assert.deepEqual(roses.opaque,[]);assert.ok(roses.keys.length>0);
 const levels=render('levels');assert.deepEqual(levels.cleared,[]);assert.deepEqual(levels.opaque,['#040a12']);
 const practice=render('roses',false);assert.deepEqual(practice.cleared,[]);assert.deepEqual(practice.opaque,['#040a12']);
});

test('clock-only piano props skip repainting, while live keys, aliases and mutable sustain stay responsive',()=>{
 const props={active:[64],automatic:[68],pressedCodes:['KeyL'],pressedKeys:[{code:'KeyL',midi:64}],range:{low:40,high:88},map:rosesMap,transpose:0,presentation:'roses',keyGuide:rosesKeyGuide(rosesMap,0),prominentPitches:new Set([64])};
 const copied={...props,active:[64],automatic:[68],pressedCodes:['KeyL'],pressedKeys:[{code:'KeyL',midi:64}],range:{low:40,high:88},prominentPitches:new Set([64])};
 assert.equal(api.samePianoFrame(props,copied),true);
 for(const change of [{active:[]},{automatic:[66]},{pressedCodes:['KeyT']},{pressedKeys:[{code:'KeyT',midi:64}]},{range:{low:40,high:96}},{map:{...rosesMap}},{transpose:1},{coolLighting:true},{keyGuide:{}},{prominentPitches:new Set([68])},{showKeyLabels:false}])assert.equal(api.samePianoFrame(props,{...copied,...change}),false);
 const interstellar={...props,starlightNotes:{}};
 assert.equal(api.samePianoFrame(interstellar,interstellar),false,'Interstellar pedal/afterglow keeps its existing parent-update path');
});

test('cached key geometry is reused and exactly matches the existing layout across maps and projector sizes',()=>{
 const cache=new api.PianoGeometryCache();
 for(const presentation of ['roses','levels','interstellar'])for(const width of [1280,1920,3840]){
  const range={low:40,high:88},first=cache.get(rosesMap,width,0,range,presentation);
  const expected=presentation==='interstellar'?api.interstellarPianoGeometry(width,0,range.low,range.high):api.mappedPianoGeometry(rosesMap,width,0,range.low,range.high,presentation==='levels');
  assert.deepEqual(first,expected);
  for(let index=0;index<1000;index++)assert.equal(cache.get(rosesMap,width,0,{...range},presentation),first);
  const resized=cache.get(rosesMap,width+10,0,range,presentation);assert.notEqual(resized,first);
  const shifted=cache.get(rosesMap,width+10,1,range,presentation);assert.notEqual(shifted,resized);
  const expanded=cache.get(rosesMap,width+10,1,{low:40,high:96},presentation);assert.notEqual(expanded,shifted);
  assert.notEqual(cache.get({...rosesMap},width+10,1,{low:40,high:96},presentation),expanded);
 }
});
