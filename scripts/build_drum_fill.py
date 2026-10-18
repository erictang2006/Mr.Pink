"""Build a short sample-based fill from the checked-in CC0 snare and hat WAVs."""
from array import array
from pathlib import Path
import math
import sys
import wave

ROOT = Path(__file__).resolve().parents[1] / "public" / "drums"
RATE = 44100


def read_mono(name):
    with wave.open(str(ROOT / name), "rb") as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, RATE):
            raise ValueError(f"Unexpected format: {name}")
        data = array("h")
        data.frombytes(wav.readframes(wav.getnframes()))
        if sys.byteorder != "little":
            data.byteswap()
        return [value / 32768 for value in data]


snare = read_mono("snare.wav")
hat = read_mono("hat.wav")
kick = read_mono("kick.wav")
output = [0.0] * int(RATE * 1.05)


def layer(sound, seconds, gain):
    offset = round(seconds * RATE)
    for index, sample in enumerate(sound):
        if offset + index >= len(output):
            break
        output[offset + index] += gain * sample


layer(kick, 0, 0.38)
for when, gain in [(0, .42), (.235, .46), (.353, .52), (.47, .57), (.588, .62), (.706, .72)]:
    layer(snare, when, gain)
for index in range(8):
    layer(hat, index * .1175, .16 + index * .018)

pcm = array("h", (round(max(-1, min(1, math.tanh(value * 1.1))) * 32767) for value in output))
if sys.byteorder != "little":
    pcm.byteswap()
with wave.open(str(ROOT / "fill.wav"), "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(pcm.tobytes())
