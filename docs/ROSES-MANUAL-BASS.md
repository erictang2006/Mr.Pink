# Manual Roses bass and sub

In Practice, Sandbox, or the collapsed Performance controls, set **Bass / Sub · bars 13–20 → Manual keys** while playback is stopped.

| Physical key | Original pitch | Sound |
| --- | --- | --- |
| `,` | C♯3 / MIDI 49 | Existing bass and sub together |
| `.` | A2 / MIDI 45 | Existing bass and sub together |
| `/` | E2 / MIDI 40 | Existing bass and sub together |

Hold to sustain; release to stop both layers. The existing Bass and Sub volume controls still balance the layers separately. These keys are unused in the original Roses note/chord/control mappings. Shift and the main synth transpose do not change their pitches, matching the original fixed-pitch bass/sub arrangement.

Automatic remains the initial default. Manual mode suppresses only the existing bars 13–20 automatic bass/sub pattern, and N does not arm it in manual mode. Choose Automatic while stopped to restore the existing N-arm behavior. The selected mode is saved locally and survives reset/reload. Changing it during a running or paused take is disabled to avoid mixing queued automatic attacks with held manual notes.

Manual free play works while stopped. During playback these keys work in the early section and stop at the existing bar-21 handoff; the bar-21 guitar/build bass, bars 29–36 backing, vocals and recorded drop retain their existing behavior. No audio asset, MIDI arrangement, other key assignment, synth setting, effect, or gain was changed. The keys use the existing bass/sub synth voices and original .78/.68 attack velocities; no additional synth graph is created.

Pause, stop/reset, normal keyup, blur, hidden-tab release, song/input changes and F9 panic release held notes through the existing lifetimes. Keyboard auto-repeat cannot add repeated attacks. The sheet identifies the manual bass/sub lanes, and the piano guide shows the added keys.

Validation: build/type checks and **293 tests pass**. Focused tests exercise the real bass class with mocked Tone nodes, actual keyboard routing/cleanup, 100 rapid repeats with no new synth allocations, unchanged original mappings, local preference reload, manual/automatic suppression, bar-21 gating and matching remaining backing/drop events. UI render tests check the mode selector, key hints, live lanes and preserved recorded drop. Browser/device listening was not available. Everything remains local.

Automatic visual gestures: while automatic bass/sub is armed and active in bars 13–20, the same `,` / `.` / `/` keys illuminate their original pitches and create live note trails without attacking any audio voice. The piano labels and live Bass pads appear for this section. Releasing the key clears its visual ownership even after crossing into bar 21. Outside that active section, automatic mode does not enable these extra note keys. Manual mode continues to produce the existing bass/sub audio. Automatic scheduling, levels and sound are unchanged.

Validation for visual gestures: all **335 tests** and build/type checks passed. Tests cover original pitches, zero extra manual attacks, independent releases, repeated keydown, blur cleanup, section boundaries, unarmed automatic mode and preserved manual playback. Browser listening was not performed.
