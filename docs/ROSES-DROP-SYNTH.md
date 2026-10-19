# Roses chord keys 1–8: original drop instrument

The default is now **Bonk + Future Bass**. See [sampled chord setup and analysis](ROSES-SAMPLED-CHORDS.md). This document describes the retained **Original Drop Synth** option.

The actual live path is `KeyboardInputManager.chordOn` → `RosesChordStabEngine.noteOn` → `RosesDropLayers.triggerAttack`. This path is shared by Roses Practice, Sandbox, and fullscreen Performance Mode. It reads the current voicings from `src/piano/rosesChords.ts`; no reference MIDI is sequenced or substituted. Every pitch in a chord receives the same immediate audio timestamp.

The old stab instrument and its A/B routing have been removed from the chord engine. Legacy saved settings cannot select it. Previous drop preferences used `stage-piano-roses-drop-v3` (now migrated to v4); the original opening synth and automatic backing retain their separate engines.

## Instrument

- Two polyphonic, stereo chord-body banks use detuned saw ensembles, slightly different spreads/filter envelopes, a 3 ms attack, 600 ms default decay, and moderate midrange sustain. They are panned ±0.45, with conservative per-voice levels and a 24-voice limit per bank.
- A centered square-harmonic body layer reinforces the low mids at each original chord pitch, independently of stereo width. A quieter band-limited square layer supplies harmonic attack definition. It follows the exact same pitches, keydown, keyup, and pedal ownership as the body layers.
- The chord body passes through a 90 Hz high-pass, denser oversampled saturation, a final adjustable low-pass (2.8 kHz by default), low-mid EQ, and 2.5% short ambience.
- The bus retains compression, master/output controls, and a −1.5 dB limiter. Optional ducking responds only to physical Z kick hits; it does not schedule drum sounds or quantize input.
- A separate centered triangle root bass is included at a controlled level in the heavy preset. **Add mono root bass** in Sandbox → **Keys 1–8 · Roses drop synth** can be switched off when the backing bass/sub already supplies enough weight. Its register and last-held-chord behavior derive from the current chord map. It bypasses chord drive/reverb. Existing backing bass/sub loops are unchanged.

## Reference findings and limits

All 14 files in `reference/roses-drop` match the supplied ZIP byte for byte. The Ableton project confirms Sylenth1 Drop Chords tracks 39 and 53, each with CamelCrusher, EQ, ambience/stereo processing, compression, and Kickstart. Their embedded Sylenth buffers are identical (patch name **ROSES chords**), while MIDI content and track levels differ. The reference MIDI is lower-register material, but live chord pitches are preserved exactly as configured in Mr Pink.

The full-mix spectrogram shows sustained harmonic density through the low mids and midrange alongside the drums/bass. This motivated a fuller body, more restrained transient layer, and saturated midrange rather than a short generic pluck. The browser graph approximates those roles; it does not load proprietary Sylenth1, CamelCrusher, Massive, Kickstart, or FabFilter plugins. No isolated Sylenth chord stem or independently decoded preset is available, so identical timbre or an isolated by-ear match cannot be established from this pack.

## Release and repeated strikes

The former short amplitude/filter releases made short taps end abruptly. The chord body now has an 850 ms release with a curved taper; the filter closes slightly more slowly so it cannot choke that tail. Root bass releases sooner to keep low frequencies tight. Ambience remains 2.5%: the tail comes from the voices themselves.

Each strike starts fresh polyphonic voices without releasing existing strikes. Each keyup releases one voice per pitch; sustain defers counted releases until pedal-up, including repeated/shared pitches. Physical piano highlights and note-bar endpoints still follow physical keyup independently of audible tails.

Sandbox → **Keys 1–8 · Roses drop synth** exposes **Decay** (200–750 ms) and **Release** (350–1200 ms). Settings persist locally; older saved settings receive the new 850 ms release default without resetting the mix.

## Verification

- In local Chrome fullscreen Roses Performance Mode, physical keys 1–8 were tested individually against the actual current mapping. Every key triggered all four expected pitches together through `RosesDropLayers`, released all four, and illuminated all corresponding piano keys. The opening `SynthEngine` received zero chord attacks. No previous stab node exists in the instrument.
- Browser key-repeat generated no extra attacks. Four rapid presses generated exactly four complete chords with no held sources left behind. No browser exceptions occurred.
- The heavier revision adds a fixed center body, keeps its filter open through more of the envelope, raises sustain, and enables moderate root bass. Real Tone/Web Audio offline renders covered all voicings, rapid repeats, and stacked chords. At 72% master the heavy default peaked at −5.39 dBFS; maximum controls peaked at −0.81 dBFS without clipped or non-finite samples. All layer controls at zero produced silence. All audio tails released; the offline harness explicitly uses the offline clock for live methods. These are bounded test renders, not a guarantee about arbitrary combined arrangements or hardware volume.
- A fresh Chrome Performance Mode audit of all eight keys confirmed unchanged pitches, active piano highlights, no opening-synth attacks, and no unreleased voices across any of the four chord banks after keyup.
- Build/type checks and chord lifecycle tests cover unchanged mappings, shared pitches, sustain, optional bass, and focus/reset releases.
- Release verification used actual Tone/Web Audio renders with sustain off: 80 ms taps and 300 ms holds both retained decaying tails even with reverb/bass disabled. Four bars of hits on beats 1, 3&, and 4& at 100 BPM produced 12 distinct attacks with overlapping release voices, at most 12 voices per bank, a peak of approximately −8 dBFS at 72% master, and no remaining held/deferred/active voices after decay. Chrome Performance Mode checks separately verified immediate physical highlight/bar release while audio continued.

All work remains local. The sample files, opening synth, loops, vocals, Interstellar, Levels, and Performance Mode visuals were not edited by this replacement.
