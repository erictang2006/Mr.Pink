# Logo recognition beat and local transition sounds

The intact CSA logo now holds for **2 seconds** after its 650 ms formation, extended from the earlier 1.1-second hold. Relative to completing “I LOVE CSA”:

| Moment | Time |
| --- | --- |
| Message hold | 0–500 ms |
| Convergence/glitch | 500–1000 ms |
| Logo formation | 1000–1650 ms |
| Intact logo recognition | 1650–3650 ms |
| Fracture | 3650–5050 ms |
| Downward piano reveal | 4350–5050 ms |
| Physical piano input ready | 5050 ms |

Six original, locally rendered non-musical effects support the existing visuals:

- `logo-form.wav`: 1.15 s assembling whoosh and fine glass grains, beginning with message convergence and resolving as the logo finishes forming.
- `logo-fracture.wav`: 1.4 s energy/granular glass fracture. Central separation at +250 ms and the outer-ring breakup at +500 ms match the visual choreography.
- `piano-reveal.wav`: 700 ms descending airy shimmer, finishing at the playable handoff.
- `levels-warp.wav`: 5 s gravitational sweep for the existing Levels → Interstellar transition.
- `galaxy-vinyl.wav`: 3.6 s soft contraction/settling effect for Interstellar → hidden Roses freestyle. It does not start backing playback.
- `keyboard-tap.wav`: 65 ms soft mechanical key tap, triggered only by physical characters/spaces and Backspace on the “I LOVE CSA” message-entry screen. Modifier keys, auto-repeat, the initial typing test, piano-text reveal and ordinary piano playing do not trigger it. The final completing “A” still taps. Tap tails recycle first under extreme input, without evicting cinematic sound cues.

The effects use predecoded mono PCM buffers and finite one-shots on a separate quiet bus following the master-volume control. Configuration is in `src/opening/transitionSounds.ts` (`transitionSoundSettings.level` defaults to `.42`). Their actual mix should be checked with the stage audio output. No music notes, keyboard mappings, musical arrangement, backing tempo or transport events are added or changed.

Scheduling uses the existing scene origins and immediate audio clock, not React render arrival times or transport look-ahead. Replay seeks past finished material rather than replaying an old impact. Cancel, reset, focus loss, hidden tabs, scene exit, F9 and disposal stop effects. The Levels sound remains continuous through its internal song switch. Sound failures cannot own scene readiness or disable live input.

The six files total under 0.8 MB on disk and approximately 1.46 MiB of decoded mono float buffers. Six active one-shots and six short retiring fade sources are the hard bounds. There are no new sound timers, animation loops, live reverb nodes or procedural synths. Recreate the files with `python3 scripts/render-transition-sounds.py`.

Tests cover updated logo timing, exact effect cue scheduling, look-ahead bypass, repeated/rehearsal starts, late commits, cancellation/disposal, failure fallback, bounded tails and local waveform durations/peaks/fades. Graphical and audible rehearsal was not performed; use the existing Replay CSA reveal/Replay CSA transformation controls, then both manual song handoffs, to check the final mix. Nothing was deployed or published.
