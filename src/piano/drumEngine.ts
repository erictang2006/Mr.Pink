import * as Tone from "tone";
import type { DrumLayer } from "./levels";

export type DrumName = DrumLayer | "fill" | "riser";
export type DrumMode = "performance" | "timed" | "step";
export type DrumStatus = "idle" | "running" | "paused" | "awaiting-cue" | "break" | "roses-ready";
export type DrumMix = Record<DrumName, number>;
export const defaultDrumMix: DrumMix = { kick: .67, clap: .44, hat: .20, fill: .50, riser: .36 };
export type DrumSnapshot = {
  status: DrumStatus;
  mode: DrumMode;
  measure: number;
  beat: number;
  tempo: number;
  active: Record<DrumLayer, boolean>;
  pending: Partial<Record<DrumLayer, boolean>>;
  fillPending: boolean;
  riserPending: boolean;
  cuePlayed: boolean;
  pulse: number;
  nextAction: string;
};
const layers: DrumLayer[] = ["kick", "clap", "hat"];
const copy = (snapshot: DrumSnapshot): DrumSnapshot => ({ ...snapshot, active: { ...snapshot.active }, pending: { ...snapshot.pending } });
const empty: DrumSnapshot = { status: "idle", mode: "performance", measure: 9, beat: 1, tempo: 126,
  active: { kick: false, clap: false, hat: false }, pending: {}, fillPending: false, riserPending: false,
  cuePlayed: false, pulse: 0, nextAction: "Press Z to start the kick" };

/** One Tone.Transport event drives every sampled drum layer and the score clock. */
export class DrumEngine {
  private players!: Tone.Players;
  private loaded: Promise<void>;
  private ready = false;
  private eventId: number;
  private step = 0;
  private anchorBar = 9;
  private generation = 0;
  private breakTimer: number | null = null;
  private stepStopAt = 0;
  private mix: DrumMix = defaultDrumMix;
  private master = 1;
  private state: DrumSnapshot = copy(empty);

  constructor(private onChange: (snapshot: DrumSnapshot) => void, private onBar: (bar: number) => void) {
    this.loaded = new Promise((resolve, reject) => {
      this.players = new Tone.Players({
        urls: { kick: "kick.wav", clap: "clap.wav", hat: "hat.wav", fill: "fill.wav", riser: "riser.wav" },
        baseUrl: "/drums/", onload: resolve, onerror: reject,
      }).toDestination();
    });
    this.eventId = Tone.Transport.scheduleRepeat(time => this.tick(time), "8n");
  }

  async load(): Promise<void> {
    await this.loaded;
    if (!this.ready) {
      this.ready = true;
      this.setMix(this.mix);
    }
  }
  isReady(): boolean { return this.ready; }
  /** Read-only observer for stage pads; never create a player before loading. */
  isLayerPlaying(name: DrumName): boolean { return this.ready && this.players.player(name).state === "started"; }
  snapshot(): DrumSnapshot { return copy(this.state); }

  setMix(mix: DrumMix): void {
    this.mix = mix;
    // Creating a Player before its ToneAudioBuffer loads replaces the buffer's
    // onload callback, leaving Tone.Players' shared load promise pending.
    if (!this.ready) return;
    for (const name of [...layers, "fill", "riser"] as DrumName[])
      this.players.player(name).volume.rampTo(this.db(this.master * mix[name]), .04);
  }
  setMaster(value: number): void { this.master = value; this.setMix(this.mix); }
  private db(gain: number): number { return gain <= 0 ? -60 : Math.max(-60, 20 * Math.log10(gain)); }

