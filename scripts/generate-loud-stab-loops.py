"""Render MIDI-exact held chord bodies from the measured Loud Stabs partials.

These are synthesized assets, not isolated note samples from the source recording.
The 0.08–0.88 s region is periodic and safe to loop while a key is held.
"""
from pathlib import Path
import math
import struct
import wave

SAMPLE_RATE = 44100
SECONDS = .96
LOOP_SECONDS = .8
PARTIALS = (1, .22, .39, .29, .22, .26, .11, .12)
CHORDS = {
    "loud-stabs-am-loop.wav": (57, 60, 64),
    "loud-stabs-dbadd9-loop.wav": (61, 65, 68, 75),
    "loud-stabs-eb-loop.wav": (63, 67, 70, 75),
    "loud-stabs-fm7-loop.wav": (65, 68, 72, 75),
}
OUT = Path(__file__).resolve().parents[1] / "public/roses/chords"
OUT.mkdir(parents=True, exist_ok=True)

for filename, notes in CHORDS.items():
    channels = [[], []]
    oscillators = []
    for index, midi in enumerate(notes):
        base = 440 * 2 ** ((midi - 69) / 12)
        weight = .9 if index == 3 else 1
        for channel in (0, 1):
            detune = -4.5 if channel == 0 else 4.5
            frequency = base * 2 ** (detune / 1200)
            # Integer cycles in the 800 ms loop keep its seam click-free.
            frequency = round(frequency * LOOP_SECONDS) / LOOP_SECONDS
            phase = index * 1.13 + channel * .57
            oscillators.append((channel, frequency, phase, weight))
    peak = 0
    for i in range(round(SAMPLE_RATE * SECONDS)):
        t = i / SAMPLE_RATE
        attack = min(1, t / .012)
        brightness = 1 + .17 * max(0, 1 - t / .08)
        values = [0., 0.]
        for channel, frequency, phase, weight in oscillators:
            fundamental = 2 * math.pi * frequency * t
            values[channel] += weight * sum(
                amplitude * math.sin(h * fundamental + phase + h * .21)
                for h, amplitude in enumerate(PARTIALS, 1)
            )
        for channel in (0, 1):
            sample = values[channel] * attack * brightness
            channels[channel].append(sample)
            peak = max(peak, abs(sample))
    scale = .72 / peak
    interleaved = bytearray()
    for left, right in zip(*channels):
        interleaved += struct.pack('<hh', round(left * scale * 32767), round(right * scale * 32767))
    with wave.open(str(OUT / filename), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(interleaved)
    print(filename, f'peak={.72:.2f}', f'duration={SECONDS:.2f}s')
