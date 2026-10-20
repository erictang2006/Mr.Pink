# Here With Me vocal experiment

This temporarily replaces the **Closer vocal overlay only**. Per the latest instruction, entry is automatic when **Roses + Here With Me** is enabled. There is no manual arming step. The separate Roses vocal cue, all chord instruments and mappings, guitar/bass backing, live drums, and visual designs retain their existing behavior.

## Rehearse

For a short audition with backing, use **Start bar 25 + backing + lead** in Timed Practice. This explicit action starts at 100 BPM with guitar/build bass prepared for bars 25–28 and **Buildup 29–36** armed for the next section. Here With Me keeps its selected automatic entrance (default 27:1&). V synth and N bass/sub belong to the earlier bars 5–20, and F6 Build belongs to 21–28; they do not arm the separate bar-29 buildup. The same explicit action also arms the drop lead for bar 37; Disarm lead can cancel that layer independently. Ordinary Jump/Start keeps its existing manual layer setup.

1. Select Roses, enable audio, and open **Timed** Practice.
2. Choose **No loop**, jump to **Bar 27**, then press **Start**.
3. In the vocal panel, leave **Roses + Here With Me** selected.
4. Default lyric entry is **bar 27, beat 1& = 62.70 s** on the full performance timeline. Bar 27 begins at 62.40 s.
5. **Entrance offset** adjusts the lyric cue by ±1000 ms in 10 ms steps: negative is earlier, positive is later. **Reset timing** restores bar 27, beat 1& and zero offset. Change timing before entry or restart to audition it; changing the offset does not restart a playing vocal.

The same compact vocal panel is available in fullscreen Performance Mode. Start the performance before the selected cue. A seek after the cue reports MISSED rather than playing an unrelated section. After bar 28, the same transport and visual/audible metronome continue counting bars 29, 30, and beyond. Recorded audio finishes naturally; no additional scored notes or vocal loops are invented. **Pause** holds the transport and recorded vocal/guitar clips; **Resume** continues their offsets. Both controls are available in Performance Mode as well as Timed Practice. Active practice loops still repeat their selected range.

## Source and alignment

- Source: `/Users/erictang/1_Here With Me - Marshmello,CHVRCHES - US-UK_(Vocals).wav`.
- Marked onset of the requested “I need you here with me” hook: **34.100 s**.
- Excerpt: **33.980–76.000 s**, including a **120 ms natural pickup** before the marked “I” onset. That preserves the soft onset/preceding consonant transition instead of cutting into the first syllable.
- Playback starts at performance **62.580 s**; the marked lyric onset lands at **62.700 s**.
- Asset: `public/roses/here_with_me_chorus_original.wav`, 44.1 kHz stereo, 16-bit PCM, 42.02 s.
- Processing: PCM-exact trim only. **No pitch shift, resampling, time stretching, gain normalization, or real-time vocal processing. Playback rate remains 1.**

The hook was identified with a previously cached, entirely local faster-whisper base.en model. Full-section and cropped word recognition were checked against waveform energy. Word boundaries are annotations, not sample-perfect linguistic ground truth; the selected onset has an estimated ±50 ms uncertainty. The entrance offset remains available for auditioning by ear.

Repeated hook energy patterns are approximately 19.2 s apart (eight bars at 100 BPM), and the 0.60 s pulse correlation exceeds nearby tempo candidates. This supports trying the original phrasing at 100 BPM without tempo adjustment. It does not prove every sung onset lies exactly on the beat.

## Configuration and rollback

The runtime still uses the established `RosesCloserEngine` overlay path to keep the change narrow. Its loaded source now points only to Here With Me; the old Closer WAV remains archived locally and is never started alongside it. Vocal UI labels now say Here With Me; the unrelated **Closer chord** instrument names remain unchanged.

Preferences are isolated in `stage-piano-roses-here-with-me-v2`. Old Closer preferences in `stage-piano-roses-closer-v2` are preserved. The initial mix is copied, but timing starts at the requested 27:1& with zero offset. The prior Here With Me v1 preferences are also preserved, while v2 initializes the corrected 27:1& cue. The old source metadata is retained in `docs/roses-reference/closer_chorus_alignment.json`; the new source/extraction hashes and timing are in `here_with_me_alignment.json`.

## Verification

- Build includes TypeScript checking; focused vocal tests verify 62.70 s onset, pickup scheduling, adjustable offsets, one-shot entry, raw PCM hashes, mute/unmute without retriggering, pause/resume, late seeks, and continuation past the section boundary.
- Local Chrome checks load the actual new WAV, start from bar 27, verify automatic single entry in Practice and Performance, exercise saved offset changes, and verify continuing audio/metronome beyond bar 28 plus Pause/Resume. Current results are in `here_with_me_continuous_verification.json`.
- The application never loads the old Closer chorus asset during the test. Other musical assets and instrument code are not edited by this experiment.

Nothing is uploaded, pushed, deployed, or published.
