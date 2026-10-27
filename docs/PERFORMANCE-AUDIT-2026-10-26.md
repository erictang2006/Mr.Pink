# Program reliability and load audit — October 26, 2026

Build/type checks pass. Five full suite runs each passed all **402 tests**, with no failures (2,010 test executions). New headless stress checks passed across the real Levels map, all three Interstellar section maps and Roses live chord mappings. This audit does **not** certify live browser or audio hardware performance.

## Coverage and measured results

| Check | Result |
| --- | --- |
| Opening typing, completion/crash, CSA choreography, replay/fallback and input quarantine | Existing automated suite passes |
| Levels score, physical mapping, drum/transition state and warp handoff | Existing automated suite passes |
| Interstellar sections, assisted mappings, overlapping voices, physical releases and pedal | Existing automated suite plus added live-clock regression passes |
| Roses live drums/chords/bass, scheduled backing, vocals, countdown and hidden bar-5 reveal | Existing automated suite passes |
| Build, TypeScript and changed-file whitespace | Pass |
| Keyboard stress | 214,500 dispatched simulated events across five mapping cases; 3,000 chord/recovery cycles each |
| Attack/release balance | Every generated attack matched a release; no held voices, input listeners or polling timers remained after disposal |
| State recovery under input stress | Repeat suppression, blur, hidden-document release, transpose, map replacement, enable/disable and disposal pass |
| Particle/live-note soak | Ten **simulated** minutes, 36,000 updates and 48,000 generated notes; busy-mode particle cap stayed at 192; no remaining particles, pulses or sounding-note state after cleanup |
| Local serving | Built HTML, JS, CSS, cover art and selected piano/vocal/drop/Bonk assets returned HTTP 200/206 with expected content types |
| Literal asset references | All 21 recognized literal local references exist; computed paths and user imports excluded |

The stress harness measured JavaScript-only input dispatch at a median 0.0301 ms, p95 0.1006 ms, p99 0.1338 ms and a worst observed 13.8997 ms. These numbers include Node event-dispatch/callback bookkeeping, **not** React painting, browser event delivery, Web Audio rendering or speaker response. They must not be presented as end-to-end musical latency. The ten-minute soak advances a simulated clock rather than running for ten wall-clock minutes.

## Confirmed delay fixed during this audit

The sampled-piano engine used by Levels and Interstellar still scheduled live attacks and releases using `Tone.now()`, which includes transport look-ahead. The same delay had already been corrected in Roses' live synth. Sampled-piano attack, physical release, source release, pedal release and panic now use `Tone.immediate()` instead. The regression test separates the two clocks by 200 ms and verifies that live calls use the immediate clock.

No instrument samples, keyboard assignments, gain/envelope settings, song arrangements or transition durations changed. Scheduled backing APIs retain their explicit timestamps.

Changed/added in this audit: `src/piano/audioEngine.ts`, `tests/piano-audio-budget.test.mjs`, `scripts/audit-performance.mjs`, this report and its JSON results. The temporary localhost preview was stopped after the serving check. Nothing was deployed or published.

## Load considerations

- Interstellar already reduces particles/bloom during dense input and caps the main backing surface near 3.2 million pixels. Its detailed nebula and galaxy are cached.
- Roses already limits the decorative record to a 30 Hz target (lower on expensive draws), caps it near 900,000 pixels, caches slow atmosphere near 600,000 pixels and batches all 144 spectrum spokes.
- Live UI status updates use interruptible React transitions; physical audio callbacks are synchronous. Audio is not queued behind animation frames.
- The build still warns about one approximately **1.60 MB minified / 322 KB gzip** JavaScript chunk. This is a startup/parse concern; it does not establish the cause of lag after loading.
- There are 138 local WAV files totaling approximately **216.54 MiB**. Decoding every WAV simultaneously into float32 would require approximately **314.99 MiB**, excluding other buffers and MP3s. This is a library-wide upper inventory, **not measured application RAM**. The longest original vocal alone represents about 76.30 MiB decoded. Wait for existing audio-ready indicators before performing; no asset or alternate backing choice was removed.
- No lint script is configured. The available build/type checks and test suite were used.

## Remaining stage checks

Browser discovery returned no connected browser, so fullscreen appearance, real frame time, GPU/CPU load, actual browser memory, Web Audio underruns and audible timing were **not measured**. Hardware keyboard rollover and output-device/Bluetooth latency are also outside the headless tests.

For a conclusive live pass on the performance laptop:

1. Reload and wait for audio readiness. Use the intended audio output and projector setup.
2. Rehearse the whole typing → crash → message → CSA → Levels → Interstellar → Roses path, including repeated intro and scene transitions.
3. In each song, test quick single notes, large chords, rapid retriggers, held sustain, pedal-up, blur/Alt-Tab, fullscreen exit/re-entry, panic and reset. Check sounds against illuminated keys.
4. In Roses, compare before-Start freestyle against active backing, then buildup and drop; verify live Z/X/C and P/O/I controls throughout their intended windows.
5. Capture browser frame times, long tasks and audio underruns during the exact passage that still lags. Compare laptop and projector resolutions. Listening is needed to establish end-to-end response.

Re-run automated checks locally:

```sh
npm run build
npm test
node scripts/audit-performance.mjs /private/tmp/mr-pink-audit.json
```

Machine-readable measurements and explicit scope limitations are in `PERFORMANCE-AUDIT-2026-10-26.json`.
