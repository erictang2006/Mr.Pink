import {editPianoTyping,isPianoTypingScene,pianoTypingConfig,type PianoTypingInput} from './pianoTyping';
import {IntroTypingTest,introTypingConfig,isTypingScene,type TypingSnapshot} from './typingTest';
import {fractureSettings} from './choreography';
export const openingMessage = 'I LOVE CSA';
export const openingTiming = {
  messageHold:500, convergence:500, logoFormation:650, logoHold:2000,
  fracture:fractureSettings.duration*fractureSettings.playbackScale, revealDelayAfterFracture:fractureSettings.transformAt*fractureSettings.playbackScale, pianoReveal:(fractureSettings.duration-fractureSettings.transformAt)*fractureSettings.playbackScale,
  easing:'cubic-bezier(.22,.7,.16,1)',
} as const;
export const openingCues = {
  formation:openingTiming.messageHold,
  hold:openingTiming.messageHold+openingTiming.convergence+openingTiming.logoFormation,
  fracture:openingTiming.messageHold+openingTiming.convergence+openingTiming.logoFormation+openingTiming.logoHold,
  get reveal(){return this.fracture+openingTiming.revealDelayAfterFracture;},
  get active(){return Math.max(this.fracture+openingTiming.fracture,this.reveal+openingTiming.pianoReveal);},
};
export type OpeningScene = 'IDLE'|'TYPING_TEST'|'TYPING_COMPLETE'|'SIMULATED_CRASH'|'MESSAGE_ENTRY'|'MESSAGE_COMPLETE'|'LOGO_FORMATION'|'LOGO_HOLD'|'LOGO_FRACTURE'|'PIANO_REVEAL'|'TYPING_PIANO_REVEAL'|'INTERSTELLAR_ACTIVE';
export type OpeningFallback = 'asset'|'render'|'slow'|'focus';
export type OpeningSnapshot = {scene:OpeningScene;message:string;run:number;animationOffset:number;pianoText?:string;pianoCompletedAt?:number;pianoLastInput?:PianoTypingInput;typing?:TypingSnapshot;introOrigin?:number;timelineOrigin?:number;fallback?:OpeningFallback;reason?:'cancel'};
export type OpeningStart = 'typing'|'message'|'full'|'logo'|'pianoTyping'|'piano';
export type SequenceClock = {now:()=>number;request:(callback:FrameRequestCallback)=>number;cancel:(id:number)=>void;setTimer?:(callback:()=>void,ms:number)=>number;clearTimer?:(id:number)=>void};
export const normalizeOpeningMessage = (value:string) => value.toUpperCase().trim().replace(/\s+/g,' ');

