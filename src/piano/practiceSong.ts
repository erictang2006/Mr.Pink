import type { KeyboardMap } from "./noteMapping";

export type SongNote = {
  beat: number;
  duration: number;
  hand: "left" | "right";
  midi: number;
  tieFromPrevious: boolean;
  tieToNext: boolean;
};
export type SongMeasure = {
  number: number;
  startBeat: number;
  beats: number;
  timeSignature: [number, number];
  tempoBpm: number;
  tempoChanges: { beat: number; bpm: number }[];
  notes: SongNote[];
  rests: { beat: number; duration: number; hand: "left" | "right" }[];
};
export type PracticeSong = {
  id: string;
  title: string;
  sourceTitle: string;
  sourceFile: string;
  measureCount: number;
  totalBeats: number;
  pitches: number[];
  measures: SongMeasure[];
  unsupportedFeatures: string[];
};
export type PracticeGroup = {
  id: string;
  measure: number;
  beat: number;
  absoluteBeat: number;
  notes: SongNote[];
  pitches: number[];
};

export function songGroups(song: PracticeSong): PracticeGroup[] {
  const groups = new Map<string, PracticeGroup>();
  for (const measure of song.measures) {
    for (const note of measure.notes) {
      if (note.tieFromPrevious) continue;
      const key = `${measure.number}:${note.beat}`;
      const existing = groups.get(key);
      if (existing) {
        existing.notes.push(note);
        if (!existing.pitches.includes(note.midi)) existing.pitches.push(note.midi);
      } else {
        groups.set(key, {
          id: key,
          measure: measure.number,
          beat: note.beat,
          absoluteBeat: measure.startBeat + note.beat,
          notes: [note],
          pitches: [note.midi],
        });
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.absoluteBeat - b.absoluteBeat);
}

export function bindingsForPitch(map: KeyboardMap, midi: number) {
  return map.bindings.flatMap((binding) => {
    const options = [];
    if (binding.midi === midi) options.push({ id: `${binding.code}:normal`, code: binding.code, label: binding.label });
    if (binding.shiftedMidi === midi)
      options.push({ id: `${binding.code}:shift`, code: binding.code, label: `⇧${binding.label}` });
    return options;
  });
}

export function secondsAtBeat(song: PracticeSong, targetBeat: number): number {
  let seconds = 0;
  let bpm = song.measures[0]?.tempoBpm ?? 100;
  for (const measure of song.measures) {
    const start = measure.startBeat;
    if (targetBeat <= start) break;
    let cursor = start;
    const changes = [...measure.tempoChanges].sort((a, b) => a.beat - b.beat);
    for (const change of changes) {
      const changeBeat = start + change.beat;
      if (changeBeat > targetBeat) break;
      seconds += Math.max(0, changeBeat - cursor) * 60 / bpm;
      cursor = changeBeat;
      bpm = change.bpm;
    }
    const end = Math.min(targetBeat, start + measure.beats);
    seconds += Math.max(0, end - cursor) * 60 / bpm;
    if (targetBeat <= start + measure.beats) break;
  }
  return seconds;
}

export function beatAtSeconds(song: PracticeSong, seconds: number): number {
  let low = 0;
  let high = song.totalBeats;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (secondsAtBeat(song, mid) < seconds) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
