# Loud Future Bass Synth Stabs analysis

Source: `chord-future-bass-type-loud-synth-stabs_75bpm_C_major.wav` (user supplied, 44.1 kHz, stereo, 16-bit PCM, 16.025 seconds).

## Hit boundaries and harmony

Strong new attacks occur at approximately 0.00, 0.80, 1.40, 1.80, 2.40, 3.20, 4.00, 4.60, 5.00, 5.60, 6.40, 7.20, 7.80, 8.20, 8.80, 9.60, 10.40, 11.00, 11.40, and 12.00 seconds. These are separated by short gaps but their stereo tails overlap. The 0.00 second hit has clear A3, C4, and E4 fundamentals; it is an A minor triad. The 3.20–6.40 region adds F3 and A3/C4/E4, consistent with F major seventh. The 6.40–9.60 region has G/B/D and an E tone; the exact extension changes or is obscured by tails. The later region also carries added tones. Those later hits are unsuitable as clean isolated major triads or single-note samples.

The first hit was trimmed at 0.785 seconds, just before the next attack, with a 50 ms end fade to prevent a click. Its original attack and stereo waveform were retained. This is the asset `public/roses/chords/loud-stabs-am-hit.wav`. A separate 120 ms high-pass excerpt of the same attack, `loud-stabs-air-hit.wav`, supplies the recorded bright transient on keys 1 and 2 without introducing audible A minor fundamentals. The remaining tail after 0.785 seconds cannot be isolated from the next hit without source separation.

## Envelope and spectrum

The first attack reaches a substantial level within roughly 20–30 ms; the body stays strong through about 0.65 seconds, then falls sharply around 0.68–0.72 seconds. Subsequent hits have different hold lengths (roughly 0.25–0.7 seconds), so there is no single fixed release in the recording. The final tail continues from the last hit at 12.0 seconds to about 13.7 seconds at low level. The peak of the complete WAV is about 0.993 full scale.

The first hit has strong fundamentals around 220, 261, and 330 Hz, plus abundant upper harmonics (notably near 440, 522, 660, 990, and 1320 Hz). The stereo body is wide: left/right correlation is about 0.03–0.15 during the first 0.05–0.65 seconds, with side energy roughly 0.86–0.98 times mid energy. The late tail becomes even more side heavy and diffuse, consistent with stereo modulation and reverb. There is no clear evidence of a separate kick, root bass, or timed sidechain pumping in this clip.

At 120 ms, the E4 fundamental's first eight harmonic magnitudes are approximately `[1, .22, .39, .29, .22, .26, .11, .12]` (windowed FFT, rounded). Some partials overlap with the other chord tones, so these are a timbre guide rather than isolated single-note measurements. `scripts/generate-loud-stab-loops.py` renders stereo, chord-accurate held-body WAVs from those partials. The 0.08–0.88-second region loops without a seam while the physical key remains down.

## Implementation and limits

- Physical key 3 is F4–A♭4–C5–E♭5. The recorded A minor triad is raised eight semitones to provide its F minor attack. A separate rendered loop supplies the E♭ seventh and a stable held body. The relatively large playback-rate shift shortens the recorded attack, but the loop keeps the chord audible until keyup.
- Physical key 1 is D♭4–F4–A♭4–E♭5 (D♭add9), and key 2 is E♭4–G4–B♭4–E♭5. Neither exact harmony occurs as an isolated source hit. They use the source's high-frequency recorded attack plus stereo loops synthesized from the analyzed partials at their exact MIDI pitches. All three keys now share the same attack/body gain contour and release behavior. No whole-chord major sample is misrepresented as a minor or add9 chord.
- The Sandbox A/B uses the same A3–C4–E4 triad and register on both sides. A is the extracted recording with gain only; B is the playable sample plus a rendered held body at its original pitch. The buttons compare the source character and processing, while physical key 3 separately exposes the eight semitone shift.

This hybrid preserves exact configured harmony, but it cannot perfectly recreate the recording's oscillator modulation, stereo effects, and reverb for the unsampled major/add9 chords. The A/B is provided for listening judgment; code and numerical analysis alone do not establish a perceptual match.

Headless Chrome check after the attack/body balance correction: at 200 ms, RMS was 0.152/0.151/0.153 for keys 1/2/3; after 1.3 seconds held, 0.113/0.109/0.106. Each voice reached silence after the 900 ms release. These measurements verify output and level, not subjective timbre matching.
