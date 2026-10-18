import rawSong from "./levels.song.json";
import type { PracticeSong, SongMeasure, SongNote } from "./practiceSong";
import type { KeyboardMap } from "./noteMapping";

const importedLevels = rawSong as unknown as PracticeSong;
const note = (beat: number, duration: number, midi: number): SongNote => ({ beat, duration, midi, hand: "right", tieFromPrevious: false, tieToNext: false });
const liveNotes: Record<number, SongNote[]> = {
  9: [note(0, 1, 68), note(1, 1, 71), note(2, 1, 76), note(3, 1, 71)],
  10: [note(0, 2, 68), note(0, 2, 71), note(2, 2, 76)],
  11: [note(0, 4, 64), note(0, 4, 71), note(0, 4, 76)],
  12: [note(0, 1, 64)],
};
export const levelsSong: PracticeSong = {
  ...importedLevels,
  title: "Levels → Roses",
  sourceTitle: `${importedLevels.sourceTitle} · live transition override`,
  pitches: [...new Set([...importedLevels.pitches, 71, 76])].sort((a, b) => a - b),
  measures: importedLevels.measures.map((measure): SongMeasure => {
    if (measure.number < 9) return measure;
    const written = liveNotes[measure.number];
    if (measure.number > 12) return { ...measure, tempoBpm: 100 };
    return { ...measure, tempoBpm: measure.number >= 12 ? 100 : 126,
      tempoChanges: measure.number === 12 ? [{ beat: 0, bpm: 100 }] : [],
      notes: written,
      rests: [{ beat: 0, duration: 4, hand: "left" },
        ...(measure.number === 12 ? [{ beat: 1, duration: 3, hand: "right" as const }] : [])] };
  }),
};
export type LevelsSection = "main" | "transition" | "roses";
export const levelsChordDefaults: Record<string, number[]> = {
  KeyU: [68, 71, 76], KeyI: [68, 73, 76], KeyO: [68, 73, 78],
  KeyJ: [66, 71, 75], KeyK: [66, 71, 76], KeyL: [69, 73, 76],
  KeyA: [37, 49, 61], KeyS: [40, 52, 64], KeyD: [35, 47, 59], KeyF: [33, 45, 57],
  // Additional dyads in the actual MuseScore bars 2, 4, 6 and 8.
  KeyY: [76, 85], KeyP: [76, 83], Semicolon: [76, 80],
  KeyH: [66, 73], KeyN: [66, 71], Comma: [64, 71],
};
export const levelsTransitionChords: Record<string, number[]> = { KeyJ: [68], KeyK: [71], KeyL: [76], KeyM: [64] };
export const levelsRosesChords: Record<string, number[]> = { KeyM: [64] };
export type DrumLayer = "kick" | "clap" | "hat";
export type DrumCue = { measure: number; layer: DrumLayer | "fill" | "riser"; code: string; beat: number; optional: boolean };
export const levelsDrumCues: DrumCue[] = [
  { measure: 9, layer: "kick", code: "KeyZ", beat: 0, optional: false },
  { measure: 10, layer: "clap", code: "KeyX", beat: 1, optional: false },
  { measure: 10, layer: "hat", code: "KeyC", beat: 0.5, optional: true },
  { measure: 11, layer: "fill", code: "KeyV", beat: 2, optional: false },
  { measure: 11, layer: "riser", code: "KeyB", beat: 0, optional: true },
];
export const drumCodeToLayer: Record<string, DrumLayer | "fill" | "riser"> = {
  KeyZ: "kick", KeyX: "clap", KeyC: "hat", KeyV: "fill", KeyB: "riser",
};
export const levelsCodeLabels: Record<string, string> = { Semicolon: ";", Comma: "," };
export const levelsLabel = (code: string) => levelsCodeLabels[code] ?? code.replace(/^Key/, "");
const samePitches = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((x, i) => x === [...b].sort((y, z) => y - z)[i]);

export function validatedLevelsChords(value: unknown): Record<string, number[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return levelsChordDefaults;
  const entries = Object.entries(value);
  if (entries.length !== Object.keys(levelsChordDefaults).length) return levelsChordDefaults;
  const allowed = /^(Key[A-Z]|Comma|Period|Semicolon|Slash|Quote)$/;
  if (entries.some(([code, pitches]) => !allowed.test(code) || !Array.isArray(pitches) || pitches.some(pitch => !Number.isInteger(pitch)))) return levelsChordDefaults;
  const expected = Object.values(levelsChordDefaults).map(pitches => [...pitches].sort((a, b) => a - b).join(",")).sort();
  const actual = entries.map(([, pitches]) => [...(pitches as number[])].sort((a, b) => a - b).join(",")).sort();
  return expected.every((chord, index) => chord === actual[index]) ? value as Record<string, number[]> : levelsChordDefaults;
}

export function chordCode(pitches: number[], section: LevelsSection, main = levelsChordDefaults): string | null {
  const choices = section === "main" ? main : section === "transition" ? levelsTransitionChords : levelsRosesChords;
  return Object.keys(choices).find(code => samePitches(choices[code], pitches)) ?? null;
}

export type LevelsInput = { id: string; measure: number; beat: number; absoluteBeat: number; codes: string[]; pitches: number[]; duration: number };
export function levelsInputs(main = levelsChordDefaults): LevelsInput[] {
  const result: LevelsInput[] = [];
  for (const measure of levelsSong.measures) {
    const byTime = new Map<number, typeof measure.notes>();
    for (const note of measure.notes) {
      if (note.tieFromPrevious) continue;
      const notes = byTime.get(note.beat) ?? [];
      notes.push(note);
      byTime.set(note.beat, notes);
    }
    for (const [beat, notes] of byTime) {
      const section: LevelsSection = measure.number <= 8 ? "main" : measure.number <= 11 ? "transition" : "roses";
      const codes: string[] = [];
      for (const hand of ["left", "right"] as const) {
        const handPitches = notes.filter(note => note.hand === hand).map(note => note.midi);
        if (!handPitches.length) continue;
        const targets = section !== "main" ? handPitches.map(pitch => [pitch]) : [handPitches];
        for (const target of targets) {
          const code = chordCode(target, section, main);
          if (!code) throw Error(`Unmapped Levels chord at bar ${measure.number}, beat ${beat + 1}: ${target.join(",")}`);
          codes.push(code);
        }
      }
      result.push({ id: `${measure.number}:${beat}`, measure: measure.number, beat,
        absoluteBeat: measure.startBeat + beat, codes, pitches: notes.map(note => note.midi),
        duration: Math.max(...notes.map(note => note.duration)) });
    }
  }
  return result.sort((a, b) => a.absoluteBeat - b.absoluteBeat);
}

export function levelsMap(section: LevelsSection, main = levelsChordDefaults): KeyboardMap {
  const chords = section === "main" ? main : section === "transition" ? levelsTransitionChords : levelsRosesChords;
  return { id: `levels-${section}`, name: section === "main" ? "Levels — Assisted" : section === "transition" ? "Levels → Roses" : "Roses Entry",
    bindings: Object.entries(chords).map(([code, notes]) => ({ code, label: levelsLabel(code), midi: notes[0] })) };
}
