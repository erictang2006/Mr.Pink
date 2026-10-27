# Roses audio stuttering investigation — October 26, 2026

The user clarified that sound stutters, rather than only visual animation dropping frames. This pass targets audio rendering work; it does not claim a measured laptop latency improvement.

## Finding

The live intro synth used `Tone.JCReverb` at room size .42. The alternate live chord instrument also constructed `Tone.JCReverb` at room size .12, even when the Bonk bus was selected. Both were connected to the live graph. Each JCReverb contains four `FeedbackCombFilter` AudioWorklet processors. Their installed implementation runs JavaScript sample loops, parameter updates and delay-line reads/writes on the audio rendering thread. Tone's own JCReverb source explicitly warns of performance degradation on some platforms.

These are eight JS audio processors in the live graph, distinct from canvas/React work. A small wet setting or a muted chord input does not dispose those processors. This is a concrete source of avoidable rendering work and a plausible contributor to stuttering, not a hardware profile proving the sole cause.

## Change

- The live intro synth now uses `NativeRoomReverb`: native Web Audio allpass filters and feedback delays, retaining the .42 room size and saved wet control. The three diffusion frequencies, four delay lengths, feedback coefficients, stereo summing and equal-power wet/dry control follow the existing JC room topology.
- The alternate chord instrument now selects its already-existing native `DropChordAmbience` implementation. Its .12 room size and .025 wet setting remain intact.
- Both actual live engine constructors now allocate zero JCReverbs, eliminating those eight worklet processors. The Bonk room already used native processing and is unchanged.

The native feedback implementation is not asserted to be sample-identical to Tone's JS delay-line implementation. Reverb settings and topology are preserved. No gains, pitch mappings, synth envelopes, audio arrangement, transport look-ahead, bar timing, camera behavior or visuals were changed in this pass. Number keys 1–5 remain silent.

The source used to generate cached backing audio, including `dropChordAmbience.ts`, remains byte-identical. No recorded WAV/MP3 or cached-render provenance manifest was changed.

## Verification and limits

Tests construct the actual live engine graphs against tracked audio-node boundaries and assert zero JCReverb allocations. They also check delay lengths, room-dependent feedback, stereo outputs, wet slider behavior, original drop defaults and complete native-room disposal. Existing musical transport and asset provenance tests remain part of the full suite.

A live browser connection was unavailable, so audio underruns, hardware CPU time and speaker output were not measured. A full reload and listening rehearsal on the performance laptop are still required to confirm the practical result. If stuttering remains, distinguish a single held intro note from rapid playing and from backing-only playback before making further audio changes.
