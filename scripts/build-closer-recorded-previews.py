"""Build isolated, recorded-first Closer chord previews from the supplied WAV.

Requires FFmpeg. This only writes WAV files under docs/roses-reference and does
not modify the playable instrument. The extra single notes are synthesized from
the measured source partial balance; the chord body is the recorded hit.
"""

from array import array
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reference/roses-chord-samples/chord-future-bass-type-loud-synth-stabs_75bpm_C_major.wav"
OUTPUT = ROOT / "docs/roses-reference/loud-stabs-previews"
RUNTIME = ROOT / "public/roses/chords"
RATE = 44100
PARTIALS = (1.0, .22, .39, .29, .22, .26, .11, .12)

# FFmpeg's atempo is a time-domain overlap/add stretch. asetrate moves pitch;
# the inverse tempo factor restores approximately the recorded hit duration.
CHORDS = (
    {
        "name": "01-dbadd9-recorded-preview.wav",
        "runtime": "loud-stabs-recorded-dbadd9",
        "source": (6.39, 7.19),
        "source_filter": (
            "bandreject=f=148:t=h:w=18,bandreject=f=175:t=h:w=18,"
            "bandreject=f=330:t=h:w=18,bandreject=f=350:t=h:w=18,"
            "bandreject=f=440:t=h:w=22,bandreject=f=522:t=h:w=22,"
            "bandreject=f=660:t=h:w=24,bandreject=f=990:t=h:w=28,"
            "bandreject=f=1320:t=h:w=32"
        ),
        "shift": 6,
        "highpass": 255,
        "extra_notes": ((75, .035),),  # E-flat5, the D-flat add9
    },
    {
        "name": "02-eb-major-recorded-preview.wav",
        "runtime": "loud-stabs-recorded-eb-major",
        "source": (9.59, 10.39),
        "source_filter": (
            "bandreject=f=196:t=h:w=18,bandreject=f=293:t=h:w=18,"
            "bandreject=f=587:t=h:w=24,bandreject=f=880:t=h:w=28"
        ),
        "shift": 3,
        "highpass": 240,
        "extra_notes": ((67, .046),),  # G4, the E-flat major third
    },
    {
        "name": "03-fm7-recorded-preview.wav",
        "runtime": "loud-stabs-recorded-fm7",
        "source": (0.0, .79),
        "source_filter": "highpass=f=85",
        "shift": 8,
        "highpass": 255,
        "extra_notes": ((68, .034), (75, .038)),  # reinforce A-flat4; add E-flat5
    },
)


def ffmpeg(input_path: Path, output_path: Path, filters: str) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(input_path),
         "-af", filters, "-ar", str(RATE), "-ac", "2", "-c:a", "pcm_s16le", str(output_path)],
        check=True,
    )


def read_wav(path: Path) -> tuple[list[float], list[float]]:
    with wave.open(str(path)) as wav:
        assert (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) == (RATE, 2, 2)
        raw = array("h")
        raw.frombytes(wav.readframes(wav.getnframes()))
    return ([raw[i] / 32768 for i in range(0, len(raw), 2)],
            [raw[i] / 32768 for i in range(1, len(raw), 2)])


def make_extra_note(left: list[float], right: list[float], midi: int, target_rms: float) -> tuple[list[float], list[float]]:
    """A quiet stereo note following the recorded amplitude contour."""
    length = len(left)
    window = 882  # 20 ms, smoothed so sample cycles do not modulate the note
    rms = []
    for start in range(0, length, window):
        end = min(start + window, length)
        power = sum((left[i] ** 2 + right[i] ** 2) / 2 for i in range(start, end))
        rms.append(math.sqrt(power / (end - start)))
    contour = [(rms[max(0, k - 1)] + rms[k] + rms[min(len(rms) - 1, k + 1)]) / 3
               for k in range(len(rms))]
    reference = max(contour[:min(12, len(contour))])
    frequency = 440 * 2 ** ((midi - 69) / 12)
    extras = ([], [])
    for i in range(length):
        t = i / RATE
        p = min(i / window, len(contour) - 1.000001)
        k = int(p)
        envelope = (contour[k] * (1 - (p - k)) + contour[k + 1] * (p - k)) / reference
        envelope *= min(1.0, t / .008)
        for channel, cents in enumerate((-4.0, 4.0)):
            phase = 2 * math.pi * frequency * 2 ** (cents / 1200) * t
            value = sum(weight * math.sin((h + 1) * phase + channel * .41 + h * .17)
                        for h, weight in enumerate(PARTIALS))
            extras[channel].append(value * envelope)
    current_rms = math.sqrt(sum(v * v for side in extras for v in side) / (2 * length))
    gain = target_rms / current_rms
    return ([v * gain for v in extras[0]], [v * gain for v in extras[1]])


