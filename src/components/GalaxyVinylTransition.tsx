import {useEffect,useRef,type MutableRefObject} from 'react';
import {galaxyVinylPose,rosesRevealSettings,revealEase,type GalaxyOrigin} from '../piano/rosesReveal';
import {drawCosmicScene,CosmicBackdropCache} from './performanceAtmosphere';
import {drawCosmicGalaxy} from './cosmicGalaxy';
import {drawRecordOrb} from './recordOrb';
import {StageEnergy,stageOrbGeometry} from './stageEnergy';
import './galaxyVinylTransition.css';
const tau=Math.PI*2;
const transitionEnergy=new StageEnergy();
const seeded=(i:number)=>((Math.sin(i*127.1+4.7)*43758.5453)%1+1)%1;
const dust=Array.from({length:rosesRevealSettings.dust},(_,i)=>({r:Math.sqrt(seeded(i*5+3))*.88,a:i%3*tau/3,size:i%13===0?1.8:.8,phase:seeded(i*7+11)}));
/** The spiral coordinates themselves tighten into concentric grooves around a single moving center. */
export function drawGalaxyVinyl(ctx:CanvasRenderingContext2D,width:number,height:number,now:number,elapsed:number,from:GalaxyOrigin,to:{x:number;y:number;radius:number},reduced:boolean,level=0,pianoTarget?:{x:number;y:number;width:number;height:number},backdrop?:CanvasImageSource){
  const sx=width/from.width,sy=height/from.height;
  const start={x:from.x*sx,y:from.y*sy,radius:from.radius*Math.min(sx,sy)},pose=galaxyVinylPose(elapsed,start,to);
  const {x,y,radius:r,rings,p}=pose;
  ctx.clearRect(0,0,width,height);
  if(pose.sky>.001){ctx.save();drawCosmicScene(ctx,width,from.skyHeight*sy,now,reduced,true,pose.sky,backdrop);ctx.restore();}
  if(from.image&&p<1){
    const t=revealEase((p-.48)/.49),old=from.piano;
    // A bounded copy of the real outgoing keyboard resolves into the mounted incoming layout.
    const end=pianoTarget??{x:width*.51,y:height*.82,width:width*.49,height:height*.18};
    ctx.save();ctx.globalAlpha=1-revealEase((p-.84)/.16);
    ctx.drawImage(from.image,old.x*sx+(end.x-old.x*sx)*t,old.y*sy+(end.y-old.y*sy)*t,old.width*sx+(end.width-old.width*sx)*t,old.height*sy+(end.height-old.height*sy)*t);ctx.restore();
  }
  // Form the record under the same galaxy texture, sharing its projection throughout.
  // Both renderers preserve caller opacity, so no opaque disc can pop into view.
  const solid=revealEase((p-.16)/.8);
  if(solid>0){
    const energy=transitionEnergy;energy.level=level;
    ctx.save();ctx.globalAlpha=solid;
    ctx.translate(x,y);ctx.rotate(-.48*(1-rings));ctx.scale(1,.53+.47*rings);ctx.translate(-x,-y);
    drawRecordOrb(ctx,width,height,now,energy,reduced,{concealed:true,rotation:elapsed*.000009,geometry:{x,y,radius:r}});ctx.restore();
  }
  const galaxyAlpha=.9*(1-revealEase((p-.18)/.78));
  if(galaxyAlpha>.001){ctx.save();ctx.globalAlpha=galaxyAlpha;drawCosmicGalaxy(ctx,width,from.skyHeight*sy,now,reduced,{x,y,radius:r},0,true,rings);ctx.restore();}
  const spin=reduced?0:(now%900000)/900000*tau+elapsed*.00012*revealEase(p/.6);
  // A finite gravitational shell is pulled inward; each particle leaves a short tangent trail.
  ctx.save();ctx.translate(x,y);ctx.rotate(-.48*(1-rings));ctx.scale(1,.53+.47*rings);
  const collapse=1-.32*Math.sin(Math.PI*Math.min(1,p/.65)),dustAlpha=revealEase(p/.2)*(.3+.7*Math.sin(Math.PI*Math.min(1,p*1.1)))*(1-revealEase((p-.88)/.12)),tailScale=(1-rings)*r*(.015+.055*revealEase(p/.3));
  const tailCos=Math.cos(.6),tailSin=Math.sin(.6);
  for(let i=0;i<dust.length;i++){
    const star=dust[i];
    const band=.18+(i%15)/15*.8;
    const rad=r*((star.r*collapse)*(1-rings)+band*rings),a=star.a+star.r*7.3*(1-rings)+star.phase*.3+spin*(.3+star.r);
    const cos=Math.cos(a),sin=Math.sin(a),px=cos*rad,py=sin*rad;
    ctx.globalAlpha=(.15+star.phase*.45)*dustAlpha;
    ctx.strokeStyle=i%4?'#88dfff':'#c5a4f6';ctx.lineWidth=star.size*.7;
    ctx.beginPath();ctx.moveTo(px+(cos*tailCos-sin*tailSin)*tailScale,py+(sin*tailCos+cos*tailSin)*tailScale);ctx.lineTo(px,py);ctx.stroke();ctx.fillStyle='#d6ecff';ctx.fillRect(px,py,star.size,star.size);
  }
  for(let arm=0;arm<6;arm++){
    ctx.beginPath();for(let j=0;j<=64;j++){
      const t=j/64,rad=r*((.12+t*.77)*(1-rings)+(.35+arm*.115)*rings),a=arm*tau/6+t*(7.3*(1-rings)+tau*rings)+spin;
      if(j)ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);else ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
    }
    ctx.globalAlpha=revealEase(p/.25)*(.13+rings*.35)*(1-revealEase((p-.78)/.2));ctx.lineWidth=1.2;ctx.strokeStyle=arm%2?'#b69bf9':'#8ce5ff';ctx.stroke();
  }
  ctx.restore();

}
export default function GalaxyVinylTransition({origin,startedAt,onComplete,level}:{origin:GalaxyOrigin;startedAt:number;onComplete:()=>void;level:MutableRefObject<number>}){
  const canvas=useRef<HTMLCanvasElement>(null),done=useRef(onComplete);done.current=onComplete;
  useEffect(()=>{
    let frame=0,complete=false,width=0,height=0,last=0,target={x:0,y:0,radius:1},pianoTarget={x:0,y:0,width:0,height:0};
    const finish=()=>{if(complete)return;complete=true;done.current();};
    const timeout=window.setTimeout(finish,Math.max(0,startedAt+rosesRevealSettings.transition-performance.now()));
    const element=canvas.current!;let ctx:CanvasRenderingContext2D|null=null;try{ctx=element.getContext('2d');}catch{/* Reveal the functional scene on context failure. */}if(!ctx){finish();return()=>window.clearTimeout(timeout);}
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{
      try{
      const rect=element.getBoundingClientRect();width=rect.width;height=rect.height;
      const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(2800000/Math.max(1,width*height)));element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
      const piano=element.parentElement?.querySelector('.performance-piano')?.getBoundingClientRect();
      pianoTarget=piano?{x:piano.left-rect.left,y:piano.top-rect.top,width:piano.width,height:piano.height}:{x:width*.51,y:height*.82,width:width*.49,height:height*.18};
      const orb=element.parentElement?.querySelector('.record-orb')?.getBoundingClientRect();
      const geometry=stageOrbGeometry(orb?.width??width*.45,orb?.height??height*.65,0,new StageEnergy(),true);
      target={x:(orb?orb.left-rect.left:0)+geometry.x,y:(orb?orb.top-rect.top:height*.15)+geometry.y,radius:geometry.radius};
      }catch{finish();}
    };
    const backdropCache=new CosmicBackdropCache();
    let observer:ResizeObserver|undefined;
    const draw=(now:number)=>{
      if(complete)return;if(now-startedAt>=rosesRevealSettings.transition){finish();return;}
      frame=requestAnimationFrame(draw);if(document.hidden||now-last<(reduced?80:16))return;last=now;
      try{drawGalaxyVinyl(ctx,width,height,now,now-startedAt,origin,target,reduced,level.current,pianoTarget,backdropCache.get(width,origin.skyHeight*height/origin.height));}catch{finish();}
    };
    try{observer=new ResizeObserver(resize);observer.observe(element);resize();if(!complete)frame=requestAnimationFrame(draw);}catch{finish();}
    return()=>{complete=true;cancelAnimationFrame(frame);window.clearTimeout(timeout);observer?.disconnect();backdropCache.release();element.width=element.height=1;};
  },[origin,startedAt,level]);
  return <canvas ref={canvas} className="galaxy-vinyl-transition" aria-hidden="true"/>;
}
