export type LiveKeystroke = {code:string;label:string;midi:number;at:number};
export type RecentKey = LiveKeystroke & {id:number};
export const liveKeySettings = {limit:5,lifetime:1000} as const;
type Clock = {now:()=>number;setTimer:(fn:()=>void,delay:number)=>number;clearTimer:(id:number)=>void};

/** Event-driven, bounded history. No frame loop and only one pending expiry timer. */
export class LiveKeyHistory {
  private entries:readonly RecentKey[]=[];
  private listeners=new Set<()=>void>();
  private timer:number|null=null;
  private serial=0;
  constructor(private clock:Clock={now:()=>performance.now(),setTimer:(fn,delay)=>window.setTimeout(fn,delay),clearTimer:id=>window.clearTimeout(id)}){}
  getSnapshot=()=>this.entries;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  append=(key:LiveKeystroke)=>this.appendMany([key]);
  appendMany=(keys:readonly LiveKeystroke[])=>{
    if(!keys.length)return;
    const now=this.clock.now();
    this.entries=[...this.entries.filter(item=>now-item.at<liveKeySettings.lifetime),...keys.map(key=>({...key,id:++this.serial}))].slice(-liveKeySettings.limit);
    this.publish();this.schedule();
  };
  clear=()=>{if(this.timer!==null)this.clock.clearTimer(this.timer);this.timer=null;if(!this.entries.length)return;this.entries=[];this.publish();};
  private publish(){for(const listener of this.listeners)listener();}
  private schedule(){
    if(this.timer!==null)this.clock.clearTimer(this.timer);
    this.timer=null;
    if(!this.entries.length)return;
    this.timer=this.clock.setTimer(()=>{
      this.timer=null;
      this.entries=this.entries.filter(item=>this.clock.now()-item.at<liveKeySettings.lifetime);
      this.publish();this.schedule();
    },Math.max(1,this.entries[0].at+liveKeySettings.lifetime-this.clock.now()));
  }
}
