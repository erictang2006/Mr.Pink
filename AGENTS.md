# Mr Pink — project instructions

These instructions apply to this repository and its subdirectories. This is the Mr Pink piano/performance app at `/Users/erictang/Mr Pink`, not the separate V-Game Expo project.

## Start here

- Read `HANDOFF.md` and the task-relevant documents in `docs/` before editing.
- Verify current source and Git status. Some older README/docs passages describe superseded arrangements and defaults; source code and the user's latest instructions take precedence.
- Preserve unrelated edits, local assets, saved settings, and existing musical arrangements. Make focused changes rather than rebuilding working systems.
- Work locally. Do not deploy, publish, upload assets, push, or create commits unless the user explicitly requests it. A configured Git remote is not authorization to push.

## Stack and commands

React 19, TypeScript, Vite, Tone.js/Web Audio, and Canvas. Use the existing npm/package-lock setup; do not upgrade dependencies as part of unrelated work.

```sh
npm run dev        # local Vite server
npm run typecheck  # TypeScript only
npm run build      # includes typecheck, then Vite build
npm test           # full existing Node test suite, when warranted
```

The user prefers minimal, relevant testing. Run focused existing tests for the affected behavior. Use build/type checks for code changes; avoid redundant full-suite runs, long audio renders, or new tests that only repeat implementation details. Documentation-only changes do not need an application build. Report what was actually checked and any checks that could not run.

Examples:

```sh
node --test tests/performance-presentation.test.mjs tests/liveNotes.test.mjs
node --test tests/roses-live-chords.test.mjs tests/roses-loud-stabs.test.mjs
```

## Audio and input boundaries

- Preserve song-specific instruments, exact MIDI pitches/voicings, physical mappings, octave variants, transport timing, and existing sample identities unless asked to change them. Check `src/piano/rosesChords.ts` before modifying chord handling.
- Live notes and chord hits must respond immediately, ignore browser key-repeat, and release safely on keyup, blur, panic, and mode changes. Do not add quantization or automatic chord sequencing.
- Roses **Z = manual kick**, **X = manual clap**. Do not add automatic kick/clap playback. Separately authorized buildup effects do not imply permission to automate those live drums.
- Keep opening synth, automatic backing, live chord instruments, and vocal overlays on their existing distinct paths. A chord-timbre task is not permission to alter the arrangement or other songs.
- Keep sustain and source ownership correct for overlapping/repeated notes. Do not truncate unrelated voices or allow stuck notes/runaway sources. Inspect the selected instrument path before changing release behavior.
- Treat MIDI, Ableton projects, proprietary presets, and full-mix audio as references. Do not silently use reference MIDI as automatic playback or full mixes as isolated instruments. Tone.js does not directly load proprietary plugin presets.
- Preserve original audio files. Put any authorized processed audio in separate files and record alignment/processing rather than guessing timestamps or pitches.
- Preserve browser preferences; inspect storage keys and migrations before changing defaults. Do not clear unrelated localStorage/IndexedDB data.

## Visual boundaries

- Piano illumination and note-bar length represent **physical key hold only**. Audio sustain/release may continue independently. Never reintroduce sustained-audio pitches into key highlights or add held-looking sustain extensions to released bars.
- Keep visible keybind labels, shared piano/note geometry, fullscreen behavior, and each song's identity: Interstellar cinematic/cosmic; Levels neon/plasma; Roses its existing presentation.
- Levels' dramatic orb keeps directional deformations/spikes, sparks, and glow. The user explicitly removed expanding outer rings/exterior circle arcs; do not restore them unintentionally.
- Interstellar has a cached right-side galaxy behind the note bars. Keep foreground notes and piano readable.
- Keep animation state/effect counts bounded, respect reduced motion, and cache expensive decorative artwork where practical. Do not introduce layout changes for an audio-only task.

## Documentation and verification

- Update `HANDOFF.md` when behavior, defaults, current experiments, or unfinished work materially changes. Keep it a concise snapshot, not a transcript.
- Update relevant feature docs when changing timing, routing, sources, or controls. Identify historical conflicts instead of copying stale values into new instructions.
- For audio changes, distinguish measured scheduling/PCM/render results from listening judgments. Do not claim to have heard or verified fidelity without doing so.
- For visual changes, a focused local browser/screenshot check is useful. Avoid unrelated redesigns and testing unrelated songs unless needed to catch a regression.