  startAt(bar: number, speed = 1, mode: DrumMode = "performance"): void {
    this.reset();
    this.anchorBar = bar;
    this.step = 0;
    if (bar >= 12) {
      Tone.Transport.bpm.value = 100;
      this.state = { ...copy(empty), status: "roses-ready", mode, measure: 12, beat: 1, tempo: 100,
        nextAction: "Press M for the live Roses E4 entry" };
      this.emit();
      return;
    }
    this.state = { ...copy(empty), status: "running", mode, measure: bar, tempo: 126 * speed,
      nextAction: bar < 9 ? "Play the scored piano part" : bar === 9 ? "Press Z for kick" : bar === 10 ? "Press X for clap; C for hats" : "Press V for fill or B for riser" };
    Tone.Transport.bpm.value = 126 * speed;
    Tone.Transport.timeSignature = 4;
    Tone.Transport.position = 0;
    Tone.Transport.start("+0.04");
    this.emit();
  }

  pause(): void {
    if (this.state.status !== "running") return;
    Tone.Transport.pause();
    this.state.status = "paused";
    this.emit();
  }
  resume(): void {
    if (this.state.status !== "paused") return;
    Tone.Transport.start("+0.02");
    this.state.status = "running";
    this.emit();
  }
  setSpeed(speed: number): void {
    if (this.state.mode !== "timed" || !["running", "paused"].includes(this.state.status)) return;
    Tone.Transport.bpm.rampTo(126 * speed, .08);
    this.state.tempo = 126 * speed;
    this.emit();
  }
  getScoreBeat(): number {
    if (this.state.status === "roses-ready") return 44;
    if (this.state.status === "awaiting-cue" || this.state.status === "break") return 43.999;
    return (this.anchorBar - 1) * 4 + Tone.Transport.ticks / Tone.Transport.PPQ;
  }

  toggle(layer: DrumLayer, bar: number, mode: DrumMode): void {
    if (!this.ready || bar < 9 || bar > 11) return;
    this.ensureRunning(bar, mode);
    const current = this.state.pending[layer] ?? this.state.active[layer];
    this.state.pending[layer] = !current;
    this.state.nextAction = `${layer.toUpperCase()} ${!current ? "ON" : "OFF"} at next beat`;
    this.armStepStop();
    this.emit();
  }

  oneShot(name: "fill" | "riser", bar: number, mode: DrumMode): void {
    if (!this.ready || bar < 9 || bar > 11) return;
    if (this.state.status === "awaiting-cue") {
      this.players.player(name).start(Tone.now() + .03);
      this.state.cuePlayed = true;
      this.state.status = "break";
      this.state.nextAction = "Rhythmic break · Roses E is next";
      this.emit();
      this.finishBreak(Tone.now() + (name === "fill" ? 1.05 : 1.5));
      return;
    }
    this.ensureRunning(bar, mode);
    this.state[name === "fill" ? "fillPending" : "riserPending"] = true;
    this.state.nextAction = `${name.toUpperCase()} queued for next beat`;
    this.armStepStop();
    this.emit();
  }

  /** In Step Mode, every physical input gives the loops at most one more bar. */
  noteStepInput(bar: number): void {
    if (this.state.mode !== "step" || !["running", "paused"].includes(this.state.status)) return;
    this.syncStepBar(bar);
    if (this.state.status === "paused") this.resume();
    this.armStepStop();
  }
  private armStepStop(): void { if (this.state.mode === "step") this.stepStopAt = this.step + 8; }

  private ensureRunning(bar: number, mode: DrumMode): void {
    if (this.state.status === "idle" || this.state.status === "roses-ready") this.startAt(bar, 1, mode);
    else {
      if (mode === "step") this.syncStepBar(bar);
      if (this.state.status === "paused") this.resume();
    }
    if (mode === "step") this.state.mode = "step";
  }
  private syncStepBar(bar: number): void {
    if (bar <= this.state.measure || bar > 11) return;
    this.anchorBar = bar;
    this.step = 0;
    this.state.measure = bar;
    Tone.Transport.position = 0;
    this.armStepStop();
  }

