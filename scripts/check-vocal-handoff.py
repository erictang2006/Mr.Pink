"""Optional local QA. Uses scipy/numpy from the existing external audio venv.

Run render-buildup-audition.mjs with QA_VOCAL_TAP=1 QA_MELODY_TAP=1
for starts 1/25/29, then pass BEFORE_DIR AFTER_DIR OUTPUT_DIR here.
The before render is a fully armed bar-1 Original Roses/lead-instrument take.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

before, after, out = map(Path, sys.argv[1:])
out.mkdir(parents=True, exist_ok=True)
rate = 44100


def load(root, prefix, suffix):
    r, x = wavfile.read(root / f"{prefix}-{suffix}.wav")
    assert r == rate
    return x.astype(np.float64) / (32768 if x.dtype == np.int16 else 1)


def region(x, start_bar, first=29, last=37):
    first_frame = round((.05 + (first - start_bar) * 2.4) * rate)
    return x[first_frame:first_frame + round((last - first) * 2.4 * rate)]


def aligned_error(a, b):
    # The native offline Player clamps an immediate bar-29 entry to its first
    # 128-frame render quantum. Separate this known start clamp from cue changes.
    first, last = rate, min(len(a), len(b)) - rate
    probe = a[first:last:8]
    errors = [(float(np.mean((probe - b[first + lag:last + lag:8]) ** 2)), lag)
              for lag in range(-128, 129)]
    error, lag = min(errors)
    return {"nativeAlignmentFrames": lag, "rmsError": error ** .5}


prefix = "bar1-roses-lead"
old = load(before, prefix, "roses-vocal")
new = load(after, prefix, "roses-vocal")
fade_start = .05 + 66.9
fade_end = .05 + 67.2
first, last = math.ceil(fade_start * rate), math.ceil(fade_end * rate)
assert np.array_equal(old[:first], new[:first]), "earlier Roses sung vocal changed"
assert np.max(np.abs(new[last:])) == 0, "Roses vocal leaked beyond its handoff"
times = np.arange(first, last) / rate
expected = old[first:last] * ((fade_end - times) / (fade_end - fade_start))[:, None]
envelope_error = float(np.max(np.abs(new[first:last] - expected)))
assert envelope_error < 2e-6, "fade contains steps/discontinuities instead of a linear ramp"
hwm_before = load(before, prefix, "hwm-vocal")
hwm_after = load(after, prefix, "hwm-vocal")
assert np.array_equal(hwm_before, hwm_after), "Here With Me vocal changed"
melody_before = load(before, prefix, "melody-tap")
melody_after = load(after, prefix, "melody-tap")
assert np.array_equal(melody_before, melody_after), "Vox instrument melody changed"

report = {
    "renderer": "Actual Tone.js/native OfflineAudioContext; no browser/device listening",
    "tempoBpm": 100,
    "rosesSourceOffsetSeconds": 9.6,
    "targetPhraseApproximateSourceSeconds": [64.8, 67.4],
    "phraseAssessment": "Local speech alignment is approximate; the phrase crosses bar 29. Preserve bar 28, fading its final 300 ms to silence at the start of bar 29.",
    "fadeStart": {"beat": 111.5, "seconds": 66.9},
    "fadeEnd": {"beat": 112, "seconds": 67.2},
    "preFadeRosesVocalBitIdentical": True,
    "rosesPeakAfterFade": 0,
    "maximumLinearEnvelopeError": envelope_error,
    "hwmVocalBitIdenticalBeforeAfter": True,
    "voxMelodyBitIdenticalBeforeAfter": True,
    "comparisons": {},
    "assetSha256": {},
}
for file in ["public/roses/roses_vocals_original_timeline.wav", "public/roses/here_with_me_chorus_e_major.wav", "public/roses/aah vocal chop loop 2.wav"]:
    report["assetSha256"][file] = hashlib.sha256(Path(file).read_bytes()).hexdigest()

for mode in ["roses", "hwm-drop"]:
    takes = {}
    for bar in [1, 25, 29]:
        prefix = (f"bar{bar}-" if bar != 25 else "") + f"{mode}-lead"
        metadata = json.loads((after / f"{prefix}-verification.json").read_text())
        roses = load(after, prefix, "roses-vocal")
        hwm = load(after, prefix, "hwm-vocal")
        melody = load(after, prefix, "melody-tap")
        mix = load(after, prefix, "preview")
        assert np.max(np.abs(region(roses, bar))) == 0
        if bar != 1:
            assert np.max(np.abs(roses)) == 0
        assert metadata["originalRosesVocalStreams"] == (1 if bar == 1 else 0)
        assert metadata["voxSynthEvents"] == (120 if mode == "roses" else 0)
        assert metadata["dropEvents"] == 224 and metadata["bar37Attacks"] == 4
        chops = [s for s in metadata["samples"] if "chop loop" in s["url"]]
        assert len(chops) == (5 if mode == "roses" else 0)
        takes[bar] = {"hwm": region(hwm, bar), "melody": melody}
        first_bar = max(25, bar)
        clip = region(mix, bar, first_bar, 37)
        wavfile.write(out / f"{mode}-start{bar}-bars{first_bar}-36.wav", rate, np.round(clip * 32767).astype(np.int16))
        report["comparisons"][f"{mode}-start{bar}"] = {
            "rosesVocalPeakBars29To36": 0,
            "hwmVocal": aligned_error(takes[1]["hwm"], takes[bar]["hwm"]),
            "melodyRmsDb": float(10 * np.log10(np.mean(melody ** 2))),
            "separateRosesChopClips": len(chops),
            "hwmVocalPlayerStarts": [s for s in metadata["samples"] if "here_with_me_chorus" in s["url"]],
        }
        assert report["comparisons"][f"{mode}-start{bar}"]["hwmVocal"]["rmsError"] < .0001

wavfile.write(out / "roses-vocal-before-bars25-28.wav", rate, region(old, 1, 25, 29).astype(np.float32))
wavfile.write(out / "roses-vocal-after-bars25-28.wav", rate, region(new, 1, 25, 29).astype(np.float32))
before_mix = load(before, "bar1-roses-lead", "preview")
wavfile.write(out / "before-start1-bars25-36.wav", rate, np.round(region(before_mix, 1, 25, 37) * 32767).astype(np.int16))
(out / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
