import manifest from "./roses_buildup_manifest.json";
export const buildupStart = 112, buildupBreak = 140, buildupEnd = 144;
export type BuildupLayer = "vox" | "spacy" | "roll" | "chops" | "snap";
export type BuildupEvent = { layer: BuildupLayer; beat: number; end: number; offset: number; gain: number };
export const buildupEvents = manifest.events as BuildupEvent[];
export const buildupBass = manifest.bass;
export const buildupKick = manifest.kick;
export const buildupAssets: Record<BuildupLayer, string> = {
  vox: "/roses/buildup/Vox synth.wav", spacy: "/roses/buildup/spacy drum.wav",
  roll: "/roses/buildup/Snare Drum 005 808 Double Beam.wav", chops: "/roses/aah vocal chop loop 2.wav",
  snap: "/roses/buildup/snap for drop.wav",
};
export type BuildupSettings = { voxMode: "original" | "light"; vox: number; spacy: number; roll: number; chops: number; chopsMuted: boolean };
export const defaultBuildupSettings: BuildupSettings = { voxMode: "light", vox: .65, spacy: .26, roll: .3, chops: .35, chopsMuted: false };
export function validBuildupSettings(raw: Partial<BuildupSettings> = {}): BuildupSettings {
  const result = { ...defaultBuildupSettings, voxMode: raw.voxMode === "original" ? "original" as const : "light" as const, chopsMuted: raw.chopsMuted === true };
  for (const key of ["vox", "spacy", "roll", "chops"] as const) if (typeof raw[key] === "number" && Number.isFinite(raw[key])) result[key] = Math.max(0, Math.min(1.5, raw[key]));
  return result;
}
export function snareTranspose(beat: number): number {
  return manifest.snare_pitch_automation.reduce((sum, points) => {
    let value = points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [at, next] = points[i], [previousAt, previous] = points[i - 1];
      if (beat < at) { value = previous + (next - previous) * Math.max(0, (beat - previousAt) / (at - previousAt)); break; }
      value = next;
    }
    return sum + Math.round(value);
  }, 0);
}
export function buildupStatusText(beat: number): string {
  return beat >= buildupEnd ? "DROP NEXT · bar 37 (not implemented)" : beat >= 143 ? "FINAL SNAP · DROP NEXT" : beat >= buildupBreak ? "BREAK · chops only until beat 4" : beat >= 136 ? "BUILD · sixteenth-note roll" : beat >= 128 ? "BUILD · eighth-note percussion" : "BUILD · quarter-note Spacy · Z kick live";
}
