# Bars 21–28: guitar and build bass removed

October 23, 2026: removed the Guitar WAV and Build Bass passages from the shared
Roses playback engine, so neither Practice nor Performance can schedule them.
Full armed starts, bar-25 shortcuts, direct seeks and practice loops all use this
engine. The guitar's three Players and stereo panners are no longer allocated.
Source audio, MIDI and import manifests remain on disk as references.

Removed the two practice score lanes, F6 input/control/pad and their instructions
and status labels. The legacy `armBuild()` method remains inert for compatibility;
it cannot re-enable these parts. Bars 21–28 retain the original sung vocal,
Here With Me cue and live drums with their existing timing. Earlier bass/sub,
bars 29–36 backing, and the selected drop remain unchanged.

Verification: 317 tests pass, including updated loop/seek/shortcut/full-start
checks for absence of the removed parts and preservation of the later buildup
bass, vocals and drop. TypeScript and production build pass. Browser listening
was not performed. Nothing was deployed or pushed.

Local checkpoint: `/private/tmp/mr-pink-remove-early-build/source.tar`.
