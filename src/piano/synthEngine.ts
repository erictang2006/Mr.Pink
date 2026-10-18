import * as Tone from "tone";
import { midiToToneName } from "./noteMapping";

export type SynthPreset = "bright" | "warm" | "pluck";
export type SynthSettings = {
  preset: SynthPreset;
  volume: number;
  attack: number;
  release: number;
  reverb: number;
  delay: number;
  chorus: number;
};
export const presetSettings: Record<SynthPreset, SynthSettings> = {
  bright: { preset: "bright", volume: .48, attack: .008, release: .30, reverb: .17, delay: .12, chorus: .14 },
  warm: { preset: "warm", volume: .55, attack: .075, release: .75, reverb: .30, delay: .09, chorus: .20 },
  pluck: { preset: "pluck", volume: .52, attack: .004, release: .14, reverb: .12, delay: .17, chorus: .06 },
};

const envelope = (settings: SynthSettings) => ({
  attack: settings.attack,
  decay: settings.preset === "pluck" ? .17 : settings.preset === "warm" ? .26 : .18,
  sustain: settings.preset === "pluck" ? .06 : settings.preset === "warm" ? .68 : .46,
  release: settings.release,
});
const oscillatorType = (preset: SynthPreset) => preset === "bright" ? "fatsawtooth" : preset === "warm" ? "triangle" : "square";

/** Free-play synth voices are owned by physical keys, independent of the piano sampler. */
export class SynthEngine {
  private synth: Tone.PolySynth;
  private chorus: Tone.Chorus;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.JCReverb;
  private output: Tone.Volume;
  private held = new Map<string, number>();
  private sustained = new Set<number>();
  private pedal = false;
  private ready = false;
  private globalVolume = 1;
  private settings: SynthSettings;

  constructor(settings: SynthSettings) {
    this.settings = settings;
    this.synth = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 16, options: {
      oscillator: { type: oscillatorType(settings.preset) }, envelope: envelope(settings),
    } });
    this.chorus = new Tone.Chorus({ frequency: 1.4, delayTime: 2.5, depth: .25, wet: settings.chorus });
    this.delay = new Tone.FeedbackDelay({ delayTime: .225, feedback: .18, wet: settings.delay });
    this.reverb = new Tone.JCReverb({ roomSize: .45, wet: settings.reverb });
    this.output = new Tone.Volume(-12).toDestination();
    this.synth.chain(this.chorus, this.delay, this.reverb, this.output);
    this.setSettings(settings);
  }

  async start(): Promise<void> {
    await Tone.start();
    if (!this.ready) { this.chorus.start(); this.ready = true; }
  }
  isReady(): boolean { return this.ready; }
  setSettings(settings: SynthSettings): void {
    if (settings.preset !== this.settings.preset) this.releaseAll();
    this.settings = settings;
    this.synth.set({ oscillator: { type: oscillatorType(settings.preset) }, envelope: envelope(settings) });
    this.chorus.wet.value = settings.chorus;
    this.delay.wet.value = settings.delay;
    this.reverb.wet.value = settings.reverb;
    this.applyVolume();
  }
  setGlobalVolume(value: number): void { this.globalVolume = value; this.applyVolume(); }
  private applyVolume(): void {
    const gain = this.globalVolume * this.settings.volume;
    this.output.volume.rampTo(gain <= 0 ? -60 : 20 * Math.log10(gain) - 12, .04);
  }
  noteOn(code: string, midi: number): void {
    if (!this.ready || this.held.has(code)) return;
    if (this.sustained.delete(midi)) this.synth.triggerRelease(midiToToneName(midi), Tone.now());
    this.held.set(code, midi);
    this.synth.triggerAttack(midiToToneName(midi), Tone.now(), .62);
  }
  noteOff(code: string): void {
    const midi = this.held.get(code);
    if (midi === undefined) return;
    this.held.delete(code);
    if (this.pedal) this.sustained.add(midi);
    else this.synth.triggerRelease(midiToToneName(midi), Tone.now());
  }
  setSustain(enabled: boolean): void {
    this.pedal = enabled;
    if (!enabled) {
      for (const midi of this.sustained) if (![...this.held.values()].includes(midi)) this.synth.triggerRelease(midiToToneName(midi), Tone.now());
      this.sustained.clear();
    }
  }
  releaseAll(): void {
    this.held.clear();
    this.sustained.clear();
    this.synth.releaseAll(Tone.now());
  }
  dispose(): void {
    this.releaseAll();
    this.synth.dispose(); this.chorus.dispose(); this.delay.dispose(); this.reverb.dispose(); this.output.dispose();
  }
}
