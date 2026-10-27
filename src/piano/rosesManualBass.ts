export type RosesBassPlaybackMode = "auto" | "manual";
export const rosesManualBassKeys = [
  { code: "Comma", label: ",", midi: 49, name: "C♯3" },
  { code: "Period", label: ".", midi: 45, name: "A2" },
  { code: "Slash", label: "/", midi: 40, name: "E2" },
] as const;
export const rosesManualBassNote = (code: string) => rosesManualBassKeys.find(key => key.code === code);
const storageKey = "stage-piano-roses-bass-playback-v1";
export function loadRosesBassPlayback(): RosesBassPlaybackMode {
  try { return localStorage.getItem(storageKey) === "manual" ? "manual" : "auto"; }
  catch { return "auto"; }
}
export function saveRosesBassPlayback(mode: RosesBassPlaybackMode): void {
  try { localStorage.setItem(storageKey, mode); } catch { /* Storage is optional. */ }
}

/** Visual-only gestures accompany the armed automatic early bass section. */
export function silentAutomaticBassActive(clock?: { bassPlaybackMode?: RosesBassPlaybackMode; status: string; measure: number; bassActive: boolean } | null): boolean {
  return clock?.bassPlaybackMode === 'auto' && ['running', 'paused'].includes(clock.status)
    && clock.bassActive && clock.measure >= 13 && clock.measure <= 20;
}
