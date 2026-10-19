# Roses Bars 29–36 — Codex reference pack (verified from user-provided Ableton remake)

Goal: Extend the existing local Mr Pink Roses arrangement through the PRE-DROP buildup (bars 29–36). Bar 37 is the start of the main drop and is an OUT-OF-SCOPE transition marker, not a new playable arrangement request.

## Source of truth

`source_project/remake 1.als` is the original session. The exact events and track names/positions are summarized in `metadata/ableton_bars29_36_events.json`. Note Ableton clips use 0-based QUARTER-NOTE beats; bar 29 starts at beat 112. All timings in this pack refer to the ORIGINAL Ableton remake arrangement, not to an altered stage timeline.

Tempo 100 BPM, 4/4: 1 beat = 0.6s, 1 bar = 2.4s.

Bar 29 67.2s / Ableton beat112; Bar 30 69.6; 31 72.0; 32 74.4; Bar 33 76.8 / beat128; Bar 34 79.2; Bar 35 81.6; Bar 36 84.0 / beat140; Bar 37 86.4 / beat144 (drop).

## Main track map

- **Build Bass** (MIDI track 23): Bars 29 C#3 (MIDI49, 4 beats), 30 A2 (45, 4 beats), 31–32 E2 (40, 8 beats); again bars 33 C#3, 34 A2, 35 E2 (only 4 beats; clip is truncated at bar 36). No Build Bass note at bar 36. Original is a Sylenth1 preset `Build Bass.fxp`; web app cannot directly load the preset. Current Mr Pink bass engine or browser synth can play the source notes. MIDI file included for cross-reference, exact Ableton notes also in JSON.
- **Vox Synth** (audio track 70): `Vox synth.wav` starts at bar 29 (beat112), clip length 16 beats/9.6s; re-triggers at bar 33 (beat128) for 12 beats/7.2s, stops bar 36. Source WAV itself is longer (~10.99s): don't play the entire file across section boundaries. Track includes a compressor. Distinct from the DISABLED `Vocal synth` MIDI track 28.
- **Buildup snare** (audio track 35): `spacy drum.wav` every QUARTER NOTE beats 1/2/3/4 in bars 29–32 (Ableton beats112..127); every EIGHTH NOTE (two per beat) in bars 33–35 (beats128..139.5). Stops at bar 36. No pitch shift/warp. Its source file is ~0.8765s, but individual clips are shortened for faster hits.
- **Buildup Kick** (audio track 33): `Roses Kick.wav` has the SAME onset grid as spacy drum above; every quarter note bars29–32, every eighth bars33–35, stops bar36. **In Mr Pink the user has repeatedly required normal live Z kick and X clap, with no auto kick/clap.** Do not silently enable the Ableton automated buildup kick. Preserve manual Z/X, show source rhythm in Practice Mode and/or optionally offer an explicitly user-controlled audition mode to compare source, with no doubling. In the live mode, no scheduled kick/clap automatically.
- **Extra snare roll** (MIDI track 80): 3-Snare Drum 005 808 Double Beam (source sample included) starts at bar33. Snare hits every EIGHTH at bars33–34 and every SIXTEENTH at bar35; ends bar36. Inspect the Ableton Sampler/MidiPitcher for exact processing; matching source MIDI note-on grid is in JSON. Do not synthesize a wrong pitched melody from the drum MIDI note number.
- **Vocal chops** (audio track 69 `25-Audio`): `aah vocal chop loop 2.wav` at beats112..120 (29–30), 120..128 (31–32), 128..136 (33–34), 136..140 (35), and 140..143 (36 beats1–3). Stop at bar36 beat4 (beat143). Do not duplicate an existing layer already running.
- **Pre-drop snap** (audio track 81): `snap for drop.wav` starts at Ableton beat143 = bar36 beat4 = 85.8s, tail to 86.2747s just before bar37. This is the only new percussion hit in bar36 in source.
- **Guitar L** (track8) has a source clip ending at beat112.031 (~18.7ms tail into bar29), practically ends at bar29; guitar not present throughout bars29–36. Guitar R ends by bar29 too.
- **Vocal synth MIDI** (track28) and **Electric Nylon Guitar MIDI** (track29) are disabled. Do not enable them.
- Main Drop Chords/Drop Bass enter at beat144 (bar37). Do not start the drop early.

## User aesthetic goal

User finds the existing vox ping a bit heavy/dull and wants a **lighter, pingier** version. `original_samples/Vox synth.wav` remains the reference and should be auditionable. Offer a *non-destructive* brighter version: high-pass/low-mid attenuation, gentle transient emphasis / upper-mid presence, optional clean short reverb, and A/B. Do not pitch the full phrase unpredictably or overwrite source asset. Preserve timing and melody. `original_samples/spacy drum.wav` should be used directly.

## Timings and expected boundaries

- Bars29–32: bass, vox, vocal chops; quarter-note spacy buildup percussion; original kick reference exists but normal live kick remains physical.
- Bars33–35: vox re-triggers at 33, bass progression restarts but truncated, vocal chops, escalating eighth-note spacy hits; additional snare roll (8ths in 33–34, 16ths in 35).
- Bar36: programmed main build (Vox, Bass, kick, spacy, snare roll) ceases; chopped aah vocal continues through beats1–3; one final `snap for drop.wav` at beat4; then drop at bar37.

## Included references

- `reference_audio/bars29_to36_original_mix.wav`: bars29–36 (67.2–86.4s); full remake mix, NOT isolated stems.
- `reference_audio/bar28_through37_context.wav`: 64.8–88.8s, one lead-in bar before buildup and one after drop.
- `reference_audio/bars35_37_drop_boundary.wav`: 81.6–88.8s, final buildup/break/drop boundary.
- Original samples, MIDI, Sylenth Build Bass preset, original `.als` project, detailed event JSON.

For Codex: inspect existing code first and preserve all prior modes, bass handling, vocal cues, sample paths, chord keys, live drum behavior, and manual transport arming. Validate the exact bar/beat grid against event JSON. Use prepared loops only when MANUALLY ARMED, but schedule their content at deterministic transport coordinates, not at the instant of keypress. If a segment is armed too late, don't retroactively start it. Provide practice grid for manual cues; no auto grading of backing.
