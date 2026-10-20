import * as Tone from "tone";
import arrangement from "./rosesDropArrangement.json";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";
import { RosesBassEngine } from "./rosesBassEngine";
import { RosesDropLayers } from "./rosesDropLayers";
import { defaultRosesDropSettings, validRosesDropSettings, type RosesDropSettings } from "./rosesDropSettings";
import { RecordedDropLeadEngine, type DropLeadSound } from "./recordedDropLeadEngine";
import { leadEventsAtBeat, leadPpq } from "./hereWithMeLead";
import { midiToToneName } from "./noteMapping";
import { audibleDropLayer, defaultDropVolumes, dropLayerIds, newDropRows, type DropLayer, type DropRow } from "./rosesDropMixer";
import type { DropChordPreset } from "./rosesDropPresets";

export const dropDrumUrls = {
  kick: "/roses/Roses Kick.wav", clap: "/roses/Roses SnareClap.wav", hat: "/roses/drop/HiHat Closed 004 Crunk.wav",
};
export type DropDrum = keyof typeof dropDrumUrls;
export const dropChordTracks = [
  { sound: "original", track: 0, url: "/roses/drop/chord-cache/chordA.wav" },
  { sound: "original", track: 1, url: "/roses/drop/chord-cache/chordB.wav" },
  { sound: "bonk", track: 0, url: "/roses/drop/chord-cache/bonkA.wav" },
  { sound: "bonk", track: 1, url: "/roses/drop/chord-cache/bonkB.wav" },
] as const;
export const brightDropChordTracks = [
  "/roses/drop/chord-cache/brightA.wav", "/roses/drop/chord-cache/brightB.wav",
] as const;
export type DropStatus = "idle" | "loading" | "running" | "paused" | "done" | "error";
export type DropSnapshot = {
  status: DropStatus; ready: boolean; rows: Record<DropLayer, DropRow>;
  drumMutes: Record<DropDrum, boolean>; chordLevels: number[]; error: string;
  chordPlayback: "cached" | "synth"; lateCallbacks: number; maxLatenessMs: number;
  chordPreset: DropChordPreset;
  leadSound: DropLeadSound; leadBrightness: number; leadRelease: number;
};

/** Explicit drop/section auditions enable this scheduler on the existing Roses clock. */
export class RosesDropAuditionEngine {
  private rows = newDropRows();
  private drumMutes: Record<DropDrum, boolean> = { kick: false, clap: false, hat: false };
  private chordLevels = [.3981071115, .9332544208];
  private status: DropStatus = "idle";
  private error = "";
  private master = .72;
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;
  private lastBeat = -1;
  private buffers = new Map<DropDrum, Tone.ToneAudioBuffer>();
  private sources = new Set<Tone.ToneBufferSource>();
  private offlineEnded = new Set<Tone.ToneBufferSource>();
  private buses = new Map<DropLayer, Tone.Gain>();
  private drumBuses = new Map<DropDrum, Tone.Gain>();
  private chordBuses: Tone.Gain[] = [];
  private output?: Tone.Gain;
  private limiter?: Tone.Limiter;
  private safety?: Tone.WaveShaper;
  private lead?: HereWithMeLeadEngine;
  private recordedLead?: RecordedDropLeadEngine;
  private leadSound: DropLeadSound = "original";
  private linkedSettings = { ...defaultRosesDropSettings };
  private lowerLeadLevel = .8;
  private bass?: RosesBassEngine;
  private chords: RosesDropLayers[] = [];
  private chordBuffers: Tone.ToneAudioBuffer[] = [];
  private bonkChordBuses: Tone.Gain[] = [];
  private cachedChordBuses: Tone.Gain[] = [];
  private chordSources = new Set<Tone.ToneBufferSource>();
  private chordStarted = false;
  private chordPreset: DropChordPreset = "original";
  private originalChordSources = new Set<Tone.ToneBufferSource>();
  private restartOriginalChords = false;
  private lateCallbacks = 0;
  private maxLatenessMs = 0;
  private scheduling?: { context: Tone.BaseContext & { updateInterval: number }; lookAhead: number; updateInterval: number };

