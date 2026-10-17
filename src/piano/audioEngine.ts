import * as Tone from 'tone';
import { midiToToneName } from './noteMapping';

const sampleBase = '/samples/';
const sampleUrls = {
  C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3',
  C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
  C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
  C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3', C7: 'C7.mp3',
};

export class PianoAudioEngine {
  private sampler!: Tone.Sampler;
  private gain: Tone.Volume;
  private active = new Map<number, number>();
  private loadPromise: Promise<void>;
  private ready = false;

  constructor() {
    this.gain = new Tone.Volume(-9).toDestination();
    this.loadPromise = new Promise((resolve, reject) => {
      this.sampler = new Tone.Sampler({
        urls: sampleUrls,
        baseUrl: sampleBase,
        attack: 0,
        release: 0.55,
        onload: () => resolve(),
        onerror: (error) => reject(error),
      }).connect(this.gain);
    });
  }

  async start(): Promise<void> {
    await Tone.start();
    await this.loadPromise;
    this.ready = true;
  }

  isReady(): boolean { return this.ready; }

  setVolume(value: number): void {
    this.gain.volume.rampTo(value <= 0 ? -60 : 20 * Math.log10(value), 0.04);
  }

  noteOn(midi: number): void {
    if (!this.ready) return;
    const count = this.active.get(midi) ?? 0;
    this.active.set(midi, count + 1);
    if (count === 0) this.sampler.triggerAttack(midiToToneName(midi), Tone.now(), 0.88);
  }

  noteOff(midi: number): void {
    const count = this.active.get(midi) ?? 0;
    if (count <= 1) {
      this.active.delete(midi);
      if (count === 1 && this.ready) this.sampler.triggerRelease(midiToToneName(midi), Tone.now());
    } else this.active.set(midi, count - 1);
  }

  releaseAll(): void {
    this.active.clear();
    if (this.ready) this.sampler.releaseAll(Tone.now());
  }

  dispose(): void {
    this.releaseAll();
    this.sampler.dispose();
    this.gain.dispose();
  }
}
