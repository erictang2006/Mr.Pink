import * as Tone from "tone";
import {SampledBonkVoice} from "./sampledBonkVoice";
import { midiToToneName } from "./noteMapping";

/** Fixed live-key pool: repeated pitches retrigger their existing envelopes
 * instead of allocating another fat synth for every overlapping release tail.
 */
export class LiveBonkBank {
  private output = new Tone.Gain(1);
  private voices = new Map<string,Tone.MonoSynth | SampledBonkVoice>();
  private owners = new Map<string,number>();
  private lastAttack = new Map<string,number>();
  constructor(template: Tone.PolySynth<Tone.MonoSynth>, pitches: readonly number[], bank?: "left" | "right" | "center") {
    const options=template.get();
    for(const midi of new Set(pitches))this.voices.set(midiToToneName(midi),(bank?new SampledBonkVoice(options,`/roses/live-bonk-waves/${bank}-${midi}.wav`):new Tone.MonoSynth(options)).connect(this.output));
    template.dispose();
  }
  async load(): Promise<void> {await Promise.all([...this.voices.values()].map(voice=>voice instanceof SampledBonkVoice?voice.load():Promise.resolve()));}
  connect(destination: Tone.InputNode): this {this.output.connect(destination);return this;}
  chain(...nodes: Tone.ToneAudioNode[]): this {this.output.chain(...nodes);return this;}
  set(options: Parameters<Tone.MonoSynth["set"]>[0]): this {for(const voice of this.voices.values())voice.set(options);return this;}
  triggerAttack(note: string, time: number, velocity: number): void {
    const voice=this.voices.get(note);if(!voice)return;
    this.owners.set(note,(this.owners.get(note)??0)+1);
    // Shared chord pitches can arrive at the same sample. Count both owners,
    // but never restart one oscillator twice at an identical audio timestamp.
    if(time>(this.lastAttack.get(note)??-Infinity)){voice.triggerAttack(note,time,velocity);this.lastAttack.set(note,time);}
  }
  triggerRelease(note: string,time: number): void {
    const count=this.owners.get(note)??0;if(!count)return;
    if(count>1)this.owners.set(note,count-1);
    else {this.owners.delete(note);this.voices.get(note)?.triggerRelease(time);}
  }
  triggerAttackRelease(note: string,duration: number,time: number,velocity: number): void {this.triggerAttack(note,time,velocity);this.triggerRelease(note,time+duration);}
  releaseAll(time: number): void {for(const note of this.owners.keys())this.voices.get(note)?.triggerRelease(time);this.owners.clear();}
  dispose(): void {for(const voice of this.voices.values())voice.dispose();this.voices.clear();this.owners.clear();this.lastAttack.clear();this.output.dispose();}
}
