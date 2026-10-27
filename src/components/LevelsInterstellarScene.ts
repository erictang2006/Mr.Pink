import {levelsWarpPose,levelsWarpSettings,warpEase,warpClamp} from '../piano/levelsInterstellarTransition';
import {drawLevelsScene,drawCosmicScene,cosmicStars} from './performanceAtmosphere';
import {drawCosmicGalaxy} from './cosmicGalaxy';
import type {LevelsOrb} from './levelsOrb';
const tau=Math.PI*2;
const particles=Array.from({length:levelsWarpSettings.particles},(_,i)=>({angle:i*2.399963,depth:((i*73)%97)/97,size:i%13===0?1.5:.7}));
/** Same center/curves evolve from the live orb into a tunnel and finally the existing galaxy. */
export function drawLevelsInterstellar(ctx:CanvasRenderingContext2D,width:number,height:number,now:number,elapsed:number,energy:number,orb:LevelsOrb,reduced:boolean,backdrop?:CanvasImageSource){
 const pose=levelsWarpPose(elapsed,width,height),{x,y,radius:r,form}=pose;
 if(elapsed>=levelsWarpSettings.settled){drawCosmicScene(ctx,width,height,now,reduced,false,1,backdrop);return;}
 drawLevelsScene(ctx,width,height,now,energy*(1-pose.charge),reduced,orb,{grid:pose.grid,orb:pose.orb,boost:pose.charge*.65,orbitAdvance:reduced?0:Math.min(1700,elapsed)**2*.0000016});
 const sky=warpEase((elapsed-3200)/1200);
 if(sky>.001)drawCosmicScene(ctx,width,height,now,reduced,true,sky,backdrop);
 if(pose.charge<.001)return;
 const spin=reduced?0:elapsed*.0008*(1+pose.tunnel*1.2);
 const visible=pose.overlay;
 ctx.save();ctx.translate(x,y);ctx.rotate(pose.tilt);ctx.scale(1,pose.squash);
 // The rim pulls inward into spiral arms while the core darkens; no full-screen flash.
 const voidSize=r*(.04+pose.collapse*.17)*(1-form);
 if(voidSize>0){const shadow=ctx.createRadialGradient(0,0,voidSize*.3,0,0,voidSize*1.6);shadow.addColorStop(0,'#01030b');shadow.addColorStop(.63,'#020411');shadow.addColorStop(1,'#03081700');ctx.fillStyle=shadow;ctx.globalAlpha=pose.collapse*(1-form);ctx.fillRect(-voidSize*1.6,-voidSize*1.6,voidSize*3.2,voidSize*3.2);}
 for(let ring=0;ring<levelsWarpSettings.rings;ring++){
  const depth=(ring/levelsWarpSettings.rings+(reduced?0:elapsed*.000065*(1+pose.tunnel)))%1;
  const band=.2+depth*.95,alpha=Math.sin(depth*Math.PI)*(.16+pose.collapse*.46)*pose.charge*visible;
  ctx.beginPath();for(let j=0;j<=levelsWarpSettings.segments;j++){
   const u=j/levelsWarpSettings.segments,rad=r*(band*(1-form)+(.1+u*.79)*form),angle=ring*tau/3+u*(tau*(1-form)+5.9*form)+spin*(1-form)+(.1+u*.79)*1.4*form;
   const skew=(1-form)*pose.tunnel*Math.sin(depth*4+spin*.18)*r*.045;
   const px=Math.cos(angle)*rad+skew,py=Math.sin(angle)*rad*(1-pose.tunnel*.13*(1-depth));
   if(j)ctx.lineTo(px,py);else ctx.moveTo(px,py);
  }
  ctx.strokeStyle=ring%3?'#7be0ff':'#b19cf6';ctx.lineWidth=ring%3?.85:1.6;ctx.globalAlpha=alpha;ctx.stroke();
 }
 for(let i=0;i<particles.length;i++){
  const p=particles[i],depth=(p.depth+(reduced?0:elapsed*.00012*(1+pose.tunnel)))%1,rad=r*(1.35-depth*1.1),angle=p.angle+depth*(2+pose.collapse*4)+spin;
  const px=Math.cos(angle)*rad,py=Math.sin(angle)*rad;
  ctx.globalAlpha=Math.sin(depth*Math.PI)*pose.charge*visible*(.25+pose.collapse*.4);ctx.strokeStyle=i%4?'#a4eaff':'#cfb7ff';ctx.lineWidth=p.size;
  const tail=(reduced?0:1)*r*(.01+pose.tunnel*.055)*(1-form);ctx.beginPath();ctx.moveTo(px+Math.cos(angle+.5)*tail,py+Math.sin(angle+.5)*tail);ctx.lineTo(px,py);ctx.stroke();
 }
 ctx.restore();
 // Warp streaks settle onto the same seeded stars used by the normal Interstellar background.
 const warp=warpEase((elapsed-levelsWarpSettings.tunnel)/300)*(1-warpEase((elapsed-4200)/500));
 if(warp>.001&&!reduced){
  ctx.save();for(let i=0;i<particles.length;i++){
   const p=particles[i],star=cosmicStars[i%cosmicStars.length],travel=warpClamp((elapsed-2700)/900),distance=(.1+p.depth*.95)*Math.min(width,height)*(1+travel*.8);
   const fromX=width*.5+Math.cos(p.angle)*distance,fromY=height*.46+Math.sin(p.angle)*distance;
   const targetX=star.x*width+Math.sin(now*.000025+i)*3,targetY=star.y*height*.94;
   const px=fromX+(targetX-fromX)*form,py=fromY+(targetY-fromY)*form,length=(12+p.depth*75)*warp*(1-form);
   ctx.globalAlpha=warp*(.2+p.depth*.55);ctx.strokeStyle=i%4?'#b4eaff':'#f0f7ff';ctx.lineWidth=p.size;
   ctx.beginPath();ctx.moveTo(px-Math.cos(p.angle)*length,py-Math.sin(p.angle)*length);ctx.lineTo(px,py);ctx.stroke();
  }ctx.restore();
 }
 if(form>.001){ctx.save();ctx.globalAlpha=.9*form;drawCosmicGalaxy(ctx,width,height,now,reduced,{x,y,radius:r});ctx.restore();}
}
