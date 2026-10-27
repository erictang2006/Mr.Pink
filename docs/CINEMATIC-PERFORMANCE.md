# Cinematic Performance Mode

The Roses centerpiece is now the [Dynamic Record Orb](ROSES-DYNAMIC-RECORD-ORB.md),
which replaces the sphere artwork described below while retaining this layout.

Implemented October 23, 2026. This layout is enabled only for Roses Performance
Mode. Interstellar and Levels use their separate original stage renderers,
backgrounds, note effects, header and piano sizing. The written brief supplied the layout and palette;
its referenced image was not included. The assumed projector target is 1920×1080,
with compact layouts for smaller screens. A real projector review is still needed.

## Presentation

- Header: existing song, measure, BPM and pedal state; centered ARM + START.
  Readiness and playback labels follow initialization and transport state.
- Left half: cyan/violet/magenta procedural energy sphere, spherical filaments,
  orbiting arcs, drifting points, note streaks, ripple rings and a reflection.
- Right half: floating pads derived from the existing physical mappings. Live
  instruments, sequence cues and automatic backing remain distinct. Pads observe
  real input and playback; they do not introduce new audio triggers.
- Bottom: existing piano renderer and geometry, approximately 18% viewport height,
  with short rising lights and restrained trails above active notes.
- Background: deep navy, cloud bands, moving beams, sparse dust and low fog.
  Practice, configuration panels and the typing/CSA/crash opening retain their
  existing interfaces.

The prior diagnostic waveform is visually hidden. Its existing parallel master
output observer still supplies measured dynamics to the orb; there is no additional
analyser or audio route. Live note ownership, drum hit IDs and transport snapshots
provide the other visual signals. Bars 29–36 gradually concentrate energy. Entry
into the running drop at 37 creates one burst that decays while music continues.
There is no visual music clock and no change to musical scheduling.

## Controls and reliability

Roses uses its existing `startArmedPerformance()` operation and finalized saved
configuration, including manual bass/sub mode and optional drop-lead selection.
Initialization is awaited, duplicate clicks are blocked, and Stop/unmount cancels
pending UI initialization. The large start control gives way to Pause/Resume,
Stop and Restart once the existing transport reports running or paused.

Interstellar and Levels retain their separate previous performance designs and
live controls. They do not mount the cinematic workstation, central orb or new
ARM + START control. Their original starlight/Levels rendering paths remain
active, including existing live-key feedback and note trails.

Orb rendering aims for 60 Hz when supported and drops to 30 Hz after repeated
over-budget frames. Pixel ratio is capped at 1.5 and orb backing resolution at
1.6 million pixels. Rings are capped at eight, drawn note sparks at 40, satellites
at 56, and the spring mesh remains bounded. Background and pad observers retain
their 30 Hz budget. Frame callbacks read refs rather than updating React state.
Reduced motion removes travelling rings, satellites, sparks and CSS sweeps,
stabilizes the sphere radius, and reduces orb refresh to 10 Hz. The orb has a
static CSS fallback for unavailable/lost Canvas rendering. Observers, animation
frames and added listeners are cleaned up on unmount.

## Verification and limits

- Baseline: 311 tests and build/type checks passed before this redesign.
- Final: 317 tests passed; production build and TypeScript check passed.
- Added tests cover transport preparation, duplicate clicks, cancellation,
  failure reporting, actual piano readiness, one-time drop release, decay and
  finite bounded artwork across compact/projector canvas sizes.
- Compared 592 existing source/asset/reference files with the local checkpoint.
  No files under `src/piano`, `public` or `reference` changed. Dependency manifests,
  global styles, piano geometry, piano renderer and Practice components are also
  unchanged from this task's checkpoint.
- Local Vite server launched and returned HTTP 200. This verifies serving only.
- No in-app browser was connected. Actual visual layout, projector readability,
  real frame rate, audio listening and live keyboard latency remain manual checks.
  Build retains its existing large-bundle warning; no dependency was added.

Local checkpoint: `/private/tmp/mr-pink-cinematic-checkpoint/source.tar`.
Verification logs are `/private/tmp/mr-pink-cinematic-{tests,build}.log`.
Everything remains local; nothing was deployed, published or pushed.
