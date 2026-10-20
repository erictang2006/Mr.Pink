# Here With Me combined lead over Roses — bars 37–52

## Verified source (not guessed)
- Original lead source: `Here with Me Remake by Energy(1).zip` -> `Remake.flp`.
- FL Studio `Pattern 9` starts at bar 26 in **its original** 100 BPM project and lasts 4 bars (1536 ticks at 96 PPQ). The same source phrase is repeated starting at bar 30.
- Four lead instrument lanes: channel 19 `Lead 1` (Spire) = lower octave, and channels 20, 21, 22 (Sylenth1) = same upper octave MIDI line, different instances. Each has 28 MIDI note events per 4-bar phrase.
- Source bundle has no isolated rendered lead audio. `.mid` files have pitch/timing only and DO NOT recreate proprietary Spire/Sylenth1 sounds. The included mp3 is a **previous synthesized approximation**, not the original FL Studio timbre.

## Target map (Roses arrangement)
- Roses 100 BPM, 4/4, **bar 1 begins at 0.0s**.
- Roses **bar 37 = 86.4s**; bars 37–52 = 38.4s; bar 53 = 124.8s.
- One source phrase lasts exactly 4 bars = **9.6s** (the last source note ends ~9.4375s, leaving a slight gap until next cycle).
- Place the phrase 4 times beginning on Roses bars **37, 41, 45, 49**, end before bar 53.
- Do NOT use the source project bar 26 as Roses bar 26. It is only the start of the four-bar MIDI pattern in the Here With Me remake.
- No transposition, no timing stretch by default. Original pitch/register as extracted.
- Four original lanes x 28 notes x 4 repeats = **448 layer note events** (112 events per layer). The three Sylenth1 lanes have duplicate MIDI notes; do not play three full-gain identical voices if the original timbral differences can't be recreated.

## Contents
- `Here_With_Me_4Layer_Lead_Repeated_16Bars_RELATIVE.mid`: 16-bar, four-lane MIDI starting at MIDI time 0; align its time 0 to Roses bar 37 / 86.4s.
- `roses_37_52_here_with_me_lead_16bar_events.json`: target-absolute note events and metadata, including bar numbers, notes, and durations.
- `roses_37_52_here_with_me_lead_16bar_events.csv`: table format.
- `Bar26_Drop_Melody_All4Layers.mid`: original four-bar source MIDI.
- `Bar26_Higher_Lead_Melody.mid` and `Bar26_Lower_Lead_Melody.mid`: separate primary melody lines.
- `bar26_midi_data.json`: original FL studio pattern MIDI event extraction.
- `4bar_previous_approximate_lead_preview_NOT_ORIGINAL.mp3`: optional four-bar audible demonstration (not original VST sound).

## Suggested Codex implementation
Use the exact event JSON or MIDI, schedule all notes to the existing Tone.Transport at musical bar 37, only when the new layer is armed. Make the lead play for bars 37–52 only; cancel/release active voices on stop/seek/disarm, no orphaned schedules. Prevent duplicate trigger and accidental double start. Add a minimal gain/mute control for the combined lead. Keep the existing Here With Me vocal, Roses drums, bass, previous-bar buildup and chord mappings intact. A synth approximation is permissible as a temporary sound until an authentic Spire/Sylenth1 stem can be rendered.

## Harmonic caution
The original extracted lead's pitches are unchanged. Existing Roses backing in E major may clash with the Here With Me melody (which begins with E-flat / D-sharp). This is **only a lead-placement test**. Do not silently transpose melody or re-harmonize other layers.
