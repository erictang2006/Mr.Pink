# Stage Piano

A React, TypeScript, Vite, Tone.js, and Canvas piano for live physical-keyboard performance. Notes sound only when a mapped key is pressed. Audio must be enabled with the on-screen button first.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm test` for input and geometry checks, `npm run typecheck` for TypeScript, and `npm run build` for a production build.

## Playing

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
| `src/App.tsx` | Mode, settings, and component wiring |

See [keyboard mappings](docs/KEYBOARD-MAPPINGS.md) before changing presets. The Salamander Grand Piano V3 recordings are by Alexander Holm and are credited in the app under CC BY 3.0.
