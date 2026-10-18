# Practice songs

The practice player reads musical data from `src/piano/interstellar.song.json`. Keyboard characters are calculated at runtime from the active profile; they are not stored in the score. Rush E has no score data yet.

## Imported Interstellar source

The user approved `cornfield_chase_inspired_original_build_template.mscz` as the exact practice arrangement. Its embedded MuseScore 4 score is titled “Midnight Orbit — original cinematic piano sketch” and has 52 measures. `scripts/import_mscz.py` imports **measures 1–30 only**, preserving the two staves as right and left hands. The imported data contains 428 written notes, 24 distinct pitches, rests, 3/4 meter, one tempo marking at 100 BPM, note durations, positions, and tie markers. All 24 pitches are covered by the bundled Interstellar mapping. The first 30 measures contain no unsupported timed score features.

To regenerate the JSON from that file:

```sh
python3 scripts/import_mscz.py /Users/erictang/Downloads/cornfield_chase_inspired_original_build_template.mscz src/piano/interstellar.song.json
npm test
npm run build
```

The importer stops with an error for unsupported timed elements, note decorations, tuplets, incomplete bars, or unexpected staff/voice structure. This strict behavior prevents silent loss of score events. For a future arrangement with those features, extend the importer and add a verification test before using its output.

## Practice rules

- Step mode advances after a fresh physical keydown for every expected pitch. Tied continuations do not ask for another keydown. Chords use the configurable press window; playing slowly is not scored as a mistake.
- Timed mode compares physical keydown pitches to score onsets within the selected timing window. Wrong keys and missed score notes reduce the displayed accuracy. The 25–125% speed control scales only the visual clock.
- The piano audio engine remains the only sound source. The practice player never plays the score automatically.
- A profile without every required pitch shows an explicit unmapped warning and pauses practice checking. Multiple bindings for one pitch can be selected in the preferred key controls.

## Assisted bars 9–13 and sustain

`src/piano/interstellar_assisted_bars_9_13.json` is the separate source for the bottom-row fingering. `src/piano/assistedSong.ts` verifies all 60 events against the approved MuseScore import at startup: bar, beat, right-hand MIDI, and left-hand MIDI must match. The assisted profile adds the nine bottom-row bindings to the original Interstellar map, leaving the full piano range intact. Only a correct physical keydown advances the assisted event and triggers the left-hand note. The note releases after its JSON duration; sustain can hold it longer. The left hand never runs from an independent clock.

The assisted view includes live note trails. “Show Assisted Notes” is off by default; when enabled, accompaniment trails appear in dim gold. Physical note trails remain visible. The audio engine separates held keys from pedal-held notes, and F9, focus loss, mapping changes, and section resets clear voices safely.

Automatic pedal mode uses the configured start and end measure in Practice Studio. Its default range is bars 9–13, matching the assisted section; change the fields to use other bars. Automatic mode is off in the fullscreen performance view because that view has no score playhead.
