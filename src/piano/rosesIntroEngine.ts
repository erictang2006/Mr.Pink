import type {RiserSettings} from "./hybridBacking";
import * as Tone from "tone";
import { RosesBackingEngine } from "./rosesBackingEngine";
import type { BackingMode, BackingGroup } from "./rosesBacking";
import type { BuildupSettings } from "./rosesBuildup";
import { applyRosesCue, rosesBassAtBeat, rosesBuildBassNotes, rosesBuildStartBeat, rosesDrumTargets, rosesEventsAtBeat, rosesGuitarRepeat, rosesIntroBars, rosesIntroTempo, rosesSynthTiming, rosesVocalCue, type RosesDrumKind } from "./rosesIntro";
import { RosesBassEngine } from "./rosesBassEngine";
import { RosesCloserEngine } from "./rosesCloserEngine";
import type { CloserStatus, RosesCloserSettings } from "./rosesCloser";
import type { SynthEngine } from "./synthEngine";
import { HereWithMeLeadEngine, type LeadSnapshot } from "./hereWithMeLeadEngine";
import { leadEndBar } from "./hereWithMeLead";
import { RosesDropAuditionEngine, type DropSnapshot, type DropDrum, type DropBackingSource } from "./rosesDropAuditionEngine";
import type { DropLayer, DropRow } from "./rosesDropMixer";
import type { DropChordPreset } from "./rosesDropPresets";
import type { DropLeadSound } from "./recordedDropLeadEngine";
import type { RosesDropSettings } from "./rosesDropSettings";

export type RosesClockMode = "step" | "timed" | "performance";
export type LiveDrumHit = { kind: RosesDrumKind; bar: number; beat: number; scoreBeat: number };
export type RosesIntroSnapshot = {
  status: "idle" | "running" | "paused" | "finished";
  mode: RosesClockMode; measure: number; beat: number; pulse: number;
  synthActive: boolean; synthPending?: boolean;
  bassActive: boolean; bassPending?: boolean; missedBassHandoff: boolean;
  buildActive: boolean; buildPending: boolean;
  sectionTails: boolean;
  vocalStatus: "NOT ARMED" | "ARMED" | "PLAYING" | "FADING";
  vocalReady: boolean;
  closerStatus: CloserStatus; closerReady: boolean;
  buildup?: ReturnType<RosesBackingEngine["snapshot"]>;
  lead?: LeadSnapshot;
  drop?: DropSnapshot;
  cycle: number;
  lastDrum?: { kind: RosesDrumKind; sequence: number };
  lastAccent?: number;
};
const initial = (): RosesIntroSnapshot => ({ status: "idle", mode: "timed", measure: 1, beat: 1, pulse: 0, synthActive: false, bassActive: false, missedBassHandoff: false, buildActive: false, buildPending: false, sectionTails: false, vocalStatus: "NOT ARMED", vocalReady: false, closerStatus: "LOADING", closerReady: false, cycle: 0 });
const clone = (state: RosesIntroSnapshot): RosesIntroSnapshot => ({ ...state, lastDrum: state.lastDrum && { ...state.lastDrum } });

/** One beat grid schedules backing and the optional vocal overlay; drums remain physical-key hits. */
export class RosesIntroEngine {
  private players!: Tone.Players;
  private output: Tone.Volume;
  private bass = new RosesBassEngine();
  private vocal: Tone.Player;
  private vocalGain: Tone.Gain;
  private closer: RosesCloserEngine;
  private buildup: RosesBackingEngine;
  private lead: HereWithMeLeadEngine;
  private drop = new RosesDropAuditionEngine(() => this.emit());
  private guitar!: Tone.Player;
  private guitarLeft?: Tone.Player;
  private guitarRight?: Tone.Player;
  private guitarLeftPan?: Tone.Panner;
  private guitarRightPan?: Tone.Panner;
  private click: Tone.Synth;
  private vocalOffset: number = rosesVocalCue.sourceOffsetSeconds;
  private vocalConfirmed = false;
  private vocalLevel = 1;
  private disposed = false;
  private audibleClick = false;
  private loaded: Promise<void>;
  private ready = false;
  private eventId: number;
  private anchorBar = 1;
  private transportStartBar = 1;
  private step = 0;
  private generation = 0;
  private drumSequence = 0;
  private state = initial();
  private master = .72;
  private speed = 1;
  private synthLeadMs = 20;
  private finishTime: number | null = null;
  private joinCloserAtStart = false;
  private clipSources = new Map<Tone.Player, { time: number; offset: number; duration: number }>();
  private pausedClips = new Map<Tone.Player, { offset: number; duration: number; delay: number }>();
  private practiceLoop: { start: number; end: number } | null = null;
  private loopEntryBacking: { synth: boolean; bass: boolean; build: boolean } | null = null;

