import * as Tone from "tone";
import arrangement from "./rosesDropArrangement.json";
import { RosesBassEngine } from "./rosesBassEngine";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";
import { defaultRosesDropSettings, validRosesDropSettings, type RosesDropSettings } from "./rosesDropSettings";
import type { DropLeadSound } from "./recordedDropLeadEngine";
import { audibleDropLayer, defaultDropVolumes, dropLayerIds, newDropRows, type DropLayer, type DropRow } from "./rosesDropMixer";
import type { DropChordPreset } from "./rosesDropPresets";

export const dropDrumUrls = {
  kick: "/roses/Roses Kick.wav", clap: "/roses/Roses SnareClap.wav", hat: "/roses/drop/HiHat Closed 004 Crunk.wav",
};
export type DropDrum = keyof typeof dropDrumUrls;
// The harmony render excludes channels 19–22: the live four-bank lead owns them.
export const hwmDropTracks = [
  { group: "chords", url: "/roses/hwm-backing/drop-instrumental-chords.wav" },
  { group: "bass", url: "/roses/hwm-backing/drop-bass.wav" },
] as const;
export type DropBackingSource = "hwm" | "roses";
const rosesChordTracks = ["chordA", "chordB", "bonkA", "bonkB", "brightA", "brightB"].map(name => ({group:name,url:`/roses/drop/chord-cache/${name}.wav`}));
export type DropStatus = "idle" | "loading" | "running" | "paused" | "done" | "error";
export type DropSnapshot = {
  status: DropStatus; ready: boolean; rows: Record<DropLayer, DropRow>;
  drumMutes: Record<DropDrum, boolean>; chordLevels: number[]; error: string;
  chordPlayback: "cached" | "synth"; lateCallbacks: number; maxLatenessMs: number;
  backingSource: DropBackingSource; chordPreset: DropChordPreset;
  leadSound: DropLeadSound; leadBrightness: number; leadRelease: number;
};

/** One transport and lead; selectable HWM or original Roses harmonic backing. */
export class RosesDropAuditionEngine {
  private rows = newDropRows();
  private drumMutes: Record<DropDrum, boolean> = { kick: false, clap: false, hat: false };
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
  private rosesSelected = false;
  private chordPreset: DropChordPreset = "original";
  private chordLevels = [.3981071115, .9332544208];
  private rosesBass?: RosesBassEngine;
  private backingSources = new Set<Tone.ToneBufferSource>();
  private chordBuses: Tone.Gain[] = [];
  private lateCallbacks = 0;
  private maxLatenessMs = 0;
  private scheduling?: { context: Tone.BaseContext & { updateInterval: number }; lookAhead: number; updateInterval: number };

