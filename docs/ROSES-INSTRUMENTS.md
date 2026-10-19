# Roses instrument library

Open **Roses Sandbox** to choose a synth in the Instrument selector. The six bundled synth designs work without sample downloads. Play A and Play B switch the active instrument for the same physical keyboard input; no song notes are played automatically. **Save active as default** selects the instrument when Roses is opened next time. The +4 semitone setting and the existing physical mapping are independent of the instrument.

The instrument selector also includes **Roses Experimental E4 Sample** from the supplied reference pack. It is a processed 0.8-second E4 slice, repitched by Tone.Sampler. It cannot sustain the intro's 2.4-second E4 notes cleanly. The A/B panel includes a manual player for the supplied four-bar remake pad reference; that recording is never used as a live instrument.

The sound controls affect the active synth immediately. Saved synth presets and per-instrument settings use browser local storage. Attack, release, filter, effects, and volume also work for imported samples; decay, sustain, and detune are oscillator controls and therefore apply only to synth presets.

## Import isolated samples

1. Choose one or more WAV, MP3, or OGG files, each containing a single isolated pitched note shorter than eight seconds. A musical loop or chord is unsuitable for a chromatic instrument.
2. Confirm the root note beside each file. The filename is used as a starting guess (for example, `C4.wav`). Give every sample a different root pitch.
3. Preview individual files, name the instrument, then click **Save sampled instrument**. Browser IndexedDB stores the actual files; the instrument selector stores their root pitches. Tone.Sampler repitches the nearest sample for missing pitches.
4. Select the saved instrument and wait for its samples to finish loading before playing. A status message reports load errors.

Browser data is specific to the current browser and origin. Back up the source audio files. Storage quota and private browsing policies can prevent persistence.

## Bundle an instrument with the project

1. Select the browser imported instrument and click **Export project manifest**.
2. Create `public/instruments/<instrument-id>/` where `<instrument-id>` is the ID shown in the exported manifest's `id` field.
3. Copy the original audio files into that folder, retaining their original filenames and case.
4. Place the downloaded manifest somewhere you can access it from the application and choose **Load project manifest**. The manifest's `/instruments/...` URLs then load the bundled files from localhost.

Project bundled samples are served from the same origin and can work offline once the application and assets are cached by the browser or served locally. Loading a project manifest does not copy its audio files into the bundle automatically. The importer does not ship copyrighted audio or contact an external sample host.
