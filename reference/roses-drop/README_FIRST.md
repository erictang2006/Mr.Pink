# Roses Drop Synth — Codex Reference Pack

This reference pack was extracted directly from the uploaded **Roses Ableton Remake(2).zip**.

## Project clock and bar locations
- Project: 100 BPM, 4/4 (four beats per bar).
- Original remake first drop: bar 37 onward (86.4 seconds, if bar 1 begins at t=0).
- First 8-bar audition: bars 37–44, 86.4–105.6s.
- Second 8-bar audition: bars 45–52, 105.6–124.8s.
- WAV previews are **FULL MIX excerpts**, not isolated synth stems.
- Ableton .als timing is measured in project beats (e.g., beat 144 = start of bar 37).

## Drop track structure verified in original Ableton .als
- MIDI track 39, **Drop Chords**: Sylenth1 -> CamelCrusher -> Kickstart -> FabFilter Pro-Q 2. Active 8-bar clip starting project beat 144.
- MIDI track 53, **Drop Chords**: Sylenth1 -> CamelCrusher -> Kickstart -> FabFilter Pro-Q 2. Another active chord layer starting project beat 144; **not identical MIDI** to track 39.
- MIDI track 57, **2nd Drop Chords**: Sylenth1 -> CamelCrusher -> Kickstart -> FabFilter Pro-Q 2. Later chord layer (first clip starts beat 212).
- MIDI track 76, **Drop Key**: Massive -> Kickstart. First clip at project beat 176 (bar 45).
- MIDI track 45, **drop bass**: Massive -> FabFilter Pro-Q 2. First clip at beat 144.
- MIDI track 54, **2nd drop bass low**: Massive -> FabFilter Pro-Q 2. First clip at beat 176.

## What files mean
- `reference_audio/drop_bars37-44_FULL_MIX.wav`: primary first-drop sonic context.
- `reference_audio/drop_bars45-52_FULL_MIX.wav`: later additional synth-key/bass-layer sonic context.
- `ableton/remake 1.als`: original full project, with clip timing, plugin references, plugin-state data. Ableton is not required to inspect XML (it is gzip-compressed XML).
- `source_midi/drop chords.mid`: original standalone chord MIDI from archive.
- `source_midi/brop bass.mid`: **spelling is original**; original standalone MIDI from archive. Do not silently rename source identity when comparing.
- `exported_als_midi/*.mid`: first active clip per named original MIDI track extracted to standard .mid by reading actual MIDI notes in .als. Each clip begins at t=0 of its own exported file; see track MIDI start beats above. These are SOURCE REFERENCE PATTERNS, not the user's desired live chord triggering sequence.
- `presets/Drop Key.nmsv` and `presets/Drop Bass.nmsv`: Native Instruments Massive plugin presets. Web Audio / Tone.js CANNOT load these proprietary presets directly. Use as analysis references only if a decoder is available.

## IMPORTANT LIMITATION
This original ZIP does **not** contain a standalone exported Sylenth1 **Drop Chords** `.fxp` preset or dry isolated synth stem. The Ableton `.als` references Sylenth1 plugin devices and may contain plugin state, but it is not a native browser synth preset. A perfect sound-identical recreation is **not established** from this pack alone. Prioritize a musically convincing Tone.js / Web Audio approximation, or request separately rendered clean chord-only stems if absolute fidelity is required.

## Target application requirements from user
- Preserve all existing keyboard keybindings and pitches/voicings for the currently configured C# minor -> B major -> A major progression and separate Closer chords.
- Recreate the *TONE / TIMBRE / PROCESSING* of the Roses drop synth stack, not the original MIDI playback pattern.
- User plays full chord stabs LIVE on keydown with no quantization or auto chord loop.
- Need darker / deeper, thick, punchy, bass-supported EDM chord stabs, not a high, bright bouncy pluck.
- Do not modify existing Roses intro pad/synth sound or imported kick/clap samples.
- No deployment; local-only work.
