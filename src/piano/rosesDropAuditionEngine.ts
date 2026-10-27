import { readObjectPreference, writeObjectPreference } from '../settings/objectPreference';
import { dropMixPreferenceKey, validDropMixer } from './mixerPreferences';
import * as Tone from "tone";
import arrangement from "./rosesDropArrangement.json";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";
import { defaultRosesDropSettings, validRosesDropSettings, type RosesDropSettings } from "./rosesDropSettings";
import type { DropLeadSound } from "./recordedDropLeadEngine";
import { audibleDropLayer, defaultDropVolumes, dropLayerIds, type DropLayer, type DropRow } from "./rosesDropMixer";
import type { DropChordPreset } from "./rosesDropPresets";
import { recordedDropTrack, recordedDropPlan, loadRecordedDropPreferences, saveRecordedDropPreferences, validRecordedOffset, recordedDropMaxVolume } from "./rosesRecordedDrop";

export const dropDrumUrls = {
  kick: "/roses/Roses Kick.wav", clap: "/roses/Roses SnareClap.wav", hat: "/roses/drop/HiHat Closed 004 Crunk.wav",
};
export type DropDrum = keyof typeof dropDrumUrls;
// The harmony render excludes channels 19–22: the live four-bank lead owns them.
export const hwmDropTracks = [
  { group: "chords", url: "/roses/hwm-backing/drop-instrumental-chords.wav" },
  { group: "bass", url: "/roses/hwm-backing/drop-bass.wav" },
] as const;
export type DropBackingSource = "hwm" | "roses" | "recording";
export const rosesInstrumentalTrack = { group: "rosesInstrumental", url: "/roses/drop/roses_punchy_Gsharp_subtle_echo_8bars_100bpm.wav" } as const;
// Reuse the existing chord row for the finished instrumental; its baked-in
// bass, percussion and ambience must never be doubled by the former stem routes.
export const activeDropLayers = (source: DropBackingSource): readonly DropLayer[] => source === "recording" ? ["lead", "recorded"] : source === "roses" ? ["lead", "chords"] : ["lead", "bass", "chords", "drums"];
export type DropStatus = "idle" | "loading" | "running" | "paused" | "done" | "error";
export type DropSnapshot = {
  status: DropStatus; ready: boolean; rows: Record<DropLayer, DropRow>;
  drumMutes: Record<DropDrum, boolean>; chordLevels: number[]; error: string;
  chordPlayback: "cached" | "synth"; lateCallbacks: number; maxLatenessMs: number;
  backingSource: DropBackingSource; chordPreset: DropChordPreset;
  leadSound: DropLeadSound; leadBrightness: number; leadRelease: number;
  recordedOffsetMs: number; activeRecordedOffsetMs: number;
};

/** One transport and lead; HWM stems or the approved finished Roses instrumental. */
export class RosesDropAuditionEngine {
  private savedMix = readObjectPreference(dropMixPreferenceKey,validDropMixer);
  private rows = this.savedMix.rows;
  private drumMutes: Record<DropDrum, boolean> = this.savedMix.drumMutes;
  private status: DropStatus = "idle";
  private error = "";
  private master = .72;
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;
  private lastBeat = -1;
  private buffers = new Map<string, Tone.ToneAudioBuffer>();
  private sources = new Set<Tone.ToneBufferSource>();
  private offlineEnded = new Set<Tone.ToneBufferSource>();
  private buses = new Map<DropLayer, Tone.Gain>();
  private drumBuses = new Map<DropDrum, Tone.Gain>();
  private output?: Tone.Gain;
  private limiter?: Tone.Limiter;
  private safety?: Tone.WaveShaper;
  private lead?: HereWithMeLeadEngine;
  private linkedSettings = { ...defaultRosesDropSettings };
  private lowerLeadLevel = .8;
  private backingStarted = false;
  private backingSource: DropBackingSource = "hwm";
  private recordedLeadEnabled = this.savedMix.recordedLeadEnabled;
  private chordPreset: DropChordPreset = this.savedMix.chordPreset;
  private chordLevels = this.savedMix.chordLevels;
  private lateCallbacks = 0;
  private maxLatenessMs = 0;
  private recordedOffsetMs = 0;
  private activeRecordedOffsetMs = 0;
  private scheduling?: { context: Tone.BaseContext & { updateInterval: number }; lookAhead: number; updateInterval: number };

