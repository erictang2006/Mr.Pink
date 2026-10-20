import * as Tone from "tone";
import type { RosesDropSettings } from "./rosesDropSettings";
import { DropChordAmbience } from "./dropChordAmbience";

// A piano-like taper avoids a flat, compressed tail followed by a sudden drop.
const chordReleaseCurve = [1, .78, .58, .42, .29, .19, .115, .06, .025, .007, 0];

/** Browser approximation of the two Sylenth chord layers, not a plugin/preset loader. */
export class RosesDropLayers {
  private left = this.body(-3, false);
  private right = this.body(3, true);
  private leftPan = new Tone.Panner(-.45);
  private rightPan = new Tone.Panner(.45);
  // Stable, centered low-mid harmonics underneath the wider saw banks, at the same MIDI pitch.
  private core = new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24, options: {
    oscillator: { type: "square5" },
    envelope: { attack: .003, decay: .6, sustain: .46, release: .85, releaseCurve: chordReleaseCurve },
    filter: { type: "lowpass", Q: .5, rolloff: -24 },
    filterEnvelope: { attack: .002, decay: .5, sustain: .55, release: .94, baseFrequency: 330, octaves: 2.5 },
    volume: -13,
  } });
  private bodyGain = new Tone.Gain(1.05);
  private bodyHighPass = new Tone.Filter({ type: "highpass", frequency: 90, rolloff: -24, Q: .5 });
  private bodyDrive = new Tone.Distortion({ distortion: .32, wet: .4, oversample: "2x" });
  private punch = new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24, options: {
    oscillator: { type: "square5" },
    envelope: { attack: .001, decay: .17, sustain: .08, release: .11 },
    filter: { type: "lowpass", Q: .6, rolloff: -24 },
    filterEnvelope: { attack: .001, decay: .16, sustain: .16, release: .1, baseFrequency: 360, octaves: 2.5 },
    volume: -18,
  } });
  private punchHighPass = new Tone.Filter({ type: "highpass", frequency: 310, rolloff: -24, Q: .5 });
  private punchDrive = new Tone.Distortion({ distortion: .2, wet: .22, oversample: "2x" });
  private punchGain = new Tone.Gain(.24);
  private lowPass = new Tone.Filter({ type: "lowpass", frequency: 2800, rolloff: -24, Q: .55 });
  private warmth = new Tone.EQ3({ low: 2.5, mid: 1.5, high: -3, lowFrequency: 360, highFrequency: 2400 });
  private ambience: Tone.JCReverb | DropChordAmbience;

  constructor(nativeAmbience = false) {
    this.ambience = nativeAmbience ? new DropChordAmbience() : new Tone.JCReverb({ roomSize: .12, wet: .025 });
    this.left.chain(this.leftPan, this.bodyGain);
    this.right.chain(this.rightPan, this.bodyGain);
    this.core.connect(this.bodyGain);
    this.bodyGain.chain(this.bodyHighPass, this.bodyDrive, this.lowPass);
    this.punch.chain(this.punchHighPass, this.punchDrive, this.punchGain, this.lowPass);
    this.lowPass.chain(this.warmth, this.ambience);
  }
  private body(detune: number, upperTexture: boolean): Tone.PolySynth<Tone.MonoSynth> {
    return new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24, options: {
      oscillator: { type: "fatsawtooth", count: upperTexture ? 2 : 3, spread: upperTexture ? 8 : 14 }, detune,
      envelope: { attack: .003, decay: .6, sustain: upperTexture ? .38 : .42, release: .85, releaseCurve: chordReleaseCurve },
      filter: { type: "lowpass", Q: .55, rolloff: -24 },
      filterEnvelope: { attack: .002, decay: .52, sustain: .56, release: .94, baseFrequency: upperTexture ? 400 : 330, octaves: upperTexture ? 3.1 : 3 },
      volume: upperTexture ? -11 : -9,
    } });
  }
  connect(destination: Tone.InputNode): void { this.ambience.connect(destination); }
  setSettings(settings: RosesDropSettings): void {
    this.bodyGain.gain.rampTo(settings.body, .025);
    this.punchGain.gain.rampTo(settings.punch, .025);
    this.lowPass.frequency.rampTo(settings.brightness, .025);
    const release = settings.release;
    const filterRelease = release * 1.1;
    this.left.set({
      envelope: { attack: .003, decay: settings.decay, sustain: .42, release, releaseCurve: chordReleaseCurve },
      filterEnvelope: { decay: settings.decay * .9, sustain: .56, release: filterRelease, baseFrequency: Math.max(250, settings.brightness * .118), octaves: 3 },
    });
    this.right.set({
      envelope: { attack: .003, decay: settings.decay * .96, sustain: .38, release, releaseCurve: chordReleaseCurve },
      filterEnvelope: { decay: settings.decay * .86, sustain: .52, release: filterRelease, baseFrequency: Math.max(290, settings.brightness * .143), octaves: 3.1 },
    });
    this.core.set({ envelope: { decay: settings.decay, release }, filterEnvelope: { decay: settings.decay * .9, release: filterRelease } });
    this.punch.set({ envelope: { decay: settings.decay * .35, release: Math.min(.28, release * .35) }, filterEnvelope: { release: Math.min(.3, filterRelease * .35) } });
  }
  triggerAttack(note: string, time: number, velocity: number): void {
    this.left.triggerAttack(note, time, velocity);
    this.right.triggerAttack(note, time, velocity);
    this.core.triggerAttack(note, time, velocity);
    this.punch.triggerAttack(note, time, velocity);
  }
  triggerAttackRelease(note: string, duration: number, time: number, velocity: number): void {
    for (const voice of [this.left, this.right, this.core, this.punch]) voice.triggerAttackRelease(note, duration, time, velocity);
  }
  triggerRelease(note: string, time: number): void {
    this.left.triggerRelease(note, time); this.right.triggerRelease(note, time); this.core.triggerRelease(note, time); this.punch.triggerRelease(note, time);
  }
  releaseAll(time: number): void { this.left.releaseAll(time); this.right.releaseAll(time); this.core.releaseAll(time); this.punch.releaseAll(time); }
  dispose(): void {
    this.left.dispose(); this.right.dispose(); this.core.dispose(); this.punch.dispose();
    this.leftPan.dispose(); this.rightPan.dispose(); this.bodyGain.dispose();
    this.bodyHighPass.dispose(); this.bodyDrive.dispose(); this.punchHighPass.dispose();
    this.punchDrive.dispose(); this.punchGain.dispose(); this.lowPass.dispose(); this.warmth.dispose(); this.ambience.dispose();
  }
}
