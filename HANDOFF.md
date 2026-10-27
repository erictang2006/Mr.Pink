# Mr Pink — current handoff

Last inspected: **2026-10-20**. This snapshot was checked against current source. Read `AGENTS.md` for standing instructions; recheck runtime files before using the values below in a future change.

## Project

Local app: `/Users/erictang/Mr Pink`. React/TypeScript/Vite with Tone.js audio and Canvas performance visuals. Songs include Interstellar, Levels, Roses, and Rush E. Entry/state/routing is in `src/App.tsx`; piano code is under `src/piano/`, UI under `src/components/`.

Run `npm run dev`; enable audio in the browser. `npm run build` includes TypeScript checking. Prefer focused tests over a full test pass for small tasks. The Git worktree was clean before this documentation change. A GitHub `origin` is configured, despite an older README claim otherwise; work remains local unless the user asks to publish/push.

## Important current state versus historical documentation

- **Roses has a 36-bar score/practice range**: `rosesIntroBars = 36`, `rosesIntroBeats = 144` in `src/piano/rosesIntro.ts`. README and parts of `docs/ROSES-INTRO.md` still describe the earlier 28-bar version.
- The vocal overlay currently plays **Here With Me**, not the archived Closer chorus. It deliberately reuses the `RosesCloserEngine` / `rosesCloser.ts` names. See `docs/HERE-WITH-ME-TEST.md`.
- The old bars-21–28 vocal-chop layer was removed, but the newer **bars-29–36 buildup has its own chops layer** and mute setting. Do not infer that every chop path is absent from the current code.
- The live chord instrument evolved beyond the original two-button previous/drop comparison. Current settings distinguish **drop / bonk**, plus an independent **current / loud** option for Closer chord keys 1–3. Read the newer sampled-chord docs and current settings rather than restoring old defaults.

## Roses arrangement and vocals

- Clock: 100 BPM, 4/4. Live Z kick / X clap remain manual. V arms the intro synth, N arms break bass/sub, F6 arms guitar/build bass, M plays the accent, B stops backing, Space controls pedal, F9 is panic. Keep current phase restrictions and keyboard logic.
- Existing original Roses vocals: arm during bar 4, start on bar 5 at 9.6 performance seconds, source offset 9.6 seconds. The offset remains adjustable.
- Guitar/build bass enter at bar 21 when armed and repeat at bar 25 without a transport restart.
- Bars 29–36 are implemented through `rosesBuildup.ts`, `rosesBuildupEngine.ts`, and `roses_buildup_manifest.json`. They include separately authorized buildup layers and rehearsal controls. The reference is `reference/roses-bars29-36/README_FIRST.md`; it contains automated source kick references that must not become automatic live Z/X playback.
- **Bar 37's arranged drop is not implemented**: current buildup status explicitly says so. A playable live drop chord instrument is already implemented; do not confuse that with an automatic bar-37 arrangement.
- Current Here With Me overlay: default lyric entrance **bar 27 beat 1& = 62.70 s**; source hook annotation **34.100 s**, excerpt starts **33.980 s**, with 120 ms pickup. The source WAV is `/roses/here_with_me_chorus_original.wav`, original pitch/speed. This overlay enters automatically when enabled; the separate Roses vocal cue retains manual arming.
- Here With Me preferences use `stage-piano-roses-here-with-me-v2`. Old Closer source/preferences are preserved. Closer chord instrument settings are separate from the vocal overlay.
- The transport/recorded-audio continuation and Pause/Resume behavior have changed since the original 28-bar ending. Inspect the engine before changing FINISHED or section-boundary handling.

## Exact current live chord shortcuts

Source of truth: `src/piano/rosesChords.ts`. All pitches below are intentional.

