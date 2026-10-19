# Roses remake — source bars 21–24 only

Source Ableton arrangement: 100 BPM, 4/4; bar 21 = absolute beat 80 / 0:48.0 and bar 25 = beat 96 / 0:57.6.

- Guitar L and Guitar R both use `Guitar build up bass compliment.wav`, covering beats 80–96.
- Build Bass MIDI enters at beat 80 and continues through beat 96. Original instrument is Sylenth1. `Build Bass.fxp` is reference only, not directly readable by Tone.js.
- At beat 88 (bar 23), a Vocal Chops MIDI clip using `ah intro sample.wav` begins, plus the prerecorded `aah vocal chop loop 2.wav` audio clip (which continues past bar 24).
- Original Kick, Snare 1, and related normal drum tracks have no clips crossing beats 80–96. Retain the existing app's *live* Z kick / X clap keys, but don't schedule drum hits or create fake practice beat targets.
- Original Roses vocal stem was uploaded separately and is not included. Keep it running if already implemented in the app.
- Source `.als` track names/clips were checked in the supplied archive. Use the existing source project for exact MIDI and sample timing if it is available to Codex.
- End the app at bar 24 only temporarily; later parts of the original audio can be added as another extension.
