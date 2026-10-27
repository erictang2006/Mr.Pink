CSA → Interstellar fracture

Current production routing reveals Levels Performance after the fracture; see [levels-opening.md](levels-opening.md). The details below document the earlier Interstellar destination.

The Phase 1 sequence, message entry and post-crash hook remain the entry points. The fracture lasts 1400 ms; the existing Interstellar canvas, piano and header reveal during its last 700 ms. The keyboard becomes enabled synchronously at the final scene handoff.

Choreography relative to fracture start:

- 0–250 ms: intact original logo, central ruby charge, subpixel vibration, center-out seam illumination.
- 250–500 ms: central lettering and inlays open small gaps; outer arcs stay in place.
- 500–900 ms: staggered outer arcs detach; movement accelerates along seeded paths.
- 700–1400 ms: red shifts through violet into blue-white. Twelve of fourteen regions (all central lettering, lower sections and outer arcs) accelerate downward into the actual piano boundary. Only the two small upper inlays drift toward the galaxy. Curved paths fan gently across the keyboard, narrow and stretch into luminous ribbons, then feed local boundary glows and a horizontal light sweep. The keyboard reveals from its top edge downward; pieces and their particles stop at that edge so the keys resolve cleanly. The real stage remains mounted underneath.
- First successful physical piano attack after handoff: one faint starfield ripple and residual stardust. The cue runs AFTER the existing audio dispatch; it does not play, delay or schedule a note. Sustain, typing, section arrows and automatic notes cannot consume it.

Adjust `fractureSettings` in `src/opening/choreography.ts` for phase timing, separation/flight/dissolve timing, particle counts and lifetimes, trail timing, rendering limits, seed and first-note cue. The parent `openingTiming` in `sequence.ts` derives fracture and stage reveal durations from these values. Change the per-region delay, origin, depth and rotation in `fragments.ts` for individual choreography. Origins and polygons are percentages of the source image.

Fourteen regions cover the complete source image exactly once. Their boundaries follow the artwork's horizontal divisions, lettering, upper inlays, circular structures and lower stem. Every piece is clipped from the unchanged supplied PNG alpha mask; the curved edges and lettering are not redrawn. The original burgundy is retained until the transformation begins. Fragment, trail and shard colors interpolate continuously through violet into pale blue-white. Secondary emission anchors are sampled once from the actual PNG alpha contours, including internal lettering cutouts, then follow each fragment’s rotation before dispersing. Each source region retains at most 96 anchors. Seam lighting is also intersected with the original alpha, so it never draws arbitrary polygon lines through empty space.

Rendering uses one short-lived Canvas 2D layer and requestAnimationFrame, with cached burgundy/violet/blue-white source pieces, seam-light sprites and small glow sprites. Default particles: 34 secondary shards, 92 energy points, 38 atmospheric points (164 total across the entire sequence, not per frame). There are no per-particle React elements or per-particle blur filters. Backing resolution is capped at 1.5 DPR and 3 million pixels; this trades some effect-layer sharpness on high-DPI/projector displays for a bounded fill cost. The existing piano and background keep their own original resolution and rendering.

Reduced motion fades the intact logo without fragmentation, trails or moving particles. Replays release old animation frames, resize observers, image callbacks and canvas buffers. Both visual canvases have pointer-events:none; the intro layer unmounts at handoff and the first-note layer removes itself after 950 ms.

Automated checks exercise exact region coverage without holes/overlaps, deterministic trajectories and finite coordinates at 1366×768, 1920×1080, 3840×2160 and 1024×768, downward source-area dominance, exact arrivals at different keyboard heights, monotonic descending paths, particle expiry, actual-alpha contour emission, palette continuity, actual renderer command bounds, replay/cancel behavior, original assisted section mappings and input quarantine. These do not substitute for visual fullscreen/device QA: no browser was connected in this session. Rehearse locally using Start CSA opening, or the existing development-only `?openingDebug=1` controls. No deployment is part of this change.

Phase 3 live reliability

The normal message-complete → playable-piano duration is 3550 ms:

| Time after completing the message | Action |
| --- | --- |
| 0–500 ms | Readable completed message |
| 500–1000 ms | Message converges |
| 1000–1650 ms | Original logo forms |
| 1650–2150 ms | Clear logo recognition beat |
| 2150–3550 ms | Center-out fracture and transformation |
| 2850–3550 ms | Real piano, starfield and title reveal |
| 3550 ms | Live input enabled; first note remains physical |

CSS animations, fracture rendering and keyboard handoff use the same absolute sequence origin. A separate cancellable deadline enables input even if animation frames stop. The input router also checks the deadline on the first physical event, so a delayed timer cannot swallow a fresh note. JavaScript still shares the browser event loop: a wholly blocked tab or operating-system suspension cannot be made real-time by application code. Held typing keys remain quarantined until their keyup, including during fallback.

