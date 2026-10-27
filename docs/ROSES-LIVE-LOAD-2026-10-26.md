# Roses live latency and drawing load — October 26, 2026

The reported symptom was illuminated physical keys with late or uneven audio. This pass addresses a verified live-synth scheduling delay and reduces competing drawing/UI work. It does not establish that every source of audible lag on the performance laptop has been eliminated.

## Live audio timing

`SynthEngine.noteOn` previously defaulted to `Tone.now()`, the scheduler clock including look-ahead. Physical note release, pedal release and panic used that clock too. The drop scheduler can raise global look-ahead to 200 ms to protect backing playback, so these live calls could inherit that delay.

Physical synth attacks, releases, pedal-up and panic now use `Tone.immediate()`. Calls with explicit scheduled times retain exactly those times. `triggerLoopNote`, the backing scheduler, sample assets, instrument settings, musical envelopes, transport, mappings, countdown and arrangement are unchanged. Existing live chord and drum routes already use immediate audio time and retain it.

## Drawing and UI

- The decorative record targets approximately 30 Hz instead of 60 Hz. Sustained expensive frames lower it further to approximately 20 Hz, with recovery to the normal target. This does not throttle physical key callbacks or audio scheduling.
- Record backing pixels are capped near 900,000 instead of 1.6 million; the separate piano, controls and labels retain their resolution.
- The slow full-stage atmospheric gradients/dust render into one reusable surface capped near 600,000 pixels, refreshed at most once per 150 ms. The main frame uses a blit between refreshes; note bars continue to update independently. Resize, rehearsal clock resets, hidden tabs, failure and cleanup are handled.
- All 144 record spectrum spokes retain their original positions and sample-derived lengths. Shared color/width and nearby opacity values are batched, reducing spectrum stroke submissions from 288 to at most 40 per frame. The art, grooves, palette, geometry and musical waveform source remain.
- Roses transport/drum status updates use interruptible React transitions. The transport-driven album-reveal store updates synchronously before the cosmetic UI update, preserving its bar-5 trigger.

## Validation

New tests distinguish the immediate audio clock from a scheduler with 200 ms look-ahead; cover keydown, keyup, sustain, panic and unchanged explicit backing times; verify all 144 spectrum endpoints; and check atmosphere reuse, bounded buffer size, resize/reset, failure latching and cleanup. Existing Roses drum/chord, hidden reveal, transport and Interstellar checks are included in the full suite.

Audible/browser rehearsal and hardware CPU/GPU/frame-time profiling were not performed. Reload the local app and check live L/;/′ synth notes, Z/X/C drums, P/O/I chords, overlapping notes with pedal, Start/countdown, bar-5 reveal, buildup/drop and reset. Any remaining audible lag should be narrowed to the affected instrument and whether it occurs before Start, during backing playback, or both.

Nothing was deployed or published.

## Follow-up: combined load and opening-note pitch report

The dedicated Roses L / ; / ' override now runs before the opening-typing override, and the latter applies only to Levels. Previously a still-active typing reveal could cause these keys to fall back to whichever keyboard map was currently installed. With a stale Levels E-major map, L maps to E6 (88), while the dedicated Roses note is E4 (64). This is a demonstrated routing failure case, not confirmation that it explains every audible pitch change reported on the laptop. Leaving the typing reveal via song selection also finishes that reveal so a delayed completion cannot carry its pitch policy into Roses.

Regression tests hold the previous Levels map and opening flag in place, vary Shift/transpose, and defer UI frames by 250 ms across 60 physical attacks. Dedicated pitches and key releases stay exact; the existing immediate live-synth clock remains unchanged.

The hidden legacy performance controls panel now mounts only in operator setup, avoiding its updates during the normal audience show. The Roses stage canvas is capped near 1.8 million pixels and the record near 600,000 pixels. Dense input or expensive rendering disables the record's blur passes; the artwork, rings and all 144 spectrum endpoints remain identical. The rising-note renderer also uses the existing frame budget for Roses. Unchanged title/palette/drop CSS variables are no longer written each frame. These are reductions in rendering and UI work; transport timing, synth timbre, envelopes, audio effects and arrangement remain unchanged.

Live laptop profiling and an audible rehearsal are still needed to confirm the reported symptom is resolved.

## Follow-up: higher sound before the first four intended notes

The refined report describes a higher precursor before the correct L–apostrophe / L–semicolon pairs, rather than a permanently wrong mapped pitch. The installed Tone `Monophonic.triggerAttack` calls `_triggerEnvelopeAttack` before `setNote`. A cold synth attack can therefore open its envelope/start oscillators while still carrying its default or preceding frequency, before the requested frequency is assigned. This is a scheduling-order risk when oscillator startup takes long enough for the audio thread to render between those operations.

