import * as Tone from 'tone';
import {readObjectPreference,writeObjectPreference} from '../settings/objectPreference';
import {defaultSodaPopSettings,validSodaPopSettings,sodaPopSettingsKey,sodaPopAsset,sodaPopFrame,type SodaPopSettings} from './sodaPopTimeline';
const cueFiles={click:'/audio/soda-pop/click.wav',brake:'/audio/soda-pop/brake.wav',scratch:'/audio/soda-pop/scratch.wav',glitch:'/audio/soda-pop/glitch.wav',can:'/audio/soda-pop/can.wav',fizz:'/audio/soda-pop/fizz.wav'};
type Hooks={beforeStart:(time:number)=>void;rehearse:(valid:()=>boolean)=>Promise<void>;back:()=>void};
type State={status:'idle'|'running'|'paused'|'finished'|'error';ready:boolean;loading:boolean;settings:SodaPopSettings;error:string;connected:boolean};
/** Independent, audio-clocked finale. Never writes the DJ transport, tempo or MIDI map. */
export class SodaPopEngine {
 private state:State={status:'idle',ready:false,loading:false,settings:{...defaultSodaPopSettings},error:'',connected:false};
 private listeners=new Set<()=>void>();
 private buffers=new Map<string,Tone.ToneAudioBuffer>();
 private sources=new Set<Tone.ToneBufferSource>();
 private output?:Tone.Gain;
 private songOutput?:Tone.Gain;
 private loading?:Promise<void>;
 private hooks?:Hooks;
 private origin=0;private position=0;private generation=0;private pending=false;private initialized=false;private forceAuto=false;
 private takeSettings={...defaultSodaPopSettings};
 private resourceGeneration=0;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 snapshot=()=>this.state;
 private publish(patch:Partial<State>){this.state={...this.state,...patch};for(const listener of this.listeners)listener();}
 attach(hooks:Hooks){this.hooks=hooks;if(!this.initialized){this.initialized=true;this.configure(readObjectPreference(sodaPopSettingsKey,validSodaPopSettings));}this.publish({connected:true});return()=>{this.hooks=undefined;this.stop();this.publish({connected:false});};}
 configure(patch:Partial<SodaPopSettings>){if(this.active())return;const song=this.buffers.get('song');const settings=validSodaPopSettings({...this.state.settings,...patch},song?.loaded? song.duration:undefined);writeObjectPreference(sodaPopSettingsKey,settings);this.publish({settings});}
 setVolume(master:number){this.output?.gain.rampTo(Math.max(0,Math.min(1,master)),.025);this.master=master;}
 private master=1;
 prepare():Promise<void>{
  if(this.state.ready)return Promise.resolve();if(this.loading)return this.loading;
  const resource=this.resourceGeneration;
  this.output??=new Tone.Gain(this.master).toDestination();this.songOutput??=new Tone.Gain(1).connect(this.output);this.publish({loading:true,error:''});
  this.loading=Promise.all(Object.entries({song:sodaPopAsset,...cueFiles}).map(async([key,url])=>{let buffer=this.buffers.get(key);if(!buffer){buffer=new Tone.ToneAudioBuffer();this.buffers.set(key,buffer);}if(!buffer.loaded)await buffer.load(url);if(resource!==this.resourceGeneration)buffer.dispose();})).then(()=>{
   if(resource!==this.resourceGeneration)return;
   this.configure({});this.publish({ready:true,loading:false});
  }).catch(()=>{if(resource===this.resourceGeneration)this.publish({ready:false,loading:false,error:'Soda Pop could not load. The DJ show is still available; retry the finale.'});throw Error('Soda Pop audio unavailable.');}).finally(()=>{if(resource===this.resourceGeneration)this.loading=undefined;});
  return this.loading;
 }
 active(){return this.state.status==='running'||this.state.status==='paused'||this.state.status==='finished';}
 elapsed(){return this.state.status==='running'?Math.max(0,(Tone.immediate()-this.origin)*this.takeSettings.speed):this.position;}
 frame(){return sodaPopFrame(this.elapsed(),this.active()?this.takeSettings:this.state.settings);}
 // A bar-boundary handoff is allowed only by the explicit rehearsal action.
 automatic(time:number):boolean {if(!this.forceAuto)return false;return this.trigger(time);}
 readyForAutomatic(){return this.state.ready&&!!this.hooks&&!this.active()&&this.forceAuto;}
 private trigger(time:number):boolean {
  if(!this.hooks||!this.state.ready||this.active())return false;
  this.takeSettings={...this.state.settings};this.position=0;this.origin=time;this.forceAuto=false;
  try{this.hooks.beforeStart(time);this.schedule(0,time);this.publish({status:'running',error:''});return true;}
  catch{this.clear();this.publish({status:'error',error:'The finale could not start. Stop and retry.'});return false;}
 }
 async launch(){if(this.pending||this.active()||!this.hooks)return;this.pending=true;const token=this.generation;try{await Tone.start();await this.prepare();if(token===this.generation)this.trigger(Tone.immediate()+.03);}catch{if(token===this.generation&&!this.state.error)this.publish({error:'Browser audio could not start. Click Start audio and retry the finale.'});}finally{this.pending=false;}}
 private schedule(position:number,time:number){
  const settings=this.takeSettings,rate=settings.speed;
  const cues:[string,number,number][]=[['brake',0,.75],['scratch',settings.transition*settings.scratch,.5],['glitch',settings.transition*settings.glitch,.38],['can',settings.transition*settings.can,.9],['fizz',settings.transition*settings.can+.07,.4]];
  for(const [key,at,level] of cues){const buffer=this.buffers.get(key)!;this.play(buffer,time+Math.max(0,at-position)/rate,Math.max(0,position-at),buffer.duration,level);}
  const musicAt=settings.transition-settings.firstBeat;
  if(settings.countIn)for(let beat=0;beat<4;beat++){const at=musicAt-(4-beat)*60/settings.bpm,buffer=this.buffers.get('click')!;if(at<position-1e-8)continue;this.play(buffer,time+Math.max(0,at-position)/rate,Math.max(0,position-at),buffer.duration,beat===0?.65:.42,false,1);}
  const music=Math.max(0,position-musicAt),length=settings.end-settings.start,finish=length+settings.fadeSeconds;
  if(music<finish){
   const start=time+Math.max(0,musicAt-position)/rate,reveal=time+Math.max(0,settings.transition-position)/rate;
   this.songOutput!.gain.cancelScheduledValues(time);
   const currentGain=music>=length?Math.max(0,1-(music-length)/settings.fadeSeconds):position>=settings.transition?1:.25;
   this.songOutput!.gain.setValueAtTime(currentGain,start);
   if(music<length){
    if(position<settings.transition)this.songOutput!.gain.linearRampToValueAtTime(1,reveal);
    this.songOutput!.gain.setValueAtTime(1,start+(length-music)/rate);
   }
   this.songOutput!.gain.linearRampToValueAtTime(0,start+(finish-music)/rate);
   this.play(this.buffers.get('song')!,start,settings.start+music,finish-music,1,true);
  }
 }
 private play(buffer:Tone.ToneAudioBuffer,time:number,offset:number,duration:number,level:number,music=false,rate=this.takeSettings.speed){
  // Cue tails may resume mid-buffer; the music duration is already the remaining excerpt.
  const remaining=Math.min(duration,buffer.duration-offset);if(remaining<=.005)return;
  let source:Tone.ToneBufferSource;
  source=new Tone.ToneBufferSource({url:buffer,...(rate===1?{}:{playbackRate:rate}),fadeIn:0,fadeOut:.012,onended:()=>{this.sources.delete(source);source.dispose();}}).connect(music?this.songOutput!:this.output!);
  this.sources.add(source);source.start(time,offset,Math.max(.001,remaining/rate-.012),level);
 }
 private clear(){for(const source of this.sources)source.dispose();this.sources.clear();}
 pause(){if(this.state.status!=='running')return;this.position=this.elapsed();this.clear();this.publish({status:'paused'});}
 resume(){if(this.state.status!=='paused')return;const now=Tone.immediate()+.015;this.origin=now-this.position/this.takeSettings.speed;this.schedule(this.position,now);this.publish({status:'running'});}
 seek(elapsed:number){if(!this.active())return;const paused=this.state.status==='paused';this.clear();this.position=Math.max(0,Math.min(this.takeSettings.transition-this.takeSettings.firstBeat+this.takeSettings.end-this.takeSettings.start+this.takeSettings.fadeSeconds,Number.isFinite(elapsed)?elapsed:0));this.origin=Tone.immediate()+.015-this.position/this.takeSettings.speed;if(!paused)this.schedule(this.position,this.origin+this.position/this.takeSettings.speed);this.publish({status:paused?'paused':'running'});}
 update(){if(this.state.status==='running'&&this.frame().phase==='finished'){this.position=this.elapsed();this.clear();this.publish({status:'finished'});}}
 stop(){this.generation++;this.pending=false;this.forceAuto=false;this.clear();this.position=0;this.publish({status:'idle',error:''});}
 restart(){this.stop();void this.launch();}
 back(){this.stop();this.hooks?.back();}
 async rehearse(){if(this.pending||!this.hooks)return;this.stop();this.pending=true;const token=this.generation;try{await Tone.start();await this.prepare();if(token!==this.generation)return;this.forceAuto=true;await this.hooks.rehearse(()=>token===this.generation);}catch{this.forceAuto=false;if(token===this.generation)this.publish({error:'Could not prepare the final DJ bar. Retry after enabling Roses audio.'});}finally{this.pending=false;}}
 dispose(){this.resourceGeneration++;this.stop();for(const buffer of this.buffers.values())buffer.dispose();this.buffers.clear();this.songOutput?.dispose();this.songOutput=undefined;this.output?.dispose();this.output=undefined;this.loading=undefined;this.publish({ready:false,loading:false});}
}
export const sodaPop=new SodaPopEngine();
