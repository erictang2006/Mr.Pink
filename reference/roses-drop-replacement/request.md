# Codex — replace ONLY the sound of the existing Roses drop in Mr Pink

## Context / non-negotiable scope

My Mr Pink project **already has a working Roses drop**. I do **not** want you to add a new drop, create a new selectable song section, move any bars, or change the performance arrangement. The task is **strictly an audio/timbre replacement for the instrumental sound of the Roses drop that already plays in the app**.

I've provided the `Roses_Punchy_Echo_Revision_Codex_Pack` assets (the pack folder may be named `Roses_Existing_Drop_Replacement_Codex_Pack` when extracted). The sound I approved is **the punchy version with the original G♯ bass**, now with a subtle warm echo/decay after each chord stab.

**Use this file as the exact target replacement sound:**

`previews/roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav`

It is a mastered **instrumental-only** render: 44.1 kHz stereo, 24-bit WAV, 100 BPM, **8 bars / 19.2 seconds**, with the kick, snare, hi-hat, chords, bass, sub, punch and subtle chord decay already in it. It contains **no vocals**.

## What to do

1. **Inspect the current Mr Pink codebase** and locate the **existing Roses drop**: identify the actual drop-start/drop-end events, bar timing, audio source(s), sampler/MIDI triggers, and any separate vocal channel. Do not assume a bar number from an older prompt: use the live project's current structure as the source of truth.
2. **Replace the existing Roses drop's instrumental audio** with the target WAV at the **same existing drop start**, using the project's existing audio preload, routing and synchronized playback machinery. Replace in place; do not schedule an additional parallel drop or expose a new option unless the current app already requires one.
3. **Prevent double playback:** while the new mastered instrumental is active, stop/mute the old Roses drop synths, bass/sub and drop percussion that the WAV already contains. Do not accidentally play the full mix *and* its stems, or the old kick *and* the new kick. Preserve any event signals the UI needs for animations even if their original sound is muted.
4. **Keep any existing vocals as separate audio.** Do not mute/replace the vocal track, bake vocals into the instrumental, modify vocal pitch, or change the vocal start time. Balance the replacement instrumental underneath the existing vocals with minimal necessary gain adjustment.
5. **Keep the current drop duration, transition boundaries, and tempo mapping exactly as they are.** The supplied WAV is 8 bars at 100 BPM. If that matches the existing drop slot, use it 1:1 with no stretch or pitch-shift. If the current drop repeats, use the app's existing bar-aligned repeat/loop behavior. If the timings don't match, inspect and explain the mismatch instead of silently altering the global arrangement or BPM.
6. Preserve **everything outside that existing Roses drop**: Roses intro/buildup or other Roses portions, Here With Me material, other music, stage transitions, piano-key mappings, keyboard visuals, cue timing, and all unrelated application behavior. **Do not rewrite the set list, change bars 29–36 or 37–44 on the basis of the old prompt, or make Here With Me the new default.**

## Sound characteristics to preserve

- Bass note sequence from the source MIDI: **C♯ → G♯ → E**. The second bass note stays **G♯, not A**. Do not transpose notes or swap octaves.
- A **heavy, tight pop** on the attack of each chord stab, with rich low mids and controlled brightness; avoid the earlier thin/glassy and springy/bouncy synth versions.
- A **small, warm, short stereo echo/reverb tail behind the chord**. The kick, bass and sub stay clean/dry. No obvious rhythmic double-hit.
- Target the **finished WAV**, not the older heavy/balanced, dry or brighter previews.

The `stems/`, `samples/`, MIDI and `render_echo_from_stems.py` are available **for debugging or future adjustment only**. Do **not** rebuild the synth or resynthesize the notes in the app if the supplied finished WAV can be played reliably. Do not layer wet-only ambience on top of the finished WAV; the default render already includes it.

## Acceptance criteria

- When Roses reaches its **existing drop**, I hear the new punchy **G♯ + subtle echo** instrumental at precisely the previous drop time.
- The old drop instrumental does **not** play underneath it; drums aren't doubled; there's no unexpected clip, pop at the boundary, or echo tail intruding into the next section.
- Existing vocals, the rest of the mashup and all stage/piano visuals behave exactly as before.
- **No new section, option, button, or bar changes.** This is a replacement, not an addition.

After implementing, summarize **which existing source/routing you replaced**, which file was installed, and whether the exact 8-bar / 100-BPM alignment was confirmed. Do not make unrelated changes.
