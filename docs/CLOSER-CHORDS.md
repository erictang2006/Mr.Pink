# Closer keys 1–3 — recorded Loud Stabs

In Roses Sandbox, select **Recorded Loud Stabs** under **Closer keys 1–3**. This is the default Closer selection. The same chord engine receives physical key events in Sandbox, Practice, and fullscreen Performance Mode. **Current chord sound** remains an optional comparison setting. Keys 4–8 continue through their previous instrument path.

The exact configured MIDI voicings remain:

| Key | MIDI | Notes |
| --- | --- | --- |
| 1 | 61, 65, 68, 75 | D♭4 F4 A♭4 E♭5 |
| 2 | 63, 67, 70, 75 | E♭4 G4 B♭4 E♭5 |
| 3 | 65, 68, 72, 75 | F4 A♭4 C5 E♭5 |

The full, finished recorded chord WAV begins on physical keydown. A loop from that same recording's steady middle fades in only if the note remains held. Physical keyup fades **both** the hit and its held loop over the adjustable Closer keyup fade (default 120 ms, range 50–400 ms). A 100 ms tap therefore ends around 220 ms instead of continuing through the complete 0.8-second source file. Older saved 600–1200 ms release values migrate to the new 120 ms default. Repeated hits create independent sources, so their short tails can overlap. Visual key highlights and note-bar lengths still follow physical keyup.

The chord sounds use **no Bonk, extra root bass, drums, or synthesized saw-chord loops**. Each recorded source hit was shifted offline with approximate duration preservation and supplemented only where its harmony needed a note. See [the source-hit analysis and three original previews](roses-reference/loud-stabs-previews/README.md). The runtime WAVs are byte-for-byte copies of those previews, plus short loops derived from their recorded bodies. All seven audio files are preloaded before Roses chord input becomes ready.

The Sandbox A/B buttons now identify their pitches honestly: **A** plays the unmodified A minor reference hit; **B** plays the finished Fm7 hit used on key 3. They are different chords and registers, so this comparison checks source character rather than an exact matched-chord difference.

Verification: the three runtime hits match their approved preview files byte for byte; their four configured pitch fundamentals are present; the sustain loops have smooth seams; no asset clips; TypeScript and the production build pass. No keyboard input manager, key 4–8 mapping, or other instrument was changed for this integration.
