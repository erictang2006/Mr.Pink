/** Full-viewport procedural atmosphere with a fixed dust budget; no filters or audio graph work. */
const dust=Array.from({length:38},(_,i)=>({x:((i*97.13)%101)/101,y:((i*53.71)%97)/97,r:i%9===0?1.2:.65}));
function haze(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,squash=1){
  ctx.save();ctx.translate(x,y);ctx.scale(1,squash);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,r);gradient.addColorStop(0,color);gradient.addColorStop(1,'#00000000');
  ctx.fillStyle=gradient;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
}
/** Slow atmospheric motion needs no full-resolution gradient rebuild on every note frame. */
export class CosmicStageCache {
  private canvas?:HTMLCanvasElement;
  private width=0;private height=0;private at=-Infinity;private reduced=false;private failed=false;
  get(width:number,height:number,now:number,intensity:number,reduced:boolean){
    if(width<=0||height<=0)return undefined;
    const resized=width!==this.width||height!==this.height;
    if(!resized&&this.failed)return undefined;
    if(!resized&&this.canvas&&this.reduced===reduced&&now>=this.at&&now-this.at<150)return this.canvas;
    this.width=width;this.height=height;this.failed=false;
    try{
      const canvas=this.canvas??document.createElement('canvas');
      if(resized||!this.canvas){
        const ratio=Math.min(1,Math.sqrt(600000/(width*height)));
        canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      }
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx){canvas.width=canvas.height=1;this.canvas=undefined;this.failed=true;return undefined;}
      ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
      drawCosmicStage(ctx,width,height,now,intensity,reduced);
      this.canvas=canvas;this.at=now;this.reduced=reduced;return canvas;
    }catch{if(this.canvas)this.canvas.width=this.canvas.height=1;this.canvas=undefined;this.failed=true;return undefined;}
  }
  release(){if(this.canvas)this.canvas.width=this.canvas.height=1;this.canvas=undefined;this.width=this.height=0;this.at=-Infinity;this.failed=false;}
}
export function drawCosmicStage(ctx:CanvasRenderingContext2D,width:number,height:number,now:number,intensity:number,reduced:boolean){
  const level=Math.max(0,Math.min(1,intensity)),time=reduced?0:now;
  const sky=ctx.createLinearGradient(0,0,width,height);
  sky.addColorStop(0,'#060b1e');sky.addColorStop(.52,'#100c26');sky.addColorStop(1,'#0a152b');
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  const drift=Math.sin(time*.00004)*width*.008;
  haze(ctx,width*.24+drift,height*.43,width*.43,`rgba(23,133,186,${.2+level*.1})`,.8);
  haze(ctx,width*.4-drift,height*.32,width*.38,`rgba(114,47,183,${.22+level*.085})`,.85);
  haze(ctx,width*.57,height*.79,width*.52,`rgba(173,43,146,${.12+level*.075})`,.48);
  haze(ctx,width*.84-drift,height*.65,width*.39,`rgba(49,112,161,${.1+level*.06})`,.8);
  // Several low-opacity cloud bands move at different depths; no texture decoding or blur filters.
  for(let i=0;i<4;i++){
    const shift=Math.sin(time*.000026+i*1.4)*width*.025;
    haze(ctx,width*(.12+i*.22)+shift,height*(.27+i*.13),width*(.23+i*.025),i%2?`rgba(110,54,159,${.045+level*.02})`:`rgba(48,121,156,${.04+level*.02})`,.14);
  }
  // Wide translucent concert beams stop above the piano and stay behind panel text.
  ctx.save();
  for(let i=0;i<3;i++){
    const x=width*(.09+i*.38),lean=Math.sin(time*.000025+i)*width*.045;
    const beam=ctx.createLinearGradient(x,0,x,height*.85);
    beam.addColorStop(0,`rgba(${i===1?'159,134,244':'106,198,229'},${.06+level*.075})`);beam.addColorStop(1,'#779fee00');
    ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(x-6,0);ctx.lineTo(x+6,0);ctx.lineTo(x+width*.17+lean,height*.86);ctx.lineTo(x-width*.13+lean,height*.86);ctx.closePath();ctx.fill();
  }
  for(let i=0;i<dust.length;i++){
    const p=dust[i],driftY=reduced?0:Math.sin(time*.00012+i)*5;
    ctx.globalAlpha=.14+(i%5)*.025+level*.035;ctx.fillStyle=i%3===0?'#d7b8f0':'#b8eaf5';
    ctx.beginPath();ctx.arc(p.x*width,p.y*height+driftY,p.r,0,Math.PI*2);ctx.fill();
    if(i%9===0){
      const x=p.x*width,y=p.y*height+driftY;
      ctx.fillRect(x-3,y-.35,6,.7);ctx.fillRect(x-.35,y-3,.7,6);
    }
  }
  ctx.globalAlpha=1;
  // Low fog and an elliptical reflected glow ground the piano without covering keycaps.
  haze(ctx,width*.38+drift,height*.99,width*.57,`rgba(71,154,196,${.21+level*.08})`,.16);
  haze(ctx,width*.75-drift,height*.98,width*.4,`rgba(166,75,189,${.17+level*.06})`,.16);
  const floor=ctx.createLinearGradient(0,height*.83,0,height);floor.addColorStop(0,'#14284000');floor.addColorStop(1,'#204c6644');ctx.fillStyle=floor;ctx.fillRect(0,height*.83,width,height*.17);
  ctx.strokeStyle='#93d9ee15';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(width*.46,height*1.07,width*.45,height*.13,0,Math.PI,Math.PI*2);ctx.stroke();
  ctx.restore();
}
