"""Import the first 30 measures of a MuseScore 4 MSCZ without changing the score.

Usage: python3 scripts/import_mscz.py SCORE.mscz OUTPUT.json
Unknown timed elements fail the import instead of being silently discarded.
"""
import json
import sys
import zipfile
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET

DURATION = {"long": 16, "breve": 8, "whole": 4, "half": 2,
            "quarter": 1, "eighth": Fraction(1, 2),
            "16th": Fraction(1, 4), "32nd": Fraction(1, 8),
            "64th": Fraction(1, 16), "128th": Fraction(1, 32)}
TIMED = {"Chord", "Rest"}
ALLOWED = TIMED | {"Clef", "TimeSig", "KeySig", "Tempo", "Dynamic",
                   "StaffText", "Text", "SystemText", "Harmony", "BarLine",
                   "Fermata", "LayoutBreak", "Marker", "RehearsalMark"}


def duration(element, measure_beats):
    kind = element.findtext("durationType")
    if kind == "measure":
        return measure_beats
    if kind not in DURATION:
        raise ValueError(f"Unsupported duration type: {kind}")
    base = Fraction(DURATION[kind])
    value = base
    for dot in range(int(element.findtext("dots", "0"))):
        value += base / (2 ** (dot + 1))
    ratio = element.find("Tuplet")
    if ratio is not None:
        raise ValueError("Tuplet requires explicit time modification; import stopped")
    return value


def number(value):
    return float(value) if value.denominator != 1 else int(value)


def import_score(path):
    with zipfile.ZipFile(path) as archive:
        scores = [name for name in archive.namelist() if name.endswith(".mscx")]
        if len(scores) != 1:
            raise ValueError(f"Expected one .mscx score; found {len(scores)}")
        root = ET.fromstring(archive.read(scores[0]))
    score = root.find("Score")
    if score is None:
        raise ValueError("No MuseScore Score element")
    staves = score.findall("Staff")
    if len(staves) != 2:
        raise ValueError(f"Expected two piano staves; found {len(staves)}")
    if any(len(staff.findall("Measure")) < 30 for staff in staves):
        raise ValueError("Score has fewer than 30 measures")
    measures = []
    beat_start = Fraction(0)
    signature = (3, 4)
    tempo = 100.0
    issues = []
    for index in range(30):
        staff_measures = [staff.findall("Measure")[index] for staff in staves]
        for measure in staff_measures:
            for time in measure.findall(".//TimeSig"):
                new_sig = (int(time.findtext("sigN")), int(time.findtext("sigD")))
                if new_sig[1] not in (1, 2, 4, 8, 16):
                    raise ValueError(f"Unsupported time signature {new_sig}")
                signature = new_sig
        measure_beats = Fraction(signature[0] * 4, signature[1])
        events = []
        rests = []
        tempo_changes = []
        for staff_index, measure in enumerate(staff_measures):
            voices = measure.findall("voice")
            if len(voices) != 1:
                raise ValueError(f"Measure {index + 1}, staff {staff_index + 1}: expected one voice, found {len(voices)}")
            cursor = Fraction(0)
            for item in voices[0]:
                if item.tag == "eid":
                    continue
                if item.tag not in ALLOWED:
                    raise ValueError(f"Measure {index + 1}: unsupported event {item.tag}")
                if item.tag == "Tempo":
                    tempo = float(item.findtext("tempo", "0")) * 60
                    tempo_changes.append({"beat": number(cursor), "bpm": round(tempo, 4)})
                if item.tag not in TIMED:
                    continue
                permitted = {"eid", "durationType", "dots", "StemDirection", "Note"} if item.tag == "Chord" else {"eid", "durationType", "duration", "dots"}
                unexpected = {child.tag for child in item} - permitted
                if unexpected:
                    raise ValueError(f"Measure {index + 1}: unsupported {item.tag} children {sorted(unexpected)}")
                beats = duration(item, measure_beats)
                if cursor + beats > measure_beats:
                    raise ValueError(f"Measure {index + 1}, staff {staff_index + 1} exceeds its meter")
                common = {"beat": number(cursor), "duration": number(beats),
                          "hand": "right" if staff_index == 0 else "left"}
                if item.tag == "Rest":
                    rests.append(common)
                else:
                    notes = item.findall("Note")
                    if not notes:
                        raise ValueError(f"Measure {index + 1}: empty chord")
                    for note in notes:
                        unexpected_note = {child.tag for child in note} - {"eid", "pitch", "tpc", "Spanner"}
                        if unexpected_note:
                            raise ValueError(f"Measure {index + 1}: unsupported note features {sorted(unexpected_note)}")
                        for spanner in note.findall("Spanner"):
                            if spanner.get("type") not in (None, "Tie") or {child.tag for child in spanner} - {"Tie", "prev", "next"}:
                                raise ValueError(f"Measure {index + 1}: unsupported note spanner")
                        pitch = note.findtext("pitch")
                        if pitch is None:
                            raise ValueError(f"Measure {index + 1}: note without pitch")
                        tied_from_previous = note.find("Spanner/prev") is not None
                        tied_to_next = note.find("Spanner[@type='Tie']/Tie") is not None
                        events.append({**common, "midi": int(pitch),
                                       "tieFromPrevious": tied_from_previous,
                                       "tieToNext": tied_to_next})
                cursor += beats
            if cursor != measure_beats:
                raise ValueError(f"Measure {index + 1}, staff {staff_index + 1}: {cursor} beats, expected {measure_beats}")
        measures.append({"number": index + 1, "startBeat": number(beat_start),
                         "beats": number(measure_beats),
                         "timeSignature": list(signature), "tempoBpm": round(tempo, 4),
                         "tempoChanges": tempo_changes,
                         "notes": events, "rests": rests})
        beat_start += measure_beats
    pitches = sorted({note["midi"] for measure in measures for note in measure["notes"]})
    return {"id": "interstellar", "title": "Interstellar", "sourceTitle": next(
        (x.text for x in score.findall("metaTag") if x.get("name") == "workTitle"), ""),
        "sourceFile": Path(path).name, "measureCount": 30, "totalBeats": number(beat_start),
        "pitches": pitches, "measures": measures, "unsupportedFeatures": issues}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    song = import_score(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(song, indent=2) + "\n")
    print(f"Imported {len(song['measures'])} measures, {sum(len(m['notes']) for m in song['measures'])} notes, {len(song['pitches'])} pitches")
