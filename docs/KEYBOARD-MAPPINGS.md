# Keyboard mappings

`KeyboardEvent.code` identifies physical keys. A binding has a `code`, display `label`, base `midi`, and optional `shiftedMidi`. The input manager remembers each pitch at keydown, so releasing Shift while another key is held does not change that note's release pitch. Changing profiles releases all held notes.

## Bundled presets

- **Standard Virtual Piano:** the original two-row chromatic layout in `src/piano/noteMapping.ts`.
- **Rush E:** currently a separate copy of that same original layout.
- **Interstellar (Roblox-Aligned):** converted from `src/piano/interstellar_roblox_aligned_mapping.json` in `src/piano/profiles.ts`. Its 24 bindings have no `shiftedMidi`, so Shift leaves their pitches unchanged. The preset is read-only; use **Save as new profile** to make edits.

The supplied Interstellar file conflicts with the original Standard/Rush E preset on 14 shared physical keys. Those existing presets were preserved; the JSON assignments live only in the Interstellar preset. The differing codes are `Digit5`, `Digit6`, `Digit7`, `KeyQ`, `KeyW`, `KeyE`, `KeyR`, `KeyT`, `KeyY`, `KeyU`, `KeyS`, `KeyD`, `KeyH`, and `KeyJ`.

Custom profiles are stored in browser local storage and can be exported as JSON. The bundled Interstellar preset is restored from its source JSON on load, while older user profiles are retained. `tests/interstellar.test.mjs` checks every supplied MIDI assignment, chords, Shift behavior, rapid repeats, profile switching, and geometry.
