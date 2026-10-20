"""Extract the actual Ableton arrangement for the optional bars 37–44 audition."""
import gzip
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'reference/roses-drop/ableton/remake 1.als'
START, END = 144, 176

def value(element, path, default=None):
    child = element.find(path)
    return child.get('Value', default) if child is not None else default

def notes_in_clip(clip):
    start, end = float(value(clip, 'CurrentStart')), float(value(clip, 'CurrentEnd'))
    relative = float(value(clip, 'Loop/StartRelative'))
    loop_start, loop_end = float(value(clip, 'Loop/LoopStart')), float(value(clip, 'Loop/LoopEnd'))
    loop_length = loop_end - loop_start
    looping = value(clip, 'Loop/LoopOn') == 'true'
    result = []
    for key in clip.findall('Notes/KeyTracks/KeyTrack'):
        midi = int(value(key, 'MidiKey'))
        for event in key.findall('Notes/MidiNoteEvent'):
            if event.get('IsEnabled') == 'false':
                continue
            pos = float(event.get('Time'))
            beat = start + pos - loop_start - relative
            # These source clips use a single pass (16 or 8 beats), with a
            # deliberate +1 start-relative trim in the second bass/chord clips.
            while looping and beat < start - 1e-8:
                beat += loop_length
            while beat < end - 1e-8:
                if START <= beat < END and beat >= start - 1e-8:
                    result.append({'beat': beat, 'duration': min(float(event.get('Duration')), end - beat, END - beat),
                                   'midi': midi, 'velocity': float(event.get('Velocity'))})
                if not looping:
                    break
                beat += loop_length
    return sorted(result, key=lambda event: (event['beat'], event['midi']))

def extract():
    root = ET.fromstring(gzip.decompress(SOURCE.read_bytes()))
    tracks = {int(track.get('Id')): track for track in root.findall('.//Tracks/*') if track.tag in ['MidiTrack', 'AudioTrack']}
    result = {'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'startBeat': START, 'endBeat': END,
              'notes': [], 'drums': [], 'clips': []}
    for tid, group in [(45, 'bass'), (39, 'chords'), (53, 'chords'), (82, 'hat')]:
        track = tracks[tid]
        for clip in track.findall('.//ArrangerAutomation/Events/MidiClip'):
            start, end = float(value(clip, 'CurrentStart')), float(value(clip, 'CurrentEnd'))
            if end <= START or start >= END or value(clip, 'Disabled') == 'true':
                continue
            result['clips'].append({'track': tid, 'start': start, 'end': end, 'startRelative': float(value(clip, 'Loop/StartRelative'))})
            events = notes_in_clip(clip)
            for event in events:
                if group == 'hat':
                    result['drums'].append({**event, 'track': tid, 'kind': 'hat', 'offset': 0, 'gain': .2511886432})
                else:
                    result['notes'].append({**event, 'track': tid, 'group': group})
    for tid, kind in [(87, 'kick'), (86, 'clap')]:
        for clip in tracks[tid].findall('.//ArrangerAutomation/Events/AudioClip'):
            start, end = float(value(clip, 'CurrentStart')), float(value(clip, 'CurrentEnd'))
            if not START <= start < END or value(clip, 'Disabled') == 'true':
                continue
            assert value(clip, 'IsWarped') == 'false'
            assert float(value(clip, 'PitchCoarse')) == 0 and float(value(clip, 'PitchFine')) == 0
            result['drums'].append({'beat': start, 'duration': min(end, END) - start, 'track': tid, 'kind': kind,
                                    'offset': float(value(clip, 'Loop/LoopStart')) + float(value(clip, 'Loop/StartRelative')),
                                    'gain': float(value(clip, 'SampleVolume')), 'velocity': 127})
    result['notes'].sort(key=lambda event: (event['beat'], event['track'], event['midi']))
    result['drums'].sort(key=lambda event: (event['beat'], event['track']))
    return result

if __name__ == '__main__':
    result = extract()
    supplied = json.loads((ROOT / 'reference/roses-drop-bass/roses_37_44_original_drop_bass_midi_events.json').read_text())['notes']
    normalize = lambda n: (n['beat'], n['midi'], n['duration'], n['velocity'])
    assert sorted(normalize(n) for n in result['notes'] if n['group'] == 'bass') == sorted((n['absolute_beat'], n['midi'], n['dur_beats'], n['velocity']) for n in supplied)
    (ROOT / 'src/piano/rosesDropArrangement.json').write_text(json.dumps(result, indent=2) + '\n')
    for track in [45, 39, 53, 82, 86, 87]:
        print(track, sum(event['track'] == track for event in result['notes'] + result['drums']))
