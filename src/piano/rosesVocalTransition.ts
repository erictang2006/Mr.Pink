/** Original Roses sung vocal only. At the default 9.6 s source offset,
 * source time equals performance time. Preserve the recording through bar 28,
 * with a final 300 ms fade ending exactly at the bar-29 downbeat.
 * This envelope is separate from the user mix and other vocal/instrument buses.
 */
export const rosesVocalHandoff = {
  startBeat: 111.5, // Bar 28, beat 4&: 66.9 s.
  endBeat: 112, // Bar 29, beat 1: 67.2 s.
} as const;

export function rosesVocalHandoffGain(beat: number): number {
  const { startBeat, endBeat } = rosesVocalHandoff;
  return Math.max(0, Math.min(1, (endBeat - beat) / (endBeat - startBeat)));
}
