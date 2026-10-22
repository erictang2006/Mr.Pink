import * as Tone from "tone";
import { RosesLoudStabsEngine } from "./rosesLoudStabsEngine";
import type { RosesDropSettings } from "./rosesDropSettings";

export type DropLeadSound = "original" | "loud-stabs";
export const dropLeadSounds = [
  { value: "original", label: "Original Here With Me Lead" },
  { value: "loud-stabs", label: "Recorded Loud Stabs · Keys 1–3" },
] as const;

/** Same recorded instrument, compressor and output trim as the live chord keys.
 * Sequencing belongs exclusively to the existing drop transport callback.
 */
export class RecordedDropLeadEngine {
  private instrument = new RosesLoudStabsEngine();
  private compressor = new Tone.Compressor({ threshold: -18, ratio: 3.5, attack: .003, release: .16 });
  private volume = new Tone.Volume(-3);
  private limiter = new Tone.Limiter(-1.5);
  // Match the original lead's RMS level without changing the recorded hit's dynamics.
  private auditionGain = new Tone.Gain(10 ** (7 / 20));
  constructor(settings: RosesDropSettings) {
    this.instrument.connect(this.compressor); this.compressor.connect(this.volume); this.volume.connect(this.limiter);
    this.limiter.connect(this.auditionGain);
    this.configure(settings);
  }
  async load(): Promise<void> { await this.instrument.load(); }
  configure(settings: RosesDropSettings): void {
    this.instrument.setBrightness(settings.brightness); this.instrument.setRelease(settings.closerRelease);
    this.volume.volume.rampTo(settings.output <= 0 ? -60 : -3 + 20 * Math.log10(settings.output), .04);
  }
  connect(destination: Tone.InputNode): void { this.auditionGain.connect(destination); }
  disconnect(): void { this.auditionGain.disconnect(); }
  trigger(midi: number, duration: number, time: number, velocity: number): void { this.instrument.triggerPitch(midi, duration, time, velocity); }
  stop(): void { this.instrument.cancel(); }
  dispose(): void { this.stop(); this.instrument.dispose(); this.compressor.dispose(); this.volume.dispose(); this.limiter.dispose(); this.auditionGain.dispose(); }
}
