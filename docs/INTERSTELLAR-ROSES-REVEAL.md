Interstellar → hidden Roses → bar-5 album reveal

Trigger and rehearsal

1. Enter the existing Interstellar Performance Mode and reach section 3 using the normal Right Arrow section navigation.
2. Press Right Arrow once more, or click NEXT SCENE →. This is separate from Roses' Start Performance control. Repeated arrow events cannot restart the morph.
3. Over 3600 ms, the right-side galaxy contracts and travels diagonally into the existing left-side record position. Its spiral coordinates tighten into concentric rings. The actual outgoing piano is briefly preserved in a bounded pixel copy and resolves into the existing Roses instrument/piano layout. No Roses title card is displayed.
4. Freestyle on the existing Roses instruments for as long as desired. Before Start Performance (including the count-in), Z plays the existing kick, X plays the existing clap, and C plays the existing vocal accent. These are immediate one-shots; they do not start the backing or advance the clock. The backing remains stopped; the black-hole center responds through the existing live-note/master-energy visualization. Cover art, title, mapping identity and record footer remain hidden. Start Performance remains present and becomes enabled when the morph and existing audio preparation are complete.
5. Click START PERFORMANCE or use the existing Space shortcut. The current four-beat count-in is unchanged. At 100 BPM, four beats take 2.4 seconds; bars 1–4 then take 9.6 seconds. The cover stays hidden throughout, with a transport-derived increase in magenta/reactivity.
6. The existing engine sends its bar-5/downbeat snapshot through Tone.Draw. That snapshot reveals the title and starts a single visual reveal: the black-hole center contracts, a local white/pink light and cyan/magenta rings spread outward, the unchanged original artwork opens through a circular mask, and pink petals drift away. Main artwork reveal completes in 800 ms; the bounded burst expires by 1900 ms.
7. To repeat the album reveal, use F10 to expose existing operator transport controls, then Stop (which calls the existing reset to bar 1). The secret center returns; Start Performance repeats the normal count-in and arrangement. Pause/resume does not retrigger the reveal. To replay the entire galaxy handoff, leave the stage, select Interstellar, and repeat steps 1–3.

Scope and wiring

The change uses the existing selectSong/panic/preparation path and preserves the existing Interstellar maps, Roses instruments, playback/arming behavior, four-beat countdown, audio engines, tempo, arrangement and section progression. Entering Roses through ordinary setup retains its existing direct presentation; the hidden presentation is enabled by this explicit cinematic handoff. No new piano shortcut was assigned.

RosesReveal in src/piano/rosesReveal.ts is presentation state only. App feeds it the engine's existing onChange snapshots; it owns no transport, audio event, timer or note callback. It remains hidden indefinitely until a running bar-5-or-later snapshot arrives, latches once, and rearms on reset to idle/bar 1. Its subscription updates only at reveal/reset boundaries. The 3600 ms morph deadline is separate and never starts backing or controls musical reveal timing. A late/skipped frame cannot leave the audience behind a permanent transition overlay.

GalaxyVinylTransition reuses drawCosmicGalaxy and drawRecordOrb, with one moving center and a spiral-to-ring coordinate morph. The target comes from the current record element's actual bounds and stageOrbGeometry, so the normal left record layout is preserved across fullscreen sizes. The final record is the existing PerformanceEnergyOrb, with a new optional hidden/reveal frame; its cover asset is still /assets/roses-cover.png. Existing groove/spectrum/lighting code stays in place. The prior generic PerformanceTransition still serves other setlist handoffs. PerformanceHeader, PerformanceWorkstation and RosesPerformanceTransport gain optional presentation flags; instruments and transport scheduling are reused.

Performance and fallback

- A finite 144-particle spiral field; 34 small accretion motes; 32 reveal petals. Counts and main durations live in rosesRevealSettings. The normal record's existing ambient budget is preserved after reveal.
- The galaxy's detailed sprite is cached per resolution, not regenerated as its drawn radius changes. The temporary keyboard copy is capped at 1600×240 pixels; the overlay at 2.8 million pixels / 1.5 DPR. The outgoing copy and overlay are released after the handoff.
- The existing record's energy still updates during the morph; its duplicate canvas drawing is skipped until the overlay finishes. No extra audio analysis graph is created.
- No per-frame React updates or per-particle DOM nodes. Context/renderer failure and the independent morph deadline reveal the functional incoming scene. The record's existing CSS fallback hides its album asset while concealed and can show it after bar 5.
- Reduced motion suppresses petals and dynamic swirl/time drift. The actual transport and count-in are unchanged.

Files

New: src/piano/rosesReveal.ts; src/components/GalaxyVinylTransition.tsx; src/components/galaxyVinylTransition.css; src/components/rosesBlackHole.ts; tests/galaxy-roses-reveal.test.mjs; this document.

Integration: src/App.tsx; src/components/cosmicGalaxy.ts; src/components/performanceAtmosphere.ts; src/components/recordOrb.ts; src/components/PerformanceEnergyOrb.tsx; src/components/PerformanceWorkstation.tsx; src/components/PerformanceHeader.tsx; src/components/RosesPerformanceTransport.tsx.

Validation

Build/type checks and the full available test suite pass. Added tests cover indefinite pre-start/bar-1–4 concealment, pause/resume, once-only bar-5 reveal, reset/replay, compact start/countdown availability, hidden identity, artwork masking, reduced-motion petal suppression, finite/bounded renderer commands, cached galaxy texture reuse, and continuous right-to-left geometry at 1366×768, 1920×1080 and 3840×2160. These are state/rendering checks rather than graphical or audible playback tests. Browser discovery returned no connected browser. Fullscreen motion quality, projector brightness, actual downbeat/audio synchronization, and live play during indefinite freestyle remain manual rehearsal checks. Everything remains local; nothing was deployed.

Load reduction — October 25

The approved choreography, particle counts, cadence targets, dimensions, musical timing and audio remain unchanged. This pass reduces repeated renderer work:

- All forty vinyl grooves retain their original radii, colors, opacity and line widths, but are grouped into eight cached, normalized Path2D objects. Breathing, rotation and resizing reuse those paths. A direct-drawing fallback remains available without Path2D.
- The transition's static haze/sky gradients use one temporary cache capped at approximately 600,000 pixels (about 2.4 MB). It is reused until resize and explicitly released at completion/cancel. Stars, twinkling, the moving galaxy and horizon still draw live. Cache/context failure falls back to direct drawing, without retrying allocation on every frame.
- Haze and halo fills on the vinyl are restricted to the nontransparent radius of each gradient instead of oversized/full-canvas rectangles. Fully transparent outgoing sky/galaxy layers are skipped.
- Constant accretion spiral geometry and petal seeds are calculated once. Per-frame rotation uses angle addition, preserving the original coordinates. Shared particle-envelope and tail calculations run once per frame rather than once per particle.

An instrumented before/after comparison for one hidden-vinyl frame at 900×650 recorded 1225 → 1116 Canvas calls, 351 → 319 stroke calls, and 2,197,525 → 1,088,144 square pixels of requested fillRect area. These are command/request counts, not measured browser CPU, GPU, actual rasterized area or FPS improvements; the browser also clips offscreen regions. The local comparison is /private/tmp/mr-pink-reveal-load-before-20261025/comparison.json. No claims of measured device frame rate are made.

Build/type checks and all 379 tests pass. Added checks verify all forty cached groove radii, cache reuse/release/failure, unchanged moving-star coordinates, unchanged animated accretion positions and unchanged particle/timing budgets. Fullscreen listening and hardware profiling remain manual because no browser is connected.
