import type { KeyboardMap } from "./noteMapping";

export const isBlack = (midi: number): boolean => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

export function pianoRange(bindings: { midi: number; shiftedMidi?: number }[]) {
  const pitches = bindings.flatMap(binding => [binding.midi, binding.shiftedMidi ?? binding.midi]);
  return { low: Math.min(48, ...pitches), high: Math.max(84, ...pitches) + 12 };
}

export function pianoGeometry(width: number, transpose: number, low = 48, high = 84) {
  const start = low + transpose;
  const end = high + transpose;
  const whites = Array.from({ length: end - start + 1 }, (_, i) => i + start).filter(midi => !isBlack(midi));
  const whiteWidth = width / whites.length;
  const blackWidth = Math.min(whiteWidth * .64, 31);
  const keys = new Map<number, { x: number; width: number; black: boolean }>();
  whites.forEach((midi, index) => keys.set(midi, { x: index * whiteWidth, width: whiteWidth, black: false }));
  for (let midi = start; midi <= end; midi++) {
    if (!isBlack(midi)) continue;
    const previous = whites.filter(note => note < midi).length;
    if (previous > 0 && previous < whites.length) keys.set(midi, { x: previous * whiteWidth - blackWidth / 2, width: blackWidth, black: true });
  }
  return { whites, keys, whiteWidth, blackWidth };
}

/** Practice can retain physical slots; Performance places notes at their actual
 * chromatic pitches so sharps light black keys and natural notes light white keys. */
export function mappedPianoGeometry(map: KeyboardMap, width: number, transpose: number, low: number, high: number, actualPitchPositions = false) {
  const geometry = pianoGeometry(width, transpose, low, high);
  if (actualPitchPositions || map.displayPitchOffset === undefined) return geometry;
  const pitch = (slot: number) => (map.bindings.find(binding => binding.positionMidi === slot - transpose)?.midi
    ?? slot - transpose + map.displayPitchOffset!) + transpose;
  return { ...geometry, whites: geometry.whites.map(pitch),
    keys: new Map([...geometry.keys].map(([slot, rect]) => [pitch(slot), rect])) };
}
