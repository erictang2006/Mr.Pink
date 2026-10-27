# Interstellar observatory background

Local visual refinement, October 25, 2026. The supplied performance image guides the atmosphere; the existing UI, piano, falling-note renderer, musical input, audio engines and arrangements are unchanged.

## Appearance and reactions

- A larger right-side galaxy uses three detailed spiral arms, icy-white core light, blue dust, muted violet accents and dark seams. Its face-on texture slowly rotates inside a fixed tilted projection (one revolution in 15 minutes).
- A horizontal nebula band contains cached dust and cloud detail, dark lanes, two small distant planets and an upper vignette for the title and HUD. The left and center stay dimmer than the right.
- Existing foreground stars have three parallax depths. Twenty-eight gentle dust motes move around the band. One shooting star appears for 1.05 seconds in each 14.5-second cycle.
- The existing live-note stream drives reactions. Low notes below MIDI 60 brighten the galaxy core; notes from MIDI 72 create small nearby stars. Nearby foreground stars respond to all live attacks. Reactions expire within 850 ms, independently of audio sustain. No new musical events or input handlers are introduced.
- All atmosphere draws before the existing falling notes and impact effects. Reduced-motion mode freezes galaxy rotation and parallax, removes meteors/drifting dust, and reduces high-note responses to one stationary sparkle.

## Performance and transitions

The existing canvas and animation loop are reused. Nebula detail and planets are cached in a surface capped near 600,000 pixels. The galaxy uses one reusable sprite capped at 1200 × 1200, shared with both transitions; replaced sprite backing stores are released. Animated detail has fixed budgets (36 arm stars, 110 foreground stars, 28 dust motes and at most eight note reactions). No large animated CSS filters or additional audio analysis are used.

The Interstellar stage surface is now capped near 3.2 million backing pixels, including on a 4K display; separate piano and HUD rendering are unchanged. The temporary nebula cache is released when leaving Interstellar. Detailed texture failures fall back to simpler drawing without blocking piano input, and failed allocations are not retried every frame.

`cosmicGalaxyGeometry` is shared by the live scene, the final Levels warp pose, and the captured Interstellar → Roses origin. Both transition galaxy layers use the new live-scene brightness. Transition durations, transport timing, hidden freestyle and the bar-5 album reveal are unchanged.

## Files

- `src/components/cosmicGalaxy.ts`: cached galaxy detail, rotation, bounded arm stars, core reaction and texture fallback.
- `src/components/cosmicObservatory.ts`: cached band/planets, sparse motion and bounded visual response state.
- `src/components/performanceAtmosphere.ts`: background composition, layered stars and reactions.
- `src/components/PerformanceVisualizer.tsx`: integration into the existing frame loop, pixel budget and cache lifecycle.
- `src/piano/cosmicGeometry.ts`: shared live/transition geometry.
- `src/piano/levelsInterstellarTransition.ts`, `src/components/LevelsInterstellarScene.ts`, `src/components/GalaxyVinylTransition.tsx`, `src/App.tsx`: matching geometry/brightness at handoffs.
- `tests/cosmic-observatory.test.mjs`: response decay/bounds, reduced motion, meteor cadence, geometry continuity, texture reuse, finite rendering and failure fallback.

## Verification

Automated Canvas command tests cover laptop (1366 × 538 sky), desktop projector (1920 × 756 sky), and 4K projector (3840 × 1512 sky) dimensions. These validate geometry, bounds and lifecycle; they do not measure browser rasterization or hardware frame rate.

The browser connection was unavailable during implementation. Remaining manual checks:

1. Open Interstellar Performance Mode at laptop size and fullscreen 1080p/4K. Confirm the title, live-key HUD, keycaps and blue/violet notes stay readable over the background.
2. Play low notes, high notes, assisted chords and rapid sequences. Confirm localized reactions, unchanged audio, immediate physical-release highlights and unchanged sustain.
3. Play the Levels → Interstellar warp, then advance Interstellar to section 3 and trigger NEXT SCENE/Right Arrow. Check galaxy size/position continuity, hidden Roses freestyle, countdown and exactly-once bar-5 reveal.
4. Repeat with reduced motion and focus/fullscreen changes. Profile actual GPU/CPU and frame rate on the stage laptop; command-count tests cannot establish 60 FPS.

Nothing was deployed or published.
