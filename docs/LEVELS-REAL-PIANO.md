# Levels Real Piano practice

Practice Studio starts in **Assisted**. Performance defaults to **Real Piano**
with individual E-major labels, input, and the same hand colors as practice.
The **Performance keys** selector beside the launch controls restores the existing
assisted arrangement when needed. The stage effects are unchanged. Performance labels, key highlights, and note trails
use actual chromatic MIDI positions: T is on E4, Y on F♯4, U on G♯4, and the
brackets on A1/B1. The visible range includes the highest mapped pitch, E7. Select **Real Piano** above the practice sheets to
play one MIDI pitch per physical key. The same selection carries into Sandbox,
which also has the toggle. Shift does not alter pitch in Real Piano.

Two requested shortcuts add bass assistance: holding `5` also holds `]` (B1),
and holding `4` also holds `[` (A1). Both original piano keys light and sound;
releasing the number releases its paired key unless that bracket is also physically
held. These shortcuts leave the displayed mapping and practice sheets unchanged.

The upper sheet keeps the assisted triggers. The lower sheet reads the individual
`SongNote` events in `levelsSong`, independently of the assisted chord inventory.
The individual sheet has separate RIGHT HAND and LEFT HAND lanes. The right-hand
fingering reference is `pu\pu\p\uut8out8outo8tuo8oyoyippijhf`; keys appearing in
that reference go in the right-hand lane and remaining keys go in the left-hand
lane, including the user's right-hand backslash and 8 bass notes. This changes
hand presentation without rewriting note pitches, durations, or attack groups.
Both sheets use the same measure boundaries and scroll together. Notes aligned
vertically start together; the width of each note shows its scored duration.
Arrows identify tied notes, which do not require a new attack. Rests remain in the
score. Both sheets remain visible in either playing mode.

## Mapping

`src/piano/levelsRealPiano.ts` exports the song-specific `levelsEMajor` map. It
reuses the full Roblox/Virtual Piano white-key positions already used by Mr. Pink:
`1234567890qwertyuiopasdfghjklzxcvbnm` corresponds to C2–C7 before remapping.
Each of these pitches moves up four semitones, preserving octave relationships.
The existing `t` C4 slot becomes E4, and `tyuiopa` becomes
E4–F♯4–G♯4–A4–B4–C♯5–D♯5. The physical rectangles, white/black shapes, widths,
and computer-key order remain fixed. `positionMidi` identifies the physical slot;
`midi` identifies the actual sounding pitch. Practice labels, highlights, and Sandbox note
trails use the same remapped geometry. Performance uses actual chromatic pitch
positions instead of these physical practice slots.

The score extends below the lowest regular E2 key. Three unused bindings cover it:

| Computer key | Actual pitch | MIDI | Existing visual slot |
| --- | --- | --- | --- |
| `[` | A1 | 33 | A♯1 black slot |
| `]` | B1 | 35 | C♯2 black slot |
| `\` | C♯2 | 37 | A1 white slot |

These bass extensions deliberately use spare bottom slots, so the two bass black
slots are exceptions to chromatic ordering. The remaining chromatic bindings use
ordinary corresponding gaps: backquote=F3, minus=G3, equal=A♯3,
semicolon=F4, quote=G4, comma=A♯4, period=C5, slash=D5.
There are not enough independent unshifted computer keys to cover every chromatic
pitch across five octaves; unbound black slots are only visual pitch references.
Every pitch in the current Levels arrangement is reachable without Shift.
Hardware keyboard rollover can still prevent some six-note chords from reaching
the browser; the detected-key display helps identify that limitation.

## Practice and sound

The existing audio engine handles note attack, release, sustain, and simultaneous
keys. Real Piano bypasses the assisted chord expansion. Step validation advances
only when every required pitch has a fresh attack within the chord window and all
required keys overlap. Timed validation uses the existing timing tolerance and
also requires the full overlapping chord within the chord window. A sustained
voice cannot replace a fresh attack for a repeated note. Validation scores note
attacks; the duration bars guide holding and releasing notes, without separate
release-duration scoring.

Switching Assisted/Real Piano clears held and sustained voices and partial chords,
while preserving the current position, transport, tempo, looping, and settings.
Each mode retains its own completed attacks and wrong-input count while the Studio
stays mounted. Navigation/reset retains the Studio's existing progress-reset
behavior. Timed loops explicitly restart the drum clock after the loop pause.

Assisted drum controls are unchanged: Z/X/C/V/B. Those letters are playable piano
keys in Real Piano, so **F1/F2/F3/F4/F5** control kick/clap/hat/fill/riser during
bars 9–11. Cues and transport instructions show the active shortcuts. Space still
toggles sustain; F9 stops sounds. Some keyboards require Fn for function keys.

## Score provenance and verification

`levels.song.json` is the project's existing MuseScore/MIDI note-event extraction.
`levels.ts` preserves bars 1–8 and applies the existing live transition overrides
to bars 9–12. Real Piano uses that active arrangement, including those overrides,
to stay synchronized with the assisted sheet. Bars 13–16 remain empty. No source
score, assisted chord definitions, or other song maps were edited.

`tests/levels-real-piano.test.mjs` covers pitch inventory, octave remapping, geometry,
exact prompt data, chord overlap/window behavior, repeated attacks, physical key
release, note layout/ties, and server-rendered sheet structure. Run `npm test` and
`npm run build`. Browser/audio and hardware rollover checks require a connected
browser; none was available during implementation.
