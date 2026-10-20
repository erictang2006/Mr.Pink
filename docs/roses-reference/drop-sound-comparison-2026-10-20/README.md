# Roses drop sound comparison — October 20, 2026

The supplied replacement videos both contain audio. The 11:54:21 AM clip shows the YouTube Ableton remake; the 11:54:43 AM clip shows Mr Pink. The original 11:44 clips had no audio tracks. The complete newly supplied Ableton folder and unchanged ZIP are preserved in `reference/roses-ableton-remake/`.

## Captured difference

Compared equal 7.2-second windows starting at bar 37. The common original clap sample aligns the captures at approximately 1.472 s (original) and 3.529 s (app); repeated claps are 1.2 s apart. Captured audio was extracted with macOS AVFoundation to 48 kHz PCM. Both captures are mono with background noise, so these full-mix comparisons cannot establish isolated instrument EQ, stereo width or the exact native plugin sound.

The visible app mix has Here With Me lead disabled, bass at 100%, Original chords at 81%, and Keys 6–8 disabled. The user confirms drums enabled. The reference also has vocal/effect material not reproduced by those enabled app rows.

After normalizing band power to the total 100 Hz–8 kHz range, the original has about **9.5 dB more relative 4–8 kHz energy** across the beat-aligned windows. The separate noise-floor-corrected active-window calculation gives approximately 11 dB, reinforcing the direction but not an exact corrective EQ amount. The app concentrates more energy below 400 Hz. Its captured average level is about 1 dB higher in the initial active-window comparison; simply raising volume or sub-bass does not address the observed brightness deficit.

Whole-mix crest factors are similar (original about 15.6 dB, app about 16.4 dB). Thus larger raw attack peaks in the original are not established. A brighter transient and stronger rhythmic gain/filter shaping can explain a sharper perceived attack without a higher peak. Decay of a dry synth envelope, reverb decay and Kickstart gain recovery are distinct and should be tuned separately.

Raw measurements, input hashes and analysis windows are in `recording-comparison.json`. These are numerical audio comparisons, not a claim of a by-ear sound-identical reproduction.

## Source-project findings

The supplied Ableton set is byte-identical to the earlier MIDI reference. Tracks 39 and 53 have the same sound-processing setup, with distinct source MIDI:

- Sylenth1 is enabled; embedded state includes **ROSES chords**.
- **CamelCrusher is bypassed.** Its presence in the device list is not evidence of active distortion from that plugin.
- EQ Eight is active. Its A-band settings include a filter around 90 Hz, a −2.36 dB adjustment near 1.04 kHz, and a +0.87 dB high-frequency adjustment near 7.33 kHz.
- Ableton Reverb is active with a 1,200 ms decay value. A parallel effect rack, Multiband Dynamics, Cross Delay, Kickstart, Compressor and FabFilter Pro-Q 2 also appear enabled.
- Multiband Dynamics crosses at approximately 98 Hz and 1.66 kHz, with band input gains of +2.3, +4.6 and +7.1 dB. This precedes its dynamics processing; these are not final output EQ boosts.
- Cross Delay has a dry/wet value around 0.135 and zero feedback. Kickstart is enabled; its exact curve is proprietary plugin state and has not been decoded here.
- Track 45 bass uses Massive and an enabled Saturator, with source PreDrive value approximately 4.57. Our filtered saw/sine bass approximation does not load that Massive preset or recreate this entire chain.

See `ableton-device-settings.json` for directly extracted on/off flags and raw parameters. Device enable flags reflect the stored set; no assertion is made about every automation event or rack-chain audibility.

## Why the current app can be softer/darker

The Original Drop browser synth passes through per-voice low-pass filters and another 2.8 kHz, 24 dB/octave low-pass, followed by a −3 dB high-band EQ setting. The main voice filter envelopes peak around 2.6–3.4 kHz at default settings. These combined filters suppress the harmonics that give a bright chord its bite. Opening only the final filter would leave the earlier voice filters in place.

The synth attack is already about 3 ms; making the attack control smaller is unlikely to be the main fix. The dry release is 850 ms, allowing substantial overlap between short source MIDI hits. The separate punch path is relatively quiet at the default 0.22 setting. The automatic chord-cache renders do not include the source's full multiband/Kickstart chain. The live-key manual-kick duck option does not add that processing to the prepared automatic chord tracks.

Bass is filtered around 820 Hz with restrained distortion. Increasing its volume mostly emphasizes existing lows, whereas the reference's native patch and saturation can contribute more midrange harmonic body.

## Proposed comparison preset

Keep the existing sounds available, and audition a separate brighter/punchier Original-chord variant using the same source MIDI:

1. Open both the per-voice filter-envelope peak and the final low-pass. Initial audition ranges: roughly 5–8 kHz for the attack peaks and 4.5–6 kHz for the final filter. Reduce the broad high-frequency attenuation. These are starting points to test, not measured Sylenth1 settings.
2. Strengthen the brief punch/harmonic attack, then make the dry tail fall away more distinctly. Test a roughly 250–400 ms dry release against the current 850 ms while preserving the source note gates. Add a separately controlled, filtered ambience tail rather than lengthening every dry note.
3. Add tempo-synchronized gain shaping in the spirit of the enabled Kickstart, plus restrained upper-mid harmonic/dynamics processing. This should create separation and recovery between hits without inventing MIDI notes. Do not copy the measured spectral deficit as a large master high-shelf boost.
4. If the bass still lacks weight after fixing chord articulation, add controlled mid-bass harmonics and match its short-note envelope while keeping the clean sub path independent.

Render candidate chord tracks ahead of playback using the existing cache approach. Keep volume/mute/solo controls and all keybindings intact; avoid returning the dense synth stack to real-time playback. Compare the same enabled layers at matched levels. A native Ableton render of the isolated Sylenth1 tracks would be the strongest reference for a closer match; the supplied full mix does not isolate those instruments.

This investigation imports references and documents measured differences. It does not replace the app's current sound presets.
