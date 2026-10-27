import * as Tone from 'tone';
import {openingCues,type OpeningSnapshot} from './sequence';

export const transitionSoundSettings={level:.42,fade:.025,maxSources:6,tapLevel:.7} as const;
export const transitionSoundFiles={
  form:'/audio/transitions/logo-form.wav',fracture:'/audio/transitions/logo-fracture.wav',
  reveal:'/audio/transitions/piano-reveal.wav',levels:'/audio/transitions/levels-warp.wav',roses:'/audio/transitions/galaxy-vinyl.wav',
  tap:'/audio/transitions/keyboard-tap.wav',
} as const;
type Sound=keyof typeof transitionSoundFiles;
type Group='opening'|'levels'|'roses'|'typing';
const openingScenes=new Set(['MESSAGE_COMPLETE','LOGO_FORMATION','LOGO_HOLD','LOGO_FRACTURE','PIANO_REVEAL']);
export function isMessageTap(snapshot:OpeningSnapshot,event:Pick<KeyboardEvent,'key'|'code'|'repeat'|'isComposing'|'metaKey'|'ctrlKey'|'altKey'>){
  return snapshot.scene==='MESSAGE_ENTRY'&&!event.repeat&&!event.isComposing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&(event.key.length===1||event.code==='Backspace');
}

/** Predecoded one-shots on a separate low-level bus. No synths, loops, timers or transport writes. */
export class TransitionSounds {
  private output=new Tone.Gain(transitionSoundSettings.level).toDestination();
  private buffers=new Map<Sound,Tone.ToneAudioBuffer>();
  private sources=new Map<Tone.ToneBufferSource,Group>();
  private retiring=new Set<Tone.ToneBufferSource>();
  private runs=new Map<Group,string>();
  private loading?:Promise<void>;
  private ready=false;
  private disposed=false;
  load():Promise<void>{
    if(this.ready)return Promise.resolve();
    if(!this.loading)this.loading=Promise.all(Object.entries(transitionSoundFiles).map(async([name,url])=>{
      const buffer=this.buffers.get(name as Sound)??new Tone.ToneAudioBuffer();this.buffers.set(name as Sound,buffer);
      await buffer.load(url);if(this.disposed)buffer.dispose();
    })).then(()=>{if(!this.disposed)this.ready=true;}).catch(error=>{this.loading=undefined;throw error;});
    return this.loading;
  }
  setVolume(master:number){if(!this.disposed)this.output.gain.rampTo(Math.max(0,Math.min(1,master))*transitionSoundSettings.level,.025);}
  syncOpening(snapshot:OpeningSnapshot,now=performance.now()){
    if(snapshot.scene!=='MESSAGE_ENTRY')this.stop('typing');
    if(snapshot.timelineOrigin===undefined||!openingScenes.has(snapshot.scene)){this.stop('opening');return;}
    this.schedule('opening',`${snapshot.run}:${snapshot.timelineOrigin}`,[['form',openingCues.formation],['fracture',openingCues.fracture],['reveal',openingCues.reveal]],now-snapshot.timelineOrigin);
  }
  transition(group:'levels'|'roses',origin:number,now=performance.now()){
    this.schedule(group,String(origin),[[group,0]],now-origin);
  }
  tap(){
    const buffer=this.buffers.get('tap');if(this.disposed||!this.ready||!buffer?.loaded)return;
    // Recycle only older tap tails during extreme typing; never evict a cinematic cue.
    if(this.sources.size>=transitionSoundSettings.maxSources){
      const oldest=[...this.sources].find(([,owner])=>owner==='typing')?.[0];
      if(!oldest)return;this.sources.delete(oldest);oldest.dispose();
    }
    let source:Tone.ToneBufferSource|undefined;
    try{
      source=new Tone.ToneBufferSource({url:buffer,fadeIn:.0005,fadeOut:.003,onended:()=>{
        if(source){this.sources.delete(source);this.retiring.delete(source);source.dispose();}
      }}).connect(this.output);
      this.sources.set(source,'typing');
      source.start(Tone.immediate(),0,buffer.duration-.003,transitionSoundSettings.tapLevel);
    }catch{if(source){this.sources.delete(source);source.dispose();}}
  }
  private schedule(group:Group,key:string,cues:readonly(readonly[Sound,number])[],elapsedMs:number){
    if(this.disposed||!this.ready||this.runs.get(group)===key)return;
    this.stop(group);this.runs.set(group,key);
    let audioNow:number;try{audioNow=Tone.immediate();}catch{return;}
    for(const [name,at] of cues){
      const buffer=this.buffers.get(name);if(!buffer?.loaded)continue;
      const offset=Math.max(0,(elapsedMs-at)/1000),delay=Math.max(0,(at-elapsedMs)/1000);
      const remaining=buffer.duration-offset;
      if(remaining<=transitionSoundSettings.fade||this.sources.size>=transitionSoundSettings.maxSources)continue;
      let source:Tone.ToneBufferSource|undefined;
      try{
        source=new Tone.ToneBufferSource({url:buffer,fadeIn:.008,fadeOut:transitionSoundSettings.fade,onended:()=>{
          if(source){this.sources.delete(source);this.retiring.delete(source);source.dispose();}
        }}).connect(this.output);
        this.sources.set(source,group);
        // Fade finishes at the visual boundary, keeping the first piano note clear.
        source.start(audioNow+delay,offset,remaining-transitionSoundSettings.fade);
      }catch{if(source){this.sources.delete(source);source.dispose();}/* Sound failure never owns scene/input readiness. */}
    }
  }
  stop(group?:Group){
    if(group)this.runs.delete(group);else this.runs.clear();
    for(const [source,owner] of this.sources)if(!group||owner===group){
      this.sources.delete(source);this.retiring.add(source);
      try{source.stop(Tone.immediate());}catch{this.retiring.delete(source);source.dispose();}
    }
    // Bound short fade tails even under repeated rehearsal resets or a suspended context.
    while(this.retiring.size>transitionSoundSettings.maxSources){const oldest=this.retiring.values().next().value!;this.retiring.delete(oldest);oldest.dispose();}
  }
  dispose(){this.disposed=true;this.stop();for(const source of this.retiring)source.dispose();this.retiring.clear();for(const buffer of this.buffers.values())buffer.dispose();this.buffers.clear();this.output.dispose();}
}
