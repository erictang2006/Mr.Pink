# Soda Pop finale

Open **Performance settings → Soda Pop · audio-only finale**. Numeric edits save on Enter or leaving the field; toggles and sliders save immediately in browser storage and join the existing repository settings sync.

The set now ends **Levels → Interstellar → Roses / Here With Me (through bar 44) → Soda Pop**. Soda Pop starts manually; finishing DJ bar 44 never launches it during a normal performance. Older profiles with automatic playback enabled are normalized to manual-only. **Play Soda Pop finale** starts the segment when you choose. **Rehearse bar 44 → Soda Pop** explicitly runs just the final DJ bar and its transition for practice. Studio practice keeps its original behavior.

The **Four-beat metronome before Soda Pop** toggle enables four audible clicks and a visible 1–4 count during the transition. It applies to manual playback, restart, and explicitly requested rehearsal. It uses the configured pulse BPM and schedules the excerpt on the downbeat following the fourth click. Pause/stop cancel future clicks; resume schedules only remaining beats.

**Practice speed** offers **0.5×** and **1×**. Choose it before starting or rehearsing. Half speed doubles the Soda Pop transition, count-in spacing and excerpt playback time; audio plays an octave lower. Source timestamps still refer to the original file, so the source timing remains 00:41, full volume through 01:22, then a fade to 01:28. The existing DJ arrangement retains its tempo. The choice saves automatically.

## Fine-tuning the cut

- **Audio start:** initially **41.00 seconds** in the supplied MP3.
- **Fade starts:** initially **82.00 seconds** (01:22), two seconds after the prior cutoff; still adjustable. The original MP3 then fades over six source seconds and stops at **88.00 seconds** (01:28) at normal speed. At 0.5×, the fade lasts twelve wall-clock seconds.
- **First beat after cut:** initially **0.00 seconds** for the new 00:41 cut. The song and title reveal start together. A positive offset plays that amount of the cut quietly before reaching full gain at the reveal. Set this to zero to reveal exactly at the cut, or adjust it after changing the start timestamp. It is bounded to keep music after the can-opening cue and before the selected endpoint.
- **Transition:** initially **1.875 seconds** from the end of bar 44 to the main scene reveal; adjustable from **1–4.5 seconds**, with a minimum of four beats when the metronome is enabled.
- **Visual pulse BPM:** initially **128**, an approximate presentation setting. It changes only the decorative pulse grid, never the MP3's tempo, speed or pitch.
- **Transition cue positions:** scratch **22%**, digital glitch **43%**, can opening **68%** of the transition. The controls retain their musical order. Carbonation follows the opening by 70 ms.

Click **Stop / return to DJ** before changing a cut while the finale is active. Controls lock the current take to its original settings so a slider cannot move the audio cutoff during playback.

## Playback and ending

The on-screen Soda Pop playback bar is hidden. Open **Performance settings → Soda Pop** for Pause, Resume, Restart finale, Stop / DJ, and the excerpt seek slider. Pause freezes the audio-clocked visual phase; resume starts from the same sample offset and resumes only unfinished transition cues. Seeking does not repeat the old DJ arrangement. Restart explicitly replays the transition and selected excerpt. The completed finale cannot automatically play twice; Stop / DJ resets it for a new take. Existing saved 80-second hard-cut defaults migrate to the 82-second fade start; other edited fade positions are retained.

At the selected fade start, the song and Soda Pop scene fade together over six source seconds. The song ends silently and the scene remains black, without an end screen. The remaining MP3 is never scheduled. Replay and Stop / DJ remain available in Performance settings; Escape and panic behavior remain available. No new keyboard shortcut is assigned.

## Implementation

`src/finale/sodaPopEngine.ts` owns a small independent Tone buffer-source scheduler and its local sound cues. The same audio-context position controls the scene and all cue offsets. Background and title pulses reuse the existing destination audio analysis, supplemented by the configurable pulse grid. `RosesIntroEngine` offers an optional handoff at absolute score beat 176, the boundary after bar 44. If the finale is disabled or unavailable, its original completion behavior remains. Other arrangements, MIDI routing and timing are unchanged.

The turntable stop briefly slows the existing final-record sources and adds a 300 ms brake tail sampled from the existing final-record asset, so the effect remains audible even when that source ends precisely at bar 44. Only this intentional transition effect changes pitch. Scratch, glitch, can-opening and carbonation cues are short original local sound effects, rendered with `scripts/render-soda-pop-cues.py`.

The original uploaded MP3 is copied byte for byte to `public/audio/soda-pop/soda-pop.mp3`, with provenance and SHA-256 in `source.json`. Local PCM decoding verified stereo / 44.1 kHz / approximately 151.02 seconds, but the PCM analysis file is not a runtime asset. Normal-speed playback uses the original MP3 decoded by the browser at 1x, without synthesizing the song, re-encoding it or changing its pitch. The excerpt starts at the chosen source offset and reaches unity finale gain on the reveal; the application's master volume remains in effect.

All seven audio buffers are preloaded during the existing Start interaction without blocking the original show on a finale failure. The independent camera overlay stays mounted across the finale. Decorative particles have a fixed budget, a capped canvas resolution, and reduced-motion support. Automated tests cover exact handoff timing, disabled/unavailable behavior, original asset integrity, double-trigger prevention, pause/resume/seek/restart, cancellation during loading, disposal, cut bounds, cue order and rendering bounds. A connected browser was unavailable for live visual and listening validation.
