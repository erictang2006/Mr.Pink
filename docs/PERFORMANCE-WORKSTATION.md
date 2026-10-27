# Performance workstation visual upgrade

The subsequent [cinematic redesign](CINEMATIC-PERFORMANCE.md) replaces the stage
layout described below, while reusing its mapping, pad and output-observer logic.
See that document for the current piano height, orb artwork and refresh budgets.

Performance has a dark navy workstation surface, cyan/purple light, a larger full
piano, physical-key monitor, live master-output waveform, and grouped instrument
pads. Practice and opening sequences retain their existing interfaces.

The piano guide reads each active song/section mapping at its sounding pitches.
Interstellar now uses the active section map instead of the full Roblox reference
map for its stage keycaps; pressed-label matching uses actual input codes. Existing
assisted voices, doubles, transposition, Levels bass links, and custom Roses vocal
and bass bindings retain their input and audio behavior.

`performancePads.ts` builds pad descriptions from existing drum maps, piano guides,
Roses drum targets, vocal configuration, manual bass mappings, and backing events.
Only shared multi-pitch bindings create chord pads. Levels drum availability is
marked for bars 9–11. Manual triggers, key-armed sequences, queued changes, and
fully automated backing have separate labels; automatic pads never invent keys.
Pads are observers, not clickable audio controls.

Pad highlights respond to input snapshots, live-note ownership (including pedal),
existing playback snapshots, and read-only Player.state queries. Drum sample
lights follow actual player endings, then fade. Read-only note queries preserve
the existing visualizer's independent note-history window. Animation uses a
bounded 30 fps DOM update loop and CSS opacity transitions, without React state
updates on each frame.

The waveform uses a 256-sample Tone.Waveform connected as a parallel observer to
the existing master destination. It never starts/resumes audio, changes gain,
adds effects, reroutes instruments, or replaces the speaker connection. Cleanup
removes only its own analysis branch. It samples at 30 fps (10 fps with reduced
motion), caps canvas pixel ratio at 1.5, and skips rendering when the page is
hidden. Silence and unavailable analysis produce a flat line, without simulated
musical activity. The waveform reflects the overall mix, not isolated instruments.

Roses mixer/calibration controls are hidden on stage; practice configuration and
physical instrument controls remain available. No musical data, MIDI pitches,
arrangements, schedules, or keyboard bindings were changed for this upgrade.

Validation: mapping/cue tests, server-rendered keycaps and automatic badges,
section-specific piano guides, sustain and release behavior, actual drum player
end states, independent note-history readers, and passive waveform connection
cleanup. A browser was not connected during implementation, so projector layout,
real audio waveform rendering, and live keyboard use still require browser QA.


## Energy core and cosmic stage

Performance now places a large energy orb between the physical input monitor and
waveform, with the instrument panels alongside it. Its cyan, lavender and pink
rim gently breathes at idle. Existing live note IDs drive one-shot reactions:
low and high pitches bias opposite sides, chords add energy and ripple rings,
and the bounded LevelsOrb spring mesh supplies restrained contour motion and
short light streaks. Repeated reads of held notes never retrigger a pulse.

Beat keys come directly from the existing Levels/Roses playback snapshots.
Paused or inactive transport does not generate visual beats. Manual drum/accent
snapshot IDs can pulse independently. Roses drop state and selected backing
intensity raise the response; the existing master waveform's RMS adds actual
musical dynamics, including quiet piano tails. No additional analyser, transport,
MIDI listener, or audio scheduling is introduced.

The background replaces the old workstation backdrop with deep navy gradients,
subtle cyan/purple/magenta haze, three faint overhead beams, 38 floating dust
points, low piano fog, and an elliptical floor reflection. The old non-workstation
backgrounds and opening sequence remain available to their existing views.

The core uses a canvas capped at pixel ratio 1.5 and approximately 30 fps; reduced
motion uses a stable radius and no expanding rings or sparks at 10 fps. Rings are
capped at eight, visible sparks at 36, and all burst/mesh state remains bounded.
The background likewise caps rendering to approximately 30 fps in the workstation.
Animation reads refs rather than setting React state each frame. Both surfaces
ignore pointer events; instrument panels and piano labels remain unobstructed.

`tests/stage-energy.test.mjs` checks idle breathing, reduced motion, pitch bias,
chord response, authoritative beat deduplication, drop contrast, decay, geometric
bounds under rapid playing/stalls, and the atmosphere's sparse particle budget.
