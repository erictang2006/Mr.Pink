// Generation-only: actual source MIDI and samples, cached before browser playback.
import * as Tone from "tone";
import source from "../../reference/here-with-me-remake/backing-source-events.json";
import { HereWithMeLeadEngine } from "./hereWithMeLeadEngine";
import { midiToToneName } from "./noteMapping";
import { DropChordAmbience } from "./dropChordAmbience";

export const hwmRenderGroups = ["chords", "bass", "drums", "fx"] as const;
type Group = typeof hwmRenderGroups[number];
type Selection = typeof source.selections.build;
export class HwmBackingRenderEngine {
  readonly buses = Object.fromEntries(hwmRenderGroups.map(group => [group, new Tone.Gain(1)])) as Record<Group,Tone.Gain>;
  private nodes: Tone.ToneAudioNode[] = [];
  private buffers = new Map<string,Tone.ToneAudioBuffer>();
  private sources: Tone.ToneBufferSource[] = [];
  private voices = new Map<number,Tone.PolySynth<Tone.Synth>>();
  private harmony = new Tone.Gain(1);
  private room = new DropChordAmbience();
  private lead?: HereWithMeLeadEngine;
  private leadOutput = new Tone.Gain(.42);
  private nexusLift = new Tone.Gain(0);
  private guitarPump = new Tone.Gain(1);
  private lowGuitarPump = new Tone.Gain(1);
  readonly scheduled: { channel: number; tick: number; midi?: number; durationTicks: number; file?: string; offsetSeconds?: number }[] = [];
  constructor(private mode: "build" | "drop") {
    this.room.output.fade.value=.1;
    this.harmony.connect(this.room);this.room.connect(this.buses.chords);
    this.buses.bass.gain.value=3.2;
    this.leadOutput.connect(this.harmony);
    this.nexusLift.connect(this.harmony);
    this.guitarPump.connect(this.harmony);
    this.lowGuitarPump.connect(this.buses.bass);
    const specs = [
      { id:2, type:"fatsawtooth", count:2, spread:9, gain:-25, cutoff:4200, attack:.004, decay:.21, sustain:.32, release:.09, pan:-.12, group:"chords" },
      { id:3, type:"fattriangle", count:2, spread:7, gain:-29, cutoff:1900, attack:.07, decay:.35, sustain:.6, release:.14, pan:.15, group:"chords" },
      { id:13, type:"triangle", count:1, spread:0, gain:-20, cutoff:1500, attack:.003, decay:.18, sustain:.4, release:.1, pan:0, group:"bass" },
      { id:18, type:"sawtooth", count:1, spread:0, gain:-29, cutoff:5800, attack:.006, decay:.2, sustain:.42, release:.12, pan:.2, group:"chords" },
      { id:23, type:"sawtooth", count:1, spread:0, gain:-22, cutoff:1500, attack:.003, decay:.22, sustain:.55, release:.1, pan:0, group:"bass" },
      { id:24, type:"fatsawtooth", count:2, spread:5, gain:-22, cutoff:2200, attack:.002, decay:.12, sustain:.22, release:.08, pan:0, group:"bass" },
      { id:26, type:"fatsawtooth", count:2, spread:5, gain:-22, cutoff:2200, attack:.002, decay:.12, sustain:.22, release:.08, pan:0, group:"bass" },
    ] as const;
    for (const spec of specs) {
      if (!this.selection.notes.some(note=>note.channel===spec.id)) continue;
      const destination = spec.id===18 ? this.nexusLift : spec.id===23||spec.id===24||spec.id===26 ? this.lowGuitarPump : spec.group==="chords" ? this.harmony : this.buses[spec.group];
      const pan = new Tone.Panner(spec.pan).connect(destination);
      const filter = new Tone.Filter({type:"lowpass",frequency:spec.cutoff,rolloff:-12,Q:.6}).connect(pan);
      const voice = new Tone.PolySynth(Tone.Synth,{oscillator:{type:spec.type,count:spec.count,spread:spec.spread},envelope:{attack:spec.attack,decay:spec.decay,sustain:spec.sustain,release:spec.release},volume:spec.gain}).connect(filter);
      voice.maxPolyphony=20;
      this.voices.set(spec.id,voice);this.nodes.push(voice,filter,pan);
    }
    if (mode==="drop") {
      this.lead = new HereWithMeLeadEngine(this.leadOutput);
      this.lead.configure({volume:1});this.lead.arm(0,false);this.lead.begin(144);this.lead.prepareVoices();
    }
  }
  private get selection(): Selection { return source.selections[this.mode]; }
  async load(): Promise<void> {
    const files = new Set(this.selection.audio.map(clip=>this.sampleFile(clip.channel,clip.file)));
    if (this.mode==="drop") files.add(source.channels.find(c=>c.id===29)!.sampleFile!+".wav");
    for (const zone of source.channels.find(c=>c.id===14)!.zones!) if (zone.present) files.add(zone.file+".wav");
    await Promise.all([...files].map(async file=>{const buffer=new Tone.ToneAudioBuffer();this.buffers.set(file,buffer);await buffer.load(`/hwm-source/${file}`);}));
  }
  private sampleFile(channel:number,file:string):string { return [9,17,30].includes(channel)?`channel-${channel}.wav`:file+".wav"; }
  tick(tick:number,time:number):void {
    const end=32*96;
    if(tick>=end)return;
    this.lead?.tick(144+tick/96,time,.6);
    // The Nexus #2 volume clip is genuinely present only in the buildup.
    const lift=this.selection.automation.find(a=>a.channel===25);
    if(lift) {
      const progress=Math.max(0,Math.min(1,(tick-lift.tick)/lift.lengthTicks));
      this.nexusLift.gain.setValueAtTime(progress*.9285714,time);
    }
    // Guitar's Kickstart is proprietary: retain its role with a restrained approximation.
    if(tick%96===0){this.guitarPump.gain.setValueAtTime(.72,time);this.guitarPump.gain.linearRampToValueAtTime(1,time+.15);}
    // Preserve the explicit Insert-100 volume pulses affecting the low guitar/bass bus.
    for(const pulse of this.selection.automation.filter(a=>a.channel===37))if(pulse.tick>=tick&&pulse.tick<tick+24){
      const at=time+(pulse.tick-tick)/96*.6;
      this.lowGuitarPump.gain.setValueAtTime(0,at);this.lowGuitarPump.gain.linearRampToValueAtTime(.8,at+.25*.6);
    }
    for(const note of this.selection.notes.filter(n=>n.tick>=tick&&n.tick<tick+24)){
      const at=time+(note.tick-tick)/96*.6;
      this.scheduled.push({channel:note.channel,tick:note.tick,midi:note.midi,durationTicks:note.durationTicks});
      if(note.channel>=19&&note.channel<=22)continue; // same source four-bank engine above
      if(note.channel===14){
        const zone=source.channels.find(c=>c.id===14)!.zones!.find(z=>z.present&&note.midi>=z.low&&note.midi<=z.high&&note.velocity>=z.velocityLow&&note.velocity<=z.velocityHigh);
        if(!zone)throw Error(`Missing Piezo zone for source note ${note.midi}`);
        const rate=2**((note.midi-zone.root)/12);
        this.play(zone.file+".wav",this.guitarPump,at,0,note.durationTicks/96*.6+.07,rate,note.velocity/128*.32);
      } else if(note.channel===29){
        const file=source.channels.find(c=>c.id===29)!.sampleFile!+".wav";
        this.play(file,this.buses.drums,at,0,(end-note.tick)/96*.6,1,note.velocity/128*.5);
      } else this.voices.get(note.channel)?.triggerAttackRelease(midiToToneName(note.midi),Math.max(.005,note.durationTicks/96*.6),at,note.velocity/128);
    }
    for(const clip of this.selection.audio.filter(c=>c.tick>=tick&&c.tick<tick+24)){
      const at=time+(clip.tick-tick)/96*.6,ch=source.channels.find(c=>c.id===clip.channel)!;
      const gain=(ch.volumeRaw??10000)/12800*(clip.group==="fx"?.36:.66);
      this.play(this.sampleFile(clip.channel,clip.file),this.buses[clip.group as Group],at,clip.offsetSeconds,clip.durationTicks/96*.6,1,gain);
      this.scheduled.push({channel:clip.channel,tick:clip.tick,durationTicks:clip.durationTicks,file:clip.file,offsetSeconds:clip.offsetSeconds});
    }
  }
  private play(file:string,destination:Tone.InputNode,time:number,offset:number,duration:number,rate:number,gain:number):void {
    const buffer=this.buffers.get(file)!;
    const length=Math.min(duration,(buffer.duration-offset)/rate);
    if(length<=0)return;
    const sample=new Tone.ToneBufferSource({url:buffer,playbackRate:rate,fadeIn:.001,fadeOut:Math.min(.025,length/2)}).connect(destination);
    sample.start(time,offset,undefined,gain);sample.stop(time+length);this.sources.push(sample);
  }
  dispose():void {
    this.lead?.dispose();for(const source of this.sources)source.dispose();for(const buffer of this.buffers.values())buffer.dispose();
    for(const node of [...this.nodes,...Object.values(this.buses),this.leadOutput,this.nexusLift,this.guitarPump,this.lowGuitarPump,this.harmony,this.room])node.dispose();
  }
}
