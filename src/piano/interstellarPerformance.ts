import scoreData from './interstellar.song.json';
import { assistedEvents, type AssistedEvent } from './assistedSong';
import { defaultInterstellarMix, highEMidi, shouldDoubleHighE, softSectionGain, type InterstellarMix } from './interstellarMix';
import { assistedInterstellarMap, interstellarMap } from './profiles';
import type { KeyboardMap } from './noteMapping';
import type { PracticeSong } from './practiceSong';

export type InterstellarSection = 1 | 2 | 3;
export const interstellarSections = {
  1: { label: 'OPENING', bars: '1–8', firstBar: 1 },
  2: { label: 'ASSISTED', bars: '9–13', firstBar: 9 },
  3: { label: 'CLIMAX', bars: '14–30', firstBar: 14 },
} as const;

export function moveInterstellarSection(current: InterstellarSection, delta: number): InterstellarSection {
  return Math.max(1, Math.min(3, current + Math.sign(delta))) as InterstellarSection;
}

export function mapForInterstellarSection(section: InterstellarSection): KeyboardMap {
  return section === 2 ? assistedInterstellarMap : interstellarMap;
}

const score = scoreData as unknown as PracticeSong;
export const climaxAccompanimentPitches = new Set(
  score.measures.slice(13, 30).flatMap(measure => measure.notes)
    .filter(note => note.hand === 'left' && note.duration <= .25)
    .map(note => note.midi),
);

export function interstellarPerformanceGain(section: InterstellarSection, midi: number, assisted: boolean, mix: InterstellarMix): number {
  if (section === 1) return 1;
  if (section === 2) return assisted
    ? Math.min(1, softSectionGain * mix.assisted / defaultInterstellarMix.assisted)
    : softSectionGain;
  return climaxAccompanimentPitches.has(midi) ? mix.accompaniment : mix.melody;
}

export function doubledPitch(section: InterstellarSection, code: string, midi: number, mix: InterstellarMix): number | null {
  return section === 3 && midi === highEMidi && shouldDoubleHighE(code, midi, mix.octaveEnabled) ? midi + 12 : null;
}

/** Match the next live physical key to the imported assisted score without running a clock. */
export function nextAssistedEvent(code: string, cursor: number): { event: AssistedEvent; nextCursor: number } | null {
  for (let offset = 0; offset < assistedEvents.length; offset++) {
    const index = (cursor + offset) % assistedEvents.length;
    const event = assistedEvents[index];
    if (event.code === code) return { event, nextCursor: (index + 1) % assistedEvents.length };
  }
  return null;
}

export type PlannedVoice = { midi: number; gain: number; assisted: boolean; octave: boolean };
export function planInterstellarPress(section: InterstellarSection, code: string, midi: number, cursor: number, mix: InterstellarMix): { voices: PlannedVoice[]; nextCursor: number } {
  const voices: PlannedVoice[] = [{ midi, gain: interstellarPerformanceGain(section, midi, false, mix), assisted: false, octave: false }];
  let nextCursor = cursor;
  if (section === 2) {
    const matched = nextAssistedEvent(code, cursor);
    if (matched && matched.event.liveMidi === midi) {
      nextCursor = matched.nextCursor;
      for (const pitch of matched.event.assistedMidi) voices.push({ midi: pitch, gain: interstellarPerformanceGain(section, pitch, true, mix), assisted: true, octave: false });
    }
  }
  const octave = doubledPitch(section, code, midi, mix);
  if (octave !== null) voices.push({ midi: octave, gain: interstellarPerformanceGain(section, midi, false, mix) * mix.octave, assisted: false, octave: true });
  return { voices, nextCursor };
}