def write_preview(path: Path, left: list[float], right: list[float], extra_notes: tuple[tuple[int, float], ...]) -> None:
    mixed_left, mixed_right = left[:], right[:]
    for midi, target_rms in extra_notes:
        note_left, note_right = make_extra_note(left, right, midi, target_rms)
        mixed_left = [a + b for a, b in zip(mixed_left, note_left)]
        mixed_right = [a + b for a, b in zip(mixed_right, note_right)]
    # The final WSOLA window can end a little before the source fade reaches zero.
    # Close its last 20 ms at a zero crossing level to prevent a playback click.
    fade_frames = min(round(.02 * RATE), len(left))
    for i in range(len(left) - fade_frames, len(left)):
        envelope = (len(left) - 1 - i) / max(1, fade_frames - 1)
        mixed_left[i] *= envelope
        mixed_right[i] *= envelope
    rms = math.sqrt(sum(v * v for side in (mixed_left, mixed_right) for v in side) / (2 * len(left)))
    peak = max(abs(v) for side in (mixed_left, mixed_right) for v in side)
    gain = min(.13 / rms, .89 / peak)
    pcm = array("h")
    for a, b in zip(mixed_left, mixed_right):
        pcm.extend((round(a * gain * 32767), round(b * gain * 32767)))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    print(f"{path.name}: {len(left) / RATE:.3f}s, peak {peak * gain:.3f}, RMS {rms * gain:.3f}")


def write_sustain_loop(preview: Path, output: Path) -> None:
    """Loop the stable recorded body, crossfading its seam in stereo."""
    left, right = read_wav(preview)
    start, end, overlap = (round(seconds * RATE) for seconds in (.16, .55, .05))
    pcm = array("h")
    length = end - start - overlap
    for i in range(length):
        values = []
        for side in (left, right):
            value = side[start + i]
            if i < overlap:
                blend = i / (overlap - 1)
                value = side[end - overlap + i] * (1 - blend) + value * blend
            values.append(round(max(-1, min(1, value)) * 32767))
        pcm.extend(values)
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    print(f"{output.name}: {length / RATE:.3f}s recorded sustain loop")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source WAV: {SOURCE}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="closer-stabs-") as folder:
        temporary = Path(folder)
        for chord in CHORDS:
            start, end = chord["source"]
            extracted = temporary / "extracted.wav"
            shifted = temporary / "shifted.wav"
            ffmpeg(SOURCE, extracted,
                   f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS,"
                   f"afade=t=in:st=0:d=0.005,{chord['source_filter']},"
                   "afade=t=out:st=0.71:d=0.08")
            factor = 2 ** (chord["shift"] / 12)
            ffmpeg(extracted, shifted,
                   f"asetrate={RATE * factor:.8f},aresample={RATE},"
                   f"atempo={1 / factor:.8f},highpass=f={chord['highpass']}"
                   + (",bandreject=f=175:t=h:w=20,bandreject=f=875:t=h:w=24"
                      if chord["name"].startswith("03-") else ""))
            left, right = read_wav(shifted)
            preview = OUTPUT / chord["name"]
            write_preview(preview, left, right, chord["extra_notes"])
            shutil.copyfile(preview, RUNTIME / f"{chord['runtime']}.wav")
            write_sustain_loop(preview, RUNTIME / f"{chord['runtime']}-sustain.wav")


if __name__ == "__main__":
    main()
