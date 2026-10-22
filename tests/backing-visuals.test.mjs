import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './src/piano/backingVisuals';export {defaultBackingMode} from './src/piano/rosesBacking';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {backingVisualEvents,backingBarEvents,backingFrame,defaultBackingMode}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const source=JSON.parse(readFileSync('reference/here-with-me-remake/backing-events-e-major.json'));
test('HWM visual events contain every actual transposed source note at its exact beat and gate, with no invented pitches',()=>{
 for(const [mode,selection] of [['hwm-build','build'],['hwm-drop','drop']]){
  const events=backingVisualEvents[mode];
  for(const note of source.selections[selection].notes){const event=events.find(e=>e.channels.includes(note.channel)&&e.start===112+note.tick/96&&e.end===112+(note.tick+note.durationTicks)/96);assert.ok(event,`${mode}: ${note.channel}:${note.tick}`);if(note.channel===29)assert.deepEqual(event.pitches,[]);else assert.ok(event.pitches.includes(note.midi));}
  for(const event of events.filter(e=>e.pitches.length))for(const midi of event.pitches)assert.ok(source.selections[selection].notes.some(n=>event.channels.includes(n.channel)&&n.midi===midi&&112+n.tick/96===event.start&&112+(n.tick+n.durationTicks)/96===event.end));
  assert.ok(events.every(e=>e.automatic));
  const audio=events.filter(e=>e.id.startsWith('audio:'));assert.equal(audio.length,source.selections[selection].audio.length);assert.ok(audio.every(e=>e.pitches.length===0),'recordings expose activity, never invented piano pitches');
 }
});
test('selected source controls harmonic context, musical layers and bar-36 transition without copying the wrong lead',()=>{
 assert.equal(defaultBackingMode,'hwm-drop');
 for(const mode of ['hwm-build','hwm-drop']){
  for(const [beat,chord] of [[112,'C♯m'],[113.5,'B'],[116,'Aadd9'],[117.5,'E']])assert.equal(backingFrame(mode,beat).chord,chord);
  assert.equal(backingFrame(mode,111.99).hwm,false);assert.equal(backingFrame(mode,112).hwm,true);assert.equal(backingFrame(mode,144).inBuild,false);
  assert.equal(backingFrame(mode,140).transition,'Transition → drop at 37');
 }
 assert.equal(backingFrame('roses',112).title,'ROSES');assert.equal(backingFrame('roses',140).transition,'BREAK · chops only until beat 4');
 assert.ok(backingVisualEvents['hwm-build'].filter(e=>e.layer==='lead').every(e=>e.channels.includes(18)));
 assert.ok(backingVisualEvents['hwm-drop'].filter(e=>e.layer==='lead').some(e=>e.channels.includes(19)&&e.channels.includes(22)));
 assert.notDeepEqual(backingBarEvents('hwm-build',29),backingBarEvents('hwm-drop',29));
 for(const mode of ['roses','hwm-build','hwm-drop'])for(let bar=29;bar<=36;bar++){const start=(bar-1)*4;assert.ok(backingBarEvents(mode,bar).every(e=>e.start<start+4&&e.end>start));}
});
test('theme stays Roses through bar 28 and full-drop guides use only actual pitched drop sources',()=>{
 const lead=JSON.parse(readFileSync('reference/here-with-me-drop-lead/lead-events-e-major.json')).events.filter(e=>e.start_tick_relative_to_rose_bar37<3072);
 for(const mode of ['roses','hwm-build','hwm-drop']){
  for(const beat of [0,96,111.999]){const view=backingFrame(mode,beat,'hwm');assert.equal(view.title,'ROSES');assert.equal(view.hwm,false);assert.deepEqual(view.active,[]);}
  const drop=backingFrame(mode,144,'hwm');assert.equal(drop.title,'HERE WITH ME');assert.equal(drop.chord,'C♯m');assert.equal(drop.intensity,1);
  assert.ok(drop.events.every(e=>e.pitches.length),'do not copy source drum clips onto the separately arranged full-drop drums');
  for(const event of drop.events.filter(e=>e.layer==='lead'))for(const midi of event.pitches)assert.ok(lead.some(n=>event.channels.includes(n.track_channel)&&144+n.start_tick_relative_to_rose_bar37/96===event.start&&n.midi_pitch===midi&&Math.abs(n.duration_ticks/96-(event.end-event.start))<1e-10));
  assert.equal(backingFrame(mode,144,'roses').title,'ROSES');assert.equal(backingFrame(mode,176,'hwm').hwm,false);
 }
});
test('automatic piano and live activity obey backing gain, solo and muted full-drop rows',()=>{
 const mix={gain:1,levels:{chords:1,bass:1,drums:1,fx:1},solo:null};
 assert.deepEqual(backingFrame('hwm-drop',112,undefined,{...mix,gain:0}).events,[]);
 const onlyBass=backingFrame('hwm-drop',112,undefined,{...mix,solo:'bass'});assert.ok(onlyBass.events.length);assert.ok(onlyBass.events.every(e=>e.layer==='bass'));
 const noHarmony=backingFrame('hwm-drop',112,undefined,{...mix,levels:{...mix.levels,chords:0}});assert.ok(noHarmony.events.every(e=>!['chords','pad','guitar','lead'].includes(e.layer)));
 const rows=Object.fromEntries(['lead','chords','bass','bonkChords','drums'].map(id=>[id,{enabled:true,muted:id==='lead',solo:false,volume:1}]));
 assert.ok(backingFrame('hwm-drop',144,'hwm',undefined,rows).events.every(e=>e.layer!=='lead'));
});