  constructor(private synth: SynthEngine, private onChange: (snapshot: RosesIntroSnapshot) => void, private getTranspose: () => number) {
    const drumsLoaded = new Promise<void>((resolve, reject) => {
      this.players = new Tone.Players({ urls: { kick: "Roses Kick.wav", clap: "Roses SnareClap.wav", accent: "woo weird sample roses.wav" }, baseUrl: "/roses/", onload: resolve, onerror: reject });
    });
    this.output = new Tone.Volume(-18).toDestination();
    this.lead = new HereWithMeLeadEngine(this.output);
    this.buildup = new RosesBackingEngine(this.output, this.bass);
    this.vocalGain = new Tone.Gain(1).connect(this.output);
    this.closer = new RosesCloserEngine(this.output, () => this.emit());
    this.players.connect(this.output);
    const guitarLoaded = new Promise<void>((resolve, reject) => {
      this.guitar = new Tone.Player({ url: "/roses/Guitar build up bass compliment.wav", onload: resolve, onerror: reject }).connect(this.output);
    });
    this.loaded = Promise.all([drumsLoaded, guitarLoaded]).then(() => undefined);
    this.guitar.fadeIn = .005; this.guitar.fadeOut = .02;
    this.vocal = new Tone.Player({ url: "/roses/roses_vocals_original_timeline.wav", onload: () => { this.state.vocalReady = true; this.emit(); }, onerror: () => { this.state.vocalReady = false; this.emit(); } }).connect(this.vocalGain);
    this.vocal.fadeOut = .02;
    this.click = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: .001, decay: .025, sustain: 0, release: .015 }, volume: -9 }).connect(this.output);
    this.eventId = Tone.Transport.scheduleRepeat(time => this.tick(time), "16n");
  }
  async load(): Promise<void> {
    await Promise.all([this.loaded, this.buildup.load()]);
    if (this.disposed) return;
    if (!this.guitarLeft) {
      this.guitarLeftPan = new Tone.Panner(rosesGuitarRepeat.leftPan).connect(this.output);
      this.guitarRightPan = new Tone.Panner(rosesGuitarRepeat.rightPan).connect(this.output);
      // Reuse the existing WAV and preserve the mix level when summing the two source tracks.
      this.guitarLeft = new Tone.Player({ url: this.guitar.buffer, volume: -6.0206, fadeIn: .005, fadeOut: .02 }).connect(this.guitarLeftPan);
      this.guitarRight = new Tone.Player({ url: this.guitar.buffer, volume: -6.0206, fadeIn: .005, fadeOut: .02 }).connect(this.guitarRightPan);
    }
    this.ready = true; this.setMaster(this.master); this.emit();
  }
  isReady(): boolean { return this.ready; }
  snapshot(): RosesIntroSnapshot { return clone({ ...this.state, ...this.closer.snapshot(), buildup: this.buildup.snapshot(), lead: this.lead.snapshot(), drop: this.drop.snapshot() }); }
  /** A full take keeps the existing early-section arming and adds the drop at 37. */
  async startWithDrop(bar: number, mode: RosesClockMode, preserveSynth = false): Promise<boolean> {
    if (!this.ready || !this.synth.isPlayable() || !Number.isInteger(bar) || bar < 1 || bar > 36) return false;
    const lower = this.lead.snapshot().lower;
    this.pause(); this.drop.stop(); this.lead.stop();
    this.state.status = "idle";
    this.practiceLoop = null; this.setSpeed(1);
    const token = ++this.generation;
    if (!await this.drop.prepare() || token !== this.generation || this.disposed) return false;
    this.setSpeed(1);
    // A new full take always queues the selected source. Reset first: arm()
    // toggles an existing arm and rejects a previously PLAYING/BREAK take.
    this.buildup.stop(); this.buildup.arm(0, false);
    return this.startAt(bar, mode, preserveSynth, lower);
  }
  async playDrop(): Promise<boolean> {
    if (!this.ready || !this.synth.isPlayable()) return false;
    const lower = this.lead.snapshot().lower;
    this.reset(37); this.practiceLoop = null; this.setSpeed(1);
    const token = this.generation;
    if (!await this.drop.prepare() || token !== this.generation || this.disposed) return false;
    this.setSpeed(1);
    return this.startAt(37, "timed", false, lower);
  }
  setDropBackingSource(value: DropBackingSource): void { this.drop.setBackingSource(value); }
  setDropRow(id: DropLayer, patch: Partial<DropRow>): void { this.drop.setRow(id, patch); }
  setDropChordPreset(value: DropChordPreset): void { this.drop.setChordPreset(value); }
  setDropLeadSound(value: DropLeadSound): void { this.drop.setLeadSound(value); }
  setDropLeadSettings(value: RosesDropSettings): void { this.drop.setLeadSettings(value); }
  dropAllOn(): void { this.drop.allOn(); }
  dropMuteAll(): void { this.drop.muteAll(); }
  resetDropVolumes(): void { this.drop.resetVolumes(); }
  muteDropDrum(kind: DropDrum, muted: boolean): void { this.drop.muteDrum(kind, muted); }
  setDropChordLevel(index: number, value: number): void { this.drop.setChordLevel(index, value); }
  armLead(): boolean {
    if (["running", "paused"].includes(this.drop.snapshot().status)) return false;
    const armed = this.lead.arm(this.scoreBeat(), this.state.status === "running" || this.state.status === "paused");
    this.emit(); return armed;
  }
  disarmLead(): void { this.lead.stop(); this.emit(); }
  setLeadSettings(settings: Partial<Omit<LeadSnapshot, "status">>): void {
    this.lead.configure(settings);
    this.emit();
  }
  rehearseLead(bar: 36 | 37, mode: RosesClockMode): boolean {
    if (!this.ready || !this.synth.isPlayable()) return false;
    this.reset(bar); this.practiceLoop = null; this.setSpeed(1);
    this.armLead(); return this.startAt(bar, mode);
  }
  setBuildupSettings(settings: BuildupSettings): void { this.buildup.configure(settings); this.emit(); }
  setBackingMode(mode: BackingMode): void {
    this.buildup.setMode(mode);
    if (mode !== "roses" && ["ARMED", "PLAYING", "BREAK"].includes(this.buildup.snapshot().status)) this.setSpeed(1);
    this.emit();
  }
  setPreDropRiser(patch:Partial<RiserSettings>):void {this.buildup.setRiser(patch);this.emit();}
  previewPreDropRiser():void {if(this.state.status!=="running"&&this.state.status!=="paused")this.buildup.previewRiser();}
  setBackingMix(patch: { gain?: number; group?: BackingGroup; level?: number; solo?: BackingGroup | null }): void { this.buildup.setMix(patch); this.emit(); }
  armBuildup(): boolean {
    const armed = this.buildup.arm(this.scoreBeat(), this.state.status === "running" || this.state.status === "paused");
    this.emit(); return armed;
  }
  cancelBuildup(): void { this.buildup.stop(); this.emit(); }
  /** Prepare the full drop before starting; its existing scheduler stays silent until bar 37. */
  rehearseFrom25(mode: RosesClockMode): Promise<boolean> { return this.rehearseIntoDrop(25, mode); }
  rehearseFrom29(mode: RosesClockMode): Promise<boolean> { return this.rehearseIntoDrop(29, mode); }
  private async rehearseIntoDrop(bar: 25 | 29 | 33 | 36, mode: RosesClockMode): Promise<boolean> {
    if (!this.ready || !this.synth.isPlayable()) return false;
    const lower = this.lead.snapshot().lower;
    this.reset(bar); this.practiceLoop = null; this.setSpeed(1);
    const token = this.generation;
    if (!await this.drop.prepare() || token !== this.generation || this.disposed) return false;
    this.setSpeed(1);
    if (bar === 25) this.armBuild();
    this.armBuildup();
    // The mixer owns the only drop lead. Do not arm the standalone lead as well.
    return this.startAt(bar, mode, false, lower, bar >= 29);
  }
  rehearseBuildup(bar: 29 | 33 | 36, mode: RosesClockMode): boolean | Promise<boolean> {
    if(this.buildup.snapshot().mode==="hybrid")return this.rehearseIntoDrop(bar,mode);
    if (!this.ready || !this.synth.isPlayable()) return false;
    this.buildup.stop(); this.buildup.arm(0, false);
    this.practiceLoop = null;
    return this.startAt(bar, mode);
  }
  setCloserSettings(settings: RosesCloserSettings): void {
    this.closer.configure(settings);
    this.vocalLevel = settings.rosesLevel;
    this.vocalGain.gain.rampTo(settings.rosesLevel, settings.fadeSeconds);
    this.emit();
  }
  tempo(): number { return Tone.Transport.bpm.value; }
  scoreBeat(): number {
    const beats = Tone.Transport.ticks / Tone.Transport.PPQ;
    return this.practiceLoop && this.state.mode !== "performance"
      ? (this.practiceLoop.start - 1) * 4 + (((this.transportStartBar - this.practiceLoop.start) * 4 + beats) % ((this.practiceLoop.end - this.practiceLoop.start + 1) * 4))
      : (this.anchorBar - 1) * 4 + beats;
  }
  setMaster(value: number): void { this.master = value; this.output.volume.rampTo(value <= 0 ? -60 : 20 * Math.log10(value) - 15, .04); this.bass.setMaster(value); this.drop.setMaster(value); }
  setBassVolumes(bass: number, sub: number): void { this.bass.setVolumes(bass, sub); }
  setVocalOffset(seconds: number, confirmed: boolean): void {
    if (!Number.isFinite(seconds)) return;
    this.vocalOffset = Math.max(0, Math.min(225, seconds));
    this.vocalConfirmed = confirmed;
    if (!confirmed && this.state.vocalStatus === "ARMED") this.state.vocalStatus = "NOT ARMED";
    this.emit();
  }
  setAudibleClick(enabled: boolean): void { this.audibleClick = enabled; }
  armVocal(): boolean {
    if (!this.state.vocalReady || !this.vocalConfirmed || this.state.vocalStatus !== "NOT ARMED") return false;
    if (this.state.status === "running" && this.state.measure !== rosesVocalCue.armBar) return false;
    if (this.state.status === "idle" && this.state.measure > rosesVocalCue.startBar) return false;
    this.state.vocalStatus = "ARMED"; this.emit(); return true;
  }
  setPracticeLoop(range: { start: number; end: number } | null): void {
    this.practiceLoop = range && range.start >= 1 && range.end <= rosesIntroBars && range.start <= range.end ? { ...range } : null;
  }
  setSpeed(value: number): void {
    const dropStatus = this.drop.snapshot().status;
    const backing = this.buildup.snapshot();
    const fixedBacking = backing.mode !== "roses" && ["ARMED", "PLAYING", "BREAK"].includes(backing.status);
    this.speed = dropStatus === "running" || dropStatus === "paused" || fixedBacking ? 1 : Math.max(.5, Math.min(1.25, value));
    Tone.Transport.bpm.rampTo(rosesIntroTempo * this.speed, .05);
    this.guitar.playbackRate = this.speed; this.vocal.playbackRate = this.speed;
    if (this.guitarLeft) this.guitarLeft.playbackRate = this.speed; if (this.guitarRight) this.guitarRight.playbackRate = this.speed;
  }
  setSynthLeadMs(value: number): void { this.synthLeadMs = Math.max(0, Math.min(60, Number.isFinite(value) ? value : 20)); }

  armSynth(): void {
    const current = this.state.synthPending ?? this.state.synthActive;
    this.state.synthPending = !current;
    this.emit();
  }
  armBass(): void {
    if (this.state.bassActive || this.state.bassPending) return;
    this.state.bassPending = true;
    this.emit();
  }
  armBuild(): void {
    if (this.state.status === "running" && this.state.measure >= 21) return;
    this.state.buildPending = !this.state.buildPending;
    this.emit();
  }
  private playClip(player: Tone.Player, time: number, offset: number, duration?: number): void {
    this.clipSources.set(player, { time, offset, duration: duration ?? Math.max(0, player.buffer.duration - offset) });
    player.start(time, offset, duration);
  }
  private stopClip(player: Tone.Player, time: number): void {
    player.stop(time); this.clipSources.delete(player); this.pausedClips.delete(player);
  }
  private pauseClips(time: number): void {
    this.pausedClips.clear();
    for (const [player, clip] of this.clipSources) {
      const elapsed = Math.max(0, time - clip.time) * player.playbackRate;
      if (elapsed < clip.duration) this.pausedClips.set(player, {
        offset: clip.offset + elapsed, duration: clip.duration - elapsed, delay: Math.max(0, clip.time - time),
      });
      player.stop(time);
    }
    this.clipSources.clear();
  }
  private resumeClips(time: number): void {
    for (const [player, clip] of this.pausedClips) this.playClip(player, time + clip.delay, clip.offset, clip.duration);
    this.pausedClips.clear();
  }
  private startGuitarRepeat(time: number, scoreBeat: number): void {
    const offset = (scoreBeat - rosesGuitarRepeat.startBeat) * 60 / rosesIntroTempo;
    this.guitarLeft!.playbackRate = this.speed; this.guitarRight!.playbackRate = this.speed;
    this.playClip(this.guitarLeft!, time, offset, (rosesGuitarRepeat.leftEndBeat - scoreBeat) * 60 / rosesIntroTempo);
    this.playClip(this.guitarRight!, time, offset, (rosesGuitarRepeat.rightEndBeat - scoreBeat) * 60 / rosesIntroTempo);
  }
  private stopBuild(time = Tone.now()): void {
    this.stopClip(this.guitar, time);
    if (this.guitarLeft) this.stopClip(this.guitarLeft, time); if (this.guitarRight) this.stopClip(this.guitarRight, time);
    this.state.buildActive = false;
  }
  stopLoop(): void {
    this.generation++;
    this.drop.stop();
    this.lead.stop();
    this.state.synthActive = false; this.state.synthPending = undefined;
    this.state.bassActive = false; this.state.bassPending = undefined;
    this.state.buildPending = false; this.stopBuild();
    this.state.vocalStatus = "NOT ARMED";
    this.buildup.stop();
    this.closer.stop();
    this.stopClip(this.vocal, Tone.immediate()); this.synth.stopLoop(); this.bass.releaseAll(); this.emit();
  }
  /** A sample starts at audio-context time now, without transport quantization. */
  hitDrum(kind: RosesDrumKind): LiveDrumHit | null {
    if (!this.ready || this.state.measure < 5 || this.state.measure > rosesIntroBars || this.state.status === "finished" && (this.finishTime === null || Tone.immediate() >= this.finishTime)) return null;
    const scoreBeat = this.state.status === "running" ? this.scoreBeat() : (this.state.measure - 1) * 4 + this.state.beat - 1;
    this.players.player(kind).start(Tone.immediate());
    this.state.lastDrum = { kind, sequence: ++this.drumSequence };
    this.emit();
    return { kind, bar: this.state.measure, beat: this.state.beat, scoreBeat };
  }
  hitAccent(): boolean {
    if (!this.ready || this.state.status === "finished" && (this.finishTime === null || Tone.immediate() >= this.finishTime)) return false;
    this.players.player("accent").start(Tone.immediate());
    this.state.lastAccent = ++this.drumSequence;
    this.emit(); return true;
  }
  startAt(bar: number, mode: RosesClockMode, preserveSynth = false, dropLowerLevel?: number, joinCloser = false): boolean {
    if (!this.ready || !this.synth.isPlayable() || !Number.isInteger(bar) || bar < 1 || bar > leadEndBar) return false;
    this.drop.stop();
    if (mode === "performance") this.speed = 1;
    const pending = this.state.synthPending;
    const bassPending = this.state.bassPending;
    const active = preserveSynth && this.state.synthActive;
    const bassActive = preserveSynth && this.state.bassActive;
    const vocalStatus = bar <= rosesVocalCue.startBar && this.state.vocalStatus === "ARMED" ? "ARMED" : "NOT ARMED";
    const buildPending = this.state.buildPending || (preserveSynth && this.state.buildActive);
    this.lead.begin((bar - 1) * 4);
    this.closer.reset(); this.buildup.begin((bar - 1) * 4); this.clipSources.clear(); this.pausedClips.clear(); this.loopEntryBacking = null;
    Tone.Transport.stop(); this.players.stopAll(); this.stopClip(this.vocal, Tone.immediate()); this.synth.stopLoop(); this.bass.releaseAll(); this.stopBuild();
    this.generation++; this.anchorBar = bar; this.transportStartBar = bar; this.step = 0; this.finishTime = null;
    this.joinCloserAtStart = joinCloser || this.buildup.snapshot().mode==="hybrid"&&bar>=29&&bar<=36;
    this.state = { ...initial(), status: "running", mode, measure: bar, beat: 1, pulse: 0, synthActive: active, synthPending: pending, bassActive, bassPending, missedBassHandoff: false, buildActive: false, buildPending, vocalStatus, vocalReady: this.state.vocalReady, cycle: 0 };
    this.vocalGain.gain.cancelScheduledValues(Tone.immediate());
    this.vocalGain.gain.setValueAtTime(this.vocalLevel, Tone.immediate());
    Tone.Transport.bpm.value = rosesIntroTempo * this.speed;
    this.guitar.playbackRate = this.speed; this.vocal.playbackRate = this.speed;
    Tone.Transport.timeSignature = 4;
    Tone.Transport.position = 0;
    if (dropLowerLevel !== undefined) this.drop.start(dropLowerLevel);
    Tone.Transport.start("+0.05");
    this.emit(); return true;
  }
  pause(): void { if (this.state.status === "running") { const time = Tone.immediate(); this.drop.pause(); this.lead.pause(); this.closer.pause(time); this.buildup.pause(time, this.scoreBeat()); this.pauseClips(time); Tone.Transport.pause(time); this.state.status = "paused"; this.emit(); } }
  resume(): void { if (this.state.status === "paused" && this.state.mode !== "step") { const time = Tone.now() + .03; this.drop.resume(); this.closer.resume(time); this.buildup.resume(time); this.resumeClips(time); Tone.Transport.start(time); this.state.status = "running"; this.emit(); } }
  /** Step Mode pauses at every expected drum position until the performer plays it. */
  resumeStep(): void {
    if (this.state.status !== "paused" || this.state.mode !== "step") return;
    this.state.status = "running";
    const time = Tone.now() + .03; this.drop.resume(); this.closer.resume(time); this.buildup.resume(time); this.resumeClips(time); Tone.Transport.start(time); this.emit();
  }
  reset(bar = 1): void {
    this.drop.stop();
    this.lead.stop();
    this.generation++; Tone.Transport.stop(); if (this.ready) this.players.stopAll(); this.stopClip(this.vocal, Tone.immediate()); this.synth.stopLoop(); this.bass.releaseAll(); this.stopBuild();
    this.closer.reset(); this.buildup.stop(); this.clipSources.clear(); this.pausedClips.clear(); this.loopEntryBacking = null;
    this.step = 0; this.finishTime = null; this.state = { ...initial(), measure: bar, vocalReady: this.state.vocalReady }; this.emit();
  }
  private tick(time: number): void {
    if (this.state.status !== "running") return;
    const index = this.step++;
    let bar = this.anchorBar + Math.floor(index / 16);
    if (this.practiceLoop && this.state.mode !== "performance" && bar > this.practiceLoop.end) {
      this.lead.begin((this.practiceLoop.start - 1) * 4);
      this.closer.reset(time); this.buildup.begin((this.practiceLoop.start - 1) * 4, true);
      if (this.state.mode === "step") {
        Tone.Transport.stop(time);
        this.stopClip(this.vocal, time);
        this.stopBuild(time);
        this.state = { ...initial(), measure: this.practiceLoop.start, mode: "step", vocalReady: this.state.vocalReady, cycle: this.state.cycle + 1 };
        const token = this.generation;
        Tone.Draw.schedule(() => { if (token === this.generation) { this.synth.stopLoop(); this.bass.releaseAll(); } }, time);
        this.emitAt(time); return;
      }
      this.anchorBar = this.practiceLoop.start;
      this.step = 1;
      bar = this.practiceLoop.start;
      this.state.cycle++;
      if (bar === 19 && this.practiceLoop.end >= 24 && this.loopEntryBacking) {
        this.state.synthActive = this.loopEntryBacking.synth;
        this.state.bassActive = this.loopEntryBacking.bass;
        this.state.buildPending = this.loopEntryBacking.build;
        if (this.state.vocalStatus === "PLAYING") {
          this.stopClip(this.vocal, time);
          this.vocal.start(time, this.vocalOffset + ((bar - rosesVocalCue.startBar) * 4) * 60 / rosesIntroTempo);
        }
      }
      if (bar >= 21 && this.state.buildActive) this.state.buildPending = true;
      this.stopBuild(time);
      if (bar <= rosesVocalCue.startBar) { this.stopClip(this.vocal, time); this.state.vocalStatus = "NOT ARMED"; }
      if (bar === 1) {
        this.state.synthActive = false; this.state.synthPending = undefined;
        this.state.bassActive = false; this.state.bassPending = undefined;
        this.state.missedBassHandoff = false;
      }
    }
    const tickInBar = index % 16;
    const absoluteBeat = (bar - 1) * 4 + tickInBar / 4;
    if (bar >= 29) {
      const auditioning = this.drop.snapshot().status === "running";
      this.drop.tick(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed));
      if (auditioning && this.drop.snapshot().status === "done") {
        Tone.Transport.stop(time); this.state.status = "finished"; this.state.measure = 44; this.state.beat = 4; this.finishTime = time;
        this.emitAt(time); return;
      }
      this.lead.tick(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed));
      if (absoluteBeat === 112) this.state.buildActive = false;
      this.buildup.tick(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed));
      if (this.joinCloserAtStart) { this.closer.joinAt(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed)); this.joinCloserAtStart = false; }
      // The written score ends here; let recorded audio finish and keep the same beat clock running.
      this.closer.tick(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed));
      if (this.audibleClick && tickInBar % 4 === 0) this.click.triggerAttackRelease(tickInBar === 0 ? "C6" : "G5", .025, time);
      this.state.measure = bar; this.state.beat = 1 + tickInBar / 4; this.state.pulse++;
      if (this.state.mode === "step" && rosesDrumTargets.some(target => target.startBeat === absoluteBeat)) {
        this.closer.pause(time); this.buildup.pause(time, absoluteBeat); Tone.Transport.pause(time); this.state.status = "paused";
      }
      this.emitAt(time); return;
    }
    if (tickInBar === 0) {
      const startBuild = bar === 21 || bar >= 21 && this.state.buildPending && !this.state.buildActive;
      if (startBuild) {
        if (bar === 21 && this.loopEntryBacking) this.loopEntryBacking.build = this.state.buildPending;
        this.state.synthActive = false; this.state.synthPending = undefined;
        this.state.bassActive = false; this.state.bassPending = undefined;
        this.synth.stopLoop(time);
        this.bass.releaseAll(time);
        this.state.buildActive = this.state.buildPending;
        this.state.buildPending = false;
        if (this.state.buildActive) {
          if (bar >= 25) this.startGuitarRepeat(time, absoluteBeat);
          else this.playClip(this.guitar, time, (bar - 21) * 4 * 60 / rosesIntroTempo);
        }
      }
      if (bar === 25 && this.state.buildActive && !startBuild) this.startGuitarRepeat(time, absoluteBeat);
      if (bar === rosesVocalCue.startBar && this.state.vocalStatus === "ARMED" && this.state.vocalReady && this.vocalConfirmed) {
        this.playClip(this.vocal, time, this.vocalOffset);
        this.state.vocalStatus = "PLAYING";
      }
      const wasActive = this.state.synthActive;
      const next = bar < 21 ? applyRosesCue(bar, wasActive, this.state.synthPending) : { active: false, pending: undefined };
      this.state.synthActive = next.active; this.state.synthPending = next.pending;
      if (wasActive && !next.active) this.synth.stopLoop(time);
      if (bar >= 13 && bar < 21) {
        if (this.state.bassPending !== undefined) {
          const wasBassActive = this.state.bassActive;
          this.state.bassActive = this.state.bassPending;
          this.state.bassPending = undefined;
          if (wasBassActive && !this.state.bassActive) this.bass.releaseAll();
        }
        if (bar === 13 && !this.state.bassActive) this.state.missedBassHandoff = true;
        if (this.state.bassActive) this.state.missedBassHandoff = false;
      }
      if (bar === 19 && this.practiceLoop?.start === 19 && this.practiceLoop.end >= 24 && !this.loopEntryBacking)
        this.loopEntryBacking = { synth: this.state.synthActive, bass: this.state.bassActive, build: this.state.buildPending };
    }
    this.closer.tick(absoluteBeat, time, 60 / (rosesIntroTempo * this.speed));
    if (this.audibleClick && tickInBar % 4 === 0) this.click.triggerAttackRelease(bar === 1 || tickInBar === 0 ? "C6" : "G5", .025, time);
    for (const event of rosesEventsAtBeat(absoluteBeat, this.state.synthActive)) {
      const timing = rosesSynthTiming(time, event.durationBeats * 60 / (rosesIntroTempo * this.speed), this.synthLeadMs, Tone.immediate());
      this.synth.triggerLoopNote(event.midi + this.getTranspose() - 4, timing.start, timing.duration);
    }
    const bass = rosesBassAtBeat(absoluteBeat, this.state.bassActive);
    this.bass.trigger(bass.bass, bass.sub, time, 60 / (rosesIntroTempo * this.speed));
    if (this.state.buildActive && absoluteBeat >= rosesBuildStartBeat) {
      this.bass.triggerBuild(rosesBuildBassNotes.filter(note => note.startBeat === absoluteBeat), time, 60 / (rosesIntroTempo * this.speed));
    }
    this.state.measure = bar; this.state.beat = 1 + tickInBar / 4; this.state.pulse++;
    if (this.state.mode === "step" && rosesDrumTargets.some(target => target.startBeat === absoluteBeat)) {
      this.closer.pause(time);
      Tone.Transport.pause(time);
      this.state.status = "paused";
    }
    this.emitAt(time);
  }
  private emitAt(time: number): void {
    const token = this.generation, value = this.snapshot();
    Tone.Draw.schedule(() => { if (token === this.generation) this.onChange(value); }, time);
  }
  private emit(): void { this.onChange(this.snapshot()); }
  dispose(): void { this.disposed = true; this.reset(); this.drop.dispose(); this.lead.dispose(); Tone.Transport.clear(this.eventId); this.players.dispose(); this.vocal.dispose(); this.vocalGain.dispose(); this.closer.dispose(); this.guitar.dispose(); this.guitarLeft?.dispose(); this.guitarRight?.dispose(); this.guitarLeftPan?.dispose(); this.guitarRightPan?.dispose(); this.click.dispose(); this.buildup.dispose(); this.output.dispose(); this.bass.dispose(); }
}