  constructor(private changed: () => void, _legacyChordPlayback: "cached" | "synth" = "cached") {
    this.rows.bonkChords.enabled = false;
  }
  snapshot(): DropSnapshot {
    return { status: this.status, ready: this.ready, rows: Object.fromEntries(dropLayerIds.map(id => [id, { ...this.rows[id] }])) as Record<DropLayer, DropRow>,
      drumMutes: { ...this.drumMutes }, chordLevels: [...this.chordLevels], error: this.error,
      chordPlayback: "cached", backingSource: this.backingSource, chordPreset: this.chordPreset, leadSound: "original", leadBrightness: this.linkedSettings.brightness, leadRelease: this.linkedSettings.closerRelease,
      lateCallbacks: this.lateCallbacks, maxLatenessMs: this.maxLatenessMs };
  }
  async prepare(): Promise<boolean> {
    if (this.ready) return true;
    this.status = "loading"; this.error = ""; this.changed();
    try {
      if (!this.loading) this.loading = Promise.all([
        ...Object.entries(dropDrumUrls).map(([group, url]) => ({ group, url })), ...hwmDropTracks, ...rosesChordTracks,
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
  setBackingSource(value: DropBackingSource): void {
    if (value !== "hwm" && value !== "roses" || value === this.backingSource) return;
    this.clearBacking(); this.backingSource = value;
    if (value === "roses" && !this.rosesSelected) { this.rows.bonkChords.enabled = true; this.rosesSelected = true; }
    // A hidden Bonk solo must not silence the HWM arrangement.
    if (value === "hwm") this.rows.bonkChords.solo = false;
    if (this.status === "running" || this.status === "paused") this.createBacking();
    this.applyMix(); this.changed();
  }
  setChordPreset(value: DropChordPreset): void {
    if (value !== "original" && value !== "bright" || value === this.chordPreset) return;
    this.chordPreset = value;
    if (this.backingSource === "roses") this.clearBackingSources();
    this.changed();
  }
  setChordLevel(index: number, value: number): void {
    if ((index === 0 || index === 1) && Number.isFinite(value)) this.chordLevels[index] = Math.max(0, Math.min(1.5, value));
    this.chordBuses.forEach((bus, i) => bus.gain.rampTo(this.chordLevels[i % 2], .015)); this.changed();
  }
  setRow(id: DropLayer, patch: Partial<DropRow>): void {
    if (id === "bonkChords" && this.backingSource === "hwm") return;
    const row = this.rows[id];
    for (const key of ["enabled", "muted", "solo"] as const) if (typeof patch[key] === "boolean") row[key] = patch[key]!;
    if (typeof patch.volume === "number" && Number.isFinite(patch.volume)) row.volume = Math.max(0, Math.min(1, patch.volume));
    if (patch.solo) for (const other of dropLayerIds) if (other !== id) this.rows[other].solo = false;
    this.applyMix(); this.changed();
  }
  allOn(): void { for (const [id, row] of Object.entries(this.rows)) { row.enabled = id !== "bonkChords" || this.backingSource === "roses"; row.muted = false; row.solo = false; } for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumMutes[kind] = false; this.applyMix(); this.changed(); }
  muteAll(): void { for (const row of Object.values(this.rows)) row.muted = true; this.applyMix(); this.changed(); }
  resetVolumes(): void { for (const id of dropLayerIds) this.rows[id].volume = defaultDropVolumes[id]; this.setChordLevel(0,.3981071115); this.setChordLevel(1,.9332544208); this.applyMix(); this.changed(); }
  muteDrum(kind: DropDrum, muted: boolean): void { this.drumMutes[kind] = muted; this.applyMix(); this.changed(); }
  private effectiveRows(): Record<DropLayer, DropRow> {
    return this.backingSource === "roses" ? this.rows : { ...this.rows, bonkChords: { ...this.rows.bonkChords, enabled: false, solo: false } };
  }
  private applyMix(): void {
    for (const id of dropLayerIds) this.buses.get(id)?.gain.rampTo((id !== "bonkChords" || this.backingSource === "roses") && audibleDropLayer(this.effectiveRows(), id) ? this.rows[id].volume : 0, .015);
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
    this.lead = new HereWithMeLeadEngine(this.buses.get("lead")!);
    this.lead.configure({ volume: 1, lower: this.lowerLeadLevel }); this.lead.arm(0, false); this.lead.begin(144); this.lead.prepareVoices();
    for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumBuses.set(kind, new Tone.Gain(0).connect(this.buses.get("drums")!));
    this.createBacking();
    this.status = "running"; this.lastBeat = -1; this.lateCallbacks = 0; this.maxLatenessMs = 0; this.applyMix(); this.changed();
  }
  private createBacking(): void {
    if (this.backingSource !== "roses" || this.rosesBass) return;
    this.rosesBass = new RosesBassEngine(this.buses.get("bass")!); this.rosesBass.setMaster(1); this.rosesBass.setVolumes(1, .65);
    for (let index = 0; index < 4; index++) this.chordBuses.push(new Tone.Gain(this.chordLevels[index % 2]).connect(this.buses.get(index < 2 ? "chords" : "bonkChords")!));
  }
  private startBacking(beat: number, time: number): void {
    if (this.backingStarted || beat >= 176) return;
    this.backingStarted = true;
    const offset = (beat - 144) * .6;
    const tracks = this.backingSource === "hwm" ? hwmDropTracks.map(track => ({...track, destination:this.buses.get(track.group)!})) :
      [this.chordPreset === "bright" ? "brightA" : "chordA", this.chordPreset === "bright" ? "brightB" : "chordB", "bonkA", "bonkB"].map((group,index)=>({group,destination:this.chordBuses[index]}));
    for (const track of tracks) {
      const buffer = this.buffers.get(track.group)!;
      if (offset >= buffer.duration) continue;
      const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: 1, fadeIn: offset > 0 ? .003 : 0, fadeOut: .01,
        onended: () => { this.sources.delete(source); this.backingSources.delete(source); if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose(); },
      }).connect(track.destination);
      this.backingSources.add(source); this.sources.add(source); source.start(time, offset);
    }
  }
  tick(beat: number, time: number, secondsPerBeat: number): void {
    if (this.status !== "running" || beat === this.lastBeat || beat < 144) return;
    this.lastBeat = beat;
    if (!Tone.getContext().isOffline) { const lateMs = Math.max(0, (Tone.immediate() - time) * 1000); if (lateMs > 5) { this.lateCallbacks++; this.maxLatenessMs = Math.max(this.maxLatenessMs, lateMs); } }
    this.startBacking(beat, time);
    this.lead?.tick(beat, time, secondsPerBeat);
    if (beat >= 176) { this.status = "done"; this.restoreScheduling(); return; }
    if (this.backingSource === "roses") for (const note of arrangement.notes.filter(note => note.group === "bass" && note.beat >= beat && note.beat < beat + .25)) {
      this.rosesBass?.triggerExact([{midi:note.midi,durationBeats:note.duration,velocity:note.velocity,startBeat:note.beat,bar:Math.floor(note.beat/4)+1,beatInBar:note.beat%4+1}],time+(note.beat-beat)*secondsPerBeat,secondsPerBeat);
    }
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
  pause(): void { if (this.status === "running") { this.status = "paused"; this.lead?.pause(); this.clearSources(); this.clearBacking(); } }
  resume(): void { if (this.status === "paused") { this.lead?.prepareVoices(); this.createBacking(); this.status = "running"; this.applyMix(); } }
  private clearBackingSources(): void {
    for (const source of this.backingSources) { source.dispose(); this.sources.delete(source); } this.backingSources.clear(); this.backingStarted = false;
  }
  private clearBacking(): void {
    this.clearBackingSources(); this.rosesBass?.dispose(); this.rosesBass = undefined;
    for (const bus of this.chordBuses) bus.dispose(); this.chordBuses = [];
  }
  private clearSources(): void { for (const source of this.sources) source.dispose(); this.sources.clear(); this.backingStarted = false; }
  private restoreScheduling(): void { if (this.scheduling) { const { context, lookAhead, updateInterval } = this.scheduling; context.lookAhead = lookAhead; context.updateInterval = updateInterval; this.scheduling = undefined; } }
  stop(): void {
    this.restoreScheduling(); this.lead?.dispose(); this.lead = undefined; this.clearSources(); this.clearBacking();
    for (const source of this.offlineEnded) source.dispose(); this.offlineEnded.clear();
    for (const bus of this.drumBuses.values()) bus.dispose(); this.drumBuses.clear();
    for (const bus of this.buses.values()) bus.dispose(); this.buses.clear();
    this.output?.dispose(); this.output = undefined; this.limiter?.dispose(); this.limiter = undefined; this.safety?.dispose(); this.safety = undefined;
    this.status = "idle"; this.lastBeat = -1;
  }
  dispose(): void { this.disposed = true; this.stop(); for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear(); }
}
