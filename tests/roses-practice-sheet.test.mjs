import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Render the actual practice component to catch missing measures in its UI,
// independently of the transport/audio tests.
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import RosesPractice from './src/components/RosesPractice';
    import RosesBackingControls from './src/components/RosesBackingControls';
    import DropLayerMixer from './src/components/DropLayerMixer';
    import RosesPerformanceTransport from './src/components/RosesPerformanceTransport';import RosesBuildupLeadControls from './src/components/RosesBuildupLeadControls';
    import PerformanceHeader from './src/components/PerformanceHeader';
    import {newDropRows} from './src/piano/rosesDropMixer';
    import { rosesMap } from './src/piano/roses';
    import { defaultCloserSettings } from './src/piano/rosesCloser';
    import { defaultBuildupSettings } from './src/piano/rosesBuildup';
    import { defaultRosesCalibration } from './src/piano/rosesCalibration';
    import { LiveNotes } from './src/piano/liveNotes';
    export function renderLeadMode(mode,status='idle'){return renderToStaticMarkup(React.createElement(RosesBuildupLeadControls,{engine:{},clock:{buildupLeadPlaybackMode:mode,status}}));}
    export function renderArmedStage(status='idle',ready=true,audience=false) {
      const controls=React.createElement(RosesPerformanceTransport,{audience,engine:{isReady:()=>ready},ready,clock:{status,measure:1,bassPlaybackMode:'manual',vocalReady:true,closerReady:true,drop:{status:'idle'}}});
      return renderToStaticMarkup(React.createElement(PerformanceHeader,{audience,song:'roses',measure:1,bpm:100,sustain:false,showPedal:true,controls}));
    }
    export function renderDrop(backingSource) {
      const rows=newDropRows();if(backingSource==='recording')rows.lead.enabled=false;
      return renderToStaticMarkup(React.createElement(DropLayerMixer, {engine:null,clock:{measure:37,drop:{status:'idle',backingSource,rows,drumMutes:{},chordLevels:[.4,.9]}},audioReady:false,startAudio:()=>{}}));
    }
    export function renderBacking(mode, reuseStart=false) {
      const noop=()=>{};
      return renderToStaticMarkup(React.createElement(RosesBackingControls, {
        engine:{isReady:()=>true}, clock:{buildup:{mode,status:'ARMED',gain:1,levels:{chords:1,bass:1,drums:1,fx:1},solo:null}},
        audioReady:true,startAudio:noop,vocalLevel:.75,onVocalLevel:noop,...(reuseStart?{onStart25:noop}:{})
      }));
    }
    export function renderSheet(backingMode="hwm-drop", dropSource="hwm", bassPlaybackMode="auto") {
      const noop = () => {};
      return renderToStaticMarkup(React.createElement(RosesPractice, {
        buildupSettings: defaultBuildupSettings, onBuildupSettings: noop,
        map: rosesMap, transpose: 0, range: { low: 48, high: 84 },
        snapshot: { pressed: [], detected: [], shift: false, notesPerSecond: 0 },
        liveNotes: new LiveNotes(), audioReady: false, startAudio: noop,
        engine: null, clock: {status:"idle",measure:1,beat:1,bassPlaybackMode,drop:{status:"idle",backingSource:dropSource,rows:newDropRows(),drumMutes:{},recordedOffsetMs:0,activeRecordedOffsetMs:0},buildup:{mode:backingMode,status:"NOT ARMED",ready:true,layers:[],bass:false,gain:1,levels:{chords:1,bass:1,drums:1,fx:1}}}, drumStatus: 'loading', onNoteRef: { current: null }, onDrumRef: { current: null },
        onExit: noop, onSandbox: noop, onPerformance: noop, onSongChange: noop,
        instrumentId: 'roses', onInstrument: noop, instrumentError: '',
        synthLevel: .55, onSynthLevel: noop, synthLeadMs: 20, onSynthLeadMs: noop,
        bassLevels: { bass: .45, sub: .35 }, onBassLevels: noop,
        vocalOffset: 9.6, onVocalOffset: noop, vocalKey: 'KeyG',
        closerSettings: defaultCloserSettings, onCloserSettings: noop,
        calibration: defaultRosesCalibration, onCalibration: noop,
        output: { label: 'Default', base: null, output: null },
      }));
    }
  `, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom/server'],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);

test('practice sheet includes every bar through 44 and the four automatic lead lanes', () => {
  const html = module.exports.renderSheet();
  assert.deepEqual([...html.matchAll(/data-measure="(\d+)"/g)].map(match => Number(match[1])), Array.from({ length: 44 }, (_, i) => i + 1));
  for (let bar = 37; bar <= 44; bar++) {
    const measure = html.split(`data-measure="${bar}"`)[1].split('class="practice-beats"')[0];
    assert.match(measure, new RegExp(`HERE WITH ME LEAD · PHRASE ${Math.floor((bar - 37) / 4) + 1}`));
    assert.match(measure, /LOWER AUTO/);
    for (const layer of [1, 2, 3]) assert.ok(measure.includes(`UPPER ${layer} AUTO`));
    assert.match(measure, /automatic backing/);
    assert.doesNotMatch(measure, /BUILD BASS|Z KICK LIVE/);
  }
  for (const bar of [37, 41]) assert.ok(html.includes(`>Bar ${bar}</button>`));
  assert.match(html, /Roses — bars 1–44/);
  assert.match(html, /Bar 1 \/ 44/);
  assert.match(html,/Bars 29–36 Backing Source/);assert.ok(html.includes('Original Roses Buildup'));
  assert.match(html, /Start bar 25 \+ backing \+ lead/);
  assert.match(html, /V · Synth 5–20/);
  assert.match(html, /N · Bass\/Sub 13–20/);
  assert.doesNotMatch(html, /F6|GUITAR WAV|GUITAR \+ BUILD BASS/);
  for(let bar=21;bar<=28;bar++){
    const measure=html.split(`data-measure="${bar}"`)[1].split('class="practice-beats"')[0];
    assert.doesNotMatch(measure,/BUILD BASS|GUITAR WAV/);assert.match(measure,/Z \/ X LIVE/);
  }
  for(const label of ['Bars 29–36 instrument','Bar 25 audition Vox sound']) {
    const selector=module.exports.renderSheet("roses").split(`aria-label="${label}"`)[1].split('</select>')[0];
    assert.deepEqual([...selector.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match=>match[1]),['Original Vox Synth','Light Ping Vox','Loud Stabs','Here With Me lead synths']);
  }
  assert.match(html,/DROP LAYER MIXER · BARS 37–44/);
  for(const layer of ['HERE WITH ME LEAD','HERE WITH ME BASS','HERE WITH ME CHORDS / GUITAR / PAD','ROSES DROP DRUMS']){
    assert.ok(html.includes(`aria-label="Mute ${layer}"`));assert.ok(html.includes(`aria-label="Solo ${layer}"`));
    assert.ok(html.includes(`aria-label="${layer} enabled"`));assert.ok(html.includes(`aria-label="${layer} volume"`));
  }
  assert.match(html,/Play Drop/);assert.match(html,/Mute drop hat/);assert.match(html,/E major/);
  assert.doesNotMatch(html,/aria-label="Here With Me drop lead sound"/);assert.doesNotMatch(html,/Recorded Loud Stabs · Keys 1–3/);
});


test('backing selector exposes only Original Roses Buildup while retained alternate modes keep their submixes',()=>{
 for(const mode of ['roses','hwm-build','hwm-drop']){
  const html=module.exports.renderBacking(mode);
  const selector=html.split('aria-label="Bars 29–36 Backing Source"')[1].split('</select>')[0];
  assert.deepEqual([...selector.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m=>m[1]),['Original Roses Buildup']);
  assert.match(html,/Start Bar 25 \+ Backing \+ Lead/);assert.match(html,/Start Bar 29/);
  assert.match(html,/Here With Me vocal volume/);assert.match(html,/Bars 29–36 backing volume/);
  for(const group of ['chords','bass','drums','fx'])assert.equal(html.includes(`Solo Here With Me backing ${group}`),mode!=='roses');
 }
 assert.doesNotMatch(module.exports.renderBacking('hwm-drop',true),/Start Bar 25 \+ Backing \+ Lead/);
});


test('drop selector exposes only Original Roses Recording while retained engines keep their mixer rows',()=>{
 const roses=module.exports.renderDrop('roses'),hwm=module.exports.renderDrop('hwm');
 for(const html of [roses,hwm,module.exports.renderDrop('recording')]){const selector=html.split('aria-label="Drop backing"')[1].split('</select>')[0];assert.deepEqual([...selector.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m=>m[1]),['Original Roses Recording']);assert.match(selector,/value="recording"/);}
 for(const label of ['HERE WITH ME LEAD','ROSES DROP INSTRUMENTAL'])assert.ok(roses.includes(`aria-label="${label} enabled"`));
 for(const label of ['ROSES DROP BASS','ROSES DROP DRUMS','KEYS 6–8 · BONK + FUTURE BASS'])assert.ok(!roses.includes(`aria-label="${label} enabled"`));
 assert.doesNotMatch(roses,/Drop chord preset|Drop chord layer A volume|Mute drop hat/);
 assert.equal((roses.match(/<option /g)||[]).length,1);
 assert.match(hwm,/HERE WITH ME CHORDS \/ GUITAR \/ PAD/);assert.doesNotMatch(hwm,/aria-label="Drop chord preset"/);
});

test('loading controls select the finalized sources before the first engine snapshot',()=>{
 const buildup=module.exports.renderBacking(undefined).split('aria-label="Bars 29–36 Backing Source"')[1].split('</select>')[0];
 const drop=module.exports.renderDrop(undefined).split('aria-label="Drop backing"')[1].split('</select>')[0];
 assert.match(buildup,/<option value="roses" selected="">Original Roses Buildup<\/option>/);
 assert.match(drop,/<option value="recording" selected="">Original Roses Recording<\/option>/);
});


test('all three backing choices produce source-specific 29–36 guides and preserve original Roses controls only for Roses',()=>{
 const modes=['roses','hwm-build','hwm-drop'],pages=modes.map(mode=>module.exports.renderSheet(mode));
 for(const [i,mode] of modes.entries()){
  const html=pages[i],bar29=html.split('data-measure="29"')[1].split('class="practice-beats"')[0];
  if(mode==='roses'){assert.match(bar29,/BUILD BASS/);assert.match(bar29,/VOX AUTO/);assert.match(html,/aria-label="Bar 25 audition Vox sound"/);}
  else {assert.match(bar29,/HERE WITH ME · BUILDUP/);assert.match(bar29,/SOFT PAD AUTO/);assert.match(bar29,/GUITAR AUTO/);assert.match(bar29,/not graded/);assert.doesNotMatch(bar29,/VOX AUTO|FINAL BREAK/);assert.doesNotMatch(html,/aria-label="Bar 25 audition Vox sound"/);}
 }
 const section=html=>html.split('data-measure="29"')[1].split('class="practice-beats"')[0];assert.notEqual(section(pages[1]),section(pages[2]));
 assert.doesNotMatch(pages[2],/<option value="(?:hwm-build|hwm-drop|hybrid)"/);
});

test('Hybrid exposes automatic riser controls and an accurate bar-36 breakdown without changing the old source sheets',()=>{
 const controls=module.exports.renderBacking('hybrid');
 for(const label of ['Pre-Drop Riser','Pre-Drop Riser enabled','Riser Volume','Riser Intensity'])assert.ok(controls.includes(`aria-label="${label}"`));
 assert.match(controls,/Preview riser/);assert.match(controls,/Start Bar 25 \+ Backing \+ Lead/);
 assert.match(module.exports.renderBacking('roses'),/aria-label="Riser Intensity"/);assert.match(module.exports.renderSheet('roses').split('data-measure="36"')[1].split('class="practice-beats"')[0],/PRE-DROP RISER AUTO/);for(const mode of ['hwm-build','hwm-drop'])assert.doesNotMatch(module.exports.renderBacking(mode),/aria-label="Riser Intensity"/);
 const html=module.exports.renderSheet('hybrid'),bar=html.split('data-measure="36"')[1].split('class="practice-beats"')[0];
 assert.match(bar,/BREAKDOWN \+ RISER/);assert.match(bar,/PRE-DROP RISER AUTO/);assert.match(bar,/Rising sweep/);assert.doesNotMatch(bar,/MELODY AUTO|BASS \/ LOW GUITAR AUTO|SOFT PAD AUTO|GUITAR AUTO/);
});

test('Hybrid adds three automatic drum controls and source-specific guide rows without changing other modes',()=>{
 const labels=['Here With Me Drums Volume','Roses Buildup Drums Volume','Drum Transition Balance'];
 for(const label of labels){assert.ok(module.exports.renderBacking('hybrid').includes(`aria-label="${label}"`));for(const mode of ['roses','hwm-build','hwm-drop'])assert.ok(!module.exports.renderBacking(mode).includes(`aria-label="${label}"`));}
 const page=module.exports.renderSheet('hybrid');
 const measure=bar=>page.split(`data-measure="${bar}"`)[1].split('class="practice-beats"')[0];
 assert.match(measure(29),/HWM DRUMS AUTO/);assert.doesNotMatch(measure(29),/ROSES DRUMS AUTO/);
 assert.match(measure(33),/HWM DRUMS AUTO/);assert.match(measure(33),/ROSES DRUMS AUTO/);
 assert.doesNotMatch(measure(35),/HWM DRUMS AUTO/);assert.match(measure(35),/ROSES DRUMS AUTO/);
});


test('third drop exposes saved sync, volume, mute and solo controls; recorded score has audio activity without invented notes',()=>{
 const html=module.exports.renderDrop('recording');
 assert.match(html,/ROSES — ORIGINAL RECORDING/);
 assert.match(html,/aria-label="Recorded Drop Volume" type="range" min="0" max="2"/);assert.match(html,/aria-label="Recorded Drop Sync Offset" type="text" inputMode="numeric"/);
 assert.match(html,/aria-label="Mute Recorded Drop"/);assert.match(html,/aria-label="Solo Recorded Drop"/);
 assert.match(html,/aria-label="HERE WITH ME LEAD enabled" type="checkbox"\/>/);
 assert.match(html,/aria-label="HERE WITH ME LEAD volume"/);assert.match(html,/aria-label="Solo HERE WITH ME LEAD"/);
 assert.doesNotMatch(html,/Mute drop hat/);
 const sheet=module.exports.renderSheet('hybrid','recording');
 assert.match(sheet,/Recorded audio bar 39/);assert.match(sheet,/no automatic piano notes/);assert.doesNotMatch(sheet,/LOWER AUTO|UPPER 1 AUTO/);assert.match(sheet,/>37–44<\/button>/);
});


test('manual bass sheet exposes its mode, keys and live lanes while preserving the recorded drop',()=>{
 const html=module.exports.renderSheet('roses','recording','manual');
 assert.match(html,/aria-label="Bass \/ Sub playback"/);assert.match(html,/<option value="manual" selected="">Manual keys<\/option>/);
 assert.match(html,/BASS · , . \/ LIVE/);assert.match(html,/SUB · , . \/ LIVE/);
 for(const pitch of ['C♯3','A2','E2'])assert.ok(html.includes(pitch));
 assert.doesNotMatch(html,/BASS AUTO|SUB AUTO/);assert.match(html,/Recorded audio bar 37/);
});


test('Roses stage exposes armed start, pause and stop outside the hidden settings panel',()=>{
 const html=module.exports.renderArmedStage();
 assert.match(html,/<header class="stage-header">/);assert.match(html,/aria-label="Roses performance playback"/);
 assert.match(html,/ARM \+ START/);assert.match(html,/BASS\/SUB MANUAL/);
 assert.doesNotMatch(html,/<details|\shidden(?:[ =>])/);assert.doesNotMatch(html,/>Pause<\/button>/);
 assert.match(module.exports.renderArmedStage('running'),/>Restart<\/button>/);assert.match(module.exports.renderArmedStage('running'),/>Stop<\/button>/);assert.doesNotMatch(module.exports.renderArmedStage('running'),/ARM \+ START/);
 assert.match(module.exports.renderArmedStage('paused'),/>Resume<\/button>/);
 assert.match(module.exports.renderArmedStage('idle',false),/<button class="stage-arm-start" disabled=""/);
});


test('buildup lead selector exposes Automatic / Manual beside the existing practice controls',()=>{
 const automatic=module.exports.renderLeadMode('auto'),manual=module.exports.renderLeadMode('manual');
 assert.match(automatic,/Automatic · Arm Buildup/);assert.match(manual,/Manual keys · HWM lead/);
 for(const key of ['W','R','T','Y','U','O','P'])assert.ok(manual.includes(`<kbd>${key}</kbd>`));
 assert.match(manual,/Automatic melody is off/);assert.match(module.exports.renderLeadMode('manual','running'),/disabled/);
 assert.match(module.exports.renderSheet(),/aria-label="Bars 29–35 lead playback"/);
});


test('audience header has a clean start and hides running transport and setup metrics',()=>{
 const idle=module.exports.renderArmedStage('idle',true,true);
 assert.match(idle,/START PERFORMANCE/);assert.doesNotMatch(idle,/ARM \+ START|BASS\/SUB|PEDAL|M\.01/);
 const running=module.exports.renderArmedStage('running',true,true);
 assert.match(running,/<div hidden="" class="roses-stage-transport"/);
 const setup=module.exports.renderArmedStage('running',true,false);
 assert.doesNotMatch(setup,/<div hidden="" class="roses-stage-transport"/);
 assert.match(setup,/>Pause<\/button>/);assert.match(setup,/>Stop<\/button>/);
});
