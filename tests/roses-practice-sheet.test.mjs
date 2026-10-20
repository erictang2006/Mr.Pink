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
    import { rosesMap } from './src/piano/roses';
    import { defaultCloserSettings } from './src/piano/rosesCloser';
    import { defaultBuildupSettings } from './src/piano/rosesBuildup';
    import { defaultRosesCalibration } from './src/piano/rosesCalibration';
    import { LiveNotes } from './src/piano/liveNotes';
    export function renderBacking(mode, reuseStart=false) {
      const noop=()=>{};
      return renderToStaticMarkup(React.createElement(RosesBackingControls, {
        engine:{isReady:()=>true}, clock:{buildup:{mode,status:'ARMED',gain:1,levels:{chords:1,bass:1,drums:1,fx:1},solo:null}},
        audioReady:true,startAudio:noop,vocalLevel:.75,onVocalLevel:noop,...(reuseStart?{onStart25:noop}:{})
      }));
    }
    export function renderSheet() {
      const noop = () => {};
      return renderToStaticMarkup(React.createElement(RosesPractice, {
        buildupSettings: defaultBuildupSettings, onBuildupSettings: noop,
        map: rosesMap, transpose: 0, range: { low: 48, high: 84 },
        snapshot: { pressed: [], detected: [], shift: false, notesPerSecond: 0 },
        liveNotes: new LiveNotes(), audioReady: false, startAudio: noop,
        engine: null, clock: null, drumStatus: 'loading', onNoteRef: { current: null }, onDrumRef: { current: null },
        onExit: noop, onSandbox: noop, onPerformance: noop, onSongChange: noop,
        instrumentId: 'roses', onInstrument: noop, instrumentError: '',
        synthLevel: .55, onSynthLevel: noop, synthLeadMs: 20, onSynthLeadMs: noop,
        bassLevels: { bass: .45, sub: .35 }, onBassLevels: noop,
        vocalOffset: 9.6, onVocalOffset: noop, vocalKey: 'KeyL', onVocalKey: noop,
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
  assert.match(html,/Bars 29–36 Backing Source/);for(const option of ['Original Roses Buildup','Here With Me — Buildup','Here With Me — Drop Backing'])assert.ok(html.includes(option));
  assert.match(html, /Start bar 25 \+ backing \+ lead/);
  assert.match(html, /V · Synth 5–20/);
  assert.match(html, /N · Bass\/Sub 13–20/);
  assert.match(html, /F6 · Build 21–28/);
  for(const label of ['Bars 29–36 instrument','Bar 25 audition Vox sound']) {
    const selector=html.split(`aria-label="${label}"`)[1].split('</select>')[0];
    assert.deepEqual([...selector.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match=>match[1]),['Original Vox Synth','Light Ping Vox','Loud Stabs','Here With Me lead synths']);
  }
  assert.match(html,/DROP LAYER MIXER · BARS 37–44/);
  for(const layer of ['HERE WITH ME LEAD','ROSES DROP BASS','ORIGINAL ROSES DROP CHORDS','KEYS 6–8 · BONK + FUTURE BASS','ROSES DROP DRUMS']){
    assert.ok(html.includes(`aria-label="Mute ${layer}"`));assert.ok(html.includes(`aria-label="Solo ${layer}"`));
    assert.ok(html.includes(`aria-label="${layer} enabled"`));assert.ok(html.includes(`aria-label="${layer} volume"`));
  }
  assert.match(html,/Play Drop/);assert.match(html,/aria-label="Drop chord preset"/);assert.match(html,/Brighter \/ Punchier/);assert.match(html,/Mute drop hat/);
});


test('backing comparison renders all three choices and four independent alternate submixes without a duplicate Practice start button',()=>{
 for(const mode of ['roses','hwm-build','hwm-drop']){
  const html=module.exports.renderBacking(mode);
  const selector=html.split('aria-label="Bars 29–36 Backing Source"')[1].split('</select>')[0];
  assert.deepEqual([...selector.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m=>m[1]),['Original Roses Buildup','Here With Me — Buildup','Here With Me — Drop Backing']);
  assert.match(html,/Start Bar 25 \+ Backing \+ Lead/);assert.match(html,/Start Bar 29/);
  assert.match(html,/Backing comparison vocal volume/);assert.match(html,/Bars 29–36 backing volume/);
  for(const group of ['chords','bass','drums','fx'])assert.equal(html.includes(`Solo Here With Me backing ${group}`),mode!=='roses');
 }
 assert.doesNotMatch(module.exports.renderBacking('hwm-drop',true),/Start Bar 25 \+ Backing \+ Lead/);
});
