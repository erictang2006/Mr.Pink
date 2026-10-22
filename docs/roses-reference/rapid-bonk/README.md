# Rapid manual Bonk repeat investigation

The live `Same as Keys 6–8` Bonk path allocated three new synth voices per chord tone whenever previous voices were still releasing. A default 850 ms release, up to five tones per chord and three banks could exceed each bank's 24-voice ceiling under rapid repeats. Tone.js then emitted `Max polyphony exceeded. Note dropped.` The bank's fat oscillators also added substantial per-strike allocation, and its JCReverb used audio-worklet comb filters.

The live-key path now prepares one MonoSynth per mapped pitch in each bank, using the original bank settings. Repeated pitches retrigger those existing voices instead of stacking another release tail. Shared pitches and sustain use ownership counts; equal-timestamp shared tones attack once. The live reverb uses native delay feedback with the existing .22 room setting and the same wet-path level. Brightness, decay, release, Bonk, body and space controls still apply. Source MIDI, keybindings and automatic drop scheduling are unchanged. Cached Bonk drop tracks were regenerated to refresh source provenance; generation continues to use the original polyphonic rendering path.

Actual-engine stress case: 64 rotating `= - 0 9` chord hits, 100 ms apart, with 35 ms physical gates: 288 requested note attacks and releases in 6.4 seconds, followed by tail padding.

| Native offline measurement | Before | After |
| --- | ---: | ---: |
| Voice-limit warnings across three banks | 348 | 0 |
| Oscillator nodes created | 1,720 | 140 |
| Filter nodes created during strikes | 156 | 0 |
| Total filter nodes including preparation | 207 | 201 |
| Full-scale clipping | None | None |

`before/` contains the captured pre-fix render and report. `after/` contains the fixed render and report. These are controlled native OfflineAudioContext measurements, not browser/device latency or underrun measurements. They establish the voice-drop cause and bounded voice allocation; a hardware listening check remains separate.

Reproduce the current check with:

```sh
NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/check-rapid-bonk.mjs
```

The script asserts that no voice-limit warnings occur. Unit regressions also cover 200 rapid repeats, shared chord tones, equal-time attacks, pedal-held retriggers, settings propagation and cleanup. Build/type checks and 155 tests pass.
