/** First four Nexus harmony voicings in the supplied Remake.flp, channel 2.
 * Source ticks 0, 144, 384 and 528 in the normalized drop selection.
 * These keys trigger chords manually; no transport or phrase is started.
 */
export const hereWithMeChords = [
  { code: "Equal", key: "=", name: "C♯ minor", notes: [49, 61, 64, 68], tick: 0 },
  { code: "Minus", key: "-", name: "B major", notes: [47, 59, 63, 66], tick: 144 },
  { code: "Digit0", key: "0", name: "Aadd9", notes: [45, 57, 61, 64, 71], tick: 384 },
  { code: "Digit9", key: "9", name: "E major", notes: [40, 52, 56, 59, 68], tick: 528 },
] as const;
export const hereWithMeChordShortcuts: Readonly<Record<string, readonly number[]>> = Object.fromEntries(hereWithMeChords.map(chord => [chord.code, chord.notes]));
export const hereWithMeChordSounds = [
  { value: "keys678", label: "Same as Keys 6–8" },
  { value: "keys123", label: "Same as Keys 1–3" },
  { value: "lead", label: "Here With Me Lead" },
  { value: "harmony", label: "Here With Me Chords / Guitar / Pad" },
] as const;
export type HereWithMeChordSound = typeof hereWithMeChordSounds[number]["value"];
export const validHereWithMeChordSound = (value: unknown): HereWithMeChordSound => value === "keys123" || value === "lead" || value === "harmony" ? value : "keys678";
