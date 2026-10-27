import {fractureSettings,revealBounds} from './choreography';
import {drawFracture,makeFractureArtwork,type FractureArtwork} from './fractureRenderer';
import {OpeningRenderBudget} from './renderBudget';
import {openingCues,type OpeningFallback} from './sequence';

/** Imperative visual lifetime, isolated from audio. Every asynchronous entry is guarded. */
export function startFracture(canvas:HTMLCanvasElement,origin:number,mask:string,onFailure:(reason:OpeningFallback)=>void):()=>void {
  let disposed=false,frame=0,observer:ResizeObserver|null=null,image:HTMLImageElement|null=null,art:FractureArtwork|null=null;
  let bounds=revealBounds(1,1),ctx:CanvasRenderingContext2D|null=null,lastFrame=0,lastWork=0;
  const budget=new OpeningRenderBudget();
  const cleanup=()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
    canvas.removeEventListener('contextlost',lost);
    if(image){image.onload=null;image.onerror=null;}
    if(art){for(const piece of art.pieces)for(const sprite of [piece.warm,piece.violet,piece.cool,piece.seam])sprite.width=sprite.height=1;for(const sprite of art.sprites)sprite.width=sprite.height=1;art.warm.width=art.warm.height=1;art=null;}
    canvas.width=canvas.height=1;
  };
  const fail=(reason:OpeningFallback)=>{if(disposed)return;cleanup();onFailure(reason);};
  const lost=(event:Event)=>{event.preventDefault();fail('render');};
  const resize=()=>{
    if(disposed||!ctx)return;
    try {
      const rect=canvas.getBoundingClientRect(),piano=canvas.closest('.performance-stage')?.querySelector('.performance-piano')?.getBoundingClientRect();
      bounds=revealBounds(rect.width,rect.height,piano?rect.height-piano.height:rect.height*.7);
      const dpr=Math.min(window.devicePixelRatio||1,budget.quality?1:fractureSettings.maxDpr,Math.sqrt(fractureSettings.maxPixels/Math.max(1,rect.width*rect.height)));
      canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);
    }catch{fail('render');}
  };
  try {
    ctx=canvas.getContext('2d');if(!ctx){fail('render');return cleanup;}
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    canvas.addEventListener('contextlost',lost);
    observer=new ResizeObserver(resize);observer.observe(canvas);resize();if(disposed)return cleanup;
    image=new Image();
    image.onload=()=>{if(disposed)return;try{art=makeFractureArtwork(image!);}catch{fail('render');}};
    image.onerror=()=>fail('asset');image.src=mask;
    const draw=()=>{
      if(disposed)return;
      try {
        const now=performance.now(),ms=(now-origin-openingCues.fracture)/fractureSettings.playbackScale;
        if(ms>=fractureSettings.duration){cleanup();return;}
        if(ms>=0){
          const previous=budget.quality;
          if(lastFrame&&budget.observe(now-lastFrame,lastWork)){fail('slow');return;}
          if(previous!==budget.quality)resize();
          if(disposed)return;
          const workStart=performance.now();
          ctx!.clearRect(0,0,bounds.width,bounds.height);
          if(art)drawFracture(ctx!,ms,bounds,art,reduced,budget.quality);
          lastWork=performance.now()-workStart;lastFrame=now;
        }
        if(!disposed)frame=requestAnimationFrame(draw);
      }catch{fail('render');}
    };
    frame=requestAnimationFrame(draw);
  }catch{fail('render');}
  return cleanup;
}
