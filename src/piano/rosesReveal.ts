/** Visual state only. Updates are delivered by the existing transport-synchronized snapshots. */
export const rosesRevealSettings={transition:3600,albumReveal:800,residual:1900,petals:32,dust:144} as const;
export type RevealClock={status:string;measure:number;beat?:number};
export type RosesRevealSnapshot={enabled:boolean;revealedAt:number|null;run:number};
export class RosesReveal {
  private value:RosesRevealSnapshot={enabled:false,revealedAt:null,run:0};
  private listeners=new Set<()=>void>();
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:RosesRevealSnapshot){this.value=value;for(const listener of this.listeners)listener();}
  enable(){this.publish({enabled:true,revealedAt:null,run:this.value.run+1});}
  disable(){if(this.value.enabled)this.publish({enabled:false,revealedAt:null,run:this.value.run+1});}
  update(clock:RevealClock,now:number){
    if(!this.value.enabled)return;
    if(clock.status==='idle'&&clock.measure===1&&this.value.revealedAt!==null){this.enable();return;}
    if(clock.status==='running'&&clock.measure>=5&&this.value.revealedAt===null)this.publish({...this.value,revealedAt:now});
  }
}
export const introRevealBuild=(clock:RevealClock|null)=>clock?.status==='running'?Math.max(0,Math.min(1,((clock.measure-1)*4+(clock.beat??1)-1)/16)):0;
export const revealClamp=(v:number)=>Math.max(0,Math.min(1,v));
export const revealEase=(v:number)=>{const t=revealClamp(v);return t*t*(3-2*t);};
export type GalaxyOrigin={x:number;y:number;radius:number;width:number;height:number;skyHeight:number;piano:{x:number;y:number;width:number;height:number};image?:HTMLCanvasElement};
export function galaxyVinylPose(elapsed:number,from:{x:number;y:number;radius:number},to:{x:number;y:number;radius:number}){
  const p=revealClamp(elapsed/rosesRevealSettings.transition),move=revealEase(p/.96),contract=revealEase(p/.94);
  return {x:from.x+(to.x-from.x)*move,y:from.y+(to.y-from.y)*move,radius:from.radius+(to.radius-from.radius)*contract,rings:revealEase((p-.08)/.86),sky:1-revealEase((p-.5)/.48),p};
}
