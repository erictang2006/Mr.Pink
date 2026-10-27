# Production cleanup — October 23, 2026

## Baseline and checkpoint

This is a preservation pass, not a musical or visual redesign. The working tree already contained substantial uncommitted work. No reset, stash, merge, deployment, or push is part of this cleanup.

The complete pre-cleanup working files, including untracked source, audio, references and documentation, are preserved in `/private/tmp/mr-pink-production-cleanup-20261023/baseline.tar` (excluding `.git`, `node_modules`, and generated `dist`). This is the dedicated cleanup checkpoint; no existing changes were committed or discarded. Restore individual files selectively from the archive rather than overwriting later work. The checkpoint directory also contains the initial file hashes, source/import inventory, public-asset reference inventory, and compiled runtime bundle hashes. Temporary storage is not a permanent backup.

Baseline commands:

- `npm test`: 272/273 passed. The prepared chord-cache test reported a stale `src/piano/noteMapping.ts` source hash.
- `npm run build`: failed type checking at the `LevelsPractice` call in `src/App.tsx`. It passes `playingMode`, `setPlayingMode`, `getHeldPitches` and `releaseModeVoices`, which the current component's `Props` and implementation do not accept.
- Existing TypeScript configuration already enables strict mode, unused locals and unused parameter checks.

## Audit and plan, recorded before cleanup

The audit covers the application entry graph, all source components and engines, local scripts and tests, public assets, generation/reference inputs, dependencies, modes, timers, and event cleanup. Static evidence establishes reachability and resource existence; it cannot certify real-time sound or browser rendering.

| Category | Finding and evidence | Action |
| --- | --- | --- |
| Safe to remove | `RecordedDropLeadEngine` has no instantiation or value import in application, scripts or tests. Its module is imported only for `DropLeadSound`; it is absent from the compiled entry graph. The route was already disabled in the final arrangement. | Remove the abandoned class and imports; keep its compatibility type. |
| Safe to remove | `dropLeadSounds` and `dropChordPresets` have no consumers. Both modules are used solely for types and are absent from runtime output. | Remove only those unused lists; preserve the types and existing controls. |
| Safe if proven | Chord-cache provenance refers to an older `noteMapping.ts` hash. The current change adds TypeScript-only mapping fields. | Compare old/current transpiled JavaScript. Refresh only that metadata hash if byte-identical; do not re-render or change audio. |
| Requires review at baseline | The newly added Levels real-piano module was partly wired into App, but the practice component did not implement the passed mode props. | Preserve code. Concurrent work independently completed this wiring during the audit; the final build passes. Do not attribute these feature changes to cleanup. |
| Requires verification | Old chord caches, original vocal sources, comparison WAVs, generation-only engines, CSA source art and archived recordings are not all runtime-loaded. Many are script inputs, provenance targets or test fixtures. | Preserve; do not equate non-runtime use with unused. |
| Must preserve | All current React components are reachable from the application entry point. `hwmBackingRenderEngine` and `brightDropChordProfile` are used by offline preparation scripts. Declaration files support compilation. | Preserve. |
| Must preserve | Bonk files and manual harmony WAVs use generated URLs; piano MP3s use a sampler base URL; backing WAVs use mode/group URLs. User sample URLs also come from local storage/IndexedDB. | Expand and verify generated built-in paths; retain imported-sample support. |
| Must preserve | Interstellar assistance, Levels mappings/drums, Roses 1–28, all 29–36 backing options, the three drop choices, vocal handoff, manual chords, practice controls, opening/crash scenes and live keystroke HUD. | No arrangement, audio, MIDI, mapping or visual changes. |
| Must preserve | React, React DOM and Tone are runtime dependencies; TypeScript, Vite and React type packages support the build. | No dependency removals or upgrades. |

## Interface and reliability findings

Performance and practice/sandbox already have separate rendering branches. Performance has optional/collapsed controls and the F7/F8 visibility shortcuts; the Roses controls are inside a collapsed details panel. Practice retains diagnostics and sound-testing controls. Moving or hiding these would change the established interface, so no UI changes are planned.

No application `console` logging or `debugger` statements were found. Tone's own diagnostic messages and audio preparation script output are not excess application logging. No unused configuration file was proven.

Keyboard input releases on blur/visibility changes and removes its listeners/ticker on disposal. Existing panic, pedal reset, engine stop/disposal, source-generation guards, practice timeout cleanup, visual RAF cancellation and fracture observer/image cleanup remain in place. These lifetimes were inspected; existing automated tests cover several of them. This is not proof against all device-specific stalls or leaks during long performances.