  private tick(time: number): void {
    if (this.state.status !== "running") return;
    const index = this.step++;
    const bar = this.anchorBar + Math.floor(index / 8);
    const eighth = index % 8;
    const boundary = eighth % 2 === 0;
    if (bar >= 12) {
      if (this.state.fillPending) { this.players.player("fill").start(time); this.state.cuePlayed = true; }
      if (this.state.riserPending) { this.players.player("riser").start(time); this.state.cuePlayed = true; }
      this.state.active = { kick: false, clap: false, hat: false };
      this.state.pending = {};
      this.state.fillPending = false;
      this.state.riserPending = false;
      Tone.Transport.pause(time);
      if (this.state.cuePlayed) {
        this.state.status = "break";
        this.state.nextAction = "Rhythmic break · Roses E is next";
        this.finishBreak(time + (this.state.cuePlayed ? .25 : 0));
      } else {
        this.state.status = "awaiting-cue";
        this.state.nextAction = "Transition paused · press V or B to cue Roses";
      }
      this.emitAt(time);
      return;
    }
    this.state.measure = bar;
    this.state.beat = 1 + eighth / 2;
    if (boundary) {
      for (const layer of layers) if (this.state.pending[layer] !== undefined) {
        this.state.active[layer] = this.state.pending[layer]!;
        delete this.state.pending[layer];
      }
      if (this.state.fillPending) { this.players.player("fill").start(time); this.state.fillPending = false; this.state.cuePlayed = true; }
      if (this.state.riserPending) { this.players.player("riser").start(time); this.state.riserPending = false; this.state.cuePlayed = true; }
      if (this.state.active.kick && !(bar === 11 && eighth === 6)) this.players.player("kick").start(time);
      if (this.state.active.clap && (eighth === 2 || eighth === 6) && !(bar === 11 && eighth === 6)) this.players.player("clap").start(time);
    }
    if (this.state.active.hat && !(bar === 11 && eighth >= 6)) this.players.player("hat").start(time);
    if (bar >= 9 && index % 8 === 0) {
      this.state.nextAction = bar === 9 ? "Press Z for kick" : bar === 10 ? "Press X for clap; C for hats" : "Press V for fill or B for riser";
    }
    this.state.pulse++;
    this.emitAt(time);
    if (index % 8 === 0 && index > 0) this.barAt(bar, time);
    if (this.state.mode === "step" && this.step >= this.stepStopAt && this.stepStopAt > 0) {
      Tone.Transport.pause(time + 60 / this.state.tempo / 2);
      this.state.status = "paused";
      this.state.nextAction = "Step clock paused · play the next piano key";
      this.emitAt(time + 60 / this.state.tempo / 2);
    }
  }

  private finishBreak(at: number): void {
    const delay = Math.max(0, (at - Tone.now()) * 1000);
    const token = this.generation;
    this.breakTimer = window.setTimeout(() => {
      if (token !== this.generation) return;
      Tone.Transport.bpm.value = 100;
      this.state.status = "roses-ready";
      this.state.measure = 12;
      this.state.beat = 1;
      this.state.tempo = 100;
      this.state.nextAction = "Press M for the live Roses E4 entry";
      this.emit();
      this.onBar(12);
      this.breakTimer = null;
    }, delay);
  }
  private barAt(bar: number, time: number): void {
    const token = this.generation;
    Tone.Draw.schedule(() => { if (token === this.generation) this.onBar(bar); }, time);
  }
  private emitAt(time: number): void {
    const value = copy(this.state);
    const token = this.generation;
    Tone.Draw.schedule(() => { if (token === this.generation) this.onChange(value); }, time);
  }
  private emit(): void { this.onChange(copy(this.state)); }

  reset(): void {
    this.generation++;
    if (this.breakTimer !== null) { window.clearTimeout(this.breakTimer); this.breakTimer = null; }
    Tone.Transport.stop();
    this.players.stopAll();
    this.step = 0;
    this.stepStopAt = 0;
    this.state = copy(empty);
    this.emit();
  }
  dispose(): void { this.reset(); Tone.Transport.clear(this.eventId); this.players.dispose(); }
}
