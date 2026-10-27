"""Optional native-render comparison. Run with the existing audio Python venv.
Uses the /private/tmp/mr-pink-official-* render cases and preserves compact QA
artifacts in docs/roses-reference/official-instrumental/.
"""
from pathlib import Path
import hashlib
import json
import shutil

import numpy as np
from scipy.io import wavfile

root = Path(__file__).resolve().parents[1]
temporary = Path('/private/tmp')
out = root / 'docs/roses-reference/official-instrumental'
out.mkdir(parents=True, exist_ok=True)
report = {'cases': {}, 'regressions': {}, 'renderer': 'Actual Tone/native OfflineAudioContext; no human/browser listening'}


def case(name):
    folder = temporary / f'mr-pink-official-{name}'
    file = next(folder.glob('*-verification.json'))
    return folder, file.name.removesuffix('-verification.json'), json.loads(file.read_text())


def read(folder, prefix, suffix='preview'):
    return wavfile.read(folder / f'{prefix}-{suffix}.wav')[1]


for name in ['start1', 'start25', 'start29', 'start37', 'start39', 'start41', 'early', 'late', 'volume200']:
    folder, prefix, data = case(name)
    bar = data['startBar']
    offset = data['recordedOffsetMs'] / 1000
    tracks = [s for s in data['samples'] if 'original-recording-8bars' in s['url']]
    assert len(tracks) == 1 and data['dropEvents'] == 0
    assert data['dropBassTracks'] == 0 and data['dropChordTracks'] == 0
    assert data['rosesInstrumentalTracks'] == 0 and not any(data['dropDrums'].values())
    track = tracks[0]
    target = .05 + (37 - bar) * 2.4 + offset
    assert abs(track['time'] - max(.05, target)) < 1e-7
    assert abs(track['offset'] - max(0, .05 - target)) < 1e-7
    assert track['playbackRate'] == 1 and data['finite'] and data['peakDb'] < 0
    samples = read(folder, prefix)
    assert np.max(np.abs(samples.astype(np.int32))) < 32767
    report['cases'][name] = {k: data[k] for k in ['startBar', 'recordedOffsetMs', 'dropEvents', 'dropDrums', 'peakDb', 'rmsDb', 'originalRecordingTracks', 'audioNodeCreations']}
    report['cases'][name]['recordedSource'] = track
    shutil.copy2(folder / f'{prefix}-verification.json', out / f'{name}-verification.json')
    if bar >= 37:
        # Existing output filters can retain a very short settling tail.
        end = round((.05 + (45 - bar) * 2.4 + .05) * 44100)
        assert not np.any(samples[end:]), 'recording leaked beyond its bounded window'
    if name == 'start37':
        start = round(.05 * 44100)
        clip = samples[start:start + round(19.2 * 44100)]
        wavfile.write(out / 'official-play-drop-preview.wav', 44100, clip)
        nonzero = np.flatnonzero(np.max(np.abs(clip.astype(np.int32)), axis=1))
        report['cases'][name]['nativeFirstNonzeroSeconds'] = float(nonzero[0] / 44100)
        assert nonzero[0] < .02 * 44100, 'unexpected gap before the first drop attack'

for source, baseline in [
    ('hwm', temporary / 'mr-pink-vocal-handoff-after'),
    ('roses', temporary / 'mr-pink-official-before'),
]:
    folder, prefix, _ = case(f'regression-{source}')
    old = read(baseline, 'roses-lead')
    new = read(folder, prefix)
    difference = int(np.max(np.abs(old.astype(np.int32) - new.astype(np.int32))))
    assert difference == 0, f'{source} drop mode changed'
    report['regressions'][f'{source}OtherDropModeMaximumPcm16Difference'] = difference

for bar in [1, 25, 29]:
    folder, prefix, _ = case(f'start{bar}')
    baseline = temporary / 'mr-pink-vocal-handoff-after'
    expected_prefix = (f'bar{bar}-' if bar != 25 else '') + 'roses-lead'
    for stem in ['roses-vocal', 'hwm-vocal', 'melody-tap']:
        old = read(baseline, expected_prefix, stem)
        new = read(folder, prefix, stem)
        assert np.array_equal(old, new), f'{stem} changed from start {bar}'
        report['regressions'][f'start{bar}-{stem}-bitIdentical'] = True
    roses = read(folder, prefix, 'roses-vocal')
    first = round((.05 + (29 - bar) * 2.4) * 44100)
    assert not np.any(roses[first:]), 'original Roses vocal returned during the buildup/drop'

before = json.loads((temporary / 'mr-pink-official-before-sha.json').read_text())
changed = [name for name, digest in before.items()
           if hashlib.sha256((root / name).read_bytes()).hexdigest() != digest]
assert set(changed) == {
    'src/piano/rosesRecordedEnvelope.json', 'src/piano/rosesRecordedDrop.ts',
    'src/components/DropLayerMixer.tsx',
    'public/roses/drop/roses-original-recording-8bars-100bpm.wav',
}
report['changedRuntimeAndAudioFiles'] = changed
report['handoffAndTransportCodeUnchanged'] = True
(out / 'comparison.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
