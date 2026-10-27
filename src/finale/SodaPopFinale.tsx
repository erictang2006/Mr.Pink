import {useEffect,useRef,type MutableRefObject} from 'react';
import {sodaPop} from './sodaPopEngine';
import type {SodaPopFrame} from './sodaPopTimeline';
import './sodaPop.css';
const colors=['#52eeff','#ff65cc','#bdff68','#f5ffff'];
/** Bounded, deterministic particles; phase and pulse follow the same audio clock as the excerpt. */
export function drawSodaPop(ctx:CanvasRenderingContext2D,w:number,h:number,frame:SodaPopFrame,reduced:boolean){
 const {phase,music,pulse,progress,elapsed}=frame;
 ctx.clearRect(0,0,w,h);
 const playing=['playing','fading','finished'].includes(phase);
 if(!playing){
  if(phase==='braking')return;
  ctx.fillStyle=`rgba(3,5,20,${phase==='scratch'?.2:.94})`;ctx.fillRect(0,0,w,h);
  if(phase==='glitch'&&!reduced)for(let i=0;i<7;i++){ctx.fillStyle=colors[i%4]+(i%2?'3a':'19');const y=((elapsed*1200+i*h/7)%h);ctx.fillRect(Math.sin(elapsed*120+i)*w*.1,y,w,3+i*2);}
  if(phase!=='pop')return;
 }
 if(playing){
  ctx.fillStyle='#060c20';ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.48,h*.5,0,w*.5,h*.5,w*.7);
  glow.addColorStop(0,`rgba(18,135,163,${.34+pulse*.15})`);glow.addColorStop(.5,'#3d124d66');glow.addColorStop(1,'#060c2000');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 }
 const t=reduced?0:playing?music:Math.max(0,progress-.68)*2.4;
 ctx.save();
 for(let i=0;i<(reduced?24:72);i++){
  const speed=.035+(i%7)*.007,seed=(i*.61803398875)%1;
  const x=(seed*w+Math.sin(t*.7+i*2.1)*w*.027),y=h*(1-((i*.2731+t*speed)%1));
  const r=2+(i%8)*1.7+(playing?pulse:0)*1.8;
  ctx.globalAlpha=.2+(i%5)*.11;ctx.strokeStyle=colors[i%4];ctx.lineWidth=i%3?1:1.7;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(x-r*.27,y-r*.35,Math.max(.6,r*.13),0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 if(playing){
  for(let i=0;i<4;i++){
   const r=Math.min(w*.31,h*.35)*(1+i*.18+pulse*.04);
   ctx.globalAlpha=(.26-i*.04)*(1+(.2*pulse));ctx.strokeStyle=colors[i];ctx.lineWidth=i===0?2:1;
   ctx.beginPath();ctx.ellipse(w*.5,h*.5,r,r*.85,Math.sin(t*.12+i)*.12,0,Math.PI*2);ctx.stroke();
  }
  // Small liquid arcs retain a splash silhouette without sprite decoding or blur passes.
  for(let i=0;i<12;i++){const a=i*Math.PI/6+(reduced?0:t*.035),r=Math.min(w,h)*(.3+(i%3)*.035);ctx.strokeStyle=colors[i%4];ctx.globalAlpha=.25+pulse*.18;ctx.lineWidth=2+i%3;ctx.beginPath();ctx.arc(w*.5+Math.cos(a)*r,h*.5+Math.sin(a)*r*.7,6+i%4,a,a+1.9);ctx.stroke();}
 }
 ctx.restore();
 if(playing&&music<.16&&!reduced){ctx.fillStyle=`rgba(232,255,255,${Math.max(0,.16-music)})`;ctx.fillRect(0,0,w,h);}
 if(frame.fade>0){ctx.fillStyle=`rgba(0,0,0,${frame.fade})`;ctx.fillRect(0,0,w,h);}
}
export default function SodaPopFinale({level}:{level?:MutableRefObject<number>}){
 const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null),count=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=canvas.current,host=root.current;if(!element||!host)return;
  const ctx=element.getContext('2d');if(!ctx)return;
  let frameId=0,last=-Infinity,width=0,height=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize=()=>{const rect=element.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(1100000/Math.max(1,width*height)));element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  const observer=new ResizeObserver(resize);observer.observe(element);resize();
  const draw=(now:number)=>{frameId=requestAnimationFrame(draw);if(now-last<(reduced?80:32))return;last=now;
   sodaPop.update();const value=sodaPop.frame();host.dataset.phase=value.phase;
   if(count.current){count.current.hidden=!value.countBeat;count.current.textContent=String(value.countBeat||'');count.current.setAttribute('aria-label',`Count-in beat ${value.countBeat}`);}
   const visual={...value,pulse:value.phase==='playing'?Math.max(value.pulse*.75,Math.min(1,(level?.current??0)*1.3)):value.pulse};
   host.style.setProperty('--soda-pulse',String(reduced?0:visual.pulse));
   host.style.setProperty('--soda-reveal',String(reduced?1:Math.min(1,value.music/.4)));
   host.style.setProperty('--soda-fade',String(value.fade));
   drawSodaPop(ctx,width,height,visual,reduced);
  };
  frameId=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frameId);observer.disconnect();};
 },[]);
 return <section ref={root} className="soda-pop-scene" data-phase="braking" aria-label="Soda Pop finale">
  <canvas ref={canvas} aria-hidden="true"/>
  <div ref={count} className="soda-count-in" hidden aria-label="Four-beat metronome"/>
  <div className="soda-pop-identity"><span className="soda-pop-kicker">MR. PINK · THE FINALE</span><h1>SODA<span>POP</span></h1><p>SAJA BOYS</p><div className="soda-can" aria-hidden="true"><i/><strong>POP!</strong><b>✦</b></div></div>

 </section>;
}