  constructor(private changed: () => void, _legacyChordPlayback: "cached" | "synth" = "cached") {
    this.rows.bonkChords.enabled = false;
    const saved = loadRecordedDropPreferences();
    this.recordedOffsetMs = saved.offsetMs; this.rows.recorded.volume = saved.volume;
  }
  snapshot(): DropSnapshot {
    return { status: this.status, ready: this.ready, rows: Object.fromEntries(dropLayerIds.map(id => [id, { ...this.rows[id], ...(id === "lead" && this.backingSource === "recording" ? { enabled: this.recordedLeadEnabled } : {}) }])) as Record<DropLayer, DropRow>,
      drumMutes: { ...this.drumMutes }, chordLevels: [...this.chordLevels], error: this.error,
      chordPlayback: "cached", backingSource: this.backingSource, chordPreset: this.chordPreset, leadSound: "original", leadBrightness: this.linkedSettings.brightness, leadRelease: this.linkedSettings.closerRelease,
      recordedOffsetMs: this.recordedOffsetMs, activeRecordedOffsetMs: this.activeRecordedOffsetMs,
      lateCallbacks: this.lateCallbacks, maxLatenessMs: this.maxLatenessMs };
  }
  async prepare(): Promise<boolean> {
    if (this.ready) return true;
    this.status = "loading"; this.error = ""; this.changed();
    try {
      if (!this.loading) this.loading = Promise.all([
        ...Object.entries(dropDrumUrls).map(([group, url]) => ({ group, url })), ...hwmDropTracks, rosesInstrumentalTrack, recordedDropTrack,
      ].map(async ({ group, url }) => {
        const buffer = new Tone.ToneAudioBuffer(); this.buffers.set(group, buffer);
        await buffer.load(url); if (this.disposed) buffer.dispose();
      })).then(() => undefined);
      await this.loading;
      if (this.disposed) return false;
      this.ready = true; if (this.status === "loading") this.status = "idle"; this.changed(); return true;
    } catch {
      for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear(); this.loading = undefined;
      if (!this.disposed) { this.status = "error"; this.error = "A drop audio sample could not load. Retry Play Drop."; this.changed(); }
      return false;
    }
  }
  setMaster(value: number): void { this.master = Math.max(0, Math.min(1, value)); this.output?.gain.rampTo(this.master, .02); }
  // Keep the incorrect polyphonic lead route disabled. Physical chord instruments
  // keep their settings, but cannot reintroduce polyphonic stabs into this lead.
  setLeadSound(_value: DropLeadSound): void {}
  setLeadSettings(value: RosesDropSettings): void { this.linkedSettings = validRosesDropSettings(value); this.changed(); }
  setRecordedOffset(value: number): void {
    this.recordedOffsetMs = validRecordedOffset(value);
    saveRecordedDropPreferences({ offsetMs: this.recordedOffsetMs, volume: this.rows.recorded.volume }); this.changed();
  }
  setBackingSource(value: DropBackingSource): void {
    if (!["hwm", "roses", "recording"].includes(value) || value === this.backingSource) return;
    // Cancel already queued HWM percussion as well as its harmonic stems before
    // joining the finished Roses render (and vice versa); leave lead/vocals alone.
    this.clearSources(); this.backingSource = value;
    if (value === "recording") this.activeRecordedOffsetMs = this.recordedOffsetMs;
    this.syncOptionalLead();
    this.applyMix(); this.changed();
  }
  setChordPreset(value: DropChordPreset): void {
    if (value !== "original" && value !== "bright" || value === this.chordPreset) return;
    this.chordPreset = value;
    // Retain legacy settings without altering or restarting the mastered WAV.
    this.persistMixer(); this.changed();
  }
  setChordLevel(index: number, value: number): void {
    if ((index === 0 || index === 1) && Number.isFinite(value)) this.chordLevels[index] = Math.max(0, Math.min(1.5, value));
    this.persistMixer(); this.changed();
  }
  setRow(id: DropLayer, patch: Partial<DropRow>): void {
    if (!activeDropLayers(this.backingSource).includes(id)) return;
    const row = this.rows[id];
    for (const key of ["enabled", "muted", "solo"] as const) if (typeof patch[key] === "boolean") {
      if (id === "lead" && key === "enabled" && this.backingSource === "recording") this.recordedLeadEnabled = patch.enabled!;
      else row[key] = patch[key]!;
    }
    if (typeof patch.volume === "number" && Number.isFinite(patch.volume)) row.volume = Math.max(0, Math.min(id === "recorded" ? recordedDropMaxVolume : 1, patch.volume));
    if (id === "recorded") saveRecordedDropPreferences({ offsetMs: this.recordedOffsetMs, volume: row.volume });
    if (patch.solo) for (const other of dropLayerIds) if (other !== id) this.rows[other].solo = false;
    if (id === "lead") this.syncOptionalLead();
    this.applyMix(); this.persistMixer(); this.changed();
  }
  allOn(): void { for (const [id, row] of Object.entries(this.rows)) { row.enabled = id !== "bonkChords"; row.muted = false; row.solo = false; } if (this.backingSource === "recording") this.recordedLeadEnabled = true; this.syncOptionalLead(); for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumMutes[kind] = false; this.applyMix(); this.persistMixer(); this.changed(); }
  muteAll(): void { for (const row of Object.values(this.rows)) row.muted = true; this.applyMix(); this.persistMixer(); this.changed(); }
  resetVolumes(): void { for (const id of dropLayerIds) this.rows[id].volume = defaultDropVolumes[id]; saveRecordedDropPreferences({ offsetMs: this.recordedOffsetMs, volume: this.rows.recorded.volume }); this.setChordLevel(0,.3981071115); this.setChordLevel(1,.9332544208); this.applyMix(); this.persistMixer(); this.changed(); }
  muteDrum(kind: DropDrum, muted: boolean): void { this.drumMutes[kind] = muted; this.applyMix(); this.persistMixer(); this.changed(); }
  private persistMixer(): void {
    writeObjectPreference(dropMixPreferenceKey,{rows:this.rows,drumMutes:this.drumMutes,recordedLeadEnabled:this.recordedLeadEnabled,chordPreset:this.chordPreset,chordLevels:this.chordLevels});
  }
  private effectiveRows(): Record<DropLayer, DropRow> {
    const active = activeDropLayers(this.backingSource), rows = this.snapshot().rows;
    return Object.fromEntries(dropLayerIds.map(id => [id, active.includes(id) ? rows[id] : { ...rows[id], enabled: false, solo: false }])) as Record<DropLayer, DropRow>;
  }
  private leadAllowed(): boolean { return this.backingSource !== "recording" || this.recordedLeadEnabled; }
  private syncOptionalLead(): void {
    if (!this.leadAllowed()) { this.lead?.dispose(); this.lead = undefined; }
    else if (this.status === "running" && this.lastBeat < 176) this.prepareLead(Math.max(144, this.lastBeat));
  }
  private applyMix(): void {
    const rows = this.effectiveRows();
    for (const id of dropLayerIds) this.buses.get(id)?.gain.rampTo(audibleDropLayer(rows, id) ? this.rows[id].volume : 0, .015);
    for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumBuses.get(kind)?.gain.rampTo(this.drumMutes[kind] ? 0 : 1, .015);
  }
  start(lowerLeadLevel = .8): void {
    this.stop();
    const context = Tone.getContext();
    if (!context.isOffline && "updateInterval" in context && typeof context.updateInterval === "number") {
      this.scheduling = { context: context as Tone.BaseContext & { updateInterval: number }, lookAhead: context.lookAhead, updateInterval: context.updateInterval };
      context.lookAhead = Math.max(context.lookAhead, .2); context.updateInterval = Math.min(context.updateInterval, .025);
    }
    this.output = new Tone.Gain(this.master);
    this.safety = new Tone.WaveShaper(value => .94 * Math.tanh(value / .94), 4096).toDestination(); this.safety.oversample = "4x";
    this.limiter = new Tone.Limiter(-2).connect(this.safety); this.output.connect(this.limiter);
    for (const id of dropLayerIds) this.buses.set(id, new Tone.Gain(0).connect(this.output));
    this.lowerLeadLevel = lowerLeadLevel;
    this.activeRecordedOffsetMs = this.recordedOffsetMs;
    if (this.leadAllowed()) this.prepareLead();
    for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumBuses.set(kind, new Tone.Gain(0).connect(this.buses.get("drums")!));
    this.status = "running"; this.lastBeat = -1; this.lateCallbacks = 0; this.maxLatenessMs = 0; this.applyMix(); this.changed();
  }
  private prepareLead(beat = 144): void {
    if (this.lead) return;
    this.lead = new HereWithMeLeadEngine(this.buses.get("lead")!);
    this.lead.configure({ volume: 1, lower: this.lowerLeadLevel }); this.lead.arm(0, false); this.lead.begin(beat, true); this.lead.prepareVoices();
  }
  private startRecorded(beat: number, time: number, secondsPerBeat: number): void {
    if (this.backingStarted) return;
    const buffer = this.buffers.get("recorded")!;
    const plan = recordedDropPlan(beat, time, secondsPerBeat, this.activeRecordedOffsetMs, buffer.duration);
    if (!plan) return;
    this.backingStarted = true;
    const fadeOut = Math.min(.01, plan.duration);
    const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: 1, fadeIn: plan.offset > 0 ? Math.min(.003, plan.duration) : 0, fadeOut,
      onended: () => { this.sources.delete(source); if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose(); },
    }).connect(this.buses.get("recorded")!);
    // Tone begins its fade at start + duration. Include that fade inside the
    // musical window so a positive sync offset cannot spill into bar 45.
    this.sources.add(source); source.start(plan.time, plan.offset, plan.duration - fadeOut);
  }
  private startBacking(beat: number, time: number): void {
    if (this.backingStarted || beat >= arrangement.endBeat) return;
    this.backingStarted = true;
    const offset = (beat - arrangement.startBeat) * .6;
    const tracks = this.backingSource === "hwm" ? hwmDropTracks.map(track => ({...track, destination:this.buses.get(track.group)!})) :
      [{ ...rosesInstrumentalTrack, destination: this.buses.get("chords")! }];
    for (const track of tracks) {
      const buffer = this.buffers.get(track.group)!;
      if (offset >= buffer.duration) continue;
      const finishedRoses = this.backingSource === "roses";
      const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: 1, fadeIn: offset > 0 ? .003 : 0, fadeOut: finishedRoses ? 0 : .01,
        onended: () => { this.sources.delete(source); if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose(); },
      }).connect(track.destination);
      this.sources.add(source);
      // The finished render already fades to zero at the end of this exact slot.
      source.start(time, offset, finishedRoses ? Math.min(buffer.duration - offset, (arrangement.endBeat - beat) * .6) : undefined);
    }
  }
  tick(beat: number, time: number, secondsPerBeat: number): void {
    if (this.status !== "running" || beat === this.lastBeat) return;
    if (this.backingSource === "recording") this.startRecorded(beat, time, secondsPerBeat);
    if (beat < 144) return;
    if (this.backingSource === "recording" && this.lead && this.lastBeat < 144 && beat > 144 && beat < 176) {
      this.lead.begin(beat, true); this.lead.prepareVoices();
    }
    this.lastBeat = beat;
    if (!Tone.getContext().isOffline) { const lateMs = Math.max(0, (Tone.immediate() - time) * 1000); if (lateMs > 5) { this.lateCallbacks++; this.maxLatenessMs = Math.max(this.maxLatenessMs, lateMs); } }
    if (this.backingSource !== "recording") this.startBacking(beat, time);
    this.lead?.tick(beat, time, secondsPerBeat);
    if (beat >= 176) { this.status = "done"; this.restoreScheduling(); return; }
    if (this.backingSource !== "hwm") return; // Both Roses recordings already include their percussion.
    for (const note of arrangement.drums.filter(note => note.beat >= beat && note.beat < beat + .25)) {
      const kind = note.kind as DropDrum, buffer = this.buffers.get(kind)!;
      const at = time + (note.beat - beat) * secondsPerBeat;
      const length = Math.min(buffer.duration - note.offset, note.duration * secondsPerBeat + (kind === "hat" ? .05 : 0));
      if (length <= 0) continue;
      const source = new Tone.ToneBufferSource({ url: buffer, fadeIn: .001, fadeOut: kind === "hat" ? Math.min(.05, length / 2) : .003,
        onended: () => { this.sources.delete(source); if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose(); },
      }).connect(this.drumBuses.get(kind)!);
      this.sources.add(source); source.start(at, note.offset, undefined, note.gain * note.velocity / 127); source.stop(at + length);
    }
  }
  pause(): void { if (this.status === "running") { this.status = "paused"; this.lead?.pause(); this.clearSources(); } }
  resume(beat?: number, time?: number): void {
    if (this.status !== "paused") return;
    if (this.leadAllowed()) { this.prepareLead(Math.max(144, this.lastBeat)); this.lead?.prepareVoices(); }
    if (this.backingSource === "recording" && beat !== undefined && time !== undefined) this.startRecorded(beat, time, .6);
    this.status = "running"; this.applyMix();
  }
  restartRecordedLoop(time: number): void {
    if (this.backingSource !== "recording" || this.status !== "running") return;
    // Stop at the scheduled loop boundary, preserving audio during lookahead.
    for (const source of this.sources) { source.fadeOut = .01; source.stop(time - .01); }
    this.backingStarted = false; this.lastBeat = -1; this.activeRecordedOffsetMs = this.recordedOffsetMs;
    this.lead?.restartLoop();
  }
  private clearSources(): void { for (const source of this.sources) source.dispose(); this.sources.clear(); this.backingStarted = false; }
  private restoreScheduling(): void { if (this.scheduling) { const { context, lookAhead, updateInterval } = this.scheduling; context.lookAhead = lookAhead; context.updateInterval = updateInterval; this.scheduling = undefined; } }
  /** Only the optional finale uses this short, intentional pitch-down tail. */
  turntableStop(time: number): void {
    for (const source of this.sources) {
      source.playbackRate.cancelScheduledValues(time);
      source.playbackRate.setValueAtTime(source.playbackRate.value, time);
      source.playbackRate.linearRampToValueAtTime(.07, time + .24);
      source.fadeOut = .025; source.stop(time + .26);
    }
    this.lead?.pause(); this.status = "done";
  }
  stop(): void {
    this.restoreScheduling(); this.lead?.dispose(); this.lead = undefined; this.clearSources();
    for (const source of this.offlineEnded) source.dispose(); this.offlineEnded.clear();
    for (const bus of this.drumBuses.values()) bus.dispose(); this.drumBuses.clear();
    for (const bus of this.buses.values()) bus.dispose(); this.buses.clear();
    this.output?.dispose(); this.output = undefined; this.limiter?.dispose(); this.limiter = undefined; this.safety?.dispose(); this.safety = undefined;
    this.status = "idle"; this.lastBeat = -1;
  }
  dispose(): void { this.disposed = true; this.stop(); for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear(); }
}
