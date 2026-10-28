import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const bundle=await build({stdin:{contents:`
 export * from './src/piano/performancePads';
 export {DrumEngine} from './src/piano/drumEngine';
 export {RosesIntroEngine} from './src/piano/rosesIntroEngine';
 export * from './src/piano/outputObserver';
 export * from './src/piano/levels';
 export * from './src/piano/levelsRealPiano';
 export * from './src/piano/roses';export {rosesLiveChordShortcuts,rosesIndividualChordNotes} from './src/piano/rosesIndividualChords';
 export * from './src/piano/rosesPresentation';
 export * from './src/piano/rosesChords';
 export * from './src/piano/visualDropChords';
 export * from './src/piano/rosesManualBass';
 export * from './src/piano/liveNotes';
 export * from './src/piano/profiles';
 export * from './src/piano/interstellarPerformance';
 export * from './src/piano/interstellarPresentation';
 export {default as Workstation} from './src/components/PerformanceWorkstation';
 export {default as IntroLoopDeck} from './src/components/RosesIntroLoopDeck';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},plugins:[{name:'shared-modules',setup(b){b.onResolve({filter:/^(react(?:\/.*)?|tone)$/},args=>({path:pathToFileURL(createRequire(import.meta.url).resolve(args.path)).href,external:true}));}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base={song:'levels',real:true,measure:9,guide:api.levelsIndividualGuide(),vocalKey:'KeyL',backingPlaying:false};

test('Intro Loop display waits until bar 13 and shows its physical source keys',()=>{
 const render=clock=>renderToStaticMarkup(createElement(api.IntroLoopDeck,{engine:{scoreBeat:()=>48,tempo:()=>100},clock}));
 assert.equal(render({status:'running',measure:4,synthActive:false}),'');
 assert.equal(render({status:'running',measure:5,synthActive:false}),'');
 assert.equal(render({status:'running',measure:5,synthActive:true}),'');
 assert.equal(render({status:'running',measure:12,synthActive:true}),'');
 const active=render({status:'running',measure:13,synthActive:true});
 assert.match(active,/INTRO LOOP/);assert.match(active,/BAR 1 \/ 4/);
 for(const key of ['L',';','&#x27;'])assert.ok(active.includes(`<kbd`)&&active.includes(key));
 assert.equal(render({status:'running',measure:21,synthActive:false}),'');
});

test('Levels pads use current real or assisted drum mappings, with correct bar availability',()=>{
 for(const real of [true,false]){
  const pads=api.performancePads({...base,real,guide:real?base.guide:{}});
  assert.deepEqual(Object.fromEntries(pads.map(p=>[p.code,p.label==='Hi-hat'?'hat':p.label])),real?api.levelsRealDrums:api.drumCodeToLayer);
  assert.ok(pads.every(p=>p.available));
  assert.ok(api.performancePads({...base,real,measure:1,guide:{}}).every(p=>!p.available));
 }
 const drums={status:'running',active:{kick:true,clap:false,hat:false},pending:{clap:true},fillPending:true};
 const pads=api.performancePads({...base,drums});
 assert.equal(pads.find(p=>p.code==='F1').active,true);
 assert.equal(pads.find(p=>p.code==='F2').queued,true);
 assert.equal(pads.find(p=>p.code==='F4').queued,true);
 assert.ok(pads.every(p=>['Drums','FX'].includes(p.group)),'no invented synth, bass or vocal instruments');
});

test('chord pads come from the actual shared piano guide, including remapped assisted triggers',()=>{
 const chords={...api.levelsChordDefaults,KeyQ:api.levelsChordDefaults.KeyA};delete chords.KeyA;
 const guide=Object.fromEntries(Object.entries(chords).flatMap(()=>[]));
 // Build the same guide directly from current bindings, without creating new audio triggers.
 for(const [code,pitches] of Object.entries(chords)) for(const pitch of pitches)(guide[pitch]??=[]).push({code,label:api.physicalKeyLabel(code),hand:'neutral'});
 const pads=api.performancePads({...base,real:false,guide}).filter(p=>p.group==='Chords');
 assert.deepEqual(pads.map(p=>p.code).sort(),Object.keys(chords).sort());
 assert.equal(pads.find(p=>p.code==='KeyQ').key,'Q');
 assert.ok(pads.every(p=>p.kind==='live'));
});

test('Roses pads distinguish manual cues, fixed chord mappings, custom vocal keys and automated layers',()=>{
 const guide=api.rosesKeyGuide(api.rosesMap,-4,'KeyP',true);
 const backing={events:[{layer:'drums'},{layer:'bass'}],active:[{layer:'bass'}]};
 const roses={status:'running',measure:15,bassPlaybackMode:'manual',synthActive:true,vocalStatus:'PLAYING',synthPending:false,lastDrum:{kind:'kick',sequence:3}};
 const pads=api.performancePads({...base,song:'roses',guide,roses,vocalKey:'KeyP',backing,backingPlaying:true});
 assert.equal(pads.find(p=>p.id==='roses:vocal').code,'KeyP');
 assert.equal(pads.find(p=>p.id==='roses:synth').queued,true,'a queued stop remains visibly queued');
 assert.equal(pads.find(p=>p.id==='roses:kick').code,'KeyZ');
 assert.equal(pads.some(p=>p.code==='F6'||p.id==='roses:build'),false,'removed early build has no stage pad');
 assert.equal(pads.find(p=>p.id==='roses:clap').code,'KeyX');
 assert.equal(pads.find(p=>p.id==='roses:kick').pulse,'3');
 assert.deepEqual(pads.filter(p=>p.group==='Bass').map(p=>p.code),api.rosesManualBassKeys.map(k=>k.code));
 assert.deepEqual(pads.filter(p=>p.group==='Chords').map(p=>p.code).sort(),Object.keys({...api.rosesLiveChordShortcuts,...api.visualDropChordShortcuts}).filter(code=>code!=='KeyP').sort());
 const auto=pads.filter(p=>p.kind==='auto');assert.equal(auto.length,2);assert.ok(auto.every(p=>!p.code&&!p.key));
 assert.equal(auto.find(p=>p.id==='auto:bass').active,true);
 assert.equal(auto.find(p=>p.id==='auto:drums').active,false);
});

test('live pad illumination follows note ownership, sustain and release with a bounded fade',()=>{
 const notes=new api.LiveNotes();notes.on('roses-chord:Digit6:69',69,0);
 assert.equal(api.padNoteLevel('Digit6',notes.soundingNotes(),50),1);
 assert.equal(api.padNoteLevel('Digit7',notes.soundingNotes(),50),0);
 notes.off('roses-chord:Digit6:69',100,true);
 assert.equal(api.padNoteLevel('Digit6',notes.soundingNotes(),10000),1,'pedal-held voices do not expire with note-trail visibility');
 const released=notes.soundingNotes();
 notes.pedalUp(10000);
 assert.equal(api.padNoteLevel('Digit6',released,10160),.5);
 assert.equal(api.padNoteLevel('Digit6',released,10330),0);
 notes.clear();assert.deepEqual(notes.soundingNotes(),[]);
});

test('output analysis is a parallel branch and cleanup leaves speaker connections intact',()=>{
 const speaker={},node={disposed:0,dispose(){this.disposed++;}};
 const connected=new Set([speaker]);
 const output={connect(n){connected.add(n);},disconnect(n){assert.ok(n,'never disconnect all output connections');connected.delete(n);}};
 const tap=api.observeOutput(output,()=>node);
 assert.deepEqual([...connected],[speaker,node]);
 tap.dispose();tap.dispose();assert.deepEqual([...connected],[speaker]);assert.equal(node.disposed,1);
 const broken={connect(){throw Error('unavailable');},disconnect(){assert.fail('failed connection should not disconnect anything');}};
 assert.throws(()=>api.observeOutput(broken,()=>node),/unavailable/);assert.equal(node.disposed,2);
});

test('section-specific Interstellar guide names actual physical keys and generated octave transformations',()=>{
 for(const section of [1,2,3]){
  const map=api.mapForInterstellarSection(section),guide=api.interstellarKeyGuide(map,0,section,true);
  for(const binding of map.bindings)assert.ok(guide[binding.midi].some(entry=>entry.code===binding.code));
  assert.ok(!guide[36],'unmapped reference keys are not presented as playable inputs');
 }
 const guide=api.interstellarKeyGuide(api.mapForInterstellarSection(3),0,3,true);
 assert.ok(guide[88].some(entry=>entry.code==='KeyF'&&entry.label==='F ×2'));
});

test('workstation renders real keycaps, separates automatic backing and deduplicates chord input',()=>{
 const pads=api.performancePads({...base});
 const html=renderToStaticMarkup(createElement(api.Workstation,{pads,snapshot:{pressed:[{code:'Digit5',midi:47},{code:'Digit5',midi:59}],detected:['Digit5'],shift:false},notes:new api.LiveNotes(),mappingName:'Levels E major'}));
 assert.match(html,/PHYSICAL INPUT/);assert.doesNotMatch(html,/workstation-wave|Live master audio waveform/,'hidden waveform is analysed without painting an unused canvas');assert.match(html,/>F1<\/kbd>/);
 assert.equal((html.match(/>5<\/kbd>/g)??[]).length,1,'one physical key per chord trigger');
 assert.doesNotMatch(html,/<button|<input|onClick|Mixer|Calibration/);
 const auto=renderToStaticMarkup(createElement(api.Workstation,{pads:[{id:'auto:bass',label:'Bass',group:'Backing',kind:'auto'}],snapshot:{pressed:[],detected:[],shift:false},notes:new api.LiveNotes(),mappingName:'Roses'}));
 assert.match(auto,/AUTOMATED/);assert.match(auto,/pad-auto\">AUTO/);assert.doesNotMatch(auto,/<kbd>/);
});


test('sample pad observers follow real player endings and never allocate before readiness',()=>{
 let state='started',reads=0;
 const players={player(name){assert.ok(['fill','kick'].includes(name));reads++;return {state};}};
 for(const [engine,method,name] of [[api.DrumEngine,'isLayerPlaying','fill'],[api.RosesIntroEngine,'isDrumPlaying','kick']]){
  assert.equal(engine.prototype[method].call({ready:false,players},name),false);
  const before=reads;
  assert.equal(engine.prototype[method].call({ready:true,players},name),state==='started');
  assert.equal(reads,before+1);
 }
 let playing=true;
 const pads=api.performancePads({...base,levelsPlaying:()=>playing});
 assert.equal(pads.find(p=>p.id==='levels:fill').playing(),true);
 playing=false;
 assert.equal(pads.find(p=>p.id==='levels:fill').playing(),false,'sample completion is observed without waiting for a React render');
 state='stopped';assert.equal(api.DrumEngine.prototype.isLayerPlaying.call({ready:true,players},'fill'),false);
});


test('pad release reads never truncate the existing piano trail history',()=>{
 const notes=new api.LiveNotes();notes.on('KeyT',64,0);notes.off('KeyT',100);
 assert.equal(notes.recentReleases(200,320).length,1);
 assert.equal(notes.recentReleases(1000,320).length,0);
 assert.equal(notes.visible(1000,4400).length,1,'longer note trails retain their own visibility window');
});


test('Roses piano shows full P/O/I chords and individual silent gesture pitches',()=>{
 for(const transpose of [0,-4,3]){
  const guide=api.rosesKeyGuide(api.rosesMap,transpose,'KeyL',true);
  for(const [code,midi] of Object.entries(api.rosesIndividualChordNotes)){
   const displayed=Object.entries(guide).filter(([,entries])=>entries.some(entry=>entry.code===code)).map(([pitch])=>Number(pitch));
   assert.deepEqual(displayed,api.rosesLiveChordShortcuts[code]??[midi]);
   const manual=api.rosesKeyGuide(api.rosesMap,transpose,'KeyL',true,true);
   const manualPitches=Object.entries(manual).filter(([,entries])=>entries.some(entry=>entry.code===code)).map(([pitch])=>Number(pitch));
   assert.deepEqual(manualPitches,[midi],'explicit manual lead labels follow individual input');
   assert.equal(api.levelsEMajor.bindings.find(binding=>binding.code===code)?.midi,midi);
  }
 }
});

test('Roses audience view shows playable pads and live keystrokes without arming controls',()=>{
 const guide=api.rosesKeyGuide(api.rosesMap,0,'KeyG',true);
 const pads=api.performancePads({...base,song:'roses',guide,vocalKey:'KeyG',roses:{status:'running',measure:15,bassPlaybackMode:'manual',bassActive:false,synthPending:true,vocalStatus:'ARMED'}});
 const props={pads,snapshot:{pressed:[{code:'Equal',label:'=',midi:61}],detected:['Equal','KeyV'],shift:false,notesPerSecond:1},notes:new api.LiveNotes(),mappingName:'Internal Roses mapping'};
 const audience=renderToStaticMarkup(createElement(api.Workstation,{...props,audience:true}));
 assert.match(audience,/record-orb/);assert.match(audience,/data-pad-id="roses:kick"/);assert.match(audience,/data-pad-id="roses:clap"/);
 assert.match(audience,/LIVE KEYS/);assert.match(audience,/<kbd>=<\/kbd>/);
 for(const code of ['Equal','Minus','Digit0','Digit9'])assert.ok(audience.includes(`data-pad-id="chord:${code}"`),`${code} chord pad visible`);
 assert.match(audience,/data-pad-id="roses:accent"/);assert.match(audience,/<kbd>C<\/kbd>/);
 assert.match(audience,/data-pad-id="intro:KeyL"/);
 for(const code of ['Digit1','Digit2','Digit3','Digit4','Digit5','KeyI','KeyO','KeyP'])assert.ok(!audience.includes(`data-pad-id="chord:${code}"`),`${code} omitted from audience pads`);
 assert.doesNotMatch(audience,/PHYSICAL INPUT|SEQUENCE \/ AUTO|QUEUED|Internal Roses mapping|Arm \/ stop|data-pad-id="(?:auto:|roses:synth|roses:vocal|roses:stop)/);
 assert.doesNotMatch(audience,/title="[^"]*(?:automatic|Arm|hold|release)/);
 const setup=renderToStaticMarkup(createElement(api.Workstation,{...props,audience:false}));
 assert.match(setup,/<kbd>=<\/kbd>/);assert.match(setup,/PHYSICAL INPUT/);assert.match(setup,/data-pad-id="chord:Equal"/);
 for(const code of ['Digit1','Digit2','Digit3','Digit4','Digit5','KeyI','KeyO','KeyP'])assert.ok(setup.includes(`data-pad-id="chord:${code}"`),`${code} retained in operator setup`);
 assert.ok(pads.some(pad=>pad.id==='chord:Equal'),'audience filtering does not mutate the input configuration');
});

test('audience Intro Loop anchors beneath a retained intro synth pad after the retired chord pads are hidden',()=>{
 const guide=api.rosesKeyGuide(api.rosesMap,0,'KeyG',true);
 const pads=api.performancePads({...base,song:'roses',guide,vocalKey:'KeyG',roses:{status:'running',measure:13,bassPlaybackMode:'manual',synthActive:true}});
 const props={pads,audience:true,snapshot:{pressed:[],detected:[],shift:false},notes:new api.LiveNotes(),mappingName:'Roses'};
 const html=renderToStaticMarkup(createElement(api.Workstation,{...props,introLoop:createElement(api.IntroLoopDeck,{engine:null,clock:{status:'running',measure:13,synthActive:true}})}));
 assert.match(html,/class="workstation-intro-loop" data-anchor-pad="intro:KeyL"/);
 const visible=pads.filter(pad=>pad.kind==='live'&&!pad.audienceHidden);
 const groups=[...new Set(visible.map(pad=>pad.group))];
 const anchor=groups.flatMap(group=>visible.filter(pad=>pad.group===group)).findIndex(pad=>pad.id==='intro:KeyL');
 for(const columns of [2,3,4,6]){
  assert.ok(html.includes(`--loop-column-${columns}:${Math.min(anchor%columns+1,columns-1)}`));
  assert.ok(html.includes(`--loop-row-${columns}:${Math.floor(anchor/columns)+2}`));
 }
 assert.match(html,/aria-label="Intro loop"/);
 const inactive=renderToStaticMarkup(createElement(api.Workstation,props));
 assert.doesNotMatch(inactive,/workstation-intro-loop/,'no empty loop row before its entrance');
});

test('Roses audience piano retains only the performance phrases without changing input data or phase-specific pitches',()=>{
 const mappings=JSON.stringify([api.rosesMap,api.rosesLiveChordShortcuts]);
 for(const gestures of [false,true]){
  const guide=api.rosesKeyGuide(api.rosesMap,0,'KeyG',true,false,gestures),before=JSON.stringify(guide);
  const clean=api.rosesAudiencePianoGuide(guide),entries=Object.values(clean).flat(),codes=new Set(entries.map(entry=>entry.code));
  for(const code of ['KeyL','Semicolon','Quote','KeyJ','KeyH','KeyF','KeyD','KeyS','KeyA','KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','Equal','Minus','Digit0','Digit9','Comma','Period','Slash'])assert.ok(codes.has(code),`${code} remains visible`);
  assert.equal(codes.size,26);assert.ok(entries.every(entry=>!entry.label.startsWith('⇧')));
  assert.ok(!codes.has('Digit2'));assert.ok(!codes.has('Digit6'));assert.ok(!codes.has('KeyZ'));
  for(const [pitch,labels] of Object.entries(clean))for(const entry of labels)assert.ok(guide[pitch].includes(entry),'every label stays at its original current-route pitch');
  if(gestures)for(const [code,pitch] of Object.entries({KeyJ:73,KeyH:71,KeyF:68,KeyD:66,KeyS:64,KeyA:63,KeyW:59}))assert.ok(clean[pitch].some(entry=>entry.code===code));
  assert.equal(JSON.stringify(guide),before);
 }
 assert.equal(JSON.stringify([api.rosesMap,api.rosesLiveChordShortcuts]),mappings);
});
