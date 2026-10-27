import type { InterstellarSection } from "./interstellarPerformance";
/** Ordered live set. The audio-only finale follows the complete Roses / HWM arrangement. */
export const performanceSetlist = ["levels", "interstellar", "roses", "soda-pop"] as const;
export function nextPerformanceSong(song: string) {
  const index = performanceSetlist.findIndex(item => item === song);
  return index >= 0 ? performanceSetlist[index + 1] : undefined;
}

/** Finish all Interstellar sections before advancing the live set. */
export function nextPerformanceStep(song: string, section: InterstellarSection):
  { section: InterstellarSection } | { song: typeof performanceSetlist[number] } | undefined {
  if (song === "interstellar" && section < 3) return { section: (section + 1) as InterstellarSection };
  const next = nextPerformanceSong(song);
  return next ? { song: next } : undefined;
}
