import type { KeyboardMap } from "./noteMapping";
import type { LiveNote } from "./liveNotes";

/** Screen geometry is deliberately independent of audio endMs/pedal state. */
export function physicalNoteBar(note: LiveNote, now: number, height: number, travelMs: number) {
  const speed = height / travelMs;
  const top = height - (now - note.startMs) * speed;
  const bottom = height - (now - (note.physicalEndMs ?? now)) * speed;
  return { top, bottom, height: Math.max(5, bottom - top), held: note.physicalEndMs === null };
}

export type StagePresentation = "interstellar" | "levels";
export type StageKeyLabel = { code: string; label: string; hand: "left" | "right" | "neutral" };
export type StageKeyGuide = Record<number, StageKeyLabel[]>;

/** Presentation data only: every chord pitch retains all of its physical trigger labels. */
export function stageKeyGuide(map: KeyboardMap, transpose: number, chords?: Record<string, number[]>): StageKeyGuide {
  const result: StageKeyGuide = {};
  const add = (midi: number, entry: StageKeyLabel) => {
    const labels = result[midi] ?? (result[midi] = []);
    if (!labels.some(item => item.code === entry.code && item.label === entry.label)) labels.push(entry);
  };
  for (const binding of map.bindings) {
    const pitches = chords?.[binding.code];
    const label = binding.label.toUpperCase();
    const hand = pitches ? Math.min(...pitches) < 62 ? "left" : "right" : "neutral";
    if (pitches) for (const midi of pitches) add(midi, { code: binding.code, label, hand });
    else {
      add(binding.midi + transpose, { code: binding.code, label, hand });
      if (binding.shiftedMidi !== undefined) add(binding.shiftedMidi + transpose, { code: binding.code, label: `⇧${label}`, hand });
    }
  }
  return result;
}

export function stageSourceCode(source: string): string {
  return source.split(":").find(part => /^(Key[A-Z]|Digit[0-9]|Comma|Period|Semicolon|Slash|Quote|BracketLeft|BracketRight|Backslash)$/.test(part)) ?? source;
}

export function stageNoteColor(presentation: StagePresentation, midi: number, source: string, guide: StageKeyGuide): string {
  if (presentation === "interstellar") return midi < 60 ? "#b7cce4" : "#a9e8ff";
  const binding = guide[midi]?.find(entry => entry.code === stageSourceCode(source));
  return (binding?.hand ?? (midi < 62 ? "left" : "right")) === "left" ? "#46e8ee" : "#cf83ff";
}
