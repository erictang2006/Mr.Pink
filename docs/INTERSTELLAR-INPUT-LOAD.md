# Dense-chord playback and rendering — October 26, 2026

The reported failure was in Interstellar with the corresponding piano keys still lighting. That establishes that the app received those physical inputs; it does not by itself establish which audio or rendering bottleneck caused each missed sound.

## Confirmed issue and fix

`PianoAudioEngine.noteOnSource` previously evicted the oldest source at 24 owned voices, even if its physical key remained held. Its separate 32-sample history cap could also stop a held voice. Assisted chords and sustained passages could therefore illuminate a note while the engine cut off its audio.

Both budgets now protect physically held sources. The 24-source budget trims released pedal-owned voices first, using a short fade; the 32-tail budget excludes held voices. Naturally completed sources are removed from tail history. Physical releases, pedal-up, same-source retriggers, shared-pitch ownership, panic/reset and disposal keep their existing paths. There is no new audio scheduling delay, pitch change, sample change or mapping change. A truly held chord may exceed the tail budgets rather than losing notes.

## Reduced drawing during dense Interstellar passages

The existing frame loop tracks its own draw cost. Four fresh note attacks, fourteen visible note trails, or a smoothed draw cost above 10 ms activates lighter secondary effects. Quality returns after a quiet 900 ms window when drawing cost has settled.

- Particle cap: 768 → 192 during the busy window.
- Ongoing shimmer budget: 12 → 3 particles per frame, with smaller collision bursts.
- Extra note-body radial bloom/inner-light passes and shadow blur are skipped. Body gradient, rounded shape, rim, bright impact lip and every visible note remain.
- Additional galaxy-arm motes, drifting dust and shooting stars pause. The main cached galaxy, nebula band, stars and live-note reactions remain.
- React input-status updates use an interruptible transition. Audio attack/release callbacks still run synchronously before these UI updates. Keyboard events are not throttled or queued behind animation frames.

The layout, musical arrangement, key mappings and transition timelines are unchanged. Normal visual richness returns outside dense passages. No new animation loop, audio analyser or input listener is introduced.

## Verification

Automated regressions cover forty physically held voices, one hundred pedal-held retriggers behind a still-held chord, shared-pitch ownership, complete release, render-budget activation/recovery, economical beam geometry/gradient retention, and bounded dense-passage particles. Existing input, sustain, Interstellar section and transition checks remain in the full suite.

No audible or graphical browser rehearsal was available. After reloading the local app, rehearse Interstellar assisted chords with and without the pedal, rapid release/retrigger sequences, all three sections, and focus/reset recovery. Confirm on the stage laptop that audible notes match illuminated keys. Actual CPU/GPU usage and frame rate have not been measured.

Nothing was deployed or published.
