# Original Roses Drop Bass — Bars 37–44 (verified against remake 1.als)

SOURCE: Roses Ableton Remake(2).zip, native Ableton arrangement at 100 BPM, 4/4.
BARS: Roses bar 37 = 86.4 seconds in the remake. Bar 45 = 105.6 seconds.

ACTUAL ACTIVE BASS TRACK: Ableton MIDI track ID 45, `drop bass`, plugin Native Instruments Massive with FabFilter Pro-Q 2 processing. The Massive preset `source_Drop_Bass.nmsv` is supplied, but the browser / this environment cannot load the proprietary plugin directly.

NOT ACTIVE UNTIL BAR 45: track ID 54 `2nd drop bass low`, also Massive. Do not mix this into bars 37–44. The two Sylenth1 Drop Chords tracks 39 and 53 are distinct CHORD tracks, and the Drop Kick is a DRUM, not another dedicated bass synth.

SOURCE NOTE PITCHES: MIDI 37=C#2, MIDI 44=G#2, MIDI 40=E2. Most notes last .34375 beats (206.25ms); some last .375 beats (225ms).
SOURCE PATTERN: syncopated note attacks, not simple sustained bass roots. The second 4-bar MIDI clip runs from beats 161–176 with StartRelative=1 and therefore the first 1 beat of its underlying phrase is skipped; preserve the start-relative offset. Do NOT repeat bars 37–40 blindly at bar 41.

FILES:
01 ORIGINAL full mix — exact unmodified original mastered song segment for bars 37–44.
02 ORIGINAL low-end-filtered mix — extracted from the exact mastered mix, 35–230 Hz frequency band, peak-normalized; includes kick, sub and any other instruments in the band. NOT an isolated Massive stem.
03 ORIGINAL kick one-shot — actual Roses Kick.wav; included to help distinguish kick thump from bass synth.
04/05 APPROX synth layers — generated from the actual bass MIDI notes, NOT isolated from original audio and NOT authentic Massive patch sounds. The sub/body split is a sound-design demonstration, not the number of original tracks.
06 APPROX combined synth — derived from 04 and 05, no drums.
07 APPROX bass + actual Roses kick — sound demonstration, not a reconstruction of the mastered mix.

`Roses_Actual_Drop_Bass_Bars37-44_100BPM.mid`: MIDI extracted from the actual arrangement with clip offsets and exact times relative to Roses bar 37.
`roses_37_44_original_drop_bass_midi_events.json/csv`: machine-readable events with original bar/beat.

To hear the authentic original Massive sound alone, load the source ALS and Massive preset in a compatible DAW and export only track 45 with its actual processing. The ZIP does NOT contain an isolated rendered track-45 WAV stem.

Recommended for Mr Pink: import exact MIDI into an optional transport-synchronized, manually armed bass backing layer at bar 37; avoid replacing the Here With Me lead or altering the physical kick/clap trigger logic. Also do not add a second full sub-bass layer blindly if live synth or chord keys are already generating root bass.
