import * as Tone from "tone";
import { hereWithMeChords } from "./hereWithMeChords";

/** Exact local chord/pad/Piezo renders. One held chord per physical key;
 * the prepared sustain body loops without starting a musical clock.
 */
export class HwmManualHarmonyEngine {
  private volume = new Tone.Gain(4);
  private buffers = new Map<string,Tone.ToneAudioBuffer>();
  private held = new Map<string,Tone.ToneBufferSource>();
  private sources = new Set<Tone.ToneBufferSource>();
  private ready = false;
  private disposed = false;
  private loading?: Promise<void>;
  constructor(output: Tone.InputNode) { this.volume.connect(output); }
  setVolume(value: number): void { this.volume.gain.rampTo(Math.max(0,Math.min(8,Number.isFinite(value)?value:4)),.025); }
  load(): Promise<void> {
    if (!this.loading) this.loading = Promise.all(hereWithMeChords.map(async chord => {
      const buffer = new Tone.ToneAudioBuffer(); this.buffers.set(chord.code,buffer);
      await buffer.load(`/roses/hwm-manual-harmony/${chord.code}.wav`); if (this.disposed) buffer.dispose();
    })).then(()=>{if(!this.disposed)this.ready=true;}).catch(error=>{
      for(const buffer of this.buffers.values())buffer.dispose();this.buffers.clear();this.loading=undefined;throw error;
    });
    return this.loading;
  }
  isReady(): boolean { return this.ready; }
  attack(code: string, time: number): void {
    const buffer=this.buffers.get(code);if(!this.ready||!buffer)return;
    this.release(code,time);
    const source=new Tone.ToneBufferSource({url:buffer,loop:true,loopStart:.8,loopEnd:1.4,fadeIn:.003,fadeOut:.12,
      onended:()=>{if(this.held.get(code)===source)this.held.delete(code);if(!source.context.isOffline){this.sources.delete(source);source.dispose();}},
    }).connect(this.volume);
    this.held.set(code,source);this.sources.add(source);source.start(time);
  }
  release(code: string, time: number): void {const source=this.held.get(code);if(source){this.held.delete(code);source.stop(time+.12);}}
  cancel(): void {for(const source of this.sources)source.dispose();this.sources.clear();this.held.clear();}
  dispose(): void {this.disposed=true;this.cancel();for(const buffer of this.buffers.values())buffer.dispose();this.buffers.clear();this.volume.dispose();this.ready=false;}
}
