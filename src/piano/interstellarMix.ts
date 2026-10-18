import scoreData from "./interstellar.song.json";
import assistedSource from "./interstellar_assisted_bars_9_13.json";
import { assistedInterstellarMap, interstellarMap } from "./profiles";
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
  octaveEnabled: true,
  octave: 0.45,
};

export const climaxStart = 14;
export const softSectionStart = 9;
export const softSectionEnd = 13;
export const softSectionGain = 0.4;
export const highEMidi = 76; // KeyF in the Roblox-aligned profile; E5 in the score.
export const highEOctaveMidi = highEMidi + 12; // E6, covered by the sampler's D#6/F#6 samples.

const song = scoreData as unknown as PracticeSong;
const assistedCodes = new Set(Object.keys(assistedSource.keyboardMapping));

export function sectionGain(measure: number): number {
  return measure >= softSectionStart && measure <= softSectionEnd ? softSectionGain : 1;
}

export function practiceNoteGain(measure: number, midi: number, mix: InterstellarMix): number {
  if (measure < climaxStart || measure > song.measureCount) return sectionGain(measure);
  const notes = song.measures[measure - 1].notes.filter(note => note.midi === midi);
  // Only the score's left-hand sixteenths are attenuated. A pitch shared with
  // the right hand keeps melody level so the lead is never hidden.
  const runningAccompaniment = notes.length > 0 && notes.every(note => note.hand === "left" && note.duration <= 0.25);
  return runningAccompaniment ? mix.accompaniment : mix.melody;
}

export function liveNoteGain(measure: number, midi: number, code: string, profileId: string, inStudio: boolean, mix: InterstellarMix): number {
  if (inStudio) return practiceNoteGain(measure, midi, mix);
  if (profileId === assistedInterstellarMap.id && assistedCodes.has(code)) return softSectionGain;
  if (profileId === interstellarMap.id || profileId === assistedInterstellarMap.id) return sectionGain(measure);
  return 1;
}

export function shouldDoubleHighE(code: string, midi: number, enabled: boolean): boolean {
  return enabled && code === "KeyF" && midi === highEMidi;
}
