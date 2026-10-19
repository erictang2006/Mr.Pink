export type RosesDropSettings = {
  mode: "drop" | "bonk";
  closerMode: "current" | "loud";
  closerRelease: number;
  body: number; punch: number; bass: number; bonk: number; space: number;
  brightness: number; decay: number; release: number; output: number;
  duck: boolean;
  bassEnabled: boolean;
};

export const defaultRosesDropSettings: RosesDropSettings = {
  mode: "bonk", closerMode: "loud", closerRelease: .12, body: 1, punch: .22, bass: .5, bonk: .35, space: .15,
  brightness: 2800, decay: .6, release: .85, output: .9, duck: false, bassEnabled: true,
};

export function validRosesDropSettings(raw: unknown = undefined): RosesDropSettings {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const result = { ...defaultRosesDropSettings };
  const bounds = { bonk: [0, 1.5], space: [0, 1], body: [0, 1.5], punch: [0, 1.5], bass: [0, 1.5], brightness: [650, 4000], decay: [.2, .75], release: [.35, 1.2], output: [0, 1] } as const;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = Math.max(bounds[key][0], Math.min(bounds[key][1], value));
  }
  // Older preferences stored a 600–1200 ms release. Migrate them so a short
  // physical tap cannot be stretched into a nearly one-second chord.
  if (typeof input.closerRelease === "number" && Number.isFinite(input.closerRelease))
    result.closerRelease = input.closerRelease >= .6
      ? defaultRosesDropSettings.closerRelease
      : Math.max(.05, Math.min(.4, input.closerRelease));
  // Only these two dedicated chord instruments are selectable.
  result.mode = input.mode === "drop" ? "drop" : "bonk";
  result.closerMode = input.closerMode === "current" ? "current" : "loud";
  result.duck = input.duck === true;
  result.bassEnabled = typeof input.bassEnabled === "boolean" ? input.bassEnabled : defaultRosesDropSettings.bassEnabled;
  return result;
}
