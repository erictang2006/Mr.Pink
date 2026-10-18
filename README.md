# Stage Piano

A React, TypeScript, Vite, Tone.js, and Canvas piano for live physical-keyboard performance. Notes sound only when a mapped key is pressed. Audio must be enabled with the on-screen button first.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm test` for input and geometry checks, `npm run typecheck` for TypeScript, and `npm run build` for a production build.

## Playing

- Click **Open Practice Studio** for the imported Interstellar score. Enable audio, then play the highlighted computer keys. Step mode waits for the full chord; Timed mode follows the score clock without playing notes for you.
- Click **Assisted bars 9–13** inside Practice Studio to use the supplied bottom-row fingerings. Each correct physical press triggers its matching left-hand note; wrong or repeated keys do not advance it.
- Space controls the sustain pedal. Toggle is the default; Hold and measure-based Automatic modes are available in the pedal controls. F9 is the emergency all-notes-off shortcut.
- The practice sheet can be scrolled horizontally. Click a measure number to jump; use the loop fields or quick ranges to rehearse a section. Speed changes only the practice timeline.
- Select a keyboard profile in Practice Mode before entering Performance Mode.
- Standard Virtual Piano and Rush E retain the original mapping. Interstellar (Roblox-Aligned) uses the bundled 24-note JSON mapping; its notes do not require Shift.
- Keydown starts one note; keyup releases the pitch captured at keydown. Losing focus or pressing F9 releases held notes.
- Practice Mode has a 280–400px keyboard-height slider, starting at 330px. Performance Mode uses 29% of viewport height.
- In Performance Mode, F7 toggles piano labels, F8 toggles the HUD, and the selected theme shortcut cycles visual themes.

## Code map

| File | Responsibility |
| --- | --- |
| `src/piano/noteMapping.ts` | Physical-key bindings and MIDI note names |
| `src/piano/profiles.ts` | Bundled and saved mapping profiles |
| `src/piano/keyboardInput.ts` | Keydown, keyup, modifiers, held-key state |
| `src/piano/audioEngine.ts` | Tone.js sampled piano and note lifetimes |
| `src/piano/geometry.ts` | Shared key positions for both canvases |
| `src/components/PianoCanvas.tsx` | Piano keys, highlights, labels |
| `src/components/PerformanceVisualizer.tsx` | Live reverse-falling-note bars |
| `src/piano/liveNotes.ts` | Visual note start and release times |
| `src/piano/sustainVoices.ts` | Physical and pedal-held voice lifetimes |
| `src/piano/interstellar_assisted_bars_9_13.json` | Exact assisted fingering and accompaniment events |
| `src/piano/assistedSong.ts` | Assisted event validation against the MuseScore import |
| `src/piano/interstellar.song.json` | Exact imported measures 1–30, pitches, rests, ties, and timing |
| `src/piano/practiceSong.ts` | Reusable song grouping, mapping choices, and score clock |
| `src/components/PracticeStudio.tsx` | Step and timed practice interface |
| `src/components/AssistedPractice.tsx` | Song-specific assisted bars 9–13 |
| `src/App.tsx` | Mode, settings, and component wiring |

See [keyboard mappings](docs/KEYBOARD-MAPPINGS.md) and [practice score import](docs/PRACTICE-SONGS.md) before changing presets or songs. The Salamander Grand Piano V3 recordings are by Alexander Holm and are credited in the app under CC BY 3.0.
