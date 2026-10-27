# Live set and restored Roses chord triggers — October 25

Performance Mode: **Levels → Interstellar section 1 → section 2 → section 3 → Roses** using the unmodified **right arrow**. Key repeat does not advance; Roses is the end of the sequence and does not wrap or restart. Input fields and the opening sequence retain their keyboard ownership.

Each change releases held voices, clears live-note trails, resets backing transport and sustain, and enters the next song at its first measure. Interstellar also resets its section and assisted cursor. A 1.9-second cyan scene bridge introduces Interstellar with opening light curtains, expanding orbital rings, star streaks and a rising title. Roses uses pink light and petal-shaped sparks. The overlay removes itself when finished. These transform/opacity animations respect reduced motion and introduce no audio fades, new instruments, crossfades or backing tracks. The performance stage stays mounted and fullscreen stays open. Roses prepares its existing assets and retains Start/Space plus the four-beat countdown; changing songs does not start its backing automatically.

**Left/right arrow** navigates Interstellar sections without Shift. Right arrow from section 3 advances to Roses; section changes retain the existing section logic without a song-change overlay or audio reset. **Shift + left/right** retains bar navigation in Levels. Plain left arrow also retains its previous navigation. No previous-song shortcut was added.

Rush E is hidden from song and mapping-profile menus; an old saved Rush E song selection falls back to Levels. Its implementation and assets are retained locally. The old visual theme is labeled Neon. No instrument samples or arrangements were deleted.

## Roses live chords

| Physical trigger | Original engine trigger | Chord and MIDI pitches |
| --- | --- | --- |
| P | 8 | C♯ minor: 61, 64, 68, 73 |
| O | 7 | B major: 59, 63, 66, 71 |
| I | 6 | A major: 57, 61, 64, 69 |

The original engine identity remains the audio owner: its attack velocity, one Bonk impact per chord, impact root tuning, optional root bass and pedal/release behavior are preserved. Visual ownership uses P/O/I, so their physical pads light correctly. No sampled audio or MIDI was changed or regenerated.

Q/W/E/R/T/Y/U and 6/7/8 now depress their corresponding piano notes and create live trails without generating audio. The original intro L/;/′, automatic arrangement, other 1–5 and Here With Me =/−/0/9 shortcuts remain unchanged. Explicit manual buildup-lead mode takes priority during its active region, preserving its existing individual lead-note controls and piano labels; otherwise P/O/I are full chord triggers.

The Sandbox **Live chord volume** control uses the existing saved chord-instrument Output setting; its label now describes P/O/I instead of the retired individual-note sound route.

Validation: original versus aliased chord engine events compared for all three chords in both Bonk and Original Drop Synth modes, including exact attacks/velocity, root impacts, optional bass and release. Silent gesture and blur-release checks, shared piano/pad labels, responsive intro-loop placement, and live-set boundaries are covered by automated tests. Build includes the TypeScript check. Browser listening and visual confirmation require rehearsal.

Final checks: 365 tests pass; TypeScript and Vite production build pass. Local Vite server launches and returns the app HTML successfully. No interactive browser or listening verification was performed.
