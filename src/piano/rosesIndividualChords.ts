import { rosesChordShortcuts } from "./rosesChords";

const otherChords = Object.fromEntries(Object.entries(rosesChordShortcuts).filter(([code]) => !/^Digit[678]$/.test(code)));
/** Preserve original engine identity, including its root impact, velocity and bass ownership. */
export const rosesChordTriggerOrigins: Readonly<Record<string, string>> = { KeyP: "Digit8", KeyO: "Digit7", KeyI: "Digit6" };
export const rosesChordEngineCode = (code: string) => rosesChordTriggerOrigins[code] ?? code;
export const rosesLiveChordShortcuts = { ...otherChords, ...Object.fromEntries(Object.entries(rosesChordTriggerOrigins).map(([code, original]) => [code, rosesChordShortcuts[original]])) };
// Explicit manual buildup lead mode retains its individual O/P notes.
export const rosesChordBindings = (manualLead = false) => manualLead ? otherChords : rosesLiveChordShortcuts;

/** Fixed visual pitches for silent chord gestures, matching Levels. */
export const rosesIndividualChordNotes: Readonly<Record<string, number>> = {
  Digit6:49, Digit7:51, Digit8:52,
  KeyQ:57, KeyW:59, KeyE:61, KeyR:63, KeyT:64,
  KeyY:66, KeyU:68, KeyI:69, KeyO:71, KeyP:73,
};
export const rosesIndividualChordPitch = (code:string):number|undefined => rosesIndividualChordNotes[code];
export const rosesChordHint = "Full Roses chords: P = C♯ minor (old 8) · O = B major (old 7) · I = A major (old 6). Q/W/E/R/T/Y/U and 1–8 animate silently. Explicit manual buildup lead mode retains its own notes. =/−/0/9 show silent Roses drop chords plus an octave above.";
