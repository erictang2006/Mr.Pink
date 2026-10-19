import * as Tone from "tone";
import { midiToToneName } from "./noteMapping";
import type { RosesNote } from "./rosesIntro";

/** Short, punchy break-bass attacks with quieter tails under the scored MIDI durations. */
export class RosesBassEngine {
  private bass = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 6, options: {
    oscillator: { type: "fatsawtooth", count: 2, spread: 8 },
    envelope: { attack: .002, decay: .19, sustain: .20, release: .10 },
  } });
  private sub = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 6, options: {
    oscillator: { type: "sine" },
    envelope: { attack: .003, decay: .22, sustain: .28, release: .10 },
  } });
  // The build uses the same filtered bass timbre, with a longer tail for its held MIDI notes.
  private build = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 3, options: {
    oscillator: { type: "fatsawtooth", count: 2, spread: 8 },
    envelope: { attack: .002, decay: .24, sustain: .48, release: .12 },
  } });
  private bassFilter = new Tone.Filter({ type: "lowpass", frequency: 820, Q: .7 });
  private bassDrive = new Tone.Distortion({ distortion: .16, wet: .20 });
  private subFilter = new Tone.Filter({ type: "lowpass", frequency: 155, Q: .45 });
  private bassOutput = new Tone.Volume(-25).toDestination();
  private subOutput = new Tone.Volume(-29).toDestination();
  private master = .72;
  private bassLevel = .45;
  private subLevel = .35;

  constructor() {
    this.bass.chain(this.bassFilter, this.bassDrive, this.bassOutput);
    this.build.connect(this.bassFilter);
    this.sub.chain(this.subFilter, this.subOutput);
    this.setMaster(this.master);
  }
  setMaster(value: number): void { this.master = Math.max(0, Math.min(1, value)); this.applyVolumes(); }
  setVolumes(bass: number, sub: number): void {
    this.bassLevel = Math.max(0, Math.min(1, bass));
    this.subLevel = Math.max(0, Math.min(1, sub));
    this.applyVolumes();
  }
  private applyVolumes(): void {
    const db = (level: number, base: number) => level <= 0 ? -60 : base + 20 * Math.log10(level);
    this.bassOutput.volume.rampTo(db(this.master * this.bassLevel, -12), .04);
    this.subOutput.volume.rampTo(db(this.master * this.subLevel, -15), .04);
  }
  trigger(bassNotes: RosesNote[], subNotes: RosesNote[], time: number, secondsPerBeat: number): void {
    for (const note of bassNotes) this.bass.triggerAttackRelease(midiToToneName(note.midi), note.durationBeats * secondsPerBeat, time, .78);
    for (const note of subNotes) this.sub.triggerAttackRelease(midiToToneName(note.midi), note.durationBeats * secondsPerBeat, time, .68);
  }
  triggerBuild(notes: RosesNote[], time: number, secondsPerBeat: number, endAtBoundary = false): void {
    for (const note of notes) this.build.triggerAttackRelease(midiToToneName(note.midi), Math.max(.001, note.durationBeats * secondsPerBeat - (endAtBoundary ? .12 : 0)), time, note.velocity / 127);
  }
  releaseAll(time = Tone.now()): void { this.bass.releaseAll(time); this.sub.releaseAll(time); this.build.releaseAll(time); }
  dispose(): void {
    this.releaseAll(); this.bass.dispose(); this.sub.dispose(); this.build.dispose();
    this.bassFilter.dispose(); this.bassDrive.dispose(); this.subFilter.dispose();
    this.bassOutput.dispose(); this.subOutput.dispose();
  }
}