| Key | Chord | MIDI |
| --- | --- | --- |
| 1 | D♭add9 | 61, 65, 68, 75 |
| 2 | E♭ major, higher root included | 63, 67, 70, 75 |
| 3 | Fm7 | 65, 68, 72, 75 |
| 4 | Lower D♭add9 | 49, 53, 56, 63 |
| 5 | Lower E♭ major | 51, 55, 58, 63 |
| 6 | A major | 57, 61, 64, 69 |
| 7 | B major | 59, 63, 66, 71 |
| 8 | C♯ minor | 61, 64, 68, 73 |

J/K remain individual melody keys; L is the default Roses vocal cue. Keys 4–8 intentionally override their previous individual notes in Roses only. No chord transposition or mapping changes are implied by a sound-design task.

Routing: keyboard chord callbacks → `RosesChordStabEngine` → selected instrument. Relevant implementations are `rosesDropLayers.ts`, `rosesFutureBassLayers.ts`, and `rosesLoudStabsEngine.ts`. Current defaults in `rosesDropSettings.ts` are `mode: "bonk"`, `closerMode: "loud"`, main decay 0.6 s / release 0.85 s, and a separate Closer keyup fade of 0.12 s. These are deliberately different instrument behaviors; do not apply a single release length across all paths without inspecting the task.

Read `docs/ROSES-SAMPLED-CHORDS.md` for recorded Bonk + synthesized Future Bass routing, and `docs/CLOSER-CHORDS.md` for recorded Loud Stabs on keys 1–3. The latter uses a held loop and short adjustable keyup fade. Older drop-synth docs also contain useful reference analysis, but some defaults have since changed. Audio reference assets are local; preserve originals and provenance.

## Performance visuals

- Interstellar and Levels keys unlight immediately on physical release even if pedal audio continues. Released note bars stop growing, then travel at fixed length. The audio engine's sustained pitches must not drive highlight state.
- Levels: energetic centered plasma orb, broad elastic stretches plus narrow pointed bursts; pitch-biased directions with free mid-register directions. Chords/density increase intensity. Sparks, local flares, flicker, and short contour trails are bounded and expire. **Expanding outer rings and exterior arcs were removed at the user's request.**
- Interstellar: cinematic starfield plus a cached blue-violet galaxy/supernova-like core on the right, behind note bars, in `cosmicGalaxy.ts`. Levels and other songs keep their own backgrounds.
- The Levels orb currently renders behind the note bars. Moving it in front with a translucent center was discussed as advice, but was not implemented in this conversation.
- Main files: `PianoCanvas.tsx`, `PerformanceVisualizer.tsx`, `performanceAtmosphere.ts`, `levelsOrb.ts`, `cosmicGalaxy.ts`, `performancePiano.ts`, and `src/piano/performancePresentation.ts`. See `docs/PERFORMANCE-VISUALS.md` for detail; the galaxy addition may not yet be documented there.

## Verification and remaining cautions

No application tests/build were run for this documentation-only task. Earlier sessions ran focused tests and local browser checks for physical keyup under sustain, fixed released-bar lengths, orb shape/settling, and the galaxy preview. Those results are historical, not a claim that today's whole repository has just been retested.

For a future visual change, start with `tests/performance-presentation.test.mjs`, `tests/liveNotes.test.mjs`, and relevant browser checks. For chord changes, inspect `tests/roses-live-chords.test.mjs` plus the Loud Stabs lifecycle/gate tests. Use relevant Roses timeline/overlay tests for scheduling changes. Preserve current code and saved preferences when older conversation requests conflict with newer implementations.

Known documentation debt: older 28-bar ending descriptions, older Closer vocal timing/source, an obsolete 7/8 chord paragraph, and the README's no-remote claim. Do not treat these as current runtime facts. Refresh the relevant passages when working on those features; no musical or visual changes were requested as part of this handoff creation.

## Soda Pop ending (2026-10-27)

Soda Pop now plays at full level through source 01:22, then fades audio and visuals for six source seconds to black at 01:28. There is no end screen. The fade start remains editable; saved 80-second default cuts migrate to 82 seconds. Pause, seek, and half-speed playback keep the fade on the audio clock. See `docs/SODA-POP-FINALE.md`.
