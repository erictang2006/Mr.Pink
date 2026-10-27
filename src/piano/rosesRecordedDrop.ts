export const recordedDropTrack = { group: "recorded", url: "/roses/drop/roses-original-recording-8bars-100bpm.wav" } as const;
// A different source needs a fresh sync calibration; retain the user's volume.
export const recordedDropStorageKey = "stage-piano-roses-recorded-drop-official-wav-v2";
const previousRecordedDropStorageKey = "stage-piano-roses-recorded-drop-v1";
export const defaultRecordedDropPreferences = { offsetMs: 0, volume: .8 };
export const recordedDropMaxVolume = 2;
export const validRecordedOffset = (value: number): number => Number.isFinite(value) ? Math.round(Math.max(-500, Math.min(500, value)) / 10) * 10 : 0;
type Preferences = typeof defaultRecordedDropPreferences;
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export function loadRecordedDropPreferences(storage?: StorageAccess): Preferences {
  try {
    const access = storage ?? globalThis.localStorage;
    const current = access.getItem(recordedDropStorageKey);
    const raw = JSON.parse(current ?? access.getItem(previousRecordedDropStorageKey) ?? "{}");
    return { offsetMs: current === null ? 0 : validRecordedOffset(raw?.offsetMs), volume: typeof raw?.volume === "number" && Number.isFinite(raw.volume) ? Math.max(0, Math.min(recordedDropMaxVolume, raw.volume)) : defaultRecordedDropPreferences.volume };
  } catch { return { ...defaultRecordedDropPreferences }; }
}
export function saveRecordedDropPreferences(value: Preferences, storage?: StorageAccess): void {
  try { (storage ?? globalThis.localStorage).setItem(recordedDropStorageKey, JSON.stringify(value)); } catch { /* Match existing local preference behavior when storage is unavailable. */ }
}
/** One shared-transport window; negative offsets seek forward when a take starts late. */
export function recordedDropPlan(beat: number, time: number, secondsPerBeat: number, offsetMs: number, duration = 19.2) {
  const target = 144 + offsetMs / 1000 / secondsPerBeat;
  if (beat >= 176 || target >= beat + .25 - 1e-8) return undefined;
  const delay = Math.max(0, (target - beat) * secondsPerBeat);
  const offset = Math.max(0, (beat - target) * secondsPerBeat);
  const length = Math.min(duration - offset, (176 - beat) * secondsPerBeat - delay);
  return length > 0 ? { time: time + delay, offset, duration: length } : undefined;
}
