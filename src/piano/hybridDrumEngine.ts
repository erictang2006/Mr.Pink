import { readObjectPreference, writeObjectPreference } from '../settings/objectPreference';
import { hybridDrumPreferenceKey } from './mixerPreferences';
import {hybridRiserEndBeat} from "./hybridBacking";
import * as Tone from 'tone';
import {validHybridDrums,hybridDrumGains,hybridDrumChangeBeats,type HybridDrumSettings} from './hybridDrumTransition';

/** Two existing prepared percussion recordings, mixed on the existing beat grid. */
export class HybridDrumEngine {
 private settings=readObjectPreference(hybridDrumPreferenceKey,validHybridDrums);
 private gains={hwm:new Tone.Gain(0),roses:new Tone.Gain(0)};
 private sources=new Set<Tone.ToneBufferSource>();
 private offlineEnded=new Set<Tone.ToneBufferSource>();
 private anchor?:{time:number;beat:number;secondsPerBeat:number};
 constructor(destination:Tone.InputNode){for(const gain of Object.values(this.gains))gain.connect(destination);}
 snapshot():HybridDrumSettings{return {...this.settings};}
 configure(patch:Partial<HybridDrumSettings>):void {
  this.settings=validHybridDrums(patch,this.settings);
  writeObjectPreference(hybridDrumPreferenceKey,this.settings);
  if(this.anchor){const time=Math.max(Tone.immediate(),this.anchor.time),beat=this.anchor.beat+Math.max(0,time-this.anchor.time)/this.anchor.secondsPerBeat;this.automate(time,beat,this.anchor.secondsPerBeat,true);}
 }
 start(time:number,offset:number,secondsPerBeat:number,buffers:{hwm:Tone.ToneAudioBuffer;roses:Tone.ToneAudioBuffer}):void {
  this.stop();const beat=112+offset/.6,rate=.6/secondsPerBeat;
  this.anchor={time,beat,secondsPerBeat};this.automate(time,beat,secondsPerBeat);
  for(const side of ['hwm','roses'] as const){
   const endBeat=side==='hwm'?136:hybridRiserEndBeat;
   const buffer=buffers[side];if(beat>=endBeat||!buffer.loaded||offset>=buffer.duration)continue;
   const source=new Tone.ToneBufferSource({url:buffer,playbackRate:rate,fadeIn:offset>0?.005:0,fadeOut:.01,onended:()=>{
    this.sources.delete(source);if(source.context.isOffline)this.offlineEnded.add(source);else source.dispose();
   }}).connect(this.gains[side]);this.sources.add(source);source.start(time,offset);source.stop(time+(endBeat-beat)*secondsPerBeat);
  }
 }
 private automate(time:number,beat:number,secondsPerBeat:number,smooth=false):void {
  const begin=beat+(smooth?.02/secondsPerBeat:0),start=time+(smooth?.02:0);
  const values=hybridDrumGains(begin,this.settings);
  for(const side of ['hwm','roses'] as const){
   const param=this.gains[side].gain;
   if(smooth){param.cancelAndHoldAtTime(time);param.linearRampToValueAtTime(values[side],start);}
   else{param.cancelScheduledValues(time);param.setValueAtTime(values[side],time);}
   for(const point of hybridDrumChangeBeats){
    if(point<=begin)continue;
    // Hold the original groove intact up to bar 33; the other segments crossfade.
    const value=hybridDrumGains(point===144?143.999999:point,this.settings)[side],at=time+(point-beat)*secondsPerBeat;
    if(point===128)param.setValueAtTime(value,at);else param.linearRampToValueAtTime(value,at);
   }
  }
 }
 stop():void {
  for(const source of this.sources)source.dispose();this.sources.clear();
  if(this.anchor){const time=Tone.immediate();for(const gain of Object.values(this.gains)){gain.gain.cancelScheduledValues(time);gain.gain.setValueAtTime(0,time);}}
  this.anchor=undefined;
 }
 dispose():void {this.stop();for(const source of this.offlineEnded)source.dispose();this.offlineEnded.clear();for(const gain of Object.values(this.gains))gain.dispose();}
}
