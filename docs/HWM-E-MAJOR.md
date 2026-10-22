# Finalized Here With Me arrangement — E major / C♯ minor

Roses bars 1–28 retain their existing notes, samples and manual arming. Here With Me buildup occupies bars 29–36; its drop occupies bars 37–44. Full takes use the existing Tone transport at 100 BPM. Region boundaries remain 67.2, 86.4 and 105.6 seconds from bar 1.

The default backing is Here With Me — Buildup. Existing backing arrangement choices remain, but there is no alternate key selector: every Here With Me choice is in E major. Ordinary full takes automatically arm the HWM buildup and prepare the drop. Earlier Roses instrument arming stays manual.

The mixer also offers **Drop backing → Roses · Original drop**, restoring the original Roses bass, both chord sound rows, Brighter / Punchier preset and A/B balance for testing. The HWM key change remains permanent; both arrangements use E-major/C♯-minor pitch material. The source-exclusion descriptions below apply when Here With Me backing is selected.

## MIDI and backing

Original extracted FLP/MIDI/JSON references remain untouched. Run `node scripts/prepare-hwm-e-major.mjs` to generate arrangement-specific JSON. It raises every pitched backing note and all four lead banks exactly one semitone. MIDI hi-hat channel 29, sample roots, audio entrances and automation are unchanged. The render engine imports the generated backing JSON and applies no further transpose. Piezo sample playback uses the new target MIDI minus the original sample root.

The source progression Cm → B♭ → A♭add9 → E♭ becomes **C♯m → B → Aadd9 → E**. Source bass channels 13/23 and low-guitar channels 24/26 move with it. Channels 19–22 retain their octave relationships and ±6-cent widening. The first four lead notes are E4/E5/E5/E5.

Use the existing local render pipeline, with the optional native audio dependency outside the project:

```sh
HWM_REGION=build NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/render-hwm-backing.mjs
HWM_REGION=drop NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/render-hwm-backing.mjs
HWM_REGION=drop HWM_INSTRUMENTAL=1 NODE_AUDIO_MODULE=/private/tmp/mr-pink-offline-audio/node_modules/node-web-audio-api/index.js node scripts/render-hwm-backing.mjs
```

The last render omits the four lead banks from `drop-instrumental-chords.wav`. At bar 37 the mixer starts that harmony stem plus `drop-bass.wav`, both at playback rate 1. One live four-bank lead schedules the transposed melody. No Roses chord-cache tracks, Roses drop bass MIDI, Bonk harmony, or polyphonic Fm7 lead recording are played. Drum samples, hit timing and per-hit gains are unchanged. Existing prepared HWM drums/FX are retained byte for byte, including intentional +200-cent snare/crash preparation.

## Supplied vocal — already in E

The newly supplied Downloads WAV is already approximately one semitone above the previous E-flat vocal. Independent waveform estimates measured **+0.998 semitones** versus the old excerpt; dominant notes are E, G♯ and B. Another +1 shift would produce F major and was therefore excluded from the final playback asset.

The supplied source is preserved at `reference/here-with-me-vocal/here-with-me-vocals-source.wav`. Its pitch is retained, using high-quality polyphase sample-rate conversion from 48 kHz to 44.1 kHz. Playback uses `public/roses/here_with_me_chorus_e_major.wav` at rate 1, with no live pitch processing. The old E-flat playback WAV is preserved too. The provenance report records **+1 relative to the old E-flat vocal; 0 additional semitones relative to the supplied file**.

The new source has a different lead-in. Envelope matching places the equivalent excerpt at 34.647 seconds rather than 33.980. Only extraction offset changes: the transport cue, 120 ms pickup, seek offset, 42.020-second playback length and 1,853,082-frame count remain unchanged. Matching is measured at 1 ms resolution; exact phonetic alignment is approximate because the two supplied masters are different.

Regenerate the aligned playback excerpt with the existing external Python audio environment:

```sh
/private/tmp/mr-pink-audio-venv/bin/python -B scripts/prepare-hwm-vocal-e-major.py reference/here-with-me-vocal/here-with-me-vocals-source.wav
```

## Manual keys and verification

Physical keys 1–8 are unchanged: 1 D♭add9, 2 E♭, 3 Fm7, 4/5 lower versions of 1/2, 6 A, 7 B and 8 C♯m. These independent chord-testing instruments are not scheduled by the finalized drop. Explicit HWM manual keys `= - 0 9` now play C♯m, B, Aadd9 and E, retaining their existing instrument choices.

Tests compare every derived MIDI event against the original, check actual rendered event pitches and asset hashes, verify manual key handling, source separation, pause/resume, stop, seeks and replay. Real Tone.js/native OfflineAudioContext renders exercise starts from bars 1, 25 and 29 and solo/full/maximum drop mixes. They verify 224 live lead events, exactly four lead attacks at bar 37, two HWM backing tracks, no Roses harmonic events, unchanged 24 kick/16 clap/38 hi-hat events, rate-1 audio and bounded finite output. Reports and WAVs are in `docs/roses-reference/hwm-e-major/`.

These are local offline playback checks, not browser/device listening or hardware-latency measurements. No deployment, publishing or push is performed.

Full-take restart fix: Start bar 1 now resets the previous buildup authorization and arms the currently selected source for **all three** backing choices, including Original Roses Buildup. Repeated starts from PLAYING, paused, finished and reset states no longer carry a stale arm. Switching sources before bar 29 retains the latest selected source. Actual native audio renders from bar 1 verify every source without manually arming the buildup in the QA harness; reports are in `docs/roses-reference/start1-backing-fix/`. Earlier instrument arming and the selected bar-37 drop are preserved.
