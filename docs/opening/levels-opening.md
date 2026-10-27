# Current opening destination: Levels

On the first launch of this opening version, setup starts with Levels selected. Later manual song selections keep their existing saved behavior. The setup button **Start opening → Levels** runs the existing typing test, offline screen, `I LOVE CSA` entry, logo fracture, and `WAIT!!! I CAN PLAY PIANO?` reveal. The final typing phrase and the stage after it both use the Levels E-major individual-note keyboard map and the existing piano samples. The reveal does not trigger the assisted Levels chords. Interstellar remains available separately from the song selector and **Enter Performance Mode**.

The internal sequence state is still named `INTERSTELLAR_ACTIVE` for compatibility with its existing timers and tests. The displayed song, piano map, audio routing, and post-reveal performance are Levels. `?openingDebug=1` exposes rehearsal controls, including **Skip to Levels**.

Levels' visualizer draws at no more than 30 frames per second and at no more than 1.5 device pixels per CSS pixel. The piano sample engine keeps at most 24 held source voices, and trims the oldest release tails when more than 32 rapid attacks have been created. Ordinary passages below those limits retain their original samples and release. All notes still release on keyup, pedal release, panic, and stage exit.

`npm test` and `npm run build` cover the keyboard handoff, voice limit, existing songs, and type checking. Fullscreen visuals and audible latency still require a local browser rehearsal.
