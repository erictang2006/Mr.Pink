export type KeyBinding = {
  code: string;
  label: string;
  midi: number;
  shiftedMidi?: number;
};
export type KeyboardMap = { id: string; name: string; bindings: KeyBinding[] };

// Each binding owns both pitches. A future mapping editor can replace this preset.
export const standardMap: KeyboardMap = {
  id: "standard",
  name: "Standard · two rows",
  bindings: [
    ["KeyZ", "Z", 48],
    ["KeyS", "S", 49],
    ["KeyX", "X", 50],
    ["KeyD", "D", 51],
    ["KeyC", "C", 52],
    ["KeyV", "V", 53],
    ["KeyG", "G", 54],
    ["KeyB", "B", 55],
    ["KeyH", "H", 56],
    ["KeyN", "N", 57],
    ["KeyJ", "J", 58],
    ["KeyM", "M", 59],
    ["KeyQ", "Q", 60],
    ["Digit2", "2", 61],
    ["KeyW", "W", 62],
    ["Digit3", "3", 63],
    ["KeyE", "E", 64],
    ["KeyR", "R", 65],
    ["Digit5", "5", 66],
    ["KeyT", "T", 67],
    ["Digit6", "6", 68],
    ["KeyY", "Y", 69],
    ["Digit7", "7", 70],
    ["KeyU", "U", 71],
  ].map(([code, label, midi]) => ({
    code: String(code),
    label: String(label),
    midi: Number(midi),
    shiftedMidi: Number(midi) + 12,
  })),
};

export function getPitch(
  map: KeyboardMap,
  code: string,
  shift: boolean,
  transpose = 0,
): number | null {
  const binding = map.bindings.find((item) => item.code === code);
  if (!binding) return null;
  return (
    (shift && binding.shiftedMidi !== undefined
      ? binding.shiftedMidi
      : binding.midi) + transpose
  );
}

export function midiToName(midi: number): string {
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiToToneName(midi: number): string {
  return midiToName(midi).replace("♯", "#");
}

export function labelForMidi(
  map: KeyboardMap,
  midi: number,
  transpose = 0,
): string {
  const direct = map.bindings.find(
    (binding) => binding.midi + transpose === midi,
  );
  if (direct) return direct.label;
  const shifted = map.bindings.find(
    (binding) =>
      binding.shiftedMidi !== undefined &&
      binding.shiftedMidi + transpose === midi,
  );
  return shifted ? `⇧${shifted.label}` : "";
}
