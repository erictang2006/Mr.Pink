Levels → Interstellar cinematic handoff

How to rehearse

1. Enter the existing Levels Performance Mode and play as usual. The scene never changes automatically when Levels finishes.
2. When ready, press Right Arrow or click NEXT SCENE →. The current audio/held notes are released through the existing panic/reset path. No Interstellar notes are scheduled or played automatically.
3. Watch the five-second transition. The full-width real piano stays mounted and visible; musical input is gated during the effect. Keys pressed during the transition remain quarantined until their physical release.
4. At five seconds, play Interstellar using the unchanged opening-section mapping. Its normal section arrows, assisted mappings, key labels, sustain and live-key HUD remain available. After section 3, the previously implemented galaxy-to-hidden-Roses transition still uses Right Arrow / NEXT SCENE →.
5. Escape cancels the animation and exits through the existing fullscreen/setup path. F9 panic or focus/tab loss finishes into the real Interstellar scene early, releases audio, and removes the transition. A new opening rehearsal cancels the pending transition deadlines. To repeat the complete effect, leave the stage, select Levels, and repeat the manual trigger.

Timeline from the physical trigger

- 0–1000 ms: the existing live Levels orb remains centered; rhythmic energy/deformation settles, rim light rises, orbital lines accelerate, particles begin pulling inward, grid/title dim.
- 1000–1700 ms: the same center darkens into a compact void; the rim becomes cyan/violet spiral rings.
- 1700–2700 ms: perspective rings and inward trails establish the wormhole.
- 2700–3600 ms: short blue/white warp streaks spread across the sky; navy replaces purple. The actual outgoing piano remains visible.
- 3600–4700 ms: the existing song-selection path selects Interstellar without starting notes. A bounded copy of the clean outgoing keyboard covers the one-time map/label update, then fades into the mounted Interstellar keys. Wormhole curves move and tilt toward the actual galaxy position (80% sky width, 49% sky height), while star streaks settle onto the normal seeded starfield. Interstellar/Hans Zimmer/HUD fade in.
- 4700–5000 ms: the exact existing Interstellar background renderer is visible without custom wormhole drawing. At 5000 ms the input gate and temporary keyboard image are removed.

Integration

LevelsWarpController (src/piano/levelsInterstellarTransition.ts) owns one absolute origin and two cancellable deadlines. The same origin drives shader poses and CSS animation times; React only observes boundary state. The existing visualizer keeps its LevelsOrb and Canvas context through the song change. A separate resize effect updates the backing resolution without reinitializing the visualizer on lightweight/presentation changes. The actual PianoCanvas component remains mounted. The source/final frame endpoints are the existing drawLevelsScene and drawCosmicScene functions.

New files: src/piano/levelsInterstellarTransition.ts; src/components/LevelsInterstellarScene.ts; src/components/PianoSceneGhost.tsx; src/components/levelsInterstellarTransition.css; tests/levels-interstellar-transition.test.mjs; tests/levels-interstellar-visualizer.test.mjs; this document.

Integration files: src/App.tsx; src/components/PerformanceVisualizer.tsx; src/components/performanceAtmosphere.ts; src/components/cosmicGalaxy.ts; tests/performance-background.test.mjs (runs/cleans up all registered effects).

Runtime limits and fallback

The effect uses the existing visualizer frame loop rather than a second full-screen canvas. Default budgets are 96 inward particles, 96 brief warp streaks, ten rings × 56 curve segments. It targets 60 Hz while active, suspends drawing in hidden tabs, and caps the stage backing buffer at 2.8 million pixels / 1.5 DPR. The normal Levels stage retains its existing lightweight cadence. The temporary keyboard copies are capped at 1600×240 pixels; the cached soft background remains capped at roughly 600,000 pixels. These resources are released after completion/cancellation. The final galaxy uses the existing cached sprite, prepared in an idle slice before formation where possible. Reduced motion removes warp streak travel and ring spin. No per-frame React state, new audio graph, MIDI mapping, transport schedule or arrangement is introduced.

The independent deadlines and a check on incoming physical keydowns complete the handoff even when animation frames/timer callbacks are delayed. Renderer or animation synchronization failure ends into the functional Interstellar scene. Already held typing/musical inputs cannot become new attacks at the scene boundary. No UI animation can schedule a musical note.

Validation

Build/type checks and all 388 tests pass. New checks cover explicit-only start, two synchronized deadlines, once-only switching, cancellation/replay/stale timers, input quarantine, actual KeyboardInputManager note-on/off balance, first fresh Interstellar key at a delayed deadline, exact source/final renderer frames, finite/bounded rendering at laptop/1080p/4K sky sizes, reduced motion, and one context/observer/frame loop through the complete song change. The existing Roses full-viewport/right-piano background check still passes after the visualizer effect update. Existing arrangements/mappings/count-in/reset/audio tests also pass.

No browser is connected in this session. These are state, renderer and input checks—not visual playback, measured GPU/FPS or audible synchronization tests. Fullscreen/projector brightness, motion quality, keyboard label blending and actual listening remain manual rehearsal checks. Everything stays local; nothing is deployed or published.
