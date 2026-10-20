/** First four Nexus harmony voicings in the supplied Remake.flp, channel 2.
 * Source ticks 0, 144, 384 and 528 in the normalized drop selection.
 * These keys trigger chords manually; no transport or phrase is started.
 */
export const hereWithMeChords = [
  { code: "Equal", key: "=", name: "C minor", notes: [48, 60, 63, 67], tick: 0 },
  { code: "Minus", key: "-", name: "B♭ major", notes: [46, 58, 62, 65], tick: 144 },
  { code: "Digit0", key: "0", name: "A♭add9", notes: [44, 56, 60, 63, 70], tick: 384 },
  { code: "Digit9", key: "9", name: "E♭ major", notes: [39, 51, 55, 58, 67], tick: 528 },
] as const;
export const hereWithMeChordShortcuts: Readonly<Record<string, readonly number[]>> = Object.fromEntries(hereWithMeChords.map(chord => [chord.code, chord.notes]));
export const hereWithMeChordSounds = [
  { value: "keys678", label: "Same as Keys 6–8" },
  { value: "keys123", label: "Same as Keys 1–3" },
  { value: "lead", label: "Here With Me Lead" },
] as const;
export type HereWithMeChordSound = typeof hereWithMeChordSounds[number]["value"];
export const validHereWithMeChordSound = (value: unknown): HereWithMeChordSound => value === "keys123" || value === "lead" ? value : "keys678";
