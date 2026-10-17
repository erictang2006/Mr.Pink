import { midiToToneName, standardMap, type KeyboardMap } from "./noteMapping";
import interstellarSource from "./interstellar_roblox_aligned_mapping.json";

const storageKey = "stage-piano-profiles-v2";
export const physicalCodes = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `Key${letter}`),
  ..."0123456789".split("").map((digit) => `Digit${digit}`),
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash",
  "Backquote",
];
export function validateProfile(value: unknown): KeyboardMap {
  if (!value || typeof value !== "object") throw Error("Invalid profile");
  const map = value as KeyboardMap;
  if (
    typeof map.id !== "string" ||
    !map.id ||
    typeof map.name !== "string" ||
    !Array.isArray(map.bindings) ||
    map.bindings.length > 100
  )
    throw Error("Invalid profile");
  const codes = new Set<string>();
  const bindings = map.bindings.map((binding) => {
    if (
      !binding ||
      typeof binding.code !== "string" ||
      !physicalCodes.includes(binding.code) ||
      codes.has(binding.code)
    )
      throw Error("Invalid or duplicate physical key");
    if (
      !Number.isInteger(binding.midi) ||
      binding.midi < 21 ||
      binding.midi > 108 ||
      (binding.shiftedMidi !== undefined &&
        (!Number.isInteger(binding.shiftedMidi) ||
          binding.shiftedMidi < 21 ||
          binding.shiftedMidi > 108))
    )
      throw Error("MIDI pitches must be 21–108");
    codes.add(binding.code);
    return {
      code: binding.code,
      label:
        typeof binding.label === "string"
          ? binding.label.slice(0, 8)
          : binding.code,
      midi: binding.midi,
      shiftedMidi: binding.shiftedMidi,
    };
  });
  return { id: map.id.slice(0, 60), name: map.name.slice(0, 60), bindings };
}

function convertInterstellarSource(): KeyboardMap {
  if (interstellarSource.shiftBehavior !== "ignoreForPitch")
    throw Error("Unexpected Interstellar Shift behavior");
  const bindings = Object.entries(interstellarSource.mapping).map(
    ([code, note]) => {
      if (
        !physicalCodes.includes(code) ||
        midiToToneName(note.midi) !== note.pitch
      )
        throw Error(`Invalid Interstellar note: ${code}`);
      return {
        code,
        label: code.replace(/^(Key|Digit)/, "").toLowerCase(),
        midi: note.midi,
      };
    },
  );
  return validateProfile({
    id: "interstellar-roblox-aligned",
    name: "Interstellar (Roblox-Aligned)",
    bindings,
  });
}

export const interstellarMap = convertInterstellarSource();
export const defaultProfiles: KeyboardMap[] = [
  {
    ...standardMap,
    id: "standard",
    name: "Standard Virtual Piano",
    bindings: standardMap.bindings.map((binding) => ({ ...binding })),
  },
  {
    ...standardMap,
    id: "rush-e",
    name: "Rush E",
    bindings: standardMap.bindings.map((binding) => ({ ...binding })),
  },
  interstellarMap,
];

export function loadProfiles(): KeyboardMap[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const maps = JSON.parse(raw);
      if (Array.isArray(maps) && maps.length <= 40) {
        const saved = maps
          .map(validateProfile)
          .filter((map) => map.id !== interstellarMap.id);
        const preserved = saved.map((map) =>
          map.id === "interstellar" && map.name === "Interstellar"
            ? { ...map, name: "Interstellar (previous mapping)" }
            : map,
        );
        const missing = defaultProfiles.filter(
          (preset) => !preserved.some((map) => map.id === preset.id),
        );
        return [...preserved, ...missing];
      }
    }
  } catch {
    /* fall back to bundled presets */
  }
  return defaultProfiles;
}

export function saveProfiles(profiles: KeyboardMap[]): void {
  localStorage.setItem(storageKey, JSON.stringify(profiles));
}

export function duplicatePitches(map: KeyboardMap): string[] {
  const seen = new Map<string, string[]>();
  for (const binding of map.bindings) {
    for (const [layer, midi] of [
      ["normal", binding.midi],
      ["Shift", binding.shiftedMidi],
    ] as const) {
      if (midi === undefined) continue;
      const key = `${layer}:${midi}`;
      seen.set(key, [...(seen.get(key) ?? []), binding.label]);
    }
  }
  return [...seen]
    .filter(([, uses]) => uses.length > 1)
    .map(([key, uses]) => `${key.replace(":", " ")}: ${uses.join(", ")}`);
}
