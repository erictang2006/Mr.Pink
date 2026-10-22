# Selected backing guides and lower-load Bonk

The Bars 29–36 Backing Source selector retains the original three labels and defaults to **Here With Me — Drop Backing**. A separate fourth option, **Hybrid — Here With Me + Roses Drum Build**, is now available for testing. It remains available in Sandbox and Practice, and inside the closed **Performance controls** panel in fullscreen. The existing Start Bar 25 + Backing + Lead button is retained.

## Source-aware visuals

`src/piano/backingVisuals.ts` reads the actual selected E-major `backing-events-e-major.json` selection (`build` or `drop`), at the existing 96 PPQ and 100 BPM. It groups simultaneous pitches by musical layer and exact gate without changing their pitches, onsets, lengths or channels. Chord names are recognized from the source chord pitch classes. Audio clips expose sample activity using the actual clip and prepared sample lengths, with no invented pitches. Original Roses uses its existing buildup/bass manifests and Vox melody data. Selection comes from the same engine snapshot that drives the backing selector.

- Practice: precise per-bar harmony, pad, guitar, bass, lead and percussion lanes; source-aware upcoming events, current chord and transition. Original Roses restores its original lanes and instrument controls. Automatic parts are labeled guide-only and are excluded from existing manual grading. The sheet scrolls vertically when needed without shrinking the piano.
- Sandbox: current selected backing guide, automatic activity and source-aware piano markers.
- Performance: shared concert header with actual section/chord, cyan/blue/purple transition starting at 29, stronger drop energy at 37, and large piano. Detailed controls are collapsed. The arrangement role remains “Buildup · Measures 29–36” regardless of source name.
- PianoCanvas and PerformanceVisualizer: physical keycaps/labels and rising hold bars remain separate from thin cyan automatic markers/trails. Physical keyup ends physical growth independently of pedal/audio sustain. Automatic activity respects HWM group gain/solo and drop row muting. No extra synth, transport, grading target or keyboard mapping is created by the visual model.

Bars 1–28 remain Roses visually. The bar-36 break appears only for Original Roses; HWM uses its actual transition. The full HWM drop's pitched visual source agrees with the existing four lead banks and harmonic stems; its percussion remains the separately arranged Roses drop percussion. No buildup-source drum pattern is substituted there.

## Lower-load live Bonk

Repeated live Bonk chords previously retained a dense fat-oscillator graph even after bounding polyphony. `SampledBonkVoice` now plays precomputed raw oscillator recordings through the existing live filters, envelopes and downstream Bonk effects. There are three recordings per exact existing MIDI pitch (left/right/center), with original bank spread/detune baked in; no runtime pitch shift or chord recording is used as a melody voice. Brightness, body, decay, release, space and output controls remain live.

A repeated pitch reuses its looping source and retriggers its envelopes. Shared held/pedal pitches retain ownership. Idle voice outputs disconnect after their release tails, and reconnect on the next press. The amplitude envelope owns the attack; no redundant source fade can be cancelled by rapid release/retrigger. This applies to keys 1–8 when using Bonk and to manual = - 0 9 when using the Keys 6–8 sound. Automatic prepared chord playback is preserved.

The generation-only script is `scripts/prepare-live-bonk-waves.mjs`; 75 float WAVs and a source/hash manifest are stored in `public/roses/live-bonk-waves/`. No new runtime dependency is required. Float samples preserve the original oscillator peaks before the normal live gain/envelope processing.

## Local verification

- Build and TypeScript checks pass; 170 tests pass, including source/MIDI/gate fidelity, independent source guides, boundaries, physical key labels, keyup under sustain, sample coverage/provenance and Bonk source lifecycle.
- Actual Tone.js/native offline 64-strike tests cover both 8–7–6 and = - 0 9. The Bonk path uses zero live oscillators (previous 8–7–6 run: 100), with no polyphony warnings or held notes after release.
- Extended 8–7–6 test: 200 chord strikes at 50 ms spacing, 800 note attacks/releases, maximum 1.2-second release, zero live oscillators, no polyphony warnings, finite unclipped output.
- An additional 200-strike body-only render (recorded impact muted) verifies the chord body stays audible on late retriggers: final four strikes measure −27.44 dBFS RMS.
- All three actual Start Bar 25 entry points were rendered through the existing transport: preserved vocal rate/alignment, four selected backing stems for HWM, original playback for Roses, 224 correct E-major lead notes, exactly four first-onset lead attacks at bar 37, one drop bass/chord stem each, and unchanged drop drum counts. Reports are in `docs/roses-reference/backing-ui/` and `docs/roses-reference/rapid-bonk/oscillator-cache/`.

