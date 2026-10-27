/** Shed secondary drawing before dense passages can monopolize the input thread. */
export class PerformanceRenderBudget {
  private busyUntil=0;
  private cost=0;
  update(now:number,notes:number,attacks:number){
    if(notes>=14||attacks>=4||this.cost>10)this.busyUntil=now+900;
    return now<this.busyUntil;
  }
  record(milliseconds:number){this.cost=this.cost*.75+Math.max(0,milliseconds)*.25;}
}
