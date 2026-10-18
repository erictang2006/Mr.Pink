import { interstellarMap } from "./profiles";
import { getPitch, midiToName, type KeyboardMap } from "./noteMapping";

export const rosesMap: KeyboardMap = {
  id: "roses-interstellar-plus-four",
  name: "Roses — Interstellar Layout +4",
  bindings: interstellarMap.bindings.map(binding => ({
    code: binding.code,
    label: binding.label,
    midi: binding.midi + 4,
    ...(binding.shiftedMidi === undefined ? {} : { shiftedMidi: binding.shiftedMidi + 4 }),
  })),
};

export const rosesPhrase = ["e", "e", "e", ...Array(7).fill("eg"), ...Array(4).fill("ef")] as string[];

export function phrasePitches(keys: string, transpose = 4): string[] {
  return [...keys].map(letter => {
    const midi = getPitch(rosesMap, `Key${letter.toUpperCase()}`, false, transpose - 4);
    return midi === null ? `${letter.toUpperCase()}: unmapped` : `${letter.toUpperCase()}: ${midiToName(midi)}`;
  });
}