These audio tests are offline scheduling/render checks, not a measured browser CPU benchmark or device listening test. No in-app browser was connected, so fullscreen appearance and hardware playback remain unverified. No deployment, publishing or push was performed. Existing vocals, MIDI, backing assets, +1 transposition and key assignments were preserved during this UI work.


## Hybrid transition

Select **Hybrid — Here With Me + Roses Drum Build** under Bars 29–36 Backing Source, then use the existing Start Bar 25 + Backing + Lead or Start Bar 29 button. With Hybrid selected, existing Rehearse 33 and Rehearse 36 controls also join the vocal at its current source offset and queue the existing drop. Start bar 1 follows the same arrangement. Other backing sources and drop mixer settings are retained.

The source is the exact existing E-major HWM Drop Backing chord and bass audio. Hybrid uses only amplitude processing: unchanged through bar 34, tapering to 45% through bar 35, then a 40 ms fade ending exactly at bar 36. No additional pitch shift is applied. The separate vocal is never gated by this envelope. Original HWM drum/FX submixes are excluded to avoid stacking competing hits. Original Roses Vox, bass and vocal chops are excluded too.

Prepared percussion reuses all 40 original Spacy Drum entrances, 32 original snare-roll entrances (including source pitch automation), and the snap at bar 36 beat 4. Spacy and roll stop before bar 36. The snap finishes before the drop gap. The airy riser spans bar 36 beat 1 through beat 4.8, leaving 120 ms of space before bar 37. Both riser variants use deterministic stereo noise, rising low-pass frequency, increasing amplitude and stereo width; intensity blends their spectral/width trajectories at matched RMS. The soft and strong endpoints are both −25 dBFS over their own duration, with no tonal alarm layer.

**Pre-Drop Riser** controls appear with Hybrid: enable, Volume (0–100%, default 35%), Intensity (0–100%, default 65%), and Preview riser. Settings survive stop, seek, replay and backing switches while the app is open. Preview is disabled during a running/paused take to avoid overlapping the automatic effect; reset stops it. FX/RISER group gain and solo still apply. No live riser synth, filter automation, worklet or new transport runs during playback; three cached backing tracks and two brief riser buffer voices use the existing clock.

Practice score lanes use the same actual HWM MIDI and original Roses percussion events, clipped at the instrumental break. Bar 36 shows Breakdown + Riser without pitched automatic hits, with a separate FX progress indicator. The Performance activity rail and rising wisp follow the actual riser window and its enable/gain settings. Physical keycaps, labels, keyboard mapping and note release remain independent.

Preparation: `scripts/prepare-hybrid-backing.mjs` writes five WAVs and a source/hash manifest to `public/roses/hybrid/`. The original three source recordings, vocal and drop assets are preserved. `reference/hybrid-backing/request.txt` stores the requested arrangement. Reports/previews are under `docs/roses-reference/hybrid-buildup/`.

Validation: actual Tone/native renders passed from bars 1, 25, 29, 33, 36 and 37, including vocal offsets/rate, exact bar-37 handoff, all 224 unchanged lead events, one drop bass and chord stem, and the existing 24 kick / 16 clap / 38 hi-hat hits. Maximum backing/riser settings remained unclipped (−7.42 dBFS full-render peak). Riser control renders verify disable is silent, volume ratio is correct, strong has greater relative high-frequency energy, zero added oscillators, and silence after its endpoint. All three existing backing modes have identical peak/RMS measurements to their earlier renders. Build/type checks and 194 tests pass. Browser/device listening remains unavailable; these checks establish scheduling and audio output, not a hardware listening judgment.
