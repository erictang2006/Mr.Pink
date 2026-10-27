#!/usr/bin/env python3
"""Local WAV replacement for the third drop option; optional numpy/scipy QA deps.
Usage: python scripts/prepare-roses-official-instrumental.py /path/to/source.wav
No resampling, normalization, pitch/tempo change, EQ or compression.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import wave

import numpy as np
from scipy import signal
from scipy.io import wavfile

root = Path(__file__).resolve().parents[1]
reference = root / 'reference/roses-original-recording'
reference.mkdir(parents=True, exist_ok=True)
source = Path(sys.argv[1]).resolve()
rate, raw = wavfile.read(source)
assert rate == 44100 and raw.dtype == np.int16 and raw.ndim == 2 and raw.shape[1] == 2
x = raw.astype(np.float64) / 32768
mono = x.mean(axis=1)


def template(filename):
    sr, a = wavfile.read(root / 'public/roses' / filename)
    a = a.astype(np.float64) / 2 ** (a.dtype.itemsize * 8 - 1)
    if a.ndim == 2:
        a = a.mean(axis=1)
    assert sr == rate
    return a[:round(.18 * rate)]


def correlations(t, lo, hi):
    first = round(lo * rate)
    a = mono[first:round(hi * rate) + len(t)]
    cross = signal.correlate(a, t, mode='valid', method='fft')
    power = signal.convolve(a * a, np.ones(len(t)), mode='valid', method='fft')
    return first, cross / np.sqrt(np.maximum(1e-14, power) * np.sum(t * t))


kick = template('Roses Kick.wav')
clap = template('Roses SnareClap.wav')
entrances = []
# The full-song energy survey identifies the main transitions following the
# quiet measures around 84 and 180 s. These are independent of the old MOV trim.
for lo, hi in [(84, 88), (180, 184)]:
    first, corr = correlations(kick, lo, hi)
    peaks, _ = signal.find_peaks(corr, height=.85, distance=round(.3 * rate))
    assert len(peaks)
    frame = int(first + peaks[0])
    entrances.append({'frame': frame, 'seconds': frame / rate,
                      'kickTemplateCorrelation': float(corr[peaks[0]])})
first = entrances[0]['frame']
start = first / rate
claps = []
for i in range(16):
    target = start + .6 + i * 1.2
    lo, corr = correlations(clap, target - .02, target + .02)
    peak = int(np.argmax(corr))
    claps.append((lo + peak) / rate)
slope, intercept = np.polyfit(np.arange(16), claps, 1)
bpm = float(120 / slope)
residual = float(np.max(np.abs(np.asarray(claps) - (intercept + slope * np.arange(16)))))
assert abs(bpm - 100) < .01 and residual < .001
assert entrances[1]['frame'] - first == round(96 * rate)

output = root / 'public/roses/drop/roses-original-recording-8bars-100bpm.wav'
analysis_path = reference / 'analysis.json'
if analysis_path.exists():
    old = json.loads(analysis_path.read_text())
    if old.get('source', '').endswith('.mov'):
        shutil.copy2(analysis_path, reference / 'analysis-mov.json')
        shutil.copy2(output, reference / 'mov-drop-8bars-100bpm.wav')
saved_source = reference / 'official-instrumental-source.wav'
if source != saved_source:
    shutil.copy2(source, saved_source)

frames = round(19.2 * rate)
original = x[first:first + frames].copy()
audio = original.copy()
assert len(audio) == frames
# Sub-millisecond ramp removes the cut into low-level preceding ambience;
# the recorded kick peak/body remain intact. No separate tail is synthesized.
attack = round(.0005 * rate)
audio[:attack] *= (.5 - .5 * np.cos(np.linspace(0, np.pi, attack)))[:, None]
fade = round(.01 * rate)
audio[-fade:] *= (.5 + .5 * np.cos(np.linspace(0, np.pi, fade)))[:, None]
integers = np.rint(audio * 8388608).astype('<i4').reshape(-1)
packed = integers.view(np.uint8).reshape(-1, 4)[:, :3].copy().tobytes()
with wave.open(str(output), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(3)
    w.setframerate(rate)
    w.writeframes(packed)
hop = round(.05 * rate)
levels = np.sqrt(np.mean(audio.reshape(-1, hop, 2) ** 2, axis=(1, 2)))
visual = np.clip(levels / np.percentile(levels, 95), 0, 1)
(root / 'src/piano/rosesRecordedEnvelope.json').write_text(json.dumps({
    'hopSeconds': .05, 'levels': [round(float(v), 4) for v in visual]
}, separators=(',', ':')) + '\n')

def db_peak(a):
    return float(20 * np.log10(np.max(np.abs(a))))


def db_rms(a):
    return float(10 * np.log10(np.mean(a * a)))


old_rate, old_raw = wavfile.read(reference / 'mov-drop-8bars-100bpm.wav')
old_audio = old_raw.astype(np.float64) / 2 ** (old_raw.dtype.itemsize * 8 - 1)
speech_path = Path('/private/tmp/mr-pink-official-vocal-check.json')
speech = json.loads(speech_path.read_text()) if speech_path.exists() else None
vocal_rate, vocal_raw = wavfile.read(root / 'public/roses/roses_vocals_original_timeline.wav')
assert vocal_rate == rate
vocal = vocal_raw[first:first + frames].astype(np.float64).mean(axis=1) / 32768
speech_filter = signal.butter(4, [300, 3500], btype='bandpass', fs=rate, output='sos')
vocal_coherence = float(np.corrcoef(signal.sosfilt(speech_filter, original.mean(axis=1)), signal.sosfilt(speech_filter, vocal))[0, 1])
meta = {
    'source': str(source), 'storedSource': str(saved_source.relative_to(root)),
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sourceAudioSeconds': len(raw) / rate, 'sourceSampleRate': rate,
    'sourceChannels': 2, 'sourceBitsPerSample': 16,
    'sourceLeadingSilenceAboveMinus60DbSeconds': float(np.flatnonzero(np.max(np.abs(x), axis=1) > .001)[0] / rate),
    'method': 'Full-song energy survey; first high-confidence kick-template match following each main pre-drop break. Independently fit sixteen clap attacks to the 100 BPM grid at native sample rate.',
    'mainDropEntrances': entrances,
    'inPointFrame': first, 'inPointSeconds': start,
    'outPointFrame': first + frames, 'outPointSeconds': (first + frames) / rate,
    'clapOnsetsSeconds': claps, 'measuredBpm': bpm,
    'maxTimingResidualSeconds': residual,
    'clapGridOffsetFromKickSeconds': float(intercept - start - .6),
    'precedingPickup': 'Pre-drop snap/build sounds precede the first drop kick and are excluded; low-level ambience at the cut receives a 0.5 ms safety ramp.',
    'output': str(output.relative_to(root)),
    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'frames': frames, 'sampleRate': rate, 'channels': 2, 'bitsPerSample': 24,
    'seconds': frames / rate, 'separateReleaseTailSeconds': 0,
    'bpm': 100, 'playbackRate': 1, 'pitchShiftSemitones': 0,
    'normalization': False, 'eq': False, 'compression': False,
    'startRampSamples': attack, 'startRampSeconds': attack / rate,
    'endFadeSeconds': fade / rate,
    'peakDbfs': db_peak(audio), 'rmsDbfs': db_rms(audio),
    'sourceFullScaleSamplesInExtract': int(np.sum((original >= 32767/32768) | (original <= -1))),
    'bodyDifferenceFromSource': float(np.max(np.abs(original[attack:-fade] - audio[attack:-fade]))),
    'previousMov': {'inPointSeconds': 2.1425, 'sampleRate': old_rate,
                    'peakDbfs': db_peak(old_audio), 'rmsDbfs': db_rms(old_audio)},
    'rmsDifferenceVsMovDb': db_rms(audio) - db_rms(old_audio),
    'vocalResidue': {
        'localSpeechRecognition': speech,
        'assessment': 'No reliable sung lyric was recognized. Generic low-confidence recognition from both repeated drops is not reliable evidence of speech. Intentional vocal-like/chopped textures and faint separation remnants cannot be certified absent without human listening.',
        'speechBandCorrelationWithSeparateVocalStem': vocal_coherence,
        'correlationLimitation': 'Shared musical material or bleed in either separated stem can produce coherence; this does not prove audible sung-vocal leakage.',
        'humanListeningVerified': False,
    },
    'limitations': 'Supplied source already touches digital full scale; preparation preserves its level and does not repair pre-existing clipped peaks. No browser/device listening was available. No additional vocal masking or audio processing was applied.',
}
analysis_path.write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps(meta, indent=2))
