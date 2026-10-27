"""Render original, non-musical cinematic one-shots locally; no runtime synthesis."""
from pathlib import Path
import math, random, struct, wave

RATE = 32000
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'transitions'
ROOT.mkdir(parents=True, exist_ok=True)

def render(name, seconds, seed, kind):
    rng = random.Random(seed)
    frames = int(seconds * RATE)
    out = [0.0] * frames
    low = slow = phase = 0.0
    for i in range(frames):
        t = i / RATE
        u = t / seconds
        noise = rng.uniform(-1, 1)
        low += .14 * (noise - low)
        slow += .012 * (noise - slow)
        if kind == 'tap':
            attack = min(1, t / .0008)
            bottom = max(0, t - .009)
            out[i] = attack * ((noise - low) * .16 + low * .48 + math.sin(math.tau * 230 * t) * .13) * math.exp(-t * 115)
            if bottom > 0:
                out[i] += low * .22 * math.exp(-bottom * 220)
        elif kind == 'form':
            envelope = math.sin(math.pi * min(1, u * .92)) ** 1.7
            phase += (180 + 1100 * u ** 2) / RATE
            out[i] = (low * .34 + slow * .3 + math.sin(phase * math.tau) * .025) * envelope
        elif kind == 'fracture':
            # Energy, center separation (250ms), then outer ring (500ms).
            build = max(0, 1 - t / .3)
            release = max(0, (t - .5) / .9)
            out[i] = slow * .2 * build + low * .1 * math.sin(math.pi * min(1, release)) ** 2
        elif kind == 'reveal':
            out[i] = (low * .25 + slow * .15) * math.sin(math.pi * u) ** 1.8
        elif kind == 'warp':
            envelope = math.sin(math.pi * u) ** 1.6
            movement = .62 + .38 * math.sin(t * 5.3 + u * u * 15)
            out[i] = (low * .19 * movement + slow * .65) * envelope
        else:
            envelope = math.sin(math.pi * u) ** 1.8
            out[i] = (low * .2 + slow * .55) * envelope * (.75 + .25 * math.sin(t * 7 - u * u * 12))
    # Inharmonic, decaying glass grains. No musical chord or backing is played.
    if kind == 'tap':
        events = []
    elif kind == 'form':
        events = [(seconds - .24 + j * .018, .018, 1900 + j * 147) for j in range(9)]
    elif kind == 'fracture':
        events = [(.25, .11, 930), (.5, .14, 1470)] + [(.27 + rng.random() * .75, .025 + rng.random() * .035, 2100 + rng.random() * 3700) for _ in range(22)]
    elif kind == 'reveal':
        events = [(j * .043, .012, 4300 - j * 230) for j in range(10)]
    elif kind == 'warp':
        events = [(3.5 + j * .05, .012, 1700 + j * 173) for j in range(12)]
    else:
        events = [(2.6 + j * .04, .012, 3400 - j * 157) for j in range(12)]
    for start, amplitude, hz in events:
        length = .23 if kind == 'fracture' else .15
        for j in range(min(int(length * RATE), frames - int(start * RATE))):
            t = j / RATE
            env = min(1, t / .002) * math.exp(-t * (27 if kind == 'fracture' else 34))
            glass = math.sin(math.tau * hz * t) + .34 * math.sin(math.tau * hz * 1.413 * t)
            out[int(start * RATE) + j] += amplitude * glass * env
    # Small deterministic early reflections, rendered once rather than live reverb nodes.
    dry = out[:]
    for delay, gain in [(.037, .16), (.083, .1), (.139, .055)]:
        shift = int(delay * RATE)
        for i in range(shift, frames):
            out[i] += dry[i - shift] * gain
    peak = max(abs(value) for value in out) or 1
    scale = min(1.8, .72 / peak)
    samples = bytearray()
    for i, value in enumerate(out):
        fade = min(1, i / (RATE * .008), (frames - 1 - i) / (RATE * .035))
        samples.extend(struct.pack('<h', round(max(-.98, min(.98, value * scale * fade)) * 32767)))
    with wave.open(str(ROOT / name), 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE); wav.writeframes(samples)

for spec in [('logo-form.wav', 1.15, 419, 'form'), ('logo-fracture.wav', 1.4, 420, 'fracture'), ('piano-reveal.wav', .7, 421, 'reveal'), ('levels-warp.wav', 5, 422, 'warp'), ('galaxy-vinyl.wav', 3.6, 423, 'vinyl'), ('keyboard-tap.wav', .065, 424, 'tap')]:
    render(*spec)
print(f'Rendered six original transition/typing one-shots in {ROOT}')
