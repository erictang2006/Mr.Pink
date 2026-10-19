import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/piano/synthEngine.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { presetSettings, presetNames, presetGroups, validSynthSettings } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('all six Roses sound presets have bounded settings and library groups', () => {
  assert.equal(Object.keys(presetSettings).length, 6);
  assert.deepEqual(new Set(presetGroups.flatMap(group => group.ids)), new Set(Object.keys(presetSettings)));
  for (const [id, preset] of Object.entries(presetSettings)) {
    assert.ok(presetNames[id]);
    assert.deepEqual(validSynthSettings(preset), preset);
    assert.ok(preset.volume <= 1 && preset.reverb <= .5 && preset.delay <= .4);
    assert.ok(preset.cutoff >= 300 && preset.cutoff <= 16000);
  }
  assert.ok(presetSettings.roses.attack >= .01 && presetSettings.roses.attack <= .025);
  assert.ok(presetSettings.roses.release >= .15 && presetSettings.roses.release <= .35);
});

test('stored legacy presets migrate and unsafe values are clamped', () => {
  assert.equal(validSynthSettings({ preset: 'bright' }).preset, 'roses');
  assert.equal(validSynthSettings({ preset: 'warm' }).preset, 'analog-pad');
  assert.equal(validSynthSettings({ preset: 'pluck' }).preset, 'bright-pluck');
  const settings = validSynthSettings({ preset: 'glass', volume: 99, cutoff: -1, delay: 99 });
  assert.equal(settings.volume, 1);
  assert.equal(settings.cutoff, 300);
  assert.equal(settings.delay, .4);
});
