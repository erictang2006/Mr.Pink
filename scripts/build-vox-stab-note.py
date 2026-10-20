"""Extract a single-note Loud Stabs timbre and verify the recorded Vox phrase.

Run with numpy/scipy. The source hit is polyphonic: this harmonic reconstruction
is an approximation, not a clean isolated original instrument stem.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, find_peaks

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/roses/chords/loud-stabs-am-hit.wav'
VOX = ROOT / 'public/roses/buildup/Vox synth.wav'
OUT = ROOT / 'public/roses/buildup/loud-stabs-single-E4.wav'
REPORT = ROOT / 'docs/roses-reference/vox-melody-analysis.json'

rate, pcm = wavfile.read(SOURCE)
audio = pcm.astype(np.float64) / 32768
t = np.arange(len(audio)) / rate
base = 440 * 2 ** ((64 - 69) / 12)
result = np.zeros_like(audio)
lowpass = butter(3, 18, fs=rate, output='sos')
for harmonic in range(1, 17):
    carrier = np.exp(-2j * np.pi * base * harmonic * t)
    # Slow complex envelopes retain measured phase, stereo and modulation.
    envelope = 2 * sosfiltfilt(lowpass, audio * carrier[:, None], axis=0)
    result += (envelope * np.conj(carrier[:, None])).real
result *= np.minimum(1, t / .008)[:, None]
result *= np.minimum(1, (t[-1] - t) / .05)[:, None]
result *= .72 / np.max(np.abs(result))
wavfile.write(OUT, rate, np.round(result * 32767).astype(np.int16))

# The disabled MIDI is cross-reference only, never enabled as a track. Its first
# two clip regions match the audio's attacks after a measured +3-semitone shift.
reference = json.loads((ROOT / 'reference/roses-bars29-36/metadata/ableton_bars29_36_events.json').read_text())
track = next(track for track in reference['tracks'] if track['name'] == 'Vocal synth')
notes = []
for clip in track['clips']:
    for note in clip['notes']:
        if note['absolute_beat'] >= clip['end_beat']:
            continue
        notes.append({'beat': note['absolute_beat'] - 112, 'duration': note['duration_beats'], 'midi': note['midi_pitch'] + 3})
sr, raw = wavfile.read(VOX)
mono = raw.astype(float).mean(axis=1) / 32768
for note in notes:
    # Verify the fundamental in a 90 ms window just after each measured attack.
    at = note['beat'] * .6 + .025
    window = mono[round(at * sr):round((at + .09) * sr)]
    spectrum = np.abs(np.fft.rfft(window * np.hanning(len(window)), 32768))
    frequencies = np.fft.rfftfreq(32768, 1 / sr)
    target = 440 * 2 ** ((note['midi'] - 69) / 12)
    region = np.flatnonzero((frequencies > target * .97) & (frequencies < target * 1.03))
    measured = frequencies[region[np.argmax(spectrum[region])]]
    note['measured_fundamental_hz'] = round(float(measured), 3)
    assert abs(12 * np.log2(measured / target)) < .35
    peaks, _ = find_peaks(spectrum)
    strongest = sorted(peaks, key=lambda k: spectrum[k], reverse=True)[:8]
    assert any(abs(frequencies[k] / target - h) < .04 for k in strongest for h in [1, 2])
notes.sort(key=lambda n: n['beat'])
manifest = {'source_sha256': hashlib.sha256(VOX.read_bytes()).hexdigest(),
            'method': 'Recorded Vox fundamental verification against clip-bounded reference MIDI, shifted +3 semitones to match the actual audio. Note gates use the reference quarter-beat lengths; audio reverb tails are not extra notes.',
            'tempo': 100, 'notes': notes,
            'stab_source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'stab_note_sha256': hashlib.sha256(OUT.read_bytes()).hexdigest(),
            'stab_method': 'E4 harmonic-envelope reconstruction from the recorded A-minor hit. Polyphonic harmonic overlaps make this a timbre approximation, not source separation.'}
REPORT.write_text(json.dumps(manifest, indent=2) + '\n')
runtime = {'notes': [{k: n[k] for k in ['beat', 'duration', 'midi']} for n in notes]}
(ROOT / 'src/piano/voxMelody.json').write_text(json.dumps(runtime, indent=2) + '\n')
print(f'{len(notes)} source-verified notes; wrote {OUT.name}')