Do not alter clipping protection or reduce volume based on raw source peaks: several prepared float chord files intentionally exceed unity before runtime gain/limiting. The original-recording drop has its own sole-backing route and optional separate HWM lead; existing tests cover duplicate-layer suppression and transition/restart behavior. Full mix headroom, live CPU load, rapid keyboard playing and actual audio-device interruptions still need a real browser/device rehearsal. No suspected timing, mix or effect issue is corrected speculatively.

## Final verification

Completed changes:

1. Removed the abandoned `RecordedDropLeadEngine` class and its unused audio imports. Its compatibility type remains at the same module path. The live recorded-stabs chord engine and manual chord choices remain intact.
2. Removed the unconsumed `dropLeadSounds` and `dropChordPresets` lists. No controls, compatibility values or existing setters were removed.
3. Corrected only the `noteMapping.ts` provenance hash in six chord-cache verification JSON files. The old and current mapping file transpile to identical JavaScript after erasing types/comments; the cache WAV hashes and contents are unchanged. This fixes the baseline stale-provenance test without generating or transposing any audio.
4. Added this audit and `production-cleanup-verification.json`; no app feature, setting or dependency was added. No audio assets were deleted or moved.

The source cleanup is small: 37 net lines removed across the two type/retired-engine modules. It does not reduce the shipped JavaScript size because the removed implementation was already excluded by the bundler. Larger apparent savings require reviewing archived/generation assets; they were deliberately retained.

Final automated checks:

- `npm test`: **281 passed, 0 failed**. Eight tests were added by concurrent Levels work during the audit; cleanup added no tests or features.
- `npm run build`: **passed**, including TypeScript checking. The earlier Levels error was resolved by the concurrent Levels edits, not by deleting their props or changing their functionality.
- The compiled JavaScript and CSS are **byte-identical with versus without only these cleanup removals**, holding current concurrent work constant. The initial whole-project output cannot be identical because other edits occurred during the audit.
- All **145 identified built-in asset URLs** exist and are served by a local production preview with exact content lengths, including sampler/base URLs, 75 generated Bonk bank/pitch paths, four generated manual harmony paths and all selected mode/group backing paths. Hybrid intentionally does not load an `fx.wav`; its two riser files have their own loader. HTML fallback was ruled out for audio/image paths.
- The root app page and its compiled JavaScript/CSS served successfully from a temporary localhost-only preview. This is a server/resource smoke check, not proof of browser execution.
- Every baseline audio, MIDI JSON, image and stylesheet hash is unchanged. All 172 public files remain present. The six provenance JSONs are the only changes under `public`.
- No browser is connected, so browser/device playback, animation appearance and extended stage rehearsal remain unverified. No publish, deploy or push occurred.

Concurrent edits were detected in `App.tsx`, `LevelsPractice.tsx`, `LevelsIndividualSheet.tsx` and `SandboxMode.tsx`, plus the new Levels tests. Those files were not edited by this cleanup. They were preserved and included in the final build/tests; the verification report distinguishes them from cleanup changes.

## Review items retained

- Vite reports a roughly 1.49 MB minified JavaScript chunk (about 293 KB gzip). Code splitting or deferred loading could reduce initial loading but may change preparation timing; not implemented.
- The six historical chord-cache WAVs occupy about 50.6 MB in the public directory and are currently generation/verification assets rather than active automatic drop backing. Relocating them requires updating scripts, provenance and tests. Original vocal sources, CSA source artwork, reference ZIPs and comparison renders also retain archival/preparation value. No asset removal is proposed without that follow-up verification.
- Preparation scripts use `esbuild` supplied through Vite's dependency tree. Making it an explicit dev dependency is a possible maintenance follow-up; the lockfile and dependencies were left untouched.
- Manual rehearsal should cover Interstellar opening/typing/CSA/crash, assistance and climax; Levels assistance and the concurrently edited individual-note mode; full Roses playback and starts 25/29/37 with each backing/drop option; pause/restart/seek and song changes; fast Bonk/manual chords; pedal, blur release and F9 panic; vocals through bar 28 and silence from bar 29. Use the actual performance audio device and browser to judge peaks, synchronization, animation smoothness and sustained CPU use. No musical timing or gain adjustment was made based on a suspected problem.

Detailed repeatable local audit helpers and baseline logs are in `/private/tmp/mr-pink-production-cleanup-20261023/` and `/private/tmp/mr-pink-cleanup-*.log`. The verification helper compares current bundles with archived copies of only the two cleaned modules, so unrelated changes are not mistaken for cleanup effects.
