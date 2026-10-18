import scoreData from "./interstellar.song.json";
import type { PracticeSong } from "./practiceSong";

export type InterstellarMix = {
  accompaniment: number;
  melody: number;
  assisted: number;
  octaveEnabled: boolean;
  octave: number;
};

export const defaultInterstellarMix: InterstellarMix = {
  accompaniment: 0.35,
  melody: 1,
  assisted: 0.5,
  octaveEnabled: false,
  octave: 0.4,
};

export const climaxStart = 14;
export const highEMidi = 76; // KeyF in the Roblox-aligned profile; E5 in the score.
export const highEOctaveMidi = highEMidi + 12; // E6, covered by the sampler's D#6/F#6 samples.

const song = scoreData as unknown as PracticeSong;

export function practiceNoteGain(measure: number, midi: number, mix: InterstellarMix): number {
  if (measure < climaxStart || measure > song.measureCount) return 1;
  const notes = song.measures[measure - 1].notes.filter(note => note.midi === midi);
  // Only the score's left-hand sixteenths are attenuated. A pitch shared with
  // the right hand keeps melody level so the lead is never hidden.
  const runningAccompaniment = notes.length > 0 && notes.every(note => note.hand === "left" && note.duration <= 0.25);
  return runningAccompaniment ? mix.accompaniment : mix.melody;
}

export function shouldDoubleHighE(measure: number, code: string, midi: number, enabled: boolean): boolean {
  return enabled && measure >= climaxStart && measure <= song.measureCount && code === "KeyF" && midi === highEMidi &&
    song.measures[measure - 1].notes.some(note => note.hand === "right" && note.midi === highEMidi);
}
