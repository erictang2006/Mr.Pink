# Final Roses audio selection

The performance UI keeps the existing separate selectors:

| Selector | Only visible option | Existing playback path |
| --- | --- | --- |
| Bars 29–36 Backing Source | Original Roses Buildup | `roses`, the original Vox/bass/Spacy/roll/chop buildup with its current bar-36 riser |
| Drop backing | Original Roses Recording | `recording`, `/roses/drop/roses-original-recording-8bars-100bpm.wav` |

The recording is the existing eight-bar official-instrumental extraction, not the reconstructed `roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav` and not the archived MOV extraction. No source trim, sync offset, duration or playback processing was changed.

`rosesAudioSelection.ts` defines the performance-facing labels and values. App applies both selections to each new Roses transport before loading or publishing its first snapshot. They therefore return on every reload, without introducing another saved preference or changing existing storage keys. The controls also display these defaults while awaiting their first snapshot.

The alternative source choices are hidden only in the selectors. All HWM/Hybrid/reconstructed playback implementations, source registries, preparation tools, assets, and source-specific controls remain intact. Engine-level defaults used by existing programmatic HWM arrangements and audio QA were not changed. Buildup instrument choices, manual chord testing, the separate HWM vocal, optional HWM recording-drop lead, recorded volume and sync-offset input remain as before. Comparison wording and a source-inapplicable bass instruction were removed from the normal buildup panel.

Validation: build/type checks and all **287 tests** pass. Updated UI render tests verify one option per selector and the initial selected values. Transport regression checks cover two fresh sessions, starts at 1/25/29/37, the official recording as sole automatic drop backing, all five original buildup chop clips, and retained saved recording volume/offset. Existing HWM/Hybrid and optional-lead tests still pass. No browser/device listening test was available.

Baseline hashes confirm that every existing audio engine, MIDI JSON, keyboard mapping, audio file, image and stylesheet is unchanged. Six historical chord-cache verification JSONs needed a metadata-only hash correction for an already-present TypeScript-only mapping field; erased old/current mapping JavaScript was confirmed identical before updating those hashes. No audio was re-rendered. Local before-change copies and logs are under `/private/tmp/mr-pink-final-audio-selection/` and `/private/tmp/mr-pink-final-selections-*.log`.
