# Vox Auto instrument options

Use **Bars 29–36 instrument** beside **Start bar 25 + backing + lead** in Timed Practice, or the same selector in **Roses Sandbox → Buildup 29–36**.

- **Original Vox Synth:** the original recorded phrase.
- **Light Ping Vox:** brighter processing of that recording.
- **Loud Stabs:** a single-note reconstruction of the recorded Loud Stabs sound, tuned to the original Vox notes.
- **Here With Me lead synths:** the existing four-bank lead instrument plays the original Vox notes and rhythm. All four banks play each written Vox pitch, as in the earlier instrument experiment.

The selected instrument replaces Vox Auto without doubling it. It does not substitute the Here With Me drop melody. The Vox phrase starts from bar 29, repeats from bar 33 with its original clip boundary, and keeps the bar-36 break. The full Here With Me drop melody remains independent in bars 37–44. Start Bar 25 still preserves guitar, bass, percussion and vocal cues. Start Bar 25 and Start Bar 29 now automatically continue into the enabled full Drop Layer Mixer arrangement at bar 37; no separate Play Drop press is needed. The Brighter / Punchier Play Drop preset is independent and remains available.

The Vox slider controls the selected instrument's level. Choices migrate from saved preferences, including the reverted melody selector: a saved Here With Me choice now uses that instrument on Vox notes. Original/Light use the existing recording; Stabs/lead disable the recorded Vox path. Switching restores the recording at its current offset or joins the selected instrument on subsequent Vox notes. Pause, reset and stop clear queued voices without replaying notes. No changes to mappings or physical note visuals.

The Vox reference contains 16 notes in the four-bar phrase, with the repeated clip truncated to 12 beats, producing 30 attacks across bars 29–35. The independent source analysis is in `docs/roses-reference/vox-melody-analysis.json`; the single-note Stabs sample remains a reconstruction rather than an isolated proprietary synth stem.

Integrated tests cover all four instrument choices, all 30 Vox onsets/pitches/durations, replay, seeking, sound switching, pause/reset, unchanged backing and the separate 224-event bar-37 lead. The optional native Tone renderer is `scripts/render-buildup-audition.mjs` with `VOX_SOUND=vox` or `VOX_SOUND=lead`; its new outputs are in `docs/roses-reference/vox-instrument-audition/`. Previous complete-melody replacement previews are historical artifacts and no longer describe active playback. Everything remains local.
