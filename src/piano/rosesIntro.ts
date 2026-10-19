import { buildupKick } from "./rosesBuildup";
import manifest from "./roses_first12_manifest.json";
import continuation from "./roses_bars13_to20_manifest.json";
import build from "./roses_bars21_to24_manifest.json";
import extension from "./roses_bars25_to28_manifest.json";

export const rosesIntroTempo = 100;
export const rosesIntroBars = 36;
export const rosesIntroBeats = 144;
export const rosesBuildStartBeat = 80;
export const rosesVocalCue = { armBar: 4, startBar: 5, sourceOffsetSeconds: 9.6 } as const;
export const rosesVocalPerformanceSeconds = (rosesVocalCue.startBar - 1) * 4 * 60 / rosesIntroTempo;
/** Start the backing early for its attack while keeping the written note-off on the beat grid. */
export function rosesSynthTiming(beatTime: number, durationSeconds: number, leadMs: number, earliestStart: number) {
  const leadSeconds = Math.max(0, Math.min(60, Number.isFinite(leadMs) ? leadMs : 0)) / 1000;
  const start = Math.max(earliestStart, beatTime - leadSeconds);
  return { start, duration: durationSeconds + (beatTime - start) };
}
export type RosesNote = { startBeat: number; durationBeats: number; midi: number; velocity: number; bar: number; beatInBar: number };
export type RosesDrum = { startBeat: number; bar: number; beatInBar: number };

/** Exact positions from the supplied MIDI and Ableton timing manifest. */
export const rosesIntroNotes: RosesNote[] = [...manifest.events.intro_pad_midi, ...continuation.events.intro_pad].map(event => ({
  startBeat: event.start_beat, durationBeats: event.duration_beats, midi: event.midi_pitch,
  velocity: event.velocity, bar: event.bar, beatInBar: event.beat_in_bar,
}));
export const rosesIntroKicks: RosesDrum[] = [...manifest.events.kick, ...continuation.events.kick].map(event => ({ startBeat: event.start_beat, bar: event.bar, beatInBar: event.beat_in_bar }));
export const rosesIntroClaps: RosesDrum[] = [...manifest.events.clap, ...continuation.events.clap].map(event => ({ startBeat: event.start_beat, bar: event.bar, beatInBar: event.beat_in_bar }));
export const rosesBassNotes: RosesNote[] = continuation.events.break_bass.map(event => ({ startBeat: event.start_beat, durationBeats: event.duration_beats, midi: event.midi_pitch, velocity: event.velocity, bar: event.bar, beatInBar: event.beat_in_bar }));
export const rosesSubNotes: RosesNote[] = continuation.events.break_sub.map(event => ({ startBeat: event.start_beat, durationBeats: event.duration_beats, midi: event.midi_pitch, velocity: event.velocity, bar: event.bar, beatInBar: event.beat_in_bar }));
export const rosesBuildBassNotes: RosesNote[] = [
  ...build.build_bass.map(event => ({ startBeat: event.start_beat, durationBeats: event.duration_beats, midi: event.midi_pitch, velocity: event.velocity, bar: Math.floor(event.start_beat / 4) + 1, beatInBar: event.start_beat % 4 + 1 })),
  ...extension.clip_timing.flatMap(clip => clip.events ?? []).map(event => ({ startBeat: event.start_beat, durationBeats: event.duration_beats, midi: event.midi, velocity: 100, bar: Math.floor(event.start_beat / 4) + 1, beatInBar: event.start_beat % 4 + 1 })),
];
export const rosesGuitarRepeat = {
  startBeat: 96,
  leftEndBeat: extension.clip_timing.find(clip => clip.track === "Guitar L")!.end_beat,
  rightEndBeat: extension.clip_timing.find(clip => clip.track === "Guitar R")!.end_beat,
  leftPan: -.6, rightPan: .605,
} as const;
export const rosesAccentTargets: RosesDrum[] = continuation.events.whoo_accent.map(event => ({ startBeat: event.start_beat, bar: event.bar, beatInBar: event.beat_in_bar }));
export const rosesIntroNoteAt = new Map(rosesIntroNotes.map(event => [event.startBeat, event]));
export const rosesIntroBarNotes = (bar: number) => rosesIntroNotes.filter(event => event.bar === bar);
export const rosesIntroLoopEvents = rosesIntroNotes.filter(event => event.bar <= 4);
export type RosesDrumKind = "kick" | "clap";
export type RosesDrumTarget = RosesDrum & { kind: RosesDrumKind; code: "KeyZ" | "KeyX"; id: string };
export const rosesDrumTargets: RosesDrumTarget[] = [
  ...buildupKick.map((startBeat, index) => ({ startBeat, bar: Math.floor(startBeat / 4) + 1, beatInBar: startBeat % 4 + 1, kind: "kick" as const, code: "KeyZ" as const, id: `buildup-kick-${index}` })),
  ...rosesIntroKicks.map((event, index) => ({ ...event, kind: "kick" as const, code: "KeyZ" as const, id: `kick-${index}` })),
  ...rosesIntroClaps.filter(event => event.bar >= 9).map((event, index) => ({ ...event, kind: "clap" as const, code: "KeyX" as const, id: `clap-${index}` })),
].sort((a, b) => a.startBeat - b.startBeat || a.kind.localeCompare(b.kind));
export function applyRosesCue(bar: number, active: boolean, pending?: boolean) {
  return bar >= 5 && pending !== undefined ? { active: pending, pending: undefined } : { active, pending };
}
export function loopSourceBeat(absoluteBeat: number): number { return (absoluteBeat - 16) % 16; }
export function rosesEventsAtBeat(absoluteBeat: number, synthActive: boolean): RosesNote[] {
  if (!synthActive || absoluteBeat < 16 || absoluteBeat >= rosesBuildStartBeat) return [];
  const sourceBeat = loopSourceBeat(absoluteBeat);
  return rosesIntroLoopEvents.filter(event => event.startBeat === sourceBeat);
}
export function rosesBassAtBeat(absoluteBeat: number, bassActive: boolean): { bass: RosesNote[]; sub: RosesNote[] } {
  if (!bassActive || absoluteBeat < 48 || absoluteBeat >= rosesBuildStartBeat) return { bass: [], sub: [] };
  return { bass: rosesBassNotes.filter(event => event.startBeat === absoluteBeat), sub: rosesSubNotes.filter(event => event.startBeat === absoluteBeat) };
}
