import * as Tone from "tone";
import { midiToToneName } from "./noteMapping";
import type { ImportedInstrument } from "./sampleLibrary";
import { loadSampleBlobs } from "./sampleLibrary";

export type SynthPreset = "roses" | "bright-pluck" | "supersaw" | "analog-pad" | "glass" | "electric-keys";
export type SynthSettings = {
  preset: SynthPreset; volume: number; attack: number; decay: number; sustain: number; release: number;
  cutoff: number; resonance: number; detune: number; chorus: number; reverb: number; delay: number;
};
export const presetGroups = [
  { label: "Leads", ids: ["roses"] }, { label: "Plucks", ids: ["bright-pluck"] },
  { label: "Chords", ids: ["supersaw"] }, { label: "Pads", ids: ["analog-pad"] },
  { label: "Bells / Keys", ids: ["glass", "electric-keys"] },
] as const;
export const presetNames: Record<SynthPreset, string> = {
  roses: "Roses Future Bass Lead", "bright-pluck": "Bright Pluck", supersaw: "Wide Supersaw",
  "analog-pad": "Warm Analog Pad", glass: "Bell / Glass Synth", "electric-keys": "Soft Electric Keys",
};
const base: Omit<SynthSettings, "preset"> = { volume: .5, attack: .018, decay: .23, sustain: .48, release: .28, cutoff: 6200, resonance: .8, detune: 12, chorus: .13, reverb: .12, delay: .09 };
export const presetSettings: Record<SynthPreset, SynthSettings> = {
  roses: { ...base, preset: "roses" },
  "bright-pluck": { ...base, preset: "bright-pluck", attack: .003, decay: .13, sustain: .09, release: .19, cutoff: 10000, detune: 3, chorus: .04, reverb: .1, delay: .14 },
  supersaw: { ...base, preset: "supersaw", volume: .37, attack: .035, decay: .3, sustain: .6, release: .55, cutoff: 7500, detune: 27, chorus: .25, reverb: .18, delay: .08 },
  "analog-pad": { ...base, preset: "analog-pad", volume: .42, attack: .28, decay: .6, sustain: .72, release: 1.1, cutoff: 2900, resonance: 1.1, detune: 9, chorus: .22, reverb: .26, delay: .03 },
  glass: { ...base, preset: "glass", attack: .004, decay: .85, sustain: .08, release: 1.1, cutoff: 10500, resonance: .5, detune: 0, chorus: .06, reverb: .24, delay: .09 },
  "electric-keys": { ...base, preset: "electric-keys", attack: .009, decay: .45, sustain: .34, release: .52, cutoff: 5400, detune: 2, chorus: .18, reverb: .12, delay: .03 },
};
const oscillators = {
  roses: { type: "fatsawtooth", count: 2 }, "bright-pluck": { type: "square" },
  supersaw: { type: "fatsawtooth", count: 5 }, "analog-pad": { type: "fattriangle", count: 2 },
  glass: { type: "fmsine", modulationType: "sine", modulationIndex: 7, harmonicity: 3.5 },
  "electric-keys": { type: "fmsine", modulationType: "sine", modulationIndex: 2, harmonicity: 2 },
} as const;
const oscillator = (settings: SynthSettings) => {
  const config = oscillators[settings.preset];
  return "count" in config ? { ...config, spread: Math.max(1, settings.detune * 2) } : config;
};
const envelope = (s: SynthSettings) => ({ attack: s.attack, decay: s.decay, sustain: s.sustain, release: s.release });
export function validSynthSettings(raw: unknown): SynthSettings {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const id = input.preset === "bright" ? "roses" : input.preset === "warm" ? "analog-pad" : input.preset === "pluck" ? "bright-pluck" : input.preset;
  const preset: SynthPreset = typeof id === "string" && Object.hasOwn(presetSettings, id) ? id as SynthPreset : "roses";
  const defaults = presetSettings[preset];
  const limits: Record<Exclude<keyof SynthSettings, "preset">, [number, number]> = {
    volume: [0, 1], attack: [.001, 1], decay: [.02, 2], sustain: [0, 1], release: [.05, 3],
    cutoff: [300, 16000], resonance: [.1, 8], detune: [0, 50], chorus: [0, .5], reverb: [0, .5], delay: [0, .4],
  };
  const result = { ...defaults };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const value = input[key]; const [min, max] = limits[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value));
  }
  return result;
}

