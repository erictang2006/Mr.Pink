# Roses · Dynamic Record Orb

The Roses-only Performance centerpiece now uses a circular picture-disc design.
Instrument pads, piano, controls, other songs and Practice interfaces retain
their existing layouts. No music, mappings, MIDI or transport code changed.

## Artwork

The requested `public/assets/roses-cover.png` was missing from the workspace.
The matching original pink floral cover was retrieved from the
[TIDAL Roses single page](https://tidal.com/album/45210099), visually compared with
the attached cover and saved locally at that path as a 1280×1280 PNG. Source:
`https://resources.tidal.com/images/2fe470f2/636f/44d9/881a/e67ea65484d1/1280x1280.jpg`.
The app only loads the local asset; no remote artwork requests occur at runtime.

The cover is clipped to a circle with a narrow edge shade. Original flowers,
frame and lettering remain upright; there is no recreated title or image
rotation. Vinyl groove highlights rotate independently while transport is
playing or measured live audio is audible. Existing energy interpolation
controls disc size and glow.

## Reactivity and budgets

- 96 radial spokes read the existing 256-sample master waveform. No FFT,
  additional analyser, output routing or audio processing was added.
- Single piano notes make gentle expanding rings; lower-register notes and
  actual drum-hit IDs create stronger visual pulses. Existing build progress
  concentrates rings and slightly increases rotation speed.
- The existing running-drop entrance creates one expanding shockwave. Its
  light/petal release decays instead of retriggering every frame.
- 24 groove lines and 22 deterministic curved petals have fixed budgets.
  Ring state remains capped at eight. There is no per-frame React state.
- Existing Canvas pixel/resolution limits, hidden-tab skipping, cleanup and
  adaptive 60-to-30 Hz refresh remain. Reduced motion disables rotation,
  travelling petals and expanding rings. Lost/unavailable Canvas rendering
  falls back to the upright local cover and a static record rim.

## Verification

324 tests pass; production build and TypeScript checks pass. Checks cover
upright artwork under independently changing groove angles, finite bounded
drawing, actual waveform amplitude response, stronger bass/drum pulses, gentle
single-note ripples, drop deduplication/decay, and reduced motion. The cover
asset returned HTTP 200 from local Vite.

A standalone SVG translation of the Canvas artwork was rendered with native
Quick Look and inspected for cover/lettering readability. This is artwork QA,
not a browser screenshot or proof of device frame rate. No in-app browser was
connected; projector composition, actual animation smoothness and device/audio
latency still require a live check. Existing build bundle-size warning remains.

Only four existing component/style files changed, plus the new pure record
renderer, image and tests. Checkpoint comparison confirms zero changes under
`src/piano`. Local checkpoint and logs: `/private/tmp/mr-pink-record-orb`.
Nothing was deployed, published or pushed.
