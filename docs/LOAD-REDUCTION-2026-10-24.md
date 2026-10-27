# Runtime load reduction — October 24, 2026

The baseline passed all 356 tests. Source and tests were checkpointed before edits at `/private/tmp/mr-pink-load-20261024/source-before.tar.gz`. This temporary checkpoint is for selective rollback, not permanent storage.

## Changes implemented

- **Removed an unused visual simulation.** `StageEnergy` still updated the former 128-point deforming Levels-style orb on every Roses vinyl frame, including its springs, bursts and ghost shapes. The current vinyl renderer does not read that object. Removed only that unused instance, impulses and updates. The separate visible Levels orb remains intact.
- **Removed invisible waveform drawing.** The master waveform canvas was styled to 1×1 pixel, fully transparent and clipped. Removed its canvas, gradients, 256-point drawing path and resize observer. The existing parallel analyser, 256 samples, RMS calculation, update cadence and cleanup remain unchanged and still drive the vinyl display.
- **Reused piano geometry.** Each piano and note-trail canvas caches its current key layout. Notes and clock updates reuse it; resizing, changing the map, range, presentation or transposition rebuilds it.
- **Skipped unchanged piano renders.** Fresh wrappers around identical note/code arrays no longer repaint the entire keyboard or replace its resize observer. Changed keys, labels, mappings, cues and ranges still redraw. Interstellar's mutable sustain/afterglow path deliberately continues receiving parent updates.
- **Suppressed duplicate input snapshots.** The keyboard poll still expires the notes-per-second counter at the existing cadence, but no longer refreshes React when pressed keys, detected keys, Shift and note rate are unchanged. Audio dispatch and key release happen before this UI deduplication.
- **Reduced pad DOM work.** Cache pad-element lookup until the pad configuration changes. Update pad CSS and lit classes only when their values change. Sample lifetime checks, hit flashes and release fades remain active.
- **Stopped polling a hidden elapsed-time HUD.** Fullscreen listeners remain active. The elapsed clock starts refreshing whenever its existing HUD becomes visible.
- **Deferred Roses preparation while playing another song.** The large backing and chord sample load starts on first Roses selection, rather than during Levels/Interstellar startup. Repeated selections and Enable Audio clicks share one preparation request; successful buffers are reused. The backing loader alone includes 11 alternative stem files totaling **45.4 MiB on disk**, plus the original buildup and live chord assets. This is a download/decode timing change, not removal of those assets or a measured memory saving.
- **Kept the unused Roses chorus stopped for initial piano-only use.** Enabling Levels or Interstellar now starts their piano/drums without starting the Roses synth chorus. Selecting Roses continues to prepare its original synth and effects.

## Verification and practical limits

All **363 tests** pass after these changes. Build/type checks also pass. Tests cover geometry identity and invalidation, immediate key changes and note-rate expiry, unchanged waveform/RMS values, observer cleanup, pad hit/fade behavior, deferred-load sharing/retry, existing arrangements, mappings and transports.

A controlled comparison against the checkpoint produced identical vinyl energy-state values for **1,200 frames**, including live notes, kicks/claps, buildups, drops, quiet passages and long frame intervals. Median time for just those energy updates in Node fell from about **55.6 ms to 0.20 ms** after removing the unused simulation. This is an isolated benchmark; it is not a total CPU reduction or browser frame-rate measurement. The temporary comparison result is `/private/tmp/mr-pink-load-20261024/energy-comparison.json`.

The input test verifies that 1,000 identical idle polls produce one UI notification instead of repeatedly publishing identical state. Pad tests verify that settled frames do not repeatedly scan or restyle the same pads. Visual budgets, rendering quality, music, MIDI, effects settings, volumes, transport timing and audio assets were not changed by this pass.

## Retained for further review

- Roses constructors still create some audio nodes and load the original sung-vocal players before Roses is selected. Fully constructing/discarding the entire song graph on demand would change engine lifetimes and preparation behavior; that larger change was not made here.
- Once Roses is selected, its existing backing loader still prepares hidden alternate modes. Loading only a selected mode would require readiness handling for source switches and seeks. Those implementations and WAVs remain available.
- Historical chord caches, original sources, reference ZIPs and offline rendering engines have generation/verification uses. Removing them would reduce disk usage, not the current performance's per-frame CPU load.
- React, React DOM and Tone are all in use. No dependency was proven unnecessary.
- The main JavaScript bundle remains roughly 1.54 MB minified. These changes target runtime work and decoding timing, not bundle-size reduction. Code splitting remains a separate change.
- No connected browser is available for device CPU, fullscreen or listening measurements. Actual rapid-playing and long-performance rehearsal remains necessary. Nothing was deployed, published or pushed.
