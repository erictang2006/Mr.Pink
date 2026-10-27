import * as Tone from "tone";
import { midiToToneName } from "./noteMapping";
import { leadEndBeat, leadEventsAtBeat, leadPpq, leadStartBeat } from "./hereWithMeLead";

export type LeadStatus = "OFF" | "ARMED" | "PLAYING" | "DONE";
export type LeadSnapshot = { status: LeadStatus; volume: number; lower: number; muted: boolean };
type Bank = { voice: Tone.PolySynth<Tone.Synth>; filter: Tone.Filter; pan: Tone.Panner };
// Shared by the standalone lead, drop mixer and Vox Auto instrument option.
const leadGainBoost = 10 ** (9 / 20);

/** Separate backing voices. Only the existing Roses transport calls tick(). */
export class HereWithMeLeadEngine {
  private status: LeadStatus = "OFF";
  private volume = .65;
  private lower = .8;
  private muted = false;
  private lastBeat = -1;
  private banks = new Map<number, Bank>();
  private bus?: Tone.Gain;
  private limiter?: Tone.Limiter;

  constructor(private output: Tone.InputNode, private startBeat = leadStartBeat) {}
  snapshot(): LeadSnapshot { return { status: this.status, volume: this.volume, lower: this.lower, muted: this.muted }; }
  configure(patch: Partial<Omit<LeadSnapshot, "status">>): void {
    if (typeof patch.volume === "number" && Number.isFinite(patch.volume)) this.volume = Math.max(0, Math.min(1, patch.volume));
    if (typeof patch.lower === "number" && Number.isFinite(patch.lower)) this.lower = Math.max(0, Math.min(1, patch.lower));
    if (typeof patch.muted === "boolean") this.muted = patch.muted;
    this.bus?.gain.rampTo(this.muted ? 0 : this.volume * leadGainBoost, .02);
    const lower = this.banks.get(19);
    lower?.voice.volume.rampTo(this.lower === 0 ? -Infinity : -12 + 20 * Math.log10(this.lower), .02);
  }
  arm(beat: number, running: boolean): boolean {
    if (this.status === "ARMED" || this.status === "PLAYING" || running && beat >= this.startBeat) return false;
    this.status = "ARMED";
    this.lastBeat = -1;
    return true;
  }
  /** A seek cancels a playing take unless the caller explicitly authorizes joining its region. */
  begin(beat: number, joinRegion = false): void {
    const armed = this.status === "ARMED" && (beat <= this.startBeat || joinRegion && beat < this.startBeat + leadEndBeat - leadStartBeat);
    this.stop();
    if (armed) this.status = joinRegion && beat > this.startBeat && beat < this.startBeat + leadEndBeat - leadStartBeat ? "PLAYING" : "ARMED";
  }
  tick(beat: number, time: number, secondsPerBeat: number): void {
    if (beat === this.lastBeat) return;
    this.lastBeat = beat;
    if (this.status === "ARMED" && beat === this.startBeat) this.status = "PLAYING";
    // A loop/seek must never enter halfway through a phrase without its downbeat.
    if (this.status === "ARMED" && beat > this.startBeat) { this.stop(); return; }
    if (this.status !== "PLAYING") return;
    if (beat >= this.startBeat + leadEndBeat - leadStartBeat) { this.status = "DONE"; return; }
    this.ensureVoices();
    for (const event of leadEventsAtBeat(beat - this.startBeat + leadStartBeat)) {
      const offset = this.startBeat + event.tick / leadPpq - beat;
      this.banks.get(event.channel)!.voice.triggerAttackRelease(
        midiToToneName(event.midi), event.durationTicks / leadPpq * secondsPerBeat,
        time + offset * secondsPerBeat, event.velocity,
      );
    }
  }
  /** Reuse the timbre on a different melody, with no drop sequencing or octave changes. */
  triggerMelodyNote(midi: number, duration: number, time: number, velocity = .6): void {
    this.ensureVoices();
    for (const bank of this.banks.values()) bank.voice.triggerAttackRelease(midiToToneName(midi), duration, time, velocity);
  }
  /** Same unison four-bank voicing as the bars 29–35 automatic Vox melody. */
  attackMelodyNote(midi: number, time: number, velocity = .6): void {
    this.ensureVoices();
    for (const bank of this.banks.values()) bank.voice.triggerAttack(midiToToneName(midi), time, velocity);
  }
  releaseMelodyNote(midi: number, time: number): void {
    for (const bank of this.banks.values()) bank.voice.triggerRelease(midiToToneName(midi), time);
  }
  /** Manual chords reuse these four voices, with the drop's upper-octave layering. */
  attackChordNote(midi: number, time: number, velocity = .6): void {
    this.ensureVoices();
    for (const [channel, bank] of this.banks) {
      bank.voice.maxPolyphony = 24;
      bank.voice.triggerAttack(midiToToneName(midi + (channel === 19 ? 0 : 12)), time, velocity);
    }
  }
  releaseChordNote(midi: number, time: number): void {
    for (const [channel, bank] of this.banks) bank.voice.triggerRelease(midiToToneName(midi + (channel === 19 ? 0 : 12)), time);
  }
  /** Build effects before starting the clock rather than inside its first callback. */
  prepareVoices(): void { this.ensureVoices(); }
  /** Reset only the score cursor at a scheduled loop boundary. Existing notes
   * keep their timed releases, including notes inside transport lookahead. */
  restartLoop(): void { this.status = "ARMED"; this.lastBeat = -1; }
  private ensureVoices(): void {
    if (this.banks.size) return;
    this.bus = new Tone.Gain(this.muted ? 0 : this.volume * leadGainBoost);
    this.limiter = new Tone.Limiter(-4).connect(this.output);
    this.bus.connect(this.limiter);
    // Four distinct, conservatively mixed browser synths; no proprietary patch claim.
    const layers = [
      { channel: 19, type: "sawtooth" as const, detune: 0, pan: 0, gain: -12, cutoff: 3400 },
      { channel: 20, type: "sawtooth" as const, detune: -6, pan: -.45, gain: -20, cutoff: 5200 },
      { channel: 21, type: "triangle" as const, detune: 0, pan: 0, gain: -18, cutoff: 6500 },
      { channel: 22, type: "sawtooth" as const, detune: 6, pan: .45, gain: -20, cutoff: 4600 },
    ];
    for (const layer of layers) {
      const pan = new Tone.Panner(layer.pan).connect(this.bus);
      const filter = new Tone.Filter({ type: "lowpass", frequency: layer.cutoff, Q: .5, rolloff: -12 }).connect(pan);
      const voice = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: layer.type }, detune: layer.detune,
        envelope: { attack: .008, decay: .24, sustain: .45, release: .28 },
        volume: layer.gain + (layer.channel === 19 ? this.lower === 0 ? -Infinity : 20 * Math.log10(this.lower) : 0),
      }).connect(filter);
      voice.maxPolyphony = 8;
      this.banks.set(layer.channel, { voice, filter, pan });
    }
  }
  /** Dispose also cancels attacks queued inside Tone's lookahead window. */
  stop(): void {
    for (const { voice, filter, pan } of this.banks.values()) { voice.dispose(); filter.dispose(); pan.dispose(); }
    this.banks.clear(); this.bus?.dispose(); this.limiter?.dispose();
    this.bus = undefined; this.limiter = undefined;
    this.status = "OFF"; this.lastBeat = -1;
  }
  pause(): void {
    const status = this.status, beat = this.lastBeat;
    this.stop(); this.status = status; this.lastBeat = beat;
  }
  dispose(): void { this.stop(); }
}
