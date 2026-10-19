# Roses keys 1–8 — Bonk + Future Bass

Keys 1–3 additionally have a dedicated [recorded Loud Stabs option](CLOSER-CHORDS.md). Keys 4–8 retain the instrument described below.

## Use

1. Select Roses → Sandbox → **Keys 1–8 · Roses drop synth**.
2. Enable audio. The local Bonk WAV must finish decoding before Roses keyboard input is enabled.
3. **Bonk + Future Bass** is the new default; **Original Drop Synth** selects the previous instrument. The selection applies to Sandbox, Practice, and fullscreen Performance Mode.
4. Adjust **Bonk Level**, **Chord Body**, **Brightness**, **Decay**, **Release**, and **Reverb / Space**. Spacebar remains the manual sustain pedal.

Preferences use `stage-piano-roses-drop-v4`. On first use, the previous mix settings are retained and the new preset is selected, with Bonk 35% and Space 15%. These are independent gain ratios, not percentages of total output power. Default chord body is 100%, decay 600 ms, release 850 ms. Returning to Original Drop Synth restores its existing synthesis, optional triangle bass, and controls.

## Recordings inspected

All four original files are retained under `reference/roses-chord-samples/`. All are 44.1 kHz, stereo, 16-bit PCM. Analysis uses waveform envelopes, short-time spectra, and periodicity; pitch names below describe identified spectral content, not a complete certified transcription of each progression.

| File | Duration | Findings | Runtime use |
| --- | ---: | --- | --- |
| `future-house-synth-bass-bonk_C.wav` | 0.62499 s | Clean single impact, strongest 10 ms RMS at 10–20 ms; RMS falls from ~0.40 to ~0.028 by 300 ms. Strong ~131 Hz and ~391 Hz partials; ~65.2 Hz harmonic spacing and a 676–677 sample repeating period identify C2 as the underlying root. | Direct one-shot sample, downmixed to mono. |
| `chord-future-bass-type-loud-synth-stabs_75bpm_C_major.wav` | 16.02499 s | Repeated chord attacks and a sustained layered body. Opening includes A3/C4/E4, later F/C/E and G/B/D material; the filename does not describe every chord. Multiple independent harmonic families coexist. Full hits can be cropped, but a clean single-note instrument was not recoverable reliably. | Full chord hits are now the main audio for the separate Closer keys 1–3 option; see [analysis](roses-reference/loud-stabs-previews/README.md). |
| `simple-future-bass-chords-stabs-loop_150bpm_E_major.wav` | 6.68735 s | Shorter, more gated hits near 0, 0.6, 1.2, 1.6 s, etc.; energy drops sharply between attacks. Opening E/G♯/B/D♯ content, with later changing harmony. Peaks reach digital full scale in the supplied file. Individual chord hits remain polyphonic. | Timbral/envelope reference only. |
| `future-bass-synth-chords_150bpm_G_major.wav` | 12.93333 s | Wide, dense sustained chord material with repeated attacks and modulation. Opening G/B/D content, subsequent different harmony; no reliably isolated single-note region found. | Stereo/body reference only. |

The Bonk is served from `public/roses/chords/future-house-bonk.wav` (original WAV bytes). It is decoded locally and centered at runtime. Each chord triggers exactly one non-looping buffer source. Its C2 root is repitched to the nearest register of the current chord root: C♯2, D♯2, F2, C♯2, D♯2, A1, B1, C♯2 for keys 1–8. Maximum transposition for these mappings is five semitones; the short recorded decay is never artificially sustained. No third or seventh is imposed by this layer.

The key 4–8 Future Bass body described below remains synthesized. The separate Closer keys 1–3 option now uses extracted full chord recordings with controlled offline pitch shifts and added harmony notes. See [Closer chords](CLOSER-CHORDS.md) for that path.

## Routing and ownership

`KeyboardInputManager.chordOn` → `RosesChordStabEngine.noteOn` → selected chord instrument. The engine still reads every pitch directly from `src/piano/rosesChords.ts`; that file is unchanged.

`RosesFutureBassLayers` combines two panned detuned saw ensembles and a centered band-limited saw body at the **exact existing MIDI notes**. Attack is 4 ms with moderate sustain, curved release, and a slower-closing filter. Chord ambience has its own high/low-pass filtered send, independent of the centered Bonk. Mild saturation and a bounded output stage protect the summed layers before the existing compressor/limiter.

The original chord instrument is never attacked in the Bonk preset, and its bus and optional oscillator bass are muted. Changing preset releases held/deferred voices and fades the old bus out. The selected version alone receives subsequent strikes. The opening synth, backing loops, drums, vocals, other songs, and performance visuals retain their existing routing.

Each body bank has a 24-voice limit (extra voices are refused rather than stealing an audible tail); recorded impacts have a 16-source limit. Natural sample completion disposes its source. Sustain defers counted body releases; it neither loops nor truncates the Bonk. Panic, blur, and instrument/song changes release active ownership. Physical keyup still ends piano glow and note-bar extension independently of audio release.

## Previews and verification

`reference/roses-chord-samples/previews/` contains:

- `bonk-only.wav`
- `body-only.wav`
- `combined.wav`
- `rhythm-100bpm.wav` — beats 1, 3&, 4&, and the following downbeat

The isolated previews use the same key-1 chord, 80 ms hold, 72% master, and production mixer settings. They preserve actual layer balance rather than normalizing each layer to the same peak.

Verification statistics are stored beside the previews. Real Tone/Web Audio renders cover all eight keys, 80 ms taps, a one-second hold, the 100 BPM rhythm, and all eight chords at maximum layer controls. The final stress render stays below full scale, and the completed renders leave no held/deferred body voices or recorded sources. Chrome checks additionally cover actual physical-key events, ignored repeats, visual keyup, sustain, and all three Roses views. Build/type checks and focused chord lifecycle tests are run after changes.

Everything remains local. The supplied reference recordings are not uploaded or published.
