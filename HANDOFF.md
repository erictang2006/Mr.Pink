# Mr Pink — current handoff

Latest focused update: **2026-10-28**, Roses audience presentation. The original arrangement snapshot below dates to October 20 and contains superseded details; current source and newer feature docs take precedence. Read `AGENTS.md` for standing instructions. The current worktree includes unrelated local changes; preserve them.

Opening passage update: the first sentence is now “Hi, my name is Eric, and I can type relatively fast.” The existing remainder (“I'm a junior and I represent CSA…” through “…enjoy the show”) is preserved. Completion still follows the full configured passage.

## Current visual experiment — subtle Mr Pink show palette

User-requested, October 28: slightly warmer rose branding, HUD/keycap borders, selected instrument accents, opening caret/glow and small existing canvas palette shifts. Levels remains cyan/plasma; Interstellar remains mainly blue/cosmic; Roses retains its record presentation. No extra effects, loops, buffers, layout, audio, mapping or saved-setting changes. Chrome offline white, CSA logo red, note colors and the finale fade-to-black remain intact.

Typing follow-up (softened after screenshot review): initial-test upcoming letters are subdued gray-blush and correctly typed letters now use a stronger, deeper pink (`#f08abc`) per the latest feedback; errors use amber/underline for clear distinction. “I LOVE CSA” and the piano-text reveal use brighter pink with pink charge/fresh-character glows and dark edging over the animated background. Existing typing/caret/glitch/dissolve timings and reduced-motion behavior remain. Calculated solid-color contrast on the gray test background is 4.74:1 upcoming / 5.39:1 correct. Theme switch reversal also restores previous typing colors.

Keyboard follow-up: the first 4–11% CSS overlay was too subtle in the user's screenshot and is superseded. Performance white keys now each own a vertical gradient: #FFF9FC top, #FCE6F0 at 50%, #F3A7C8 bottom. White-key presses use a brighter pink glow/subtle highlight on existing press envelopes; shortcut labels, geometry, borders and existing black-key styling stay intact. Practice defaults remain unchanged. No extra drawing passes, filters, animations, event handling or audio changes; the same theme switch restores the original palette. Build/type checks and 26 focused piano/physical-release tests pass for the exact gradient update; no graphical browser verification.

Easy reversal: set `mrPinkShowEnabled=false` in `src/theme/mrPinkShow.ts` and reload. Both scoped CSS and canvas colors return to their previous palettes; no Git reset/revert or settings deletion is needed. See `docs/MR-PINK-SHOW-THEME.md`. Build/type checks and 45 focused renderer/transition tests pass; browser appearance still needs review.

## Current Roses audience polish — October 28

- Audience **LIVE INSTRUMENTS** hides chord pads 1–5 and I/O/P; F10 operator setup and backend physical mappings retain them. Remaining pads have larger keycaps/labels and stronger localized press feedback. Live note IDs catch retriggers between the existing 30 Hz display frames; no new audio dispatch or per-frame React work.
- Audience piano labels show L/;/' · J/H/F/D/S/A (A is the existing phrase ending) · Q/W/E/R/T/Y/U/I/O/P · =/−/0/9 · comma/period/slash. Other labels/shift duplicates are hidden; the continuous piano and all playable notes remain. Labels keep current phase-dependent MIDI positions. F10 restores the full guide. Practice, Sandbox, Levels and Interstellar are unchanged.
- Intro Loop now anchors under a retained intro synth pad in audience view. See `docs/ROSES-AUDIENCE-VIEW.md` and `docs/PERFORMANCE-WORKSTATION.md`.
- Press visibility follow-up: audience pads have 2px borders, a bright inner edge while lit, and a bounded 420ms local flash so short taps remain visible. Border response is 60ms; reduced motion disables pop/flash animation. Audio/input behavior is unchanged.
- Build/TypeScript and 30 relevant tests pass. Browser connection unavailable; fullscreen audience appearance has not been visually verified. No audio/sample/arrangement/preferences changes; local only.

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

Soda Pop is manual-only. Its default source cut starts at 00:39 with an adjustable two-second audio fade-in, reaching full level at 00:41. It stays full through source 01:22, then fades audio and visuals for six source seconds to black at 01:28. There is no end screen. The fade start remains editable; saved 80-second default cuts migrate to 82 seconds. Pause, seek, and half-speed playback keep both fades on the audio clock. Old 00:41 starts migrate once to 00:39 when adding the fade-in setting; custom cuts are preserved. See `docs/SODA-POP-FINALE.md`.
