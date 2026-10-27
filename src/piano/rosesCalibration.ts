export type RosesCalibrationSettings = { leadMs: number; gradingMs: number; audibleClick: boolean };
export const metronomeVisualOffsetLimitMs = 1000;
export const defaultRosesCalibration: RosesCalibrationSettings = { leadMs: 0, gradingMs: 0, audibleClick: false };
export function loadRosesCalibration(outputId: string): RosesCalibrationSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(`stage-piano-roses-calibration:${outputId}`) || "{}");
    const number = (value: unknown, limit: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(-limit, Math.min(limit, value)) : 0;
    return { leadMs: number(saved.leadMs, metronomeVisualOffsetLimitMs), gradingMs: number(saved.gradingMs, 250), audibleClick: saved.audibleClick === true };
  } catch { return { ...defaultRosesCalibration }; }
}
export function saveRosesCalibration(outputId: string, settings: RosesCalibrationSettings): void {
  try { localStorage.setItem(`stage-piano-roses-calibration:${outputId}`, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
export function beatErrorMs(scoreBeat: number, bpm: number): number {
  return (scoreBeat - Math.round(scoreBeat)) * 60000 / bpm;
}
