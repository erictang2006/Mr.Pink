import * as Tone from "tone";
import type { RosesDropSettings } from "./rosesDropSettings";

// The recording's missing fundamental is C2 (~65.2 Hz), not its louder C3 overtone.
export const bonkRootMidi = 36;
export const bonkSampleUrl = "/roses/chords/future-house-bonk.wav";
export function bonkPitchForRoot(root: number): number {
  // Keep transposition within -6..+5 semitones of the recorded register.
  return bonkRootMidi + ((root % 12 + 6) % 12 - 6);
}
const releaseCurve = [1, .8, .6, .43, .29, .18, .105, .055, .022, .006, 0];

/** A recorded impact plus a MIDI-exact chord body; never plays a recorded chord loop. */
export class RosesFutureBassLayers {
  private left = this.body(-4, false);
  private right = this.body(4, true);
  private center = new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24, options: {
    oscillator: { type: "sawtooth4" },
    envelope: { attack: .004, decay: .55, sustain: .34, release: .85, releaseCurve },
    filter: { type: "lowpass", Q: .7, rolloff: -24 },
    filterEnvelope: { attack: .004, decay: .55, sustain: .45, release: .94, baseFrequency: 280, octaves: 2.6 },
    volume: -18,
  } });
  private leftPan = new Tone.Panner(-.55);
  private rightPan = new Tone.Panner(.55);
  private bodyGain = new Tone.Gain(1);
  private highPass = new Tone.Filter({ type: "highpass", frequency: 105, Q: .5, rolloff: -24 });
  private drive = new Tone.Distortion({ distortion: .18, wet: .22, oversample: "2x" });
  private lowPass = new Tone.Filter({ type: "lowpass", frequency: 2600, Q: .6, rolloff: -24 });
  private warmth = new Tone.EQ3({ low: 2, mid: 1, high: -3, lowFrequency: 380, highFrequency: 2200 });
  private spaceHighPass = new Tone.Filter({ type: "highpass", frequency: 450, Q: .5, rolloff: -24 });
  private spaceLowPass = new Tone.Filter({ type: "lowpass", frequency: 2300, Q: .5, rolloff: -24 });
  private ambience = new Tone.JCReverb({ roomSize: .22, wet: 1 });
  private spaceGain = new Tone.Gain(.042);
  private mix = new Tone.Gain(1);
  // Bound extreme stacked hits before the shared compressor; normal hits stay in its gentle region.
  private safety = new Tone.WaveShaper(value => .95 * Math.tanh(value / .95), 2048);
  private output = new Tone.Gain(1);
  private bonkBuffer = new Tone.ToneAudioBuffer();
  private bonkHighPass = new Tone.Filter({ type: "highpass", frequency: 38, Q: .5, rolloff: -24 });
  private bonkLowPass = new Tone.Filter({ type: "lowpass", frequency: 1500, Q: .5, rolloff: -24 });
  private bonkGain = new Tone.Gain(.28);
  private impacts = new Set<Tone.ToneBufferSource>();
  private loading: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly profile: "roses" | "closer" = "roses") {
    this.left.chain(this.leftPan, this.bodyGain);
    this.right.chain(this.rightPan, this.bodyGain);
    this.center.connect(this.bodyGain);
    this.bodyGain.chain(this.highPass, this.drive, this.lowPass, this.warmth, this.mix);
    this.warmth.chain(this.spaceHighPass, this.spaceLowPass, this.ambience, this.spaceGain, this.mix);
    this.bonkHighPass.chain(this.bonkLowPass, this.bonkGain, this.mix);
    this.mix.chain(this.safety, this.output);
    if (profile === "closer") {
      // Loud Stabs reference: denser sustained harmonics, a wider body, and restrained top end.
      // Leave the original Roses profile's nodes and settings exactly as before.
      this.left.set({ oscillator: { type: "fatsawtooth", count: 7, spread: 22 }, detune: -5,
        envelope: { sustain: .48 }, filterEnvelope: { sustain: .5, octaves: 2.9 }, volume: -12 });
      this.right.set({ oscillator: { type: "fatsawtooth", count: 5, spread: 18 }, detune: 5,
        envelope: { sustain: .44 }, filterEnvelope: { sustain: .48, octaves: 3 }, volume: -13 });
      this.center.set({ oscillator: { type: "square7" }, envelope: { sustain: .4 }, volume: -19 });
      this.leftPan.pan.value = -.65; this.rightPan.pan.value = .65;
      this.highPass.frequency.value = 120;
      this.drive.distortion = .23; this.drive.wet.value = .28;
      this.warmth.set({ low: 1.5, mid: 2, high: -4 });
    }
  }
  private body(detune: number, right: boolean): Tone.PolySynth<Tone.MonoSynth> {
    return new Tone.PolySynth({ voice: Tone.MonoSynth, maxPolyphony: 24, options: {
      oscillator: { type: "fatsawtooth", count: right ? 4 : 5, spread: right ? 14 : 18 }, detune,
      envelope: { attack: .004, decay: .55, sustain: right ? .32 : .36, release: .85, releaseCurve },
      filter: { type: "lowpass", Q: .85, rolloff: -24 },
      filterEnvelope: { attack: .004, decay: .5, sustain: .42, release: .94, baseFrequency: 280, octaves: right ? 2.9 : 2.7 },
      volume: right ? -15 : -14,
    } });
  }
  isReady(): boolean { return this.bonkBuffer.loaded && !this.disposed; }
  load(): Promise<void> {
    if (this.bonkBuffer.loaded) return Promise.resolve();
    if (!this.loading) this.loading = this.bonkBuffer.load(bonkSampleUrl).then(() => {
      if (this.disposed) { this.bonkBuffer.dispose(); return; }
      const original = this.bonkBuffer.get()!;
      // Center the actual recording without changing its envelope or normalizing up its tail.
      const mono = Tone.getContext().createBuffer(1, original.length, original.sampleRate);
      const channel = mono.getChannelData(0);
      for (let c = 0; c < original.numberOfChannels; c++) {
        const input = original.getChannelData(c);
        for (let i = 0; i < channel.length; i++) channel[i] += input[i] / original.numberOfChannels;
      }
      this.bonkBuffer.set(mono);
    }).catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  connect(destination: Tone.InputNode): void { this.output.connect(destination); }
  setSettings(settings: RosesDropSettings): void {
    if (this.profile === "closer") settings = { ...settings, body: 1.12, bonk: .35, space: .15,
      brightness: 2700, decay: .58, release: settings.closerRelease };
    this.bodyGain.gain.rampTo(settings.body, .025);
    this.bonkGain.gain.rampTo(settings.bonk * .8, .025);
    this.spaceGain.gain.rampTo(settings.space * .28, .025);
    this.lowPass.frequency.rampTo(settings.brightness, .025);
    for (const voice of [this.left, this.right, this.center]) voice.set({
      envelope: { decay: settings.decay, release: settings.release },
      filterEnvelope: { decay: settings.decay * .9, release: settings.release * 1.1,
        baseFrequency: Math.max(220, settings.brightness * .105) },
    });
  }
  triggerAttack(note: string, time: number, velocity: number): void {
    this.left.triggerAttack(note, time, velocity);
    this.right.triggerAttack(note, time, velocity);
    this.center.triggerAttack(note, time, velocity);
  }
  triggerImpact(root: number, time: number, velocity: number): void {
    if (!this.bonkBuffer.loaded || this.disposed || this.impacts.size >= 16) return;
    const source = new Tone.ToneBufferSource({ url: this.bonkBuffer, loop: false,
      playbackRate: 2 ** ((bonkPitchForRoot(root) - bonkRootMidi) / 12), fadeIn: .001, fadeOut: .008,
      onended: () => { this.impacts.delete(source); source.dispose(); },
    });
    source.connect(this.bonkHighPass);
    this.impacts.add(source);
    source.start(time, 0, undefined, velocity);
    // Natural sample completion owns cleanup. Physical keyup and pedal never truncate it.
  }
  triggerRelease(note: string, time: number): void {
    this.left.triggerRelease(note, time); this.right.triggerRelease(note, time); this.center.triggerRelease(note, time);
  }
  releaseAll(time: number): void {
    this.left.releaseAll(time); this.right.releaseAll(time); this.center.releaseAll(time);
    for (const source of this.impacts) source.stop(time);
  }
  dispose(): void {
    this.disposed = true;
    for (const source of this.impacts) source.dispose();
    this.impacts.clear();
    this.left.dispose(); this.right.dispose(); this.center.dispose();
    this.leftPan.dispose(); this.rightPan.dispose(); this.bodyGain.dispose(); this.highPass.dispose();
    this.drive.dispose(); this.lowPass.dispose(); this.warmth.dispose();
    this.spaceHighPass.dispose(); this.spaceLowPass.dispose(); this.ambience.dispose(); this.spaceGain.dispose();
    this.bonkHighPass.dispose(); this.bonkLowPass.dispose(); this.bonkGain.dispose(); this.bonkBuffer.dispose(); this.mix.dispose(); this.safety.dispose(); this.output.dispose();
  }
}
