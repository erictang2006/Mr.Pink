/** Permanent E-major vocal. Supplied take already contains +100 cents versus
 * the old E-flat excerpt; never shift it again. Duration and cue are unchanged. */
export const closerSource = {
  file: "/roses/here_with_me_chorus_e_major.wav",
  onsetSeconds: 34.100,
  excerptStartSeconds: 33.980,
  pickupSeconds: .120,
  originalPlaybackRate: 1,
} as const;

export const closerTimingPresets = [
  { id: "27-1-and", label: "Bar 27 · 1&", beat: 104.5 },
  { id: "27-4-and", label: "Bar 27 · 4&", beat: 107.5 },
  { id: "28-1", label: "Bar 28 · 1", beat: 108 },
  { id: "28-4", label: "Bar 28 · 4", beat: 111 },
  { id: "28-4-and", label: "Bar 28 · 4&", beat: 111.5 },
  { id: "19-4-and", label: "Bar 19 · 4&", beat: 75.5 },
  { id: "20-1", label: "Bar 20 · 1", beat: 76 },
  { id: "20-4", label: "Bar 20 · 4", beat: 79 },
  { id: "20-4-and", label: "Bar 20 · 4&", beat: 79.5 },
  { id: "21-1", label: "Bar 21 · 1", beat: 80 },
  { id: "21-2", label: "Bar 21 · 2", beat: 81 },
] as const;

export type RosesCloserSettings = {
  enabled: boolean; preset: string; offsetMs: number;
  rosesLevel: number; closerLevel: number; fadeSeconds: number;
};
export const defaultCloserSettings: RosesCloserSettings = {
  enabled: true, preset: "27-1-and", offsetMs: 0, rosesLevel: 1, closerLevel: .75, fadeSeconds: .25,
};
export function validCloserSettings(value: Partial<RosesCloserSettings> = {}): RosesCloserSettings {
  const bounded = (n: unknown, fallback: number, min: number, max: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    preset: closerTimingPresets.some(preset => preset.id === value.preset) ? value.preset! : defaultCloserSettings.preset,
    offsetMs: bounded(value.offsetMs, 0, -1000, 1000),
    rosesLevel: bounded(value.rosesLevel, 1, 0, 1.5),
    closerLevel: bounded(value.closerLevel, .75, 0, 1.5),
    fadeSeconds: bounded(value.fadeSeconds, .25, 0, 3),
  };
}
export function closerTarget(settings: RosesCloserSettings) {
  return closerTimingPresets.find(preset => preset.id === settings.preset) ?? closerTimingPresets.find(preset => preset.id === defaultCloserSettings.preset)!;
}
/** Keep the old overlay mix, but initialize this separate experiment at the requested cue. */
export function migrateCloserSettings(value: Partial<RosesCloserSettings> = {}): RosesCloserSettings {
  return validCloserSettings({ ...value, preset: "27-1-and", offsetMs: 0 });
}
/** Offset is in real milliseconds; the raw vocal always plays at its original speed. */
export function closerCuePlan(settings: RosesCloserSettings, secondsPerBeat = .6) {
  const onsetBeat = closerTarget(settings).beat + settings.offsetMs / 1000 / secondsPerBeat;
  return { onsetBeat, startBeat: onsetBeat - closerSource.pickupSeconds / secondsPerBeat };
}
export type CloserStatus = "LOADING" | "UNAVAILABLE" | "WAITING" | "PLAYING" | "PAUSED" | "MISSED" | "OFF" | "STOPPED" | "FINISHED";