/** Shared timeline, one visual frame, one input deadline; no per-frame React notifications. */
export class OpeningSequence {
  private state:OpeningSnapshot={scene:'IDLE',message:'',run:0,animationOffset:0};
  private listeners=new Set<(value:OpeningSnapshot)=>void>();
  private frame:number|null=null;
  private origin=0;
  private deadline:number|null=null;
  private token=0;
  private typingTest:IntroTypingTest|null=null;
  private blocked=new Set<string>();
  private pianoHeld=new Set<string>();
  private pianoSerial=0;
  constructor(private clock:SequenceClock={now:()=>performance.now(),request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),setTimer:(callback,ms)=>window.setTimeout(callback,ms),clearTimer:id=>window.clearTimeout(id)},private passage:string=introTypingConfig.passage){}
  getSnapshot=():OpeningSnapshot=>this.state;
  get capturing():boolean{return !['IDLE','TYPING_PIANO_REVEAL','INTERSTELLAR_ACTIVE'].includes(this.state.scene);}
  get pianoTyping():boolean{return isPianoTypingScene(this.state.scene);}
  isQuarantined(code:string):boolean{return this.blocked.has(code);}
  subscribe(listener:(value:OpeningSnapshot)=>void):()=>void {this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  private notify(patch:Partial<OpeningSnapshot>):void {this.state={...this.state,...patch};for(const listener of this.listeners)listener(this.state);}
  start(mode:OpeningStart='message'):void {
    this.stopClock();
    const token=++this.token;
    const offset=mode==='logo'?openingCues.hold:mode==='piano'||mode==='pianoTyping'?openingCues.active:0;
    this.origin=this.clock.now()-offset;
    this.typingTest=mode==='typing'?new IntroTypingTest(this.passage):null;
    this.pianoHeld.clear();this.pianoSerial=0;
    this.notify({pianoText:mode==='pianoTyping'?'':undefined,pianoCompletedAt:undefined,pianoLastInput:undefined,typing:this.typingTest?.snapshot(),introOrigin:undefined,timelineOrigin:mode==='message'||mode==='typing'?undefined:this.origin,fallback:undefined,scene:mode==='typing'?'TYPING_TEST':mode==='message'?'MESSAGE_ENTRY':mode==='pianoTyping'?'TYPING_PIANO_REVEAL':mode==='piano'?'INTERSTELLAR_ACTIVE':mode==='logo'?'LOGO_HOLD':'MESSAGE_COMPLETE',message:mode==='message'||mode==='typing'?'':openingMessage,run:this.state.run+1,animationOffset:offset,reason:undefined});
    if(mode==='message'||mode==='typing'||mode==='pianoTyping'||mode==='piano')return;
    if(this.token===token){this.armDeadline();this.schedule();}
  }
  crashComplete():void{if(this.state.scene==='IDLE')this.start('message');}
  cancel():void{this.token++;this.stopClock();this.notify({scene:'IDLE',message:'',pianoText:undefined,pianoCompletedAt:undefined,pianoLastInput:undefined,typing:undefined,introOrigin:undefined,timelineOrigin:undefined,fallback:undefined,reason:'cancel'});}
  reset():void{this.start('message');}
  timelineElapsed=():number=>this.state.timelineOrigin===undefined?0:Math.max(0,this.clock.now()-this.state.timelineOrigin);
  /** Fail open to the SAME real stage; never create audio or consume the next live key. */
  revealPiano=(fallback:OpeningFallback='render'):void=>{
    if(this.pianoTyping){this.finishPianoTyping(fallback);return;}
    if(!this.capturing||this.state.scene==='MESSAGE_ENTRY'&&fallback!=='render')return;
    if(isTypingScene(this.state.scene)){if(fallback==='render')this.enterMessage();return;}
    this.enterPianoTyping(fallback);
  };
  private stopClock():void{
    if(this.frame!==null)this.clock.cancel(this.frame);this.frame=null;
    if(this.deadline!==null)this.clock.clearTimer?.(this.deadline);this.deadline=null;
  }
  private armDeadline():void{
    if(!this.clock.setTimer)return;
    const token=this.token;
    this.deadline=this.clock.setTimer(()=>{
      if(token!==this.token||!this.capturing)return;
      this.deadline=null;
      this.enterPianoTyping();
    },Math.max(0,openingCues.active-this.timelineElapsed()));
  }
  private enterMessage():void{
    this.token++;this.stopClock();this.notify({scene:'MESSAGE_ENTRY',message:'',introOrigin:undefined,timelineOrigin:undefined,animationOffset:0});
  }
  private advanceIntro():void{
    if(this.state.introOrigin===undefined)return;
    const elapsed=this.clock.now()-this.state.introOrigin;
    if(elapsed>=introTypingConfig.completionHold+introTypingConfig.crashDuration){this.enterMessage();return;}
    if(elapsed>=introTypingConfig.completionHold&&this.state.scene==='TYPING_COMPLETE')this.notify({scene:'SIMULATED_CRASH'});
  }
  private armIntroTimer():void{
    if(!this.clock.setTimer||this.state.introOrigin===undefined)return;
    const elapsed=this.clock.now()-this.state.introOrigin;
    const next=elapsed<introTypingConfig.completionHold?introTypingConfig.completionHold:introTypingConfig.completionHold+introTypingConfig.crashDuration;
    const token=this.token;
    this.deadline=this.clock.setTimer(()=>{
      if(token!==this.token||!isTypingScene(this.state.scene))return;
      this.deadline=null;this.advanceIntro();
      if(token===this.token&&isTypingScene(this.state.scene))this.armIntroTimer();
    },Math.max(0,next-elapsed));
  }
  private enterPianoTyping(fallback?:OpeningFallback):void{
    this.token++;this.stopClock();this.pianoHeld.clear();this.pianoSerial=0;
    this.notify({scene:'TYPING_PIANO_REVEAL',pianoText:'',pianoCompletedAt:undefined,pianoLastInput:undefined,fallback});
  }
  /** Text-only handoff. Held piano voices/keys must continue until their normal keyup. */
  finishPianoTyping=(fallback?:OpeningFallback):void=>{
    if(!this.pianoTyping)return;
    this.token++;this.stopClock();this.notify({scene:'INTERSTELLAR_ACTIVE',fallback});
  };
  private armPianoTypingTimer():void{
    const token=this.token;
    if(this.clock.setTimer)this.deadline=this.clock.setTimer(()=>{
      if(token!==this.token||!this.pianoTyping)return;
      this.deadline=null;this.finishPianoTyping();
    },Math.max(0,pianoTypingConfig.duration-(this.clock.now()-this.state.pianoCompletedAt!)));
    else this.schedule();
  }
  private pianoTypingDown(event:KeyboardEvent):boolean{
    if(this.blocked.has(event.code))return true;
    if(event.metaKey||event.ctrlKey||event.altKey)return false;
    if(event.code==='Escape'||event.code==='F9'){this.blocked.add(event.code);this.cancel();return true;}
    if(event.isComposing||event.repeat||this.pianoHeld.has(event.code))return true;
    if(event.code.startsWith('Shift'))return false;
    // One routed event edits text, then returns to the EXISTING physical piano dispatch.
    this.pianoHeld.add(event.code);
    const control=event.code==='Space'||event.code==='Backspace';
    if(this.state.pianoCompletedAt===undefined){
      const text=editPianoTyping(this.state.pianoText??'',event.code==='Backspace'?'Backspace':event.key);
      if(text!==this.state.pianoText){
        const at=this.clock.now(),complete=text===pianoTypingConfig.message,token=this.token;
        this.notify({pianoText:text,pianoLastInput:{serial:++this.pianoSerial,index:Math.max(0,text.length-1),code:event.code,shift:event.shiftKey,at},pianoCompletedAt:complete?at:undefined});
        if(complete&&token===this.token&&this.pianoTyping)this.armPianoTypingTimer();
      }
    }
    if(event.key.length===1||control)event.preventDefault?.();
    // Spaces are text here; they must not toggle the separate sustain-pedal listener.
    return control||event.key.length!==1;
  }
  private checkInputDeadline():void{
    if(isTypingScene(this.state.scene))this.advanceIntro();
    if(this.pianoTyping&&this.state.pianoCompletedAt!==undefined&&this.clock.now()-this.state.pianoCompletedAt>=pianoTypingConfig.duration)this.finishPianoTyping();
    if(this.capturing&&this.state.timelineOrigin!==undefined&&this.timelineElapsed()>=openingCues.active){
      this.enterPianoTyping();
    }
  }
  private schedule():void{if(this.frame!==null)return;const token=this.token;this.frame=this.clock.request(()=>{if(token===this.token)this.tick();});}
  private tick=():void=>{
    this.frame=null;
    const token=this.token;
    if(this.pianoTyping){this.checkInputDeadline();if(this.pianoTyping&&this.state.pianoCompletedAt!==undefined)this.schedule();return;}
    if(isTypingScene(this.state.scene)){
      this.advanceIntro();if(isTypingScene(this.state.scene)&&this.state.scene!=='TYPING_TEST'&&token===this.token)this.schedule();return;
    }
    const elapsed=this.clock.now()-this.origin;
    if(elapsed>=openingCues.active){this.enterPianoTyping();return;}
    const scene:OpeningScene=elapsed>=openingCues.reveal?'PIANO_REVEAL':elapsed>=openingCues.fracture?'LOGO_FRACTURE':elapsed>=openingCues.hold?'LOGO_HOLD':elapsed>=openingCues.formation?'LOGO_FORMATION':'MESSAGE_COMPLETE';
    if(scene!==this.state.scene)this.notify({scene});
    if(token===this.token)this.schedule();
  };
  /** This is called by the existing input manager, before its ordinary piano dispatch. */
  keyDown(event:KeyboardEvent):boolean {
    this.checkInputDeadline();
    if(this.pianoTyping)return this.pianoTypingDown(event);
    if(!this.capturing)return this.blocked.has(event.code);
    if(event.metaKey||event.ctrlKey||event.altKey)return false;
    this.blocked.add(event.code);
    if(event.code==='Escape'||event.code==='F9'){this.cancel();return true;}
    if(this.state.scene==='TYPING_TEST'){
      if(event.isComposing||event.repeat&&event.code!=='Backspace')return true;
      if(this.typingTest?.input(event.code==='Enter'||event.code==='NumpadEnter'?'Enter':event.code==='Backspace'?'Backspace':event.key,this.clock.now())){
        const typing=this.typingTest.snapshot(),complete=typing.finishedAt!==null,token=this.token;
        this.notify({typing,scene:complete?'TYPING_COMPLETE':'TYPING_TEST',introOrigin:complete?typing.finishedAt!:undefined});
        if(complete&&token===this.token&&this.getSnapshot().scene==='TYPING_COMPLETE'){this.armIntroTimer();this.schedule();}
      }
      return true;
    }
    if(this.state.scene!=='MESSAGE_ENTRY'||event.repeat||event.isComposing)return true;
    let message=this.state.message;
    if(event.code==='Backspace')message=message.slice(0,-1);
    else if(event.key.length===1&&message.length<48)message+=event.key.toUpperCase();
    else return true;
    if(normalizeOpeningMessage(message)===openingMessage) {
      this.origin=this.clock.now();
      this.notify({message:openingMessage,scene:'MESSAGE_COMPLETE',timelineOrigin:this.origin});if(this.getSnapshot().scene==='MESSAGE_COMPLETE'){this.armDeadline();this.schedule();}
    }else this.notify({message});
    return true;
  }
  keyUp(event:KeyboardEvent):boolean {
    this.checkInputDeadline();
    this.pianoHeld.delete(event.code);
    const wasBlocked=this.blocked.delete(event.code);
    return this.capturing||wasBlocked;
  }
  releasePhysicalKeys():void{this.blocked.clear();this.pianoHeld.clear();}
  dispose():void{this.token++;this.stopClock();this.listeners.clear();this.blocked.clear();this.pianoHeld.clear();}
}