`PitchFirstSynth` keeps Tone's existing Synth options and envelope implementation, but sets the requested note while silent and then calls the same envelope attack at the original timestamp. The Roses live and loop synths use this voice; sampled instruments and other scene engines are unchanged. No extra notes, warm-up sounds, effects or attack delays were added.

Tests invoke the installed native Tone attack method and the corrected method against an audio-thread probe to demonstrate the old-pitch versus requested-pitch ordering. They cover all four E4 / G-sharp4 / E4 / F-sharp4 initial attacks, a reused voice and exact scheduled timestamps. This confirms the software order; listening on the performance laptop is still required to confirm the reported precursor is gone.

## Follow-up: precursor occurs only after loading

The user confirmed that the pitch-first change alone did not resolve the sound, and that it occurs only on the first phrase after loading. Pitch assignment order is therefore not an established explanation of the audible symptom. The preceding probe tested method order, not rendered audio.

Cold voices now start their native oscillator sources while the amplitude envelope is still closed. After source creation completes, the voice rereads the audio clock and opens the unchanged envelope at the later of the requested timestamp and two render quanta beyond that clock (about 5.8 ms at 44.1 kHz). This avoids opening an envelope against an already-past timestamp during potentially expensive first source creation and allows connected pitch signals to settle. Reused voices retain their immediate attack timing; future score timestamps remain exact when source creation completes before that deadline. Zero-sustain presets stop relative to the adjusted attack. No warm-up notes, preset changes, or global transport look-ahead were introduced.

The updated tests simulate a 40 ms main-thread stall inside native source creation and check that the envelope remains closed until creation and signal settling finish. They cover four separate cold voices, reused voices, future scheduled notes, default velocity and zero-sustain cleanup. These verify scheduling, not the resulting audible waveform. A fresh-load laptop rehearsal remains necessary to determine whether this addresses the reported sound.

## Current correction: initialize the detune spread immediately

The user reported that the delayed-envelope attempt made the octave precursor longer/more apparent. That entire attack override and its added delay have been removed. The normal Tone envelope implementation and requested attack timestamp are restored.

The installed `FatOscillator.spread` setter assigns each child oscillator's `detune.value`. The installed `Param.value` setter schedules that assignment at `context.now()`, which includes scheduler look-ahead. New voices therefore initially have no spread; Roses uses two saws with phases 0 and 180 degrees. Tone's actual Fourier coefficients demonstrate that this zero-spread pair cancels the fundamental while retaining the second harmonic. That condition ends when the delayed ±12-cent detuning applies, while reused voices already have their spread applied. This is a concrete mechanism for a transient octave on newly allocated voices.

`PitchFirstSynth` now constructs each voice synchronously with zero look-ahead, restoring the original context look-ahead and ticker interval in `finally` before returning. Initial detune values apply at audio time. No asynchronous work or note scheduling occurs within this scope. Live attacks and explicit backing timestamps retain their existing timing, presets and effects. This avoids both a warm-up phrase and a delayed attack.

Six targeted tests exercise the installed spread/parameter setters and Fourier coefficient generator, verify immediate spread initialization for four independent voices, preserve attack timestamps and check clock/ticker restoration even on construction failure. These establish the library timing defect and mathematical octave mechanism; they do not replace a fresh-load listening check on the user's laptop. Browser connection was unavailable for that check.

## Current follow-up: crackling during playing

The user subsequently reported crackling throughout playing. The previous constructor changed the shared context's look-ahead twice and ticker update interval three times per newly allocated voice. Tone's actual look-ahead setter forwards interval changes to the worker, so restoring the original numeric values still caused worker messages during key handling. This was an unintended side effect of the previous fix; it is not proof that it accounts for all audible crackling.

Voice initialization now receives a private forwarding context whose `now()` uses audio time only while that voice is being constructed. Once construction returns (or throws), it follows the normal shared scheduler clock. Native context methods remain bound to the original context and cached, so audio nodes still belong to the same underlying AudioContext. The shared look-ahead, ticker interval and worker are never changed by voice initialization. Immediate spread initialization, the preset, envelope, effects and score timestamps remain intact. No limiter, gain reduction or arbitrary timbre change has been added without evidence of clipping.

Regression coverage now checks 24 repeated successful/failed allocations with zero shared clock writes, immediate spread assignment during construction, regular clock forwarding afterward and correctly bound native context methods. A laptop listening check after a full reload is still needed; software tests alone cannot confirm that crackling has stopped.
