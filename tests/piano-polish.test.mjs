import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({stdin:{contents:`
export * from './src/piano/rosesPresentation';
export * from './src/piano/performancePresentation';
export * from './src/piano/geometry';
export * from './src/piano/noteMapping';
export * from './src/piano/roses';
export * from './src/piano/rosesChords';
export * from './src/piano/hereWithMeChords';
export * from './src/piano/backingVisuals';
export * from './src/components/performancePiano';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { rosesMap, rosesKeyGuide, rosesChordShortcuts, hereWithMeChordShortcuts, getPitch, pianoGeometry, backingFrame, drawPerformancePiano, stageKeyGuide, standardMap } = api;

test('every Roses keycap resolves to the actual routed pitch, including all chord aliases', () => {
  const chords = {...rosesChordShortcuts,...hereWithMeChordShortcuts};
  for (const transpose of [0, 2, -3]) for (const vocal of ['KeyL','KeyC','KeyG']) {
    const guide = rosesKeyGuide(rosesMap, transpose, vocal);
    for (const [midi, entries] of Object.entries(guide)) for (const entry of entries) {
      assert.ok(!['KeyV','KeyN','KeyB','KeyM','KeyZ','KeyX',vocal].includes(entry.code));
      assert.ok(chords[entry.code] ? chords[entry.code].includes(+midi) : getPitch(rosesMap,entry.code,entry.label.startsWith('⇧'),transpose) === +midi);
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
