import { cosmicGalaxyGeometry } from './cosmicGeometry';
export const levelsWarpSettings={duration:5000,destabilize:1000,collapse:1700,tunnel:2700,galaxy:3600,settled:4700,particles:96,rings:10,segments:56,maxPixels:2800000} as const;
export const warpClamp=(value:number)=>Math.max(0,Math.min(1,value));
export const warpEase=(value:number)=>{const t=warpClamp(value);return t*t*(3-2*t);};
export function levelsWarpPose(elapsed:number,width:number,height:number){
 const t=Math.max(0,elapsed),form=warpEase((t-levelsWarpSettings.galaxy)/(levelsWarpSettings.settled-levelsWarpSettings.galaxy));
 const radius=Math.min(width*.16,height*.255),targetRadius=cosmicGalaxyGeometry(width,height).radius;
 const zoom=warpEase((t-levelsWarpSettings.tunnel)/(levelsWarpSettings.galaxy-levelsWarpSettings.tunnel));
 return {elapsed:t,charge:warpEase(t/1000),collapse:warpEase((t-1000)/700),tunnel:warpEase((t-1700)/1000),zoom,form,
  x:width*(.5+.3*form),y:height*(.46+.03*form),radius:radius*(1+zoom*.7)*(1-form)+targetRadius*form,tilt:-.48*form,squash:1-.47*form,
  grid:1-warpEase(t/1200),orb:1-warpEase((t-1050)/650),overlay:1-warpEase((t-4400)/300),ready:t>=levelsWarpSettings.duration};
}
export type LevelsWarpSnapshot={active:boolean;startedAt:number;switched:boolean;run:number};
type Clock={now:()=>number;setTimer:(fn:()=>void,delay:number)=>number;clearTimer:(id:number)=>void};
/** One absolute timeline; musical engines are accessed only through the existing song-switch action. */
export class LevelsWarpController {
 private state:LevelsWarpSnapshot={active:false,startedAt:0,switched:false,run:0};
 private listeners=new Set<()=>void>();private timers:number[]=[];private generation=0;private blocked=new Set<string>();
 constructor(private actions:{switchSong:()=>void;ready:()=>void},private clock:Clock={now:()=>performance.now(),setTimer:(fn,ms)=>window.setTimeout(fn,ms),clearTimer:id=>window.clearTimeout(id)}){}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(next:LevelsWarpSnapshot){this.state=next;for(const listener of this.listeners)listener();}
 private clearTimers(){for(const id of this.timers)this.clock.clearTimer(id);this.timers=[];}
 start(){
  if(this.state.active)return false;this.clearTimers();const token=++this.generation;
  this.publish({active:true,startedAt:this.clock.now(),switched:false,run:this.state.run+1});
  if(token!==this.generation||!this.state.active)return false;
  for(const at of [levelsWarpSettings.galaxy,levelsWarpSettings.duration])this.timers.push(this.clock.setTimer(()=>{if(token===this.generation)this.checkDeadline();},Math.max(0,this.state.startedAt+at-this.clock.now())));
  return true;
 }
 private switchOnce(){if(!this.state.active||this.state.switched)return;this.publish({...this.state,switched:true});if(this.state.active)this.actions.switchSong();}
 checkDeadline(){if(!this.state.active)return;const age=this.clock.now()-this.state.startedAt;if(age>=levelsWarpSettings.duration)this.finish();else if(age>=levelsWarpSettings.galaxy)this.switchOnce();}
 finish=()=>{if(!this.state.active)return;this.switchOnce();if(!this.state.active)return;++this.generation;this.clearTimers();this.publish({...this.state,active:false});this.actions.ready();};
 cancel(){++this.generation;this.clearTimers();if(this.state.active)this.publish({...this.state,active:false});}
 keyDown(event:KeyboardEvent){
  this.checkDeadline();if(this.blocked.has(event.code))return true;
  if(!this.state.active||event.code==='Escape'||event.code==='F9'||event.metaKey||event.ctrlKey||event.altKey)return false;
  this.blocked.add(event.code);return true;
 }
 keyUp(event:KeyboardEvent){return this.blocked.delete(event.code);}
 dispose(){this.cancel();this.listeners.clear();this.blocked.clear();}
}
