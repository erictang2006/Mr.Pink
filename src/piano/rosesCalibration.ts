export type RosesCalibrationSettings = { leadMs: number; gradingMs: number; audibleClick: boolean };
export const defaultRosesCalibration: RosesCalibrationSettings = { leadMs: 0, gradingMs: 0, audibleClick: false };
export function loadRosesCalibration(outputId: string): RosesCalibrationSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(`stage-piano-roses-calibration:${outputId}`) || "{}");
    const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(-250, Math.min(250, value)) : 0;
    return { leadMs: number(saved.leadMs), gradingMs: number(saved.gradingMs), audibleClick: saved.audibleClick === true };
  } catch { return { ...defaultRosesCalibration }; }
}
export function saveRosesCalibration(outputId: string, settings: RosesCalibrationSettings): void {
  try { localStorage.setItem(`stage-piano-roses-calibration:${outputId}`, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
export function beatErrorMs(scoreBeat: number, bpm: number): number {
  return (scoreBeat - Math.round(scoreBeat)) * 60000 / bpm;
}
