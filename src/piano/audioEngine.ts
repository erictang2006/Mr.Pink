import * as Tone from 'tone';
import { midiToToneName } from './noteMapping';
import { SustainVoices } from './sustainVoices';

const sampleBase = '/samples/';
const sampleUrls = {
  C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3',
  C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
  C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
  C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3', C7: 'C7.mp3',
};
type SampleVoice = { stop: (time?: number) => unknown; fadeOut?: number };

export class PianoAudioEngine {
  private sampler!: Tone.Sampler;
  private gain: Tone.Volume;
  private voices = new SustainVoices();
  private sourceVoices = new Map<string, { voice: SampleVoice; held: boolean }>();
  private readonly sourceVoiceLimit = 24;
  private recentSources: { midi: number; voice: SampleVoice }[] = [];
  private readonly sampleTailLimit = 32;
  private pedal = false;
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

  noteOn(midi: number, linearGain = 1): boolean {
    if (!this.ready) return false;
    const dampedPrior = this.voices.attack(midi);
    if (dampedPrior) {
      this.sampler.triggerRelease(midiToToneName(midi), Tone.immediate());
    }
    // In Tone 15.1.22 Sampler forwards this argument to ToneBufferSource.start,
    // whose gain envelope uses it as an amplitude factor (not MIDI velocity).
    this.sampler.triggerAttack(midiToToneName(midi), Tone.immediate(), 0.88 * Math.max(0, Math.min(1, linearGain)));
    return dampedPrior;
  }

  noteOff(midi: number): void {
    if (this.voices.release(midi) && this.ready)
      this.sampler.triggerRelease(midiToToneName(midi), Tone.immediate());
  }

  /** A physical assisted trigger owns its sample voice, even when chords share a pitch. */
  noteOnSource(source: string, midi: number, linearGain = 1): boolean {
    if (!this.ready) return false;
    this.stopSource(source);
    this.sampler.triggerAttack(midiToToneName(midi), Tone.immediate(), 0.88 * Math.max(0, Math.min(1, linearGain)));
    // Tone Sampler keeps the ToneBufferSource it just created in this table.
    // Retaining that instance lets us release only this physical trigger.
    const active = (this.sampler as unknown as { _activeSources: Map<number, SampleVoice[]> })._activeSources;
    const voice = active.get(midi)?.at(-1);
    if (!voice) throw Error(`Sample voice was not created for MIDI ${midi}`);
    this.sourceVoices.set(source, { voice, held: true });
    this.recentSources.push({ midi, voice });
    this.trimVoiceBudget();
    return true;
  }

  noteOffSource(source: string): void {
    const entry = this.sourceVoices.get(source);
    if (!entry) return;
    if (this.pedal) entry.held = false;
    else this.stopSource(source);
    this.trimVoiceBudget();
  }

  /** Physical chords always win. Budgets apply to pedal-held/released tails only. */
  private trimVoiceBudget(): void {
    if(this.sourceVoices.size>this.sourceVoiceLimit)for(const [source,entry] of this.sourceVoices){
      if(this.sourceVoices.size<=this.sourceVoiceLimit)break;
      if(!entry.held){entry.voice.fadeOut=.012;this.stopSource(source);}
    }
    const active=(this.sampler as unknown as {_activeSources:Map<number,SampleVoice[]>})._activeSources;
    this.recentSources=this.recentSources.filter(entry=>active.get(entry.midi)?.includes(entry.voice));
    const held=new Set([...this.sourceVoices.values()].filter(entry=>entry.held).map(entry=>entry.voice));
    let excess=this.recentSources.reduce((count,entry)=>count+Number(!held.has(entry.voice)),0)-this.sampleTailLimit;
    if(excess<=0)return;
    this.recentSources=this.recentSources.filter(entry=>{
      if(excess<=0||held.has(entry.voice))return true;
      excess--;entry.voice.fadeOut=.012;entry.voice.stop(Tone.immediate());
      for(const [owner,current] of this.sourceVoices)if(current.voice===entry.voice)this.sourceVoices.delete(owner);
      return false;
    });
  }

  private stopSource(source: string): void {
    const entry = this.sourceVoices.get(source);
    if (!entry) return;
    entry.voice.stop(Tone.immediate());
    this.sourceVoices.delete(source);
  }

  setSustain(enabled: boolean): void {
    this.pedal = enabled;
    for (const midi of this.voices.setPedal(enabled))
      if (this.ready) this.sampler.triggerRelease(midiToToneName(midi), Tone.immediate());
    if (!enabled) for (const [source, entry] of this.sourceVoices)
      if (!entry.held) this.stopSource(source);
  }

  setRelease(seconds: number): void {
    this.sampler.release = Math.max(0.05, Math.min(3, seconds));
  }

  releaseAll(): void {
    this.voices.clear();
    this.sourceVoices.clear();
    this.recentSources = [];
    this.pedal = false;
    if (this.ready) this.sampler.releaseAll(Tone.immediate());
  }

  dispose(): void {
    this.releaseAll();
    this.sampler.dispose();
    this.gain.dispose();
  }
}
