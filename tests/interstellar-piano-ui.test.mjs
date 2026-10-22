import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import score from '../src/piano/interstellar.song.json' with {type:'json'};
import mappingSource from '../src/piano/interstellar_roblox_aligned_mapping.json' with {type:'json'};
import assistedSource from '../src/piano/interstellar_assisted_bars_9_13.json' with {type:'json'};

const bundle = await build({stdin:{contents:`
export * from './src/piano/interstellarPresentation';
export * from './src/piano/interstellarPerformance';
export * from './src/piano/interstellarMix';
export * from './src/piano/geometry';
export * from './src/piano/noteMapping';
export * from './src/piano/liveNotes';
export * from './src/piano/performancePresentation';
export * from './src/components/interstellarPiano';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const {interstellarKeyGuide,interstellarPianoGeometry,mapForInterstellarSection,defaultInterstellarMix,planInterstellarPress,pianoRange,getPitch,drawInterstellarPiano,LiveNotes,physicalNoteBar} = api;

function recordDraw(geometry, guide, height, active=[], codes=[], depths=new Map()) {
  const text=[], faces=[];
  const ctx=new Proxy({
    fillStyle:'',font:'',
    createLinearGradient:()=>({addColorStop(){}}),
    fillText(label,x,y,maxWidth){text.push({label,x,y,maxWidth,color:this.fillStyle,font:this.font});},
    roundRect(x,y,w,h){faces.push({x,y,w,h});},
  },{get(target,key){return key in target?target[key]:()=>{};}});
  const width=geometry.whiteWidth*geometry.whites.length;
  drawInterstellarPiano(ctx,width,height,geometry,guide,new Set(active),new Set(codes),depths);
  return {text,faces};
}

test('all visible keycaps match the source mappings, with every assisted alias preserved', () => {
  for(const section of [1,2,3]) {
    const map=mapForInterstellarSection(section);
    const guide=interstellarKeyGuide(map,0,section,true);
    const source={...mappingSource.mapping,...(section===2?assistedSource.keyboardMapping:{})};
    for(const [code,note] of Object.entries(source)) {
      assert.ok(guide[note.midi].some(entry=>entry.code===code),`${section}: ${code}`);
    }
    for(const [midi,entries] of Object.entries(guide)) for(const entry of entries) {
      if(entry.label==='F ×2') assert.deepEqual([section,+midi,entry.code],[3,88,'KeyF']);
      else assert.equal(getPitch(map,entry.code,entry.label.startsWith('⇧'),0),+midi);
    }
    assert.equal(map.bindings.length,Object.keys(source).length,'no mappings added or removed');
    assert.ok(Object.keys(guide).every(midi=>+midi<84||section===3&&+midi===88));
  }
});

test('every score pitch and generated voice has a piano key, while unused upper notes have no guide', () => {
  for(const section of [1,2,3]) {
    const map=mapForInterstellarSection(section), range=pianoRange(map.bindings);
    const geometry=interstellarPianoGeometry(1920,0,range.low,range.high);
    const guide=interstellarKeyGuide(map,0,section,true);
    const bars=section===1?[1,8]:section===2?[9,13]:[14,30];
    for(const measure of score.measures.filter(m=>m.number>=bars[0]&&m.number<=bars[1])) {
      for(const note of measure.notes) assert.ok(geometry.keys.has(note.midi),`bar ${measure.number}: ${note.midi}`);
    }
    for(const binding of map.bindings) {
      for(const voice of planInterstellarPress(section,binding.code,binding.midi,0,defaultInterstellarMix).voices) assert.ok(geometry.keys.has(voice.midi));
    }
    for(let midi=84;midi<=96;midi++) {
      assert.ok(geometry.keys.has(midi),'continuous upper piano remains available');
      assert.equal(Boolean(guide[midi]),section===3&&midi===88);
    }
  }
  assert.equal(interstellarKeyGuide(mapForInterstellarSection(3),0,3,false)[88],undefined);
  assert.equal(interstellarKeyGuide(mapForInterstellarSection(3),1,3,true)[88],undefined,'transposed F no longer triggers the fixed E6 double');
});

test('fullscreen laptop and projector geometry keeps keycaps readable and aligned with note columns', () => {
  for(const [width,screenHeight] of [[1280,720],[1366,768],[1920,1080],[2560,1440],[3840,2160]]) {
    for(const section of [1,2,3]) {
      const map=mapForInterstellarSection(section), range=pianoRange(map.bindings);
      const geometry=interstellarPianoGeometry(width,0,range.low,range.high);
      const guide=interstellarKeyGuide(map,0,section,true),height=screenHeight*.3;
      const {text}=recordDraw(geometry,guide,height);
      assert.equal(text.length,Object.values(guide).flat().length);
      for(const [midi,entries] of Object.entries(guide)) for(const entry of entries) {
        const label=text.find(item=>item.label===entry.label),key=geometry.keys.get(+midi);
        assert.ok(Math.abs(label.x-(key.x+key.width/2))<.001);
        assert.ok(label.y>height*.63 && label.y<height,'natural-key caps are below the black keys');
        assert.ok(label.maxWidth>=24,'keycaps retain usable text width');
      }
      for(const [midi,key] of geometry.keys) if(key.black) {
        assert.ok(Math.abs(key.width/geometry.whiteWidth-.6)<.0001);
        assert.ok(Math.abs(key.x+key.width/2-geometry.keys.get(midi+1).x)<.0001);
      }
    }
  }
});

test('mapped black-key labels work for an existing profile without inventing any bundled black-key mappings', () => {
  const map={id:'custom',name:'Custom',bindings:[{code:'KeyS',label:'s',midi:61}]};
  const guide=interstellarKeyGuide(map,0,1,true);
  const geometry=interstellarPianoGeometry(1280,0,48,96);
  const label=recordDraw(geometry,guide,230,[61],['KeyS']).text[0];
  assert.equal(label.label,'S');
  assert.equal(label.x,geometry.keys.get(61).x+geometry.keys.get(61).width/2);
  assert.ok(label.y<230*.63);
  assert.equal(label.color,'#09273a');
});

test('illumination is immediate during depression and clears on release while sustain and finished trails remain', () => {
  const map=mapForInterstellarSection(3),range=pianoRange(map.bindings);
  const geometry=interstellarPianoGeometry(1366,0,range.low,range.high);
  const guide=interstellarKeyGuide(map,0,3,true),notes=new LiveNotes();
  notes.on('interstellar:KeyF:1',76,0);
  for(const depth of [0,.5,1]) {
    const rendered=recordDraw(geometry,guide,230,[76],['KeyF'],new Map([[76,depth]]));
    assert.equal(rendered.text.find(label=>label.label==='F').color,'#09273a');
  }
  notes.off('interstellar:KeyF:1',200,true);
  assert.deepEqual(notes.soundingPitches(),[76]);
  assert.equal(recordDraw(geometry,guide,230).text.find(label=>label.label==='F').color,'#e1f5ff');
  const note=notes.visible(300,4400)[0];
  assert.equal(physicalNoteBar(note,300,440,4400).held,false);
  assert.equal(physicalNoteBar(note,300,440,4400).height,physicalNoteBar(note,1300,440,4400).height);
  assert.ok(physicalNoteBar(note,1300,440,4400).bottom<physicalNoteBar(note,300,440,4400).bottom);
});
