import { midiToName } from './noteMapping';

// Dedicated original-synth notes; Q–P retain the live chord instrument.
// L / ; / ' are adjacent on the home row. C is the vocal accent;
// G arms the Roses vocal. Keep C in the candidate list for legacy callers.
const candidates = [
  {code: 'KeyL', label: 'L'}, {code: 'Semicolon', label: ';'},
  {code: 'Quote', label: "'"}, {code: 'KeyC', label: 'C'},
];
const pitches = [64, 66, 68]; // Original T, Y, U respectively.
export function rosesIntroKeys(vocalKey = 'KeyG') {
  return candidates.filter(key => key.code !== vocalKey).slice(0, 3)
    .map((key, i) => ({...key, midi: pitches[i]}));
}
export function rosesIntroKeyPitch(code: string, transpose = 0, vocalKey = 'KeyG'): number | undefined {
  const key = rosesIntroKeys(vocalKey).find(key => key.code === code);
  return key === undefined ? undefined : key.midi + transpose;
}
export function rosesIntroKeyLabel(midi: number, vocalKey = 'KeyG') {
  return rosesIntroKeys(vocalKey).find(key => key.midi === midi)?.label;
}
export function rosesIntroKeyHint(transpose = 0, vocalKey = 'KeyG') {
  return rosesIntroKeys(vocalKey).map(key => `${key.label} = ${midiToName(key.midi + transpose)}`).join(' · ');
}

/** Migrate earlier C/L vocal shortcuts so C is free for the accent. */
export function normalizeRosesVocalKey(_saved: string): 'KeyG' {
  return 'KeyG';
}
