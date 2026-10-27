/** Bounded secondary effects; this controller never owns the input deadline. */
export const openingReliability = {
  assetTimeout:2500,
  slowFrame:30,slowWork:10,poorFrames:4,
  severeFrame:120,severeWork:45,severeFrames:3,
} as const;
export class OpeningRenderBudget {
  quality:0|1|2=0;
  private poor=0;
  private severe=0;
  observe(frameMs:number,workMs:number):boolean {
    const poor=frameMs>openingReliability.slowFrame||workMs>openingReliability.slowWork;
    this.poor=poor?this.poor+1:Math.max(0,this.poor-1);
    this.severe=frameMs>openingReliability.severeFrame||workMs>openingReliability.severeWork?this.severe+1:0;
    if(this.poor>=openingReliability.poorFrames&&this.quality<2){this.quality=(this.quality+1) as 1|2;this.poor=0;}
    return this.quality===2&&this.severe>=openingReliability.severeFrames;
  }
}
