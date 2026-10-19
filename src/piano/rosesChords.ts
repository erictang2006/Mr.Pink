// J/K remain melody keys; L remains the vocal cue. In Roses only, 4–8
// intentionally override their individual low notes with live chords.
export const rosesChordShortcuts: Readonly<Record<string, readonly number[]>> = {
  Digit1: [61, 65, 68, 75],
  Digit2: [63, 67, 70, 75],
  Digit3: [65, 68, 72, 75],
  Digit4: [49, 53, 56, 63],
  Digit5: [51, 55, 58, 63],
  Digit6: [57, 61, 64, 69],
  Digit7: [59, 63, 66, 71],
  Digit8: [61, 64, 68, 73],
};

export const rosesChordHint = "Live chords: 1 D♭add9 · 2 E♭ major · 3 Fm7 · 4/5 = lower 1/2 · 8 C♯ minor · 7 B major · 6 A major · hold to sustain, release to stop";
export const rosesChordSource = (code: string, midi: number): string => `roses-chord:${code}:${midi}`;
