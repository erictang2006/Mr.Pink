# Roses Drop — Punchy + Subtle Echo (Original G♯ Bass)

This revision starts from the **user-approved punchy Version 3A**. Its chord MIDI, bass MIDI (C♯ → G♯ → E), bass/sub timbre, pop transient, kick, snare, hi-hats, sidechain and tempo are unchanged. Only a low-level stereo ambience return is added behind the chord layer. The bass and drums are sent to **zero** reverb/delay.

## Audio previews

- `previews/roses_punchy_Gsharp_subtle_echo_8bars_100bpm.mp3` **RECOMMENDED**: short filtered reflections, a very quiet one-shot stereo echo, and a warm 1.2-second reverb decay; the attack stays dry and punchy.
- `previews/roses_punchy_Gsharp_more_echo_8bars_100bpm.mp3`: same effect times and pitches, but 55% more ambience, for comparison.
- `previews/roses_punchy_dry_Gsharp_reference.wav`: approved Version 3A, unmodified.

Every new mix is 44.1kHz stereo, 19.2 seconds, 8 bars at 100 BPM. MP3s have matching 24-bit WAVs. The final 55ms are faded to zero to avoid a click at the end of the drop slot. Listen to the files in context with your vocals.

## What we actually found in the uploaded project

`Roses Ableton Remake(3).zip` contains `remake 1.als`. On each `Drop Chords` track, the native Reverb has `DecayTime` = **1200ms** and `PreDelay` = **2.5ms**. The native `CrossDelay` has `DryWet` approximately **0.135** (13.5% wet) and `Feedback` = **0**. Its left/right delays are different beat-synced note selections. This tells us the track really uses a spacious reverb + sparse, low-feedback delay. Our audio is an **approximation**: it does not claim to emulate Ableton's exact Reverb impulse response, or map Ableton beat-selection enum values to milliseconds.

## How the effect here works

- Send: **chord_body + 15% chord_pop only** (the original pop stays dry in the master mix).
- Wet EQ: gently high-passed around 230–340Hz and darkened/low-passed around 3kHz; leaves subbass, kick and bass definition alone.
- Early reflections: decorrelated, low-level clusters approx 24–150ms.
- Diffuse late reverb: roughly 1.2s RT60 decay, **low in level** compared with dry.
- Stereo one-shot delay: approximately 146ms left / 215ms right, filtered and softly mixed, **zero feedback**. Avoids obvious rhythmic bouncing.
- The `subtle_echo` mix is designed to keep the existing punch; `more_echo` is only a slightly wetter comparison, not a different note pattern.
- No new chord layers or pitched synth voices. No notes transposed, bass note G♯ retained.

## Stems

`stems/source_Gsharp_*.wav` are bit-for-bit copies of the 7 original Version 3A stems. `stems/subtle_chord_ambience_wet.wav` is the new additive ambience layer. `stems/short_dark_room.wav` and `stems/single_stereo_echo.wav` provide the two components separately, for finer control.

## Reproduce

The shipped `render_echo_from_stems.py` rebuilds both wet versions from the included original G♯ stems. Requires `numpy`, `scipy`, `soundfile` and `ffmpeg` for MP3 conversion. `render_echo_from_stems.py` must be run inside this directory. The wet-level multipliers are 1.0 (recommended) and 1.55 (comparison).

## Important integration rule (existing Roses drop only)

Use `CODEX_PROMPT.md` as the integration source of truth. The app **already contains a Roses drop**: replace its current instrumental sound in place with `previews/roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav`, without introducing an alternative drop section or changing the current performance arrangement. Do not double the WAV with its stems or existing instrument/drum tracks. Vocals stay untouched.
