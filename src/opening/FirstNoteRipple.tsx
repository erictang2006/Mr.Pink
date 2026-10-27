import {useEffect,useRef,useState} from 'react';
import {clamp,fractureSettings,random,smooth} from './choreography';

/** Optional visual acknowledgement AFTER audio dispatch. Failure only removes this layer. */
export default function FirstNoteRipple({at}:{at:number}) {
  const ref=useRef<HTMLCanvasElement>(null),[done,setDone]=useState(false);
  useEffect(()=>{
    const canvas=ref.current!;
    let frame=0,width=0,height=0,observer:ResizeObserver|null=null,finished=false;
    const stop=(notify=true)=>{
      if(finished)return;finished=true;cancelAnimationFrame(frame);observer?.disconnect();canvas.width=canvas.height=1;if(notify)setDone(true);
    };
    try {
      const ctx=canvas.getContext('2d');
      if(!ctx||window.matchMedia('(prefers-reduced-motion: reduce)').matches){stop();return;}
      const resize=()=>{
        if(finished)return;
        try {
          const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
          const dpr=Math.min(window.devicePixelRatio||1,fractureSettings.maxDpr,Math.sqrt(fractureSettings.maxPixels/Math.max(1,width*height)));
          canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);
        }catch{stop();}
      };
      observer=new ResizeObserver(resize);observer.observe(canvas);resize();
      const draw=()=>{
        if(finished)return;
        try {
          const t=clamp((performance.now()-at)/fractureSettings.firstNoteDuration);
          ctx.clearRect(0,0,width,height);
          if(t>=1){stop();return;}
          ctx.strokeStyle='#c3ddff';ctx.globalAlpha=Math.sin(Math.PI*smooth(t))*.23;ctx.lineWidth=1;
          ctx.beginPath();ctx.ellipse(width*.5,height*.68,width*(.03+t*.65),height*(.01+t*.32),0,Math.PI,Math.PI*2);ctx.stroke();
          for(let i=0;i<fractureSettings.firstNoteParticles;i++) {
            const x=width*(.17+random(i+29)*.66)+(random(i+51)-.5)*t*50;
            const y=height*(.27+random(i+92)*.4)-t*(12+random(i+4)*35);
            ctx.globalAlpha=(1-t)**2*.75;ctx.fillStyle='#d4e6ff';const size=i%7===0?1.7:.8;ctx.fillRect(x,y,size,size);
          }
          frame=requestAnimationFrame(draw);
        }catch{stop();}
      };draw();
    }catch{stop();}
    return()=>stop(false);
  },[at]);
  return done?null:<canvas className="csa-first-note" ref={ref} aria-hidden="true"/>;
}
