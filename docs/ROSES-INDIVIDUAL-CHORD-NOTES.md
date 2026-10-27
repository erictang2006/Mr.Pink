> Superseded October 25: full 8/7/6 chord playback is restored on P/O/I respectively. Other chord-note gesture keys remain visual-only. See [current live set and chord mapping](PERFORMANCE-SETLIST.md). Historical implementation details follow.

# Roses individual chord notes

The former 8/7/6 chord shortcuts now use individual notes, with the existing
Roses chord instrument and its saved Bonk/Original Drop Synth settings. This
applies in Practice, Sandbox and Performance. The automatic arrangement is
unchanged. Interstellar and Levels are unchanged.

| Former shortcut | Play together | Actual pitches |
| --- | --- | --- |
| 8 · C♯ minor | E T U P | C♯4 E4 G♯4 C♯5 |
| 7 · B major | W R Y O | B3 D♯4 F♯4 B4 |
| 6 · A major | Q E T I | A3 C♯4 E4 A4 |

6, 7 and 8 themselves now play C♯3, D♯3 and E3. All thirteen individual
bindings match the corresponding Levels E-major pitches. Each key owns one
voice; release and sustain act on individual notes. Bonk has one pitched impact
per manual note. No automatic chord expansion or extra root bass is added.
These fixed E-major pitches replace the previous fixed chord pitches and stay
independent of the Roses melody transpose setting.

As explicitly selected, Q–P (including the intro keys T/U/Y) now uses the chord
sound instead of the live melody synth. The separately scheduled melody synth
and backing tracks retain their existing sound and timing. Shortcuts 1–5 and
=/−/0/9 retain their previous playback. The original 6–8 voicing definitions
remain reference data for sample preparation and historical engine checks;
they are excluded from active keyboard bindings and piano chord labels.

Verification: 320 tests passed, including exact Levels pitch parity, rendered
keycap alignment, single-note ownership, repeat suppression, sustain, blur,
retained shortcuts and prepared-wave provenance. TypeScript and production
build passed. No audio samples were regenerated or modified. Browser listening
was not performed. Everything remains local.

Checkpoint: `/private/tmp/mr-pink-individual-chords/source.tar`.

## October 23 pitch correction and Sandbox volume

The sustained E/T/U/P oscillator WAVs measure 277.18, 329.63, 415.30 and
554.36 Hz, matching C♯4/E4/G♯4/C♯5. The incorrect descending impression came
from the Bonk impact: its chord-root tuning folded pitch classes into a narrow
register, so G♯ wrapped below E. Individual-note calls now use a consistent
two-octave offset for this low attack layer, preserving the ascending intervals
0/3/7/12 semitones. The sustained note pitches are unchanged. Existing chord
shortcut and automatic impact calls retain their original folded tuning.

Sandbox now exposes **Chord-note volume** directly below Labels/Master/Transpose,
above the manual Here With Me chords. This 0–100% slider shares the existing
Roses chord instrument Output setting and local persistence; it is not a new
independent mixer bus. Existing sound controls remain in the Roses chord sound
panel below.

322 tests and build/type checks pass, including actual source playback-rate
options, old chord tuning, and measured WAV body pitches. No audio WAVs were
regenerated. Four cache provenance reports record the runtime-only source
amendment: a normalized source comparison verifies that the only rendering
engine change is the optional impact-tuning branch. Browser listening was not
available. Correction checkpoint and logs: `/private/tmp/mr-pink-chord-pitch-fix`.