type Voice = Tone.PolySynth | Tone.Sampler;
/** Owns Roses voices; the app's existing physical-key manager remains the only input source. */
export class SynthEngine {
  private voice: Voice;
  private loopVoice: Voice;
  private loopGain: Tone.Gain;
  private loopLevel = .55;
  private loopStopped = false;
  private filter: Tone.Filter;
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
  private sampleUrls: string[] = [];
  private generation = 0;
  private disposed = false;
  private imported = false;
  private loading = false;
  private loopStopTimer: number | null = null;

  constructor(settings: SynthSettings) {
    this.settings = validSynthSettings(settings);
    this.voice = this.makeSynth(this.settings);
    this.loopVoice = this.makeSynth(this.settings);
    this.loopGain = new Tone.Gain(.55);
    this.filter = new Tone.Filter({ type: "lowpass", frequency: this.settings.cutoff, Q: this.settings.resonance });
    this.chorus = new Tone.Chorus({ frequency: 1.4, delayTime: 2.5, depth: .25, wet: this.settings.chorus });
    this.delay = new Tone.FeedbackDelay({ delayTime: .225, feedback: .15, wet: this.settings.delay });
    this.reverb = new Tone.JCReverb({ roomSize: .42, wet: this.settings.reverb });
    this.output = new Tone.Volume(-18).toDestination();
    this.connectVoice(this.voice);
    this.loopVoice.chain(this.loopGain, this.filter);
    this.setSettings(this.settings);
  }
  private makeSynth(s: SynthSettings): Tone.PolySynth {
    return new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 20, options: { oscillator: oscillator(s), envelope: envelope(s) } });
  }
  private connectVoice(voice: Voice): void { voice.connect(this.filter); this.filter.chain(this.chorus, this.delay, this.reverb, this.output); }
  async start(): Promise<void> { await Tone.start(); if (!this.ready) { this.chorus.start(); this.ready = true; } }
  isReady(): boolean { return this.ready; }
  isPlayable(): boolean { return this.ready && !this.loading; }
  setSettings(value: SynthSettings): void {
    const next = validSynthSettings(value);
    if (!this.imported && next.preset !== this.settings.preset) this.releaseAll();
    this.settings = next;
    if (!this.imported && this.voice instanceof Tone.PolySynth && this.loopVoice instanceof Tone.PolySynth) {
      const options = { oscillator: oscillator(next), envelope: envelope(next), detune: next.detune };
      this.voice.set(options); this.loopVoice.set(options);
    }
    if (this.imported && this.voice instanceof Tone.Sampler && this.loopVoice instanceof Tone.Sampler) {
      this.voice.attack = this.loopVoice.attack = next.attack;
      this.voice.release = this.loopVoice.release = next.release;
    }
    this.filter.frequency.rampTo(next.cutoff, .03); this.filter.Q.value = next.resonance;
    this.chorus.wet.value = next.chorus; this.delay.wet.value = next.delay; this.reverb.wet.value = next.reverb;
    this.applyVolume();
  }
  useSynth(settings: SynthSettings): void {
    this.generation++; this.releaseAll(); this.clearLoopStopTimer(); this.voice.dispose(); this.loopVoice.dispose(); this.sampleUrls.forEach(URL.revokeObjectURL); this.sampleUrls = [];
    this.loading = false;
    this.imported = false; this.voice = this.makeSynth(validSynthSettings(settings)); this.loopVoice = this.makeSynth(validSynthSettings(settings));
    this.voice.connect(this.filter); this.loopVoice.connect(this.loopGain); this.setSettings(settings);
  }
  async useImported(instrument: ImportedInstrument, settings: SynthSettings): Promise<void> {
    const version = ++this.generation;
    this.releaseAll(); this.loading = true;
    let blobs: Blob[];
    try { blobs = instrument.source === "browser" ? await loadSampleBlobs(instrument) : []; }
    catch (error) { throw error; }
    if (version !== this.generation || this.disposed) return;
    const urls = blobs.map(URL.createObjectURL);
    const map: Record<string, string> = {};
    instrument.samples.forEach((sample, i) => { map[midiToToneName(sample.rootMidi)] = instrument.source === "browser" ? urls[i] : sample.url!; });
    let samplers: Tone.Sampler[];
    const pending: Tone.Sampler[] = [];
    try {
      samplers = await Promise.all([0, 1].map(() => new Promise<Tone.Sampler>((resolve, reject) => {
        const next = new Tone.Sampler({ urls: map, attack: settings.attack, release: settings.release,
          onload: () => resolve(next), onerror: reject });
        pending.push(next);
      })));
    } catch (error) { pending.forEach(item => item.dispose()); urls.forEach(URL.revokeObjectURL); throw error; }
    if (version !== this.generation || this.disposed) { samplers.forEach(item => item.dispose()); urls.forEach(URL.revokeObjectURL); return; }
    this.releaseAll(); this.clearLoopStopTimer(); this.voice.dispose(); this.loopVoice.dispose(); this.sampleUrls.forEach(URL.revokeObjectURL);
    this.sampleUrls = urls; [this.voice, this.loopVoice] = samplers; this.imported = true; this.loading = false;
    this.voice.connect(this.filter); this.loopVoice.connect(this.loopGain); this.setSettings(settings);
  }
  setGlobalVolume(value: number): void { this.globalVolume = value; this.applyVolume(); }
  setLoopLevel(value: number): void {
    this.loopLevel = Math.max(0, Math.min(1.5, Number.isFinite(value) ? value : .55));
    if (!this.loopStopped) this.loopGain.gain.rampTo(this.loopLevel, .02);
  }
  private applyVolume(): void {
    const gain = this.globalVolume * this.settings.volume;
    this.output.volume.rampTo(gain <= 0 ? -60 : 20 * Math.log10(gain) - 15, .04);
  }
  noteOn(code: string, midi: number, time = Tone.now(), velocity = .65): boolean {
    if (!this.ready || this.loading || this.held.has(code)) return false;
    const note = midiToToneName(midi);
    // Chords can share pitches with each other or the melody. Retrigger one
    // sounding voice per pitch; the last physical owner releases that voice.
    const wasSustained = this.sustained.delete(midi);
    if (wasSustained || [...this.held.values()].includes(midi)) this.voice.triggerRelease(note, time);
    this.held.set(code, midi); this.voice.triggerAttack(note, time, velocity);
    return true;
  }
  noteOff(code: string): void {
    const midi = this.held.get(code); if (midi === undefined) return;
    this.held.delete(code);
    if (this.pedal) this.sustained.add(midi);
    else if (![...this.held.values()].includes(midi)) this.voice.triggerRelease(midiToToneName(midi), Tone.now());
  }
  setSustain(enabled: boolean): void {
    this.pedal = enabled;
    if (!enabled) {
      for (const midi of this.sustained) if (![...this.held.values()].includes(midi)) this.voice.triggerRelease(midiToToneName(midi), Tone.now());
      this.sustained.clear();
    }
  }
  preview(midi: number): void { if (this.ready && !this.loading) this.voice.triggerAttackRelease(midiToToneName(midi), .35, Tone.now(), .55); }
  triggerLoopNote(midi: number, time: number, durationSeconds: number): boolean {
    if (!this.ready || this.loading) return false;
    this.clearLoopStopTimer();
    this.loopStopped = false;
    this.loopGain.gain.setValueAtTime(this.loopLevel, Math.max(Tone.immediate(), time));
    this.loopVoice.triggerAttackRelease(midiToToneName(midi), durationSeconds, time, .58);
    return true;
  }
  private clearLoopStopTimer(): void {
    if (this.loopStopTimer !== null) window.clearTimeout(this.loopStopTimer);
    this.loopStopTimer = null;
  }
  stopLoop(time = Tone.immediate()): void {
    // Tone.PolySynth can still have attacks queued in its look-ahead window.
    // Muting this dedicated bus makes Stop backing immediate even if one lands
    // just after releaseAll; a second release catches that late attack.
    this.clearLoopStopTimer();
    const stopAt = Math.max(Tone.immediate(), time);
    this.loopStopped = true;
    this.loopGain.gain.setValueAtTime(0, stopAt);
    this.loopVoice.releaseAll(stopAt);
    const voice = this.loopVoice;
    this.loopStopTimer = window.setTimeout(() => {
      if (this.loopVoice === voice && !this.disposed) voice.releaseAll(Tone.now());
      this.loopStopTimer = null;
    }, Math.max(0, (stopAt - Tone.immediate()) * 1000) + 350);
  }
  releaseAll(): void { this.held.clear(); this.sustained.clear(); this.voice.releaseAll(Tone.now()); this.stopLoop(); }
  dispose(): void { this.disposed = true; this.generation++; this.releaseAll(); this.clearLoopStopTimer(); this.voice.dispose(); this.loopVoice.dispose(); this.loopGain.dispose(); this.sampleUrls.forEach(URL.revokeObjectURL); this.filter.dispose(); this.chorus.dispose(); this.delay.dispose(); this.reverb.dispose(); this.output.dispose(); }
}
