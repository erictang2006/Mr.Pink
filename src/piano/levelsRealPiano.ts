import { stageKeyGuide } from "./performancePresentation";
import { interstellarRobloxMap } from './interstellarRoblox';
import { levelsSong, type LevelsInput, type DrumLayer } from './levels';
import { songGroups, type PracticeSong } from './practiceSong';
import type { KeyboardMap } from './noteMapping';

export type LevelsPlayingMode = 'assisted' | 'real';

/** Keep the C-based physical slots; +4 maps their white keys to E major.
 * Shift is ignored. Low bass extensions occupy unused bottom slots.
 */
export const levelsEMajor: KeyboardMap = {
  pairedKeys: { Digit5: 'BracketRight', Digit4: 'BracketLeft' },
  id: 'levelsEMajor', name: 'Levels · E major · individual notes', displayPitchOffset: 4,
  bindings: [
    ...interstellarRobloxMap.bindings.map(({ code, label, midi }) => ({ code, label, midi: midi + 4, positionMidi: midi })),
    { code: 'Backslash', label: '\\', midi: 37, positionMidi: 33 },
    { code: 'BracketLeft', label: '[', midi: 33, positionMidi: 34 },
    { code: 'BracketRight', label: ']', midi: 35, positionMidi: 37 },
    ...([
      ['Backquote', '`', 49], ['Minus', '-', 51], ['Equal', '=', 54],
      ['Semicolon', ';', 61], ['Quote', "'", 63], ['Comma', ',', 66],
      ['Period', '.', 68], ['Slash', '/', 70],
    ] as const).map(([code, label, positionMidi]) => ({ code, label, positionMidi, midi: positionMidi + 4 })),
  ],
};

/** User's fingering reference; hand lanes classify keys without rewriting the score. */
export const levelsRightHandSequence = String.raw`pu\pu\p\uut8out8outo8tuo8oyoyippijhf`;
const rightHandKeys = new Set(levelsRightHandSequence);
export function levelsPracticeHand(midi: number): 'right' | 'left' {
  const label = levelsEMajor.bindings.find(binding => binding.midi === midi)?.label;
  return label && rightHandKeys.has(label) ? 'right' : 'left';
}

export const levelsRealDrums: Record<string, DrumLayer | 'fill' | 'riser'> = {
  F1: 'kick', F2: 'clap', F3: 'hat', F4: 'fill', F5: 'riser',
};

export function levelsRealInputs(song: PracticeSong = levelsSong): LevelsInput[] {
  return songGroups(song).map(group => ({
    ...group,
    codes: group.pitches.map(pitch => {
      const binding = levelsEMajor.bindings.find(binding => binding.midi === pitch);
      if (!binding) throw Error(`Unmapped Levels MIDI pitch ${pitch} at ${group.id}`);
      return binding.code;
    }),
    duration: Math.max(...group.notes.map(note => note.duration)),
  }));
}

/** Require overlapping chord notes and fresh attacks inside the chord window.
 * Pedal-held notes never substitute for a new scored attack. */
export class LevelsChordCollector {
  private attacks = new Map<string, Map<number, number>>();
  clear(id?: string) { if (id === undefined) this.attacks.clear(); else this.attacks.delete(id); }
  hasPending(id: string, at: number, held: readonly number[], windowMs: number): boolean {
    return [...(this.attacks.get(id) ?? [])].some(([pitch, time]) => at - time <= windowMs && held.includes(pitch));
  }
  press(id: string, required: readonly number[], midi: number, at: number, held: readonly number[], windowMs: number) {
    const attacks = this.attacks.get(id) ?? new Map<number, number>();
    for (const [pitch, time] of attacks) if (at - time > windowMs || !held.includes(pitch)) attacks.delete(pitch);
    if (required.includes(midi)) attacks.set(midi, at);
    this.attacks.set(id, attacks);
    const collected = required.filter(pitch => attacks.has(pitch) && held.includes(pitch));
    return { collected, complete: collected.length === required.length };
  }
}

/** Keep transport messages consistent with the active drum shortcuts. */
export function levelsDrumHint(text: string | undefined, real: boolean): string | undefined {
  if (!real || !text) return text;
  const keys: Record<string, string> = { Z: 'F1', X: 'F2', C: 'F3', V: 'F4', B: 'F5' };
  return text.replace(/\b[ZXCVB]\b/g, code => keys[code]);
}

/** Performance uses one physical label per sounding pitch and the practice hand colors. */
export function levelsIndividualGuide(transpose = 0) {
  const guide = stageKeyGuide(levelsEMajor, transpose);
  for (const [pitch, entries] of Object.entries(guide)) {
    for (const entry of entries) entry.hand = levelsPracticeHand(Number(pitch) - transpose);
  }
  return guide;
}
