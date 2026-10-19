# Recorded Loud Stabs chord previews

These are the local masters for the recorded chord hits now connected to physical keys 1–3. The source is [`reference/roses-chord-samples/chord-future-bass-type-loud-synth-stabs_75bpm_C_major.wav`](../../../reference/roses-chord-samples/chord-future-bass-type-loud-synth-stabs_75bpm_C_major.wav), 44.1 kHz stereo PCM. Run `python3 scripts/build-closer-recorded-previews.py` from the project root to rebuild them and the runtime copies in `public/roses/chords/` (requires FFmpeg).

| Key and exact configured MIDI | Source interval and measured chord content | Offline shift | Added matching-timbre note(s) |
| --- | --- | ---: | --- |
| 1 — D♭4 F4 A♭4 E♭5 (`61,65,68,75`) | 6.39–7.19 s, G3 B3 D4 major **core**. The recording also has E/F/C and lower residual content; narrow notch filters reduce those tones before shifting. | +6 semitones | E♭5 (ninth) |
| 2 — E♭4 G4 B♭4 E♭5 (`63,67,70,75`) | 9.59–10.39 s, C4 G4 C5 open fifth/octave **core**. The source has D and lower G content, which is reduced before shifting. It is not a major chord by itself. | +3 semitones | G4 (major third) |
| 3 — F4 A♭4 C5 E♭5 (`65,68,72,75`) | 0.00–0.79 s, A3 C4 E4 minor **core**, with faint lower octave content. | +8 semitones | E♭5 (minor seventh); A♭4 reinforcement because the recorded minor third is quiet after shifting |

The source chords and pitches above are estimates from windowed spectral peaks and harmonic relationships, not separated multitracks. There is no clean isolated pure major triad in the recording. No source chord is treated as an isolated single note, and the C/G hit is not described as major until the G4 note is added after shifting.

In the three selected hits, the recorded amplitude rises from 10% to 90% of its local peak over roughly 10–15 ms. Their last 100 ms are about 17–18 dB quieter than their first 100 ms. Left/right sample correlation is approximately 0.12 (A minor), 0.36 (G core), and 0.30 (C/G core), consistent with the wide recorded sound. These measurements are taken before filtering and pitch shifting.

The main layer in each preview is the full recorded chord hit. FFmpeg shifts pitch with `asetrate` and restores duration approximately with `atempo` overlap/add. Only the added/reinforced notes use additive synthesis, with harmonic weights measured from the recording and an envelope that follows the shifted sample. The finished WAVs are stereo, 44.1 kHz, 16-bit PCM and are loudness matched to about −17.7 dBFS RMS. Peak levels are below −2.5 dBFS.

Each source hit lasts about 0.8 seconds before the next chord attack contaminates its tail. A short fade prevents a click at that boundary. This means the previews preserve the **available recorded decay** but cannot recover a longer isolated reverb tail from this loop. The +8-semitone Fm7 shift may have more stretch artifacts than the shorter shifts.

For a held physical key, a 340 ms loop is made from 0.16–0.55 s of that same finished recording. Its seam has a 50 ms stereo crossfade. The full hit starts immediately, and the recorded body loop fades in from 0.48–0.65 s. Keyup now fades both the hit and loop over the short Closer keyup fade (120 ms by default), so a short tap can end well before the source file's 0.8-second boundary. These runtime assets contain the recorded chord and only the listed complementary notes; no saw-chord loop or Bonk is added to keys 1–3.
