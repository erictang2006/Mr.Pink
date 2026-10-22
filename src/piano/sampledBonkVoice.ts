import * as Tone from "tone";

/** Original oscillator recording through the original live MonoSynth filters
 * and envelopes. Repeated taps reuse one looping source while it is sounding.
 */
export class SampledBonkVoice {
  private filter: Tone.Filter;
  private filterEnvelope: Tone.FrequencyEnvelope;
  private envelope: Tone.AmplitudeEnvelope;
  private output: Tone.Volume;
  private buffer = new Tone.ToneAudioBuffer();
  private source?: Tone.ToneBufferSource;
  private sources = new Set<Tone.ToneBufferSource>();
  private disposed = false;
  private destination?: Tone.InputNode;
  private connected = false;
  constructor(options: ReturnType<Tone.PolySynth<Tone.MonoSynth>["get"]>, private url: string){
    this.filter=new Tone.Filter(options.filter);this.filterEnvelope=new Tone.FrequencyEnvelope(options.filterEnvelope);
    this.envelope=new Tone.AmplitudeEnvelope(options.envelope);this.output=new Tone.Volume(options.volume);
    this.filter.chain(this.envelope,this.output);this.filterEnvelope.connect(this.filter.frequency);
  }
  async load(): Promise<void> {await this.buffer.load(this.url);if(this.disposed)this.buffer.dispose();}
  connect(output: Tone.InputNode): this {this.destination=output;return this;}
  set(options: Parameters<Tone.MonoSynth["set"]>[0]): this {
    if(options.envelope)this.envelope.set(options.envelope);if(options.filterEnvelope)this.filterEnvelope.set(options.filterEnvelope);
    if(options.filter)this.filter.set(options.filter);if(options.volume!==undefined)this.output.volume.value=options.volume;return this;
  }
  triggerAttack(_note: string,time: number,velocity: number): void {
    if(!this.buffer.loaded||this.disposed)return;
    if(!this.connected&&this.destination){this.output.connect(this.destination);this.connected=true;}
    if(this.source?.getStateAtTime(time)==="started")this.source.cancelStop();
    else {
      const source=new Tone.ToneBufferSource({url:this.buffer,loop:true,loopStart:1,loopEnd:2.8,
        // The amplitude envelope owns the attack. A source fade-in would be
        // cancelled by cancelStop() on retrigger and could leave its gain at zero.
        onended:()=>{if(this.source===source){this.source=undefined;if(!source.context.isOffline){this.output.disconnect();this.connected=false;}}if(!source.context.isOffline){this.sources.delete(source);source.dispose();}},
      }).connect(this.filter);this.source=source;this.sources.add(source);source.start(time);
    }
    this.envelope.triggerAttack(time,velocity);this.filterEnvelope.triggerAttack(time);
  }
  triggerRelease(time: number): void {
    this.envelope.triggerRelease(time);this.filterEnvelope.triggerRelease(time);
    this.source?.stop(time+Number(this.envelope.release)+.02);
  }
  dispose(): void {this.disposed=true;for(const source of this.sources)source.dispose();this.sources.clear();this.buffer.dispose();this.filter.dispose();this.filterEnvelope.dispose();this.envelope.dispose();this.output.dispose();}
}