Missing artwork no longer disables Start CSA opening or Jump to piano. Message entry remains available; if artwork is not ready when the message completes, the real piano opens directly. Asset loading has a 2500 ms timeout. Canvas/context/cache/resize exceptions, context loss and an opening React render exception also skip to the same functional stage. The optional first-note effect has its own guarded lifetime and can fail without affecting audio. Focus loss during a running reveal releases notes/pedal and reveals the real piano; focus loss while entering the message preserves the text. Exiting native fullscreen during the reveal likewise removes the intro rather than trapping input. Normal active Performance Mode retains its existing Escape/fullscreen exit behavior.

Runtime load handling lives in `renderBudget.ts`. Four poor frames (>30 ms spacing or >10 ms visual work) reduce particle drawing by half, disable decorative trails, and cap the intro canvas at 1 DPR. Another four poor frames remove particles entirely, keeping primary logo pieces and the keyboard light sweep. If severe overload persists (>120 ms spacing or >45 ms visual work for three observations, after quality has reduced), the intro hands off early to the live piano. It does not alter the existing audio engine, musical mapping, piano rendering resolution, tempo or arrangements. A single slow frame does not change quality. These thresholds are conservative policies tested with synthetic loads, not measured 60 FPS guarantees.

The intro does not clear/redraw its canvas before fracture starts. Buffers, source callbacks, context-loss listeners, observers and animation frames are released on completion, cancellation, failure and replay. The first-note effect also releases its buffer/observer when finished. The message stays higher contrast during its recognition beat; the keyboard reveal uses opacity without an extra full-keyboard brightness filter.

Exact local rehearsal steps:

1. Run `npm run dev`, open the local Vite URL with `?openingDebug=1`, select Interstellar and enable audio. The normal start button also works without the debug query.
2. Click Start opening typing test, complete the displayed passage, then type `I LOVE CSA` physically after the crash; Backspace corrects mistakes. Timing starts when the complete normalized message matches.
3. At 3.55 seconds the new TYPING_PIANO_REVEAL moment begins. Physically type WAIT... I CAN PLAY PIANO? and hear its actual mapped notes. After the one-second hold and 650 ms dissolution, press a mapped opening note (for example F) and watch for the single residual starfield response. Release it, test Space sustain and rapid notes, then use Right Arrow for the existing assisted section and its C/B/M inputs. Right Arrow again selects the existing climax section.
4. Press Escape to return to setup. Expand CSA opening rehearsal. Replay full intro restarts the physical passage test; Replay CSA reveal repeats the 3.55-second animation without retyping; Replay CSA transformation starts at the intact logo recognition beat and takes 1.90 seconds; Reset to message entry clears the typed message; Jump to piano skips all intro animation; Restore clean setup releases active voices/pedal and returns to setup.
5. Repeat several times with a key held through reset, simultaneous notes, and a sustain press. Check that release highlights and audio remain correct. Test Alt-Tab during entry, during fracture, and after handoff. Return and release any physically held keys before resuming.
6. Test fullscreen entry/exit and a refused fullscreen request, both at 1366×768 and 1920×1080/projector output. Confirm message/logo recognition, title/black-key label readability, no final opacity jump or residual overlay, and audible first-note timing.

All rehearsal buttons are development-only and appear only on setup, never above the stage. No rehearsal keyboard shortcuts were added. Existing console integration methods remain available in development; the production crash-complete hook remains unchanged. The typing-test update now includes the upstream passage and simulated crash in this workspace; see typing-intro.md. The external `mrPinkOpening.crashComplete()` hook remains available for compatibility.

Files changed for Phase 3: `src/App.tsx`, `src/opening/sequence.ts`, `OpeningReveal.tsx`, `FractureCanvas.tsx`, `fractureRuntime.ts` (new guarded runtime), `renderBudget.ts` (new load policy), `OpeningGuard.tsx` (new visual error boundary), `FirstNoteRipple.tsx`, `fractureRenderer.ts`, `opening.css`, `tests/opening-sequence.test.mjs`, and this document. No musical arrangement, keyboard mapping or audio-engine file was changed in this pass.

Phase 4 update: the 3.55-second CSA deadline now enters the playable TYPING_PIANO_REVEAL scene. Normal INTERSTELLAR_ACTIVE follows only after the physical demonstration phrase completes and dissolves. See piano-typing-reveal.md.

Phase 2B downward choreography: major-piece arrivals occur at 1120 ms + each region’s delay × 0.35 (1120–1186.5 ms), with a 180 ms boundary glow. Recognition, center/ring separation, 1400 ms fracture duration, particle counts, input handoff and the WAIT!!! typing reveal are unchanged. Ribbon bloom uses repeated narrow strokes with no additional blur filters or animation loops. Reduced-motion mode retains its intact-logo fade. Browser preview was unavailable; laptop/projector playback remains a manual check.
