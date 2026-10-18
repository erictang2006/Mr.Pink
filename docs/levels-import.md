# Levels score import

The authoritative source is [`scores/levels_blank_30_second_template.mscz`](../scores/levels_blank_30_second_template.mscz). `scripts/import_mscz.py` extracted all 16 measures into [`src/piano/levels.song.json`](../src/piano/levels.song.json). The import contains 333 individual notes, 4/4 meter at 126 BPM, rests, and no unsupported features.

The supplied `levels_assisted_chords_final.json` has the same pitches, onset beats, and durations for every event in all 16 bars. Its `sourceScore` field names `levels_blank_30_second_template(2).mscz`; the provided score file is named without `(2)`. Its right-hand `physicalKeys` arrays are the older multi-key fingering and are superseded by the Stage 6 single-key assignments.

Bars 1–8 contain six requested right-hand triads: U, I, O, J, K, L. They also contain six additional scored dyads. The extra triggers are Y=[76,85], P=[76,83], ;=[76,80], H=[66,73], N=[66,71], and ,=[64,71]. The left-hand stacks are A=[37,49,61], S=[40,52,64], D=[35,47,59], F=[33,45,57]. Bars 9–11 use J=68 and M=64; bars 12–16 have no written notes. All timing comes from the imported score. No notes are generated on a timer.

The Levels Practice Studio can remap an assisted trigger to an unused physical key. The mapping is stored locally and used in both Practice and Performance modes. A rollover test shows which keydown events reach the browser; software cannot recover keys that the keyboard hardware does not report.

The transition gain defaults to 40% in bars 9–12 and is saved locally. Space controls sustain manually; the gain setting does not change Interstellar.
