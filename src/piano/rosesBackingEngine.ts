import * as Tone from "tone";
import { RosesBuildupEngine, type BuildupStatus } from "./rosesBuildupEngine";
import type { BuildupSettings } from "./rosesBuildup";
import type { RosesBassEngine } from "./rosesBassEngine";
import { backingChoices, backingGroups, backingStemUrl, type BackingGroup, type BackingMode } from "./rosesBacking";

/** One region router, driven only by the existing Roses transport callback.
 * Mode A delegates to the original engine. B/C use separately rendered submixes.
 */
export class RosesBackingEngine {
  private original: RosesBuildupEngine;
  private originalOutput: Tone.Gain;
  private output: Tone.Gain;
  private limiter: Tone.Limiter;
  private safety: Tone.WaveShaper;
  private groups = new Map<BackingGroup,Tone.Gain>();
  private buffers = new Map<string,Tone.ToneAudioBuffer>();
  private sources = new Set<Tone.ToneBufferSource>();
  private mode: BackingMode = "roses";
  private gain = 1;
  private levels: Record<BackingGroup,number> = {chords:1,bass:1,drums:1,fx:1};
  private solo: BackingGroup | null = null;
  private status: BuildupStatus = "NOT ARMED";
  private armed = false;
  private lastBeat = -1;
  private entry = 112;
  private started = false;
  private paused = false;
  private pausedOffset = 0;
  private pausedDelay = 0;
  private anchorTime = 0;
  private anchorOffset = 0;
  private secondsPerBeat = .6;
  private ready = false;
  private bassGainValue = 1;
  private disposed = false;
  constructor(destination: Tone.InputNode, private bass: RosesBassEngine) {
    this.originalOutput = new Tone.Gain(1).connect(destination);
    this.original = new RosesBuildupEngine(this.originalOutput,bass);
    this.output = new Tone.Gain(1);
    this.safety = new Tone.WaveShaper(value=>.9*Math.tanh(value/.9),2048).connect(destination);
    this.limiter = new Tone.Limiter(-3).connect(this.safety);this.output.connect(this.limiter);
    for(const group of backingGroups)this.groups.set(group,new Tone.Gain(1).connect(this.output));
  }
  async load():Promise<void> {
    await Promise.all([this.original.load(),...(["hwm-build","hwm-drop"] as const).flatMap(mode=>backingGroups.map(async group=>{
      const buffer = new Tone.ToneAudioBuffer();this.buffers.set(`${mode}:${group}`,buffer);
      await buffer.load(backingStemUrl(mode,group));if(this.disposed)buffer.dispose();
    }))]);
    if(!this.disposed)this.ready=true;
  }
  configure(settings:BuildupSettings):void {this.original.configure(settings);}
  snapshot() {
    const current = this.mode==="roses" ? this.original.snapshot() : {status:this.status,ready:this.ready,layers:this.started&&!this.paused&&this.lastBeat<144?[...backingGroups]:[],bass:this.started&&!this.paused&&this.lastBeat<144};
    return {...current,layers:current.layers as string[],mode:this.mode,gain:this.gain,levels:{...this.levels},solo:this.solo};
  }
  setMode(mode:BackingMode):void {
    if(mode===this.mode||!backingChoices.some(choice=>choice.value===mode))return;
    const state=this.snapshot().status,beat=this.lastBeat,paused=this.paused;
    const active=["ARMED","PLAYING","BREAK"].includes(state);
    this.stop();this.mode=mode;
    if(active){this.arm(0,false);this.begin(Math.max(0,beat));if(paused)this.pause(Tone.immediate(),Math.max(0,beat));}
  }
  setMix(patch:{gain?:number;group?:BackingGroup;level?:number;solo?:BackingGroup|null}):void {
    if(typeof patch.gain==="number"&&Number.isFinite(patch.gain))this.gain=Math.max(0,Math.min(1.5,patch.gain));
    if(patch.group&&backingGroups.includes(patch.group)&&typeof patch.level==="number"&&Number.isFinite(patch.level))this.levels[patch.group]=Math.max(0,Math.min(1.5,patch.level));
    if(patch.solo===null||patch.solo&&backingGroups.includes(patch.solo))this.solo=patch.solo;
    this.originalOutput.gain.rampTo(this.gain,.02);this.output.gain.rampTo(this.gain,.02);
    for(const group of backingGroups)this.groups.get(group)!.gain.rampTo(this.solo&&group!==this.solo?0:this.levels[group],.02);
    this.updateBassGain();
  }
  private updateBassGain(time?:number):void {
    const gain=this.mode==="roses"&&this.lastBeat>=112&&this.lastBeat<144?this.gain:1;
    if(gain!==this.bassGainValue){this.bass.setBuildGain?.(gain,time);this.bassGainValue=gain;}
  }
  arm(beat:number,running:boolean):boolean {
    if(this.mode==="roses")return this.original.arm(beat,running);
    if(!this.ready||running&&beat>=112||this.status==="PLAYING"||this.status==="BREAK")return false;
    this.armed=!this.armed;this.status=this.armed?"ARMED":"NOT ARMED";return this.armed;
  }
  begin(beat:number,repeat=false):void {
    const wasArmed=this.armed;
    this.stopSources();this.lastBeat=-1;this.entry=Math.max(112,beat);this.started=false;this.paused=false;
    this.updateBassGain();
    if(this.mode==="roses"){this.original.begin(beat,repeat);return;}
    this.original.stop();this.armed=this.status==="ARMED"||repeat&&wasArmed;
    this.status=this.armed?"ARMED":"NOT ARMED";
  }
  tick(beat:number,time:number,secondsPerBeat:number):void {
    if(beat===this.lastBeat)return;
    this.lastBeat=beat;this.secondsPerBeat=secondsPerBeat;this.updateBassGain(time);
    if(this.mode==="roses"){this.original.tick(beat,time,secondsPerBeat);return;}
    if(!this.armed||this.paused||beat<this.entry)return;
    if(beat>=144){this.status="FINISHED";return;}
    this.status="PLAYING";
    if(!this.started){this.bass.releaseAll(time);this.startSources(time,(beat-112)*.6);}
  }
  private startSources(time:number,offset:number):void {
    if(this.mode==="roses"||offset>=19.2)return;
    this.anchorTime=time;this.anchorOffset=offset;this.started=true;
    for(const group of backingGroups){
      const buffer=this.buffers.get(`${this.mode}:${group}`)!;
      if(offset>=buffer.duration)continue;
      const source=new Tone.ToneBufferSource({url:buffer,playbackRate:.6/this.secondsPerBeat,fadeIn:offset>0?.005:0,fadeOut:.01}).connect(this.groups.get(group)!);
      // Kept until stop/pause: no offline graph disposal before rendering.
      this.sources.add(source);source.start(time,offset);
      source.stop(time+(19.35-offset)/(.6/this.secondsPerBeat));
    }
  }
  private stopSources():void {for(const source of this.sources)source.dispose();this.sources.clear();}
  pause(time:number,beat:number):void {
    this.paused=true;
    if(this.mode==="roses"){this.original.pause(time,beat);return;}
    this.pausedOffset=this.started?this.anchorOffset+Math.max(0,time-this.anchorTime)*(.6/this.secondsPerBeat):Math.max(0,beat-112)*.6;
    this.pausedDelay=this.started?Math.max(0,this.anchorTime-time):0;
    this.stopSources();this.started=false;
  }
  resume(time:number):void {
    this.paused=false;
    if(this.mode==="roses"){this.original.resume(time);return;}
    if(this.armed&&this.lastBeat>=112&&this.lastBeat<144)this.startSources(time+this.pausedDelay,this.pausedOffset);
  }
  stop(time=Tone.immediate()):void {
    this.original.stop(time);this.stopSources();this.armed=false;this.started=false;this.paused=false;this.lastBeat=-1;this.status="NOT ARMED";this.updateBassGain();
  }
  dispose():void {
    this.disposed=true;this.stop();this.original.dispose();for(const buffer of this.buffers.values())buffer.dispose();
    for(const node of [...this.groups.values(),this.originalOutput,this.output,this.limiter,this.safety])node.dispose();
  }
}