  constructor(private changed: () => void, private chordPlayback: "cached" | "synth" = "cached") {}
  snapshot(): DropSnapshot {
    return { status: this.status, ready: this.ready, rows: Object.fromEntries(dropLayerIds.map(id => [id, { ...this.rows[id] }])) as Record<DropLayer, DropRow>,
      drumMutes: { ...this.drumMutes }, chordLevels: [...this.chordLevels], error: this.error,
      chordPlayback: this.chordPlayback, chordPreset: this.chordPreset, leadSound: this.leadSound, leadBrightness: this.linkedSettings.brightness, leadRelease: this.linkedSettings.closerRelease, lateCallbacks: this.lateCallbacks, maxLatenessMs: this.maxLatenessMs };
  }
  async prepare(): Promise<boolean> {
    if (this.ready) return true;
    this.status = "loading"; this.error = ""; this.changed();
    try {
      if (!this.recordedLead) this.recordedLead = new RecordedDropLeadEngine(this.linkedSettings);
      if (!this.loading) this.loading = Promise.all([this.recordedLead.load(), ...(Object.keys(dropDrumUrls) as DropDrum[]).map(async kind => {
        const buffer = new Tone.ToneAudioBuffer(); this.buffers.set(kind, buffer);
        await buffer.load(dropDrumUrls[kind]); if (this.disposed) buffer.dispose();
      }), ...(this.chordPlayback === "cached" ? [...dropChordTracks.map(track => track.url), ...brightDropChordTracks].map(async (url, index) => {
        const buffer = new Tone.ToneAudioBuffer(); this.chordBuffers[index] = buffer;
        await buffer.load(url); if (this.disposed) buffer.dispose();
      }) : [])]).then(() => undefined);
      await this.loading;
      if (this.disposed) return false;
      this.ready = true; if (this.status === "loading") this.status = "idle"; this.changed(); return true;
    } catch {
      for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear(); this.loading = undefined;
      for (const buffer of this.chordBuffers) buffer.dispose(); this.chordBuffers = [];
      this.recordedLead?.dispose(); this.recordedLead = undefined;
      if (!this.disposed) { this.status = "error"; this.error = "A drop audio sample could not load. Retry Play Drop."; this.changed(); }
      return false;
    }
  }
  setMaster(value: number): void { this.master = Math.max(0, Math.min(1, value)); this.output?.gain.rampTo(this.master, .02); }
  setLeadSound(value: DropLeadSound): void {
    if (value !== "original" && value !== "loud-stabs" || value === this.leadSound) return;
    this.lead?.dispose(); this.lead = undefined; this.recordedLead?.stop(); this.recordedLead?.disconnect();
    this.leadSound = value;
    if (this.status === "running" || this.status === "paused") this.createLead();
    this.changed();
  }
  setLeadSettings(value: RosesDropSettings): void {
    this.linkedSettings = validRosesDropSettings(value); this.recordedLead?.configure(this.linkedSettings); this.changed();
  }
  setChordPreset(value: DropChordPreset): void {
    if (this.chordPlayback !== "cached" || value !== "original" && value !== "bright" || value === this.chordPreset) return;
    this.chordPreset = value;
    if (this.chordStarted && (this.status === "running" || this.status === "paused")) {
      this.restartOriginalChords = true;
    }
    this.changed();
  }
  setRow(id: DropLayer, patch: Partial<DropRow>): void {
    const row = this.rows[id];
    for (const key of ["enabled", "muted", "solo"] as const) if (typeof patch[key] === "boolean") row[key] = patch[key]!;
    if (typeof patch.volume === "number" && Number.isFinite(patch.volume)) row.volume = Math.max(0, Math.min(1, patch.volume));
    if (patch.solo) for (const other of dropLayerIds) if (other !== id) this.rows[other].solo = false;
    this.applyMix(); this.changed();
  }
  allOn(): void { for (const row of Object.values(this.rows)) { row.enabled = true; row.muted = false; row.solo = false; } for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumMutes[kind] = false; this.applyMix(); this.changed(); }
  muteAll(): void { for (const row of Object.values(this.rows)) row.muted = true; this.applyMix(); this.changed(); }
  resetVolumes(): void { for (const id of dropLayerIds) this.rows[id].volume = defaultDropVolumes[id]; this.chordLevels = [.3981071115, .9332544208]; this.applyMix(); this.changed(); }
  muteDrum(kind: DropDrum, muted: boolean): void { this.drumMutes[kind] = muted; this.applyMix(); this.changed(); }
  setChordLevel(index: number, value: number): void {
    if ((index === 0 || index === 1) && Number.isFinite(value)) this.chordLevels[index] = Math.max(0, Math.min(1.5, value));
    this.applyMix(); this.changed();
  }
  private applyMix(): void {
    for (const id of dropLayerIds) this.buses.get(id)?.gain.rampTo(audibleDropLayer(this.rows, id) ? this.rows[id].volume : 0, .015);
    for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumBuses.get(kind)?.gain.rampTo(this.drumMutes[kind] ? 0 : 1, .015);
    this.chordBuses.forEach((bus, index) => bus.gain.rampTo(this.chordLevels[index], .015));
    this.bonkChordBuses.forEach((bus, index) => bus.gain.rampTo(this.chordLevels[index], .015));
  }
  start(lowerLeadLevel = .8): void {
    this.stop();
    const context = Tone.getContext();
    if (!context.isOffline && "updateInterval" in context && typeof context.updateInterval === "number") {
      const updateInterval = context.updateInterval;
      this.scheduling = { context: context as Tone.BaseContext & { updateInterval: number }, lookAhead: context.lookAhead, updateInterval };
      // Leave more time for dense automatic chord attacks and React/UI work.
      // Live keys still use Tone.immediate(); restore the clock on exit.
      context.lookAhead = Math.max(context.lookAhead, .2);
      context.updateInterval = Math.min(updateInterval, .025);
    }
    this.output = new Tone.Gain(this.master);
    // Dynamics limiters can overshoot on dense simultaneous hits. The final
    // soft ceiling also bounds extreme slider settings without hard clipping.
    this.safety = new Tone.WaveShaper(value => .94 * Math.tanh(value / .94), 4096).toDestination();
    this.safety.oversample = "4x";
    this.limiter = new Tone.Limiter(-2).connect(this.safety); this.output.connect(this.limiter);
    for (const id of dropLayerIds) this.buses.set(id, new Tone.Gain(0).connect(this.output));
    this.lowerLeadLevel = lowerLeadLevel; this.createLead();
    this.createBacking();
    for (const kind of Object.keys(dropDrumUrls) as DropDrum[]) this.drumBuses.set(kind, new Tone.Gain(0).connect(this.buses.get("drums")!));
    this.status = "running"; this.lastBeat = -1; this.lateCallbacks = 0; this.maxLatenessMs = 0; this.applyMix(); this.changed();
  }
  private createLead(): void {
    if (this.leadSound === "loud-stabs") {
      this.recordedLead?.configure(this.linkedSettings); this.recordedLead?.connect(this.buses.get("lead")!);
    } else {
      this.lead = new HereWithMeLeadEngine(this.buses.get("lead")!);
      this.lead.configure({ volume: 1, lower: this.lowerLeadLevel }); this.lead.arm(0, false);
      this.lead.begin(Math.max(144, this.lastBeat), true); this.lead.prepareVoices();
    }
  }
  private createBacking(): void {
    this.bass = new RosesBassEngine(this.buses.get("bass")!);
    this.bass.setMaster(1); this.bass.setVolumes(1, .65);
    for (let i = 0; i < 2; i++) {
      const bus = new Tone.Gain(this.chordLevels[i]).connect(this.buses.get("chords")!);
      this.chordBuses.push(bus);
      if (this.chordPlayback === "synth") {
        const synth = new RosesDropLayers(true); synth.setSettings(defaultRosesDropSettings); synth.connect(bus); this.chords.push(synth);
      }
    }
    if (this.chordPlayback === "cached") {
      this.bonkChordBuses = this.chordLevels.map(level => new Tone.Gain(level).connect(this.buses.get("bonkChords")!));
      this.cachedChordBuses = [...this.chordBuses, ...this.bonkChordBuses];
    }
  }
  private startChordTracks(beat: number, time: number, secondsPerBeat: number): void {
    if (this.chordPlayback !== "cached" || this.chordStarted && !this.restartOriginalChords || beat >= 176) return;
    const replaceOnly = this.chordStarted;
    if (replaceOnly) {
      // Fade only the two old Original-chord tracks at the scheduled handoff.
      // Bonk, bass, drums and lead continue through a live A/B change.
      for (const source of this.originalChordSources) source.stop(time);
      this.originalChordSources.clear();
    }
    this.chordStarted = true;
    this.restartOriginalChords = false;
    const offset = (beat - 144) * .6;
    const first = this.chordPreset === "bright" ? 4 : 0;
    const indices = replaceOnly ? [first, first + 1] : [first, first + 1, 2, 3];
    indices.forEach((bufferIndex, index) => {
      const buffer = this.chordBuffers[bufferIndex];
      if (offset >= buffer.duration) return;
      const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: .6 / secondsPerBeat, fadeIn: replaceOnly ? .01 : offset > 0 ? .003 : 0, fadeOut: .01,
        onended: () => { this.chordSources.delete(source); this.originalChordSources.delete(source); if (source.context.isOffline) this.offlineEnded.add(source); else source.dispose(); },
      }).connect(this.cachedChordBuses[index]);
      this.chordSources.add(source); if (index < 2) this.originalChordSources.add(source); source.start(time, offset);
    });
  }
  tick(beat: number, time: number, secondsPerBeat: number): void {
    if (this.status !== "running" || beat === this.lastBeat || beat < 144) return;
    this.lastBeat = beat;
    if (!Tone.getContext().isOffline) {
      const lateMs = Math.max(0, (Tone.immediate() - time) * 1000);
      if (lateMs > 5) { this.lateCallbacks++; this.maxLatenessMs = Math.max(this.maxLatenessMs, lateMs); }
    }
    this.startChordTracks(beat, time, secondsPerBeat);
    this.lead?.tick(beat, time, secondsPerBeat);
    if (this.leadSound === "loud-stabs" && beat < 176) for (const note of leadEventsAtBeat(beat)) {
      const bankGain = 10 ** ((note.channel === 19 ? -12 : note.channel === 21 ? -18 : -20) / 20) * (note.channel === 19 ? this.lowerLeadLevel : 1) * 10 ** (9 / 20);
      this.recordedLead?.trigger(note.midi, note.durationTicks / leadPpq * secondsPerBeat,
        time + (144 + note.tick / leadPpq - beat) * secondsPerBeat, note.velocity * bankGain);
    }
    if (beat >= 176) { this.status = "done"; this.restoreScheduling(); return; }
    for (const note of arrangement.notes.filter(note => note.beat >= beat && note.beat < beat + .25)) {
      const at = time + (note.beat - beat) * secondsPerBeat;
      if (note.group === "bass") {
        const scored = { midi: note.midi, durationBeats: note.duration, velocity: note.velocity, startBeat: note.beat, bar: Math.floor(note.beat / 4) + 1, beatInBar: note.beat % 4 + 1 };
        this.bass?.triggerExact([scored], at, secondsPerBeat);
      } else this.chords[note.track === 39 ? 0 : 1]?.triggerAttackRelease(midiToToneName(note.midi), note.duration * secondsPerBeat, at, note.velocity / 127);
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
  pause(): void {
    if (this.status !== "running") return;
    this.status = "paused"; this.lead?.pause(); this.recordedLead?.stop(); this.clearBacking();
    for (const source of this.sources) source.stop(Tone.immediate());
  }
  resume(): void { if (this.status === "paused") { this.lead?.prepareVoices(); this.createBacking(); this.status = "running"; this.applyMix(); } }
  private clearBacking(): void {
    for (const source of this.chordSources) source.dispose(); this.chordSources.clear(); this.chordStarted = false;
    this.originalChordSources.clear(); this.restartOriginalChords = false;
    this.cachedChordBuses = [];
    for (const bus of this.bonkChordBuses) bus.dispose(); this.bonkChordBuses = [];
    this.bass?.dispose(); this.bass = undefined;
    for (const chord of this.chords) chord.dispose(); this.chords = [];
    for (const bus of this.chordBuses) bus.dispose(); this.chordBuses = [];
  }
  private restoreScheduling(): void {
    if (!this.scheduling) return;
    const { context, lookAhead, updateInterval } = this.scheduling;
    context.lookAhead = lookAhead; context.updateInterval = updateInterval;
    this.scheduling = undefined;
  }
  stop(): void {
    this.restoreScheduling();
    this.lead?.dispose(); this.lead = undefined; this.clearBacking();
    this.recordedLead?.stop(); this.recordedLead?.disconnect();
    for (const source of this.sources) source.dispose(); this.sources.clear();
    for (const source of this.offlineEnded) source.dispose(); this.offlineEnded.clear();
    for (const bus of this.drumBuses.values()) bus.dispose(); this.drumBuses.clear();
    for (const bus of this.buses.values()) bus.dispose(); this.buses.clear();
    this.output?.dispose(); this.output = undefined; this.limiter?.dispose(); this.limiter = undefined; this.safety?.dispose(); this.safety = undefined;
    this.status = "idle"; this.lastBeat = -1;
  }
  dispose(): void {
    this.disposed = true; this.stop();
    this.recordedLead?.dispose(); this.recordedLead = undefined;
    for (const buffer of this.buffers.values()) buffer.dispose(); this.buffers.clear();
    for (const buffer of this.chordBuffers) buffer.dispose(); this.chordBuffers = [];
  }
}
