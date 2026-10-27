import * as Tone from "tone";
import { midiToToneName } from "./noteMapping";
import { rosesChordShortcuts } from "./rosesChords";
import { hereWithMeChordShortcuts, validHereWithMeChordSound, type HereWithMeChordSound } from "./hereWithMeChords";
import { HwmManualHarmonyEngine } from "./hwmManualHarmonyEngine";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";
import { voxStabNoteUrl } from "./voxMelodyEngine";
import { RosesFutureBassLayers } from "./rosesFutureBassLayers";
import { RosesLoudStabsEngine } from "./rosesLoudStabsEngine";
import { RosesDropLayers } from "./rosesDropLayers";
import { defaultRosesDropSettings, validRosesDropSettings, type RosesDropSettings } from "./rosesDropSettings";

/** Dedicated live chord timbre; the Roses lead and scheduled backing have separate voices. */
export class RosesChordStabEngine {
  private voice = new RosesDropLayers(true);
  private future = new RosesFutureBassLayers("roses", true);
  private closer = new RosesLoudStabsEngine();
  private closerSources = new Set<string>();
  private closerSustained = new Map<number, number>();
  private settings = { ...defaultRosesDropSettings };
  private globalVolume = 1;
  private originalBus = new Tone.Gain(0);
  private futureBus = new Tone.Gain(1);
  private bass = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: .002, decay: .58, sustain: .16, release: .12 },
    filter: { type: "lowpass", Q: .5, rolloff: -24 },
    filterEnvelope: { attack: .001, decay: .45, sustain: .25, release: .12, baseFrequency: 110, octaves: 1.8 },
    volume: -10,
  });
  private bassHighPass = new Tone.Filter({ type: "highpass", frequency: 35, Q: .5, rolloff: -24 });
  private bassGain = new Tone.Gain(.6);
  private compressor = new Tone.Compressor({ threshold: -18, ratio: 3.5, attack: .003, release: .16 });
  private duckGain = new Tone.Gain(1);
  private output = new Tone.Volume(-12);
  private limiter = new Tone.Limiter(-1.5);
  private held = new Map<string, number>();
  private sustained = new Map<number, number>();
  private pedal = false;
  private bassOwners = new Map<string, { midi: number; held: boolean }>();
  private bassCurrentCode: string | null = null;
  private hereWithMeSound: HereWithMeChordSound = "keys678";
  private manualHarmony?: HwmManualHarmonyEngine;
  private manualLead?: HereWithMeLeadEngine;
  private stabNote?: Tone.Sampler;
  private stabNoteReady = false;
  private stabNoteLoading?: Promise<void>;
  private manualSources = new Map<string, "lead" | "stabs" | "harmony">();
  private manualSustained: { midi: number; sound: "lead" | "stabs" | "harmony" }[] = [];

  constructor() {
    this.voice.connect(this.originalBus);
    this.originalBus.connect(this.compressor);
    this.future.connect(this.futureBus);
    this.futureBus.connect(this.compressor);
    this.closer.connect(this.compressor);
    this.closer.setReferenceLevel(this.globalVolume);
    this.compressor.chain(this.duckGain, this.output, this.limiter);
    this.limiter.toDestination();
    // Mono root foundation bypasses chord distortion/reverb and never stacks low harmonies.
    this.bass.chain(this.bassHighPass, this.bassGain, this.compressor);
    this.setSettings(this.settings);
  }

  /** Decode the local impact before enabling any live Roses keys. */
  async load(): Promise<void> {
    if (!this.stabNoteLoading) this.stabNoteLoading = new Promise<void>((resolve, reject) => {
      this.stabNote = new Tone.Sampler({ urls: { E4: voxStabNoteUrl }, attack: .001, release: this.settings.closerRelease,
        onload: () => { this.stabNoteReady = true; resolve(); }, onerror: reject,
      }).connect(this.compressor);
    }).catch(error => { this.stabNote?.dispose(); this.stabNote = undefined; this.stabNoteLoading = undefined; throw error; });
    await Promise.all([this.future.load(), this.closer.load(), this.getManualHarmony().load(), this.stabNoteLoading]);
  }
  isReady(): boolean { return this.future.isReady() && this.closer.isReady() && this.stabNoteReady && !!this.manualHarmony?.isReady(); }
  setHereWithMeSound(value: HereWithMeChordSound): void {
    const next = validHereWithMeChordSound(value);
    if (next === this.hereWithMeSound) return;
    this.releaseAll(); this.hereWithMeSound = next;
    if (next === "lead") this.getManualLead().prepareVoices();
  }
  setHereWithMeHarmonyVolume(value: number): void { this.getManualHarmony().setVolume(value); }
  private getManualHarmony(): HwmManualHarmonyEngine {
    if (!this.manualHarmony) this.manualHarmony = new HwmManualHarmonyEngine(this.compressor);
    return this.manualHarmony;
  }
  private getManualLead(): HereWithMeLeadEngine {
    if (!this.manualLead) {
      this.manualLead = new HereWithMeLeadEngine(this.compressor);
      this.manualLead.configure({ volume: .65 });
    }
    return this.manualLead;
  }
  private get activeVoice(): RosesDropLayers | RosesFutureBassLayers {
    return this.settings.mode === "bonk" ? this.future : this.voice;
  }

  setGlobalVolume(value: number): void {
    const level = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    this.globalVolume = level;
    this.closer.setReferenceLevel(level);
    this.applyOutput();
  }

  compareLoudStab(side: "A" | "B"): void { this.closer.compare(side); }

  setSettings(raw: RosesDropSettings): void {
    const next = validRosesDropSettings(raw);
    const bassChanged = next.bassEnabled !== this.settings.bassEnabled;
    if (next.mode !== this.settings.mode) this.releaseAll();
    this.settings = next;
    this.voice.setSettings(next);
    this.future.setSettings(next);
    this.closer.setRelease(next.closerRelease);
    this.closer.setBrightness(next.brightness);
    if (this.stabNote) this.stabNote.release = next.closerRelease;
    this.originalBus.gain.rampTo(next.mode === "drop" ? 1 : 0, .015);
    this.futureBus.gain.rampTo(next.mode === "bonk" ? 1 : 0, .015);
    this.bassGain.gain.rampTo(next.mode === "drop" && next.bassEnabled ? next.bass : 0, .025);
    this.bass.set({
      envelope: { attack: .003, decay: next.decay, sustain: .3, release: Math.min(.5, next.release * .55) },
      filterEnvelope: { attack: .002, decay: .4, sustain: .25, release: Math.min(.55, next.release * .65), baseFrequency: 110, octaves: 1.8 },
    });
    if (bassChanged) this.syncBass(Tone.immediate());
    if (!next.duck) { this.duckGain.gain.cancelScheduledValues(Tone.immediate()); this.duckGain.gain.rampTo(1, .025); }
    this.applyOutput();
  }
  private applyOutput(): void {
    const level = this.globalVolume * this.settings.output;
    this.output.volume.rampTo(level <= 0 ? -60 : -3 + 20 * Math.log10(level), .04);
  }
  /** Optional manual-kick ducking; no beat clock, drum scheduling, or input delay. */
  duck(time = Tone.immediate()): void {
    if (!this.settings.duck) return;
    this.duckGain.gain.cancelAndHoldAtTime(time);
    this.duckGain.gain.linearRampToValueAtTime(.3, time + .004);
    this.duckGain.gain.linearRampToValueAtTime(1, time + .18);
  }

  noteOn(source: string, midi: number, code: string, time = Tone.immediate()): boolean {
    if (this.held.has(source)) return false;
    const name = midiToToneName(midi);
    // Each strike gets a fresh voice. PolySynth retains earlier release tails;
    // shared pitches are balanced by one release per attack, not cut on retrigger.
    this.held.set(source, midi);
    const manual = hereWithMeChordShortcuts[code];
    if (manual && this.hereWithMeSound === "harmony") {
      this.manualSources.set(source,"harmony");
      if (midi === manual[0]) this.getManualHarmony().attack(code,time);
      return true;
    }
    if (manual && (this.hereWithMeSound === "lead" || this.hereWithMeSound === "keys123" && this.settings.closerMode === "loud")) {
      const sound = this.hereWithMeSound === "lead" ? "lead" : "stabs";
      this.manualSources.set(source, sound);
      if (sound === "lead") this.getManualLead().attackChordNote(midi, time);
      else this.stabNote?.triggerAttack(name, time, .8);
      return true;
    }
    if (this.settings.closerMode === "loud" && /^Digit[123]$/.test(code)) {
      this.closerSources.add(source);
      if (midi === rosesChordShortcuts[code]?.[0]) this.closer.attack(code, time);
      return true;
    }
    this.activeVoice.triggerAttack(name, time, /^[4567]$/.test(code.replace("Digit", "")) ? .68 : .86);
    if (midi === (manual ?? rosesChordShortcuts[code])?.[0]) {
      if (this.settings.mode === "bonk") {
        this.future.triggerImpact(midi, time, .9);
        return true;
      }
      this.bassOwners.delete(code);
      this.bassOwners.set(code, { midi: midi - (midi >= 60 ? 24 : 12), held: true });
      this.bassCurrentCode = null;
      this.syncBass(time);
    }
    return true;
  }

  /** A manually played single pitch reuses the chord body and pitched impact.
   * No chord expansion or automatic root/bass accompaniment is introduced. */
  noteOnIndividual(source: string, midi: number, code: string, time = Tone.immediate()): boolean {
    if (!this.noteOn(source, midi, code, time)) return false;
    if (this.settings.mode === "bonk") this.future.triggerImpact(midi, time, .9, true);
    return true;
  }

  noteOff(source: string, time = Tone.immediate()): void {
    const midi = this.held.get(source);
    if (midi === undefined) return;
    this.held.delete(source);
    const manual = this.manualSources?.get(source);
    if (manual) {
      this.manualSources.delete(source);
      if (this.pedal) this.manualSustained.push({ midi, sound: manual });
      else this.releaseManualNote(midi, manual, time);
      return;
    }
    // Bind release to the instrument that received keydown, even if A/B changed meanwhile.
    if (this.closerSources.delete(source)) {
      if (this.pedal) this.closerSustained.set(midi, (this.closerSustained.get(midi) ?? 0) + 1);
      else if (midi === rosesChordShortcuts[source.split(":")[1]]?.[0]) this.closer.release(source.split(":")[1], time);
      return;
    }
    const code = source.split(":")[1];
    if (midi === (hereWithMeChordShortcuts[code] ?? rosesChordShortcuts[code])?.[0]) {
      const owner = this.bassOwners.get(code);
      if (this.pedal && owner) owner.held = false;
      else this.bassOwners.delete(code);
      this.syncBass(time);
    }
    if (this.pedal) this.sustained.set(midi, (this.sustained.get(midi) ?? 0) + 1);
    else this.activeVoice.triggerRelease(midiToToneName(midi), time);
  }

  setSustain(enabled: boolean): void {
    this.pedal = enabled;
    if (enabled) return;
    const time = Tone.immediate();
    for (const note of this.manualSustained ?? []) this.releaseManualNote(note.midi, note.sound, time);
    if (this.manualSustained) this.manualSustained.length = 0;
    for (const [midi, count] of this.sustained) for (let i = 0; i < count; i++) this.activeVoice.triggerRelease(midiToToneName(midi), time);
    this.sustained.clear();
    for (const [midi, count] of this.closerSustained) for (const [code, notes] of Object.entries(rosesChordShortcuts)) if (notes[0] === midi && /^Digit[123]$/.test(code)) for (let i = 0; i < count; i++) this.closer.release(code, time);
    this.closerSustained.clear();
    for (const [code, owner] of this.bassOwners) if (!owner.held) this.bassOwners.delete(code);
    this.syncBass(Tone.immediate());
  }
  private releaseManualNote(midi: number, sound: "lead" | "stabs" | "harmony", time: number): void {
    if (sound === "lead") this.manualLead?.releaseChordNote(midi, time);
    else if (sound === "harmony") {
      if ([...this.manualSources].some(([source, route]) => route === "harmony" && this.held.get(source) === midi)) return;
      const code=Object.keys(hereWithMeChordShortcuts).find(code=>hereWithMeChordShortcuts[code][0]===midi);
      if(code)this.manualHarmony?.release(code,time);
    } else {
      // Sampler releases every copy of a pitch. Keep shared notes sounding
      // until the last physical chord containing that pitch is released.
      if ([...this.manualSources].some(([source, route]) => route === "stabs" && this.held.get(source) === midi)) return;
      this.stabNote?.triggerRelease(midiToToneName(midi), time);
    }
  }

  private syncBass(time: number): void {
    if (this.settings.mode === "bonk" || !this.settings.bassEnabled) {
      if (this.bassCurrentCode !== null) this.bass.triggerRelease(time);
      this.bassCurrentCode = null;
      return;
    }
    const latest = [...this.bassOwners.entries()].at(-1);
    if ((latest?.[0] ?? null) === this.bassCurrentCode) return;
    this.bassCurrentCode = latest?.[0] ?? null;
    if (latest) this.bass.triggerAttack(midiToToneName(latest[1].midi), time, .82);
    else this.bass.triggerRelease(time);
  }

  releaseAll(): void {
    this.manualHarmony?.cancel(); this.manualLead?.stop(); this.stabNote?.releaseAll(Tone.immediate());
    this.manualSources?.clear(); if (this.manualSustained) this.manualSustained.length = 0;
    this.held.clear(); this.sustained.clear(); this.closerSources.clear(); this.closerSustained.clear(); this.bassOwners.clear(); this.bassCurrentCode = null;
    this.voice.releaseAll(Tone.immediate()); this.future.releaseAll(Tone.immediate()); this.closer.releaseAll(Tone.immediate()); this.bass.triggerRelease(Tone.immediate());
  }
  dispose(): void {
    this.releaseAll(); this.manualHarmony?.dispose(); this.manualLead?.dispose(); this.stabNote?.dispose();
    this.voice.dispose(); this.future.dispose(); this.closer.dispose(); this.bass.dispose(); this.bassHighPass.dispose();
    this.bassGain.dispose(); this.originalBus.dispose(); this.futureBus.dispose(); this.compressor.dispose(); this.duckGain.dispose(); this.output.dispose(); this.limiter.dispose();
  }
}
