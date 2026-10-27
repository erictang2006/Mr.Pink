# Bars 29–35 lead: Automatic or Manual

In **Practice or Sandbox**, beside **Bass / Sub · bars 13–20**, use the new
**Lead · bars 29–35** selector. Stop playback before changing it. Automatic is
the default; the selected mode saves locally under its own preference key.

- **Automatic · Arm Buildup** retains the existing selected Vox instrument and
  scheduled melody. Existing Arm Buildup, full armed start, bar-25 shortcut and
  bar-29 rehearsal behavior remain. During bars 29–35, physical **J/H/F/D/S/A/W** are
  visual-only gestures: keycaps and trails respond, without a live audio attack
  or release. This does not silence the automatic backing or other manual keys.
- **Manual keys · HWM lead** suppresses the scheduled melody, including the Vox
  WAV and every alternate timbre. Individual presses use the same four synth
  banks, unison pitches, processing and velocity as the existing buildup lead.
  This is the Vox melody's lead sound, not a replacement drop melody or the
  separate manual chord lead's octave-expanded voicing.

| Key | Pitch |
| --- | --- |
| W | B3 |
| R | D♯4 |
| T | E4 |
| Y | F♯4 |
| U | G♯4 |
| O | B4 |
| P | C♯5 |

These are the actual seven MIDI pitches in the existing bars 29–35 melody,
matching the current E-major piano labels. Hold/release each key independently.
Manual input can be auditioned while stopped; during a running take the sound
change is confined to bars 29–35. Earlier and later sections retain the existing
live chord/melody routing. The manual lead clears at the bar-36 break. Physical
key release remains correctly owned even when crossing a section boundary.
Manual lead keys follow hold/release, like manual bass, rather than pedal sustain.

The existing **Buildup Vox** level controls this lead's gain. The automatic
instrument selector is disabled in Manual mode; its saved value is retained
for returning to Automatic. Bass, percussion, vocal chops, main sung vocals,
bar-36 riser/snap and the selected drop remain unchanged. Automatic piano note
markers are hidden for the suppressed lead; the actual manually pressed keys
and corresponding live instrument pads remain visible.

Implementation reuses the buildup's existing `VoxMelodyEngine` and four-layer
`HereWithMeLeadEngine`. It adds no duplicate lead engine or musical clock.
Mode changes, pause, stop, seek, reset and the break clear the relevant lead
voices. J/H/F/D/S/A stay visual-only during bars 29–35 in either lead mode.
Modes persist independently of the instrument/timing settings.

## Verification

Automated tests, TypeScript and production build pass. Checks compare
Automatic/Manual full arrangements from bars 1, 25 and 29, prove that only the
scheduled melody is removed, verify exact four-bank manual pitches and repeat
suppression, exercise pause/replay/bar-36 cleanup, retain all automatic timbres,
and validate persistence, selector markup and absence of automatic visual
markers. Keyboard tests play `jhhffds`, then `jhhffdsaw`: every tap appears in the snapshot and
trail history while issuing zero live audio calls in Automatic bars 29–35.
Earlier and drop sections retain their existing live sound. Manual mode uses
the seven lead keys listed above; J/H/F/D/S/A stay visual-only in bars 29–35.

The lead render engine change only adds manual hold/release methods; a source
comparison confirms all existing methods remain byte-for-byte unchanged. Three
backing render reports and the dependent manual-harmony manifest record this
provenance-only amendment. No prepared audio, MIDI or note-event data changed.
Browser/device listening was not performed. Everything stays local.

Checkpoint and logs: `/private/tmp/mr-pink-manual-buildup-lead`.

The A–W phrase ending is silent in Automatic mode. A previously fell through to the original Roses synth; both ending keys now use the same gesture lifetime as the rest of the phrase. W keeps its existing B3 MIDI pitch and remains audible only when explicitly selecting Manual lead mode. No recorded melody or automatic note data was changed.
