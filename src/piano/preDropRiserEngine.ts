import { readObjectPreference, writeObjectPreference } from '../settings/objectPreference';
import { riserPreferenceKey } from './mixerPreferences';
import * as Tone from 'tone';
import {validRiserSettings,riserUrls,type RiserSettings,hybridRiserEndBeat} from './hybridBacking';

/** Prepared stereo sweeps: two buffer voices, no live noise/oscillator/filter work. */
export class PreDropRiserEngine {
 private settings=readObjectPreference(riserPreferenceKey,validRiserSettings);
 private output:Tone.Gain;
 private blends={soft:new Tone.Gain(1-this.settings.intensity),strong:new Tone.Gain(this.settings.intensity)};
 private buffers={soft:new Tone.ToneAudioBuffer(),strong:new Tone.ToneAudioBuffer()};
 private sources=new Set<Tone.ToneBufferSource>();
 private offlineEnded=new Set<Tone.ToneBufferSource>();
 private disposed=false;
 constructor(destination:Tone.InputNode){this.output=new Tone.Gain(this.settings.enabled?this.settings.volume:0).connect(destination);this.blends.soft.connect(this.output);this.blends.strong.connect(this.output);}
 async load():Promise<void>{await Promise.all((['soft','strong'] as const).map(async side=>{await this.buffers[side].load(riserUrls[side]);if(this.disposed)this.buffers[side].dispose();}));}
 route(destination:Tone.InputNode):void {this.output.disconnect();this.output.connect(destination);}
 snapshot():RiserSettings{return {...this.settings};}
 configure(patch:Partial<RiserSettings>):void {
  this.settings=validRiserSettings(patch,this.settings);
  writeObjectPreference(riserPreferenceKey,this.settings);
  this.output.gain.rampTo(this.settings.enabled?this.settings.volume:0,.025);
  this.blends.soft.gain.rampTo(1-this.settings.intensity,.025);this.blends.strong.gain.rampTo(this.settings.intensity,.025);
 }
 play(time:number,offset=0,rate=1):void {
  this.stop();if(this.disposed||offset>=(hybridRiserEndBeat-140)*.6)return;
  for(const side of ['soft','strong'] as const){
   const buffer=this.buffers[side];if(!buffer.loaded||offset>=buffer.duration)continue;
   const source=new Tone.ToneBufferSource({url:buffer,playbackRate:rate,fadeIn:offset>0?.005:0,fadeOut:.005,onended:()=>{
    this.sources.delete(source);if(source.context.isOffline)this.offlineEnded.add(source);else source.dispose();
   }}).connect(this.blends[side]);this.sources.add(source);source.start(time,offset);source.stop(time+Math.max(.005,(buffer.duration-offset)/rate-.005));
  }
 }
 stop():void{for(const source of this.sources)source.dispose();this.sources.clear();}
 dispose():void{this.disposed=true;this.stop();for(const source of this.offlineEnded)source.dispose();this.offlineEnded.clear();for(const node of [...Object.values(this.buffers),...Object.values(this.blends),this.output])node.dispose();}
}
