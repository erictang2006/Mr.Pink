import { starlightBeamStops, type starlightNoteShape } from './starlight';

type BeamShape = ReturnType<typeof starlightNoteShape>;
const materials = new Map<string, {stops:ReturnType<typeof starlightBeamStops>;edge:string}>();

/** Layered light stays within the existing beam shape, with a narrow halo outside it. */
export function drawStarlightBeam(
  ctx:CanvasRenderingContext2D, shape:BeamShape, color:string,
  held:boolean, now:number, reducedMotion:boolean, economical=false,
) {
  const {x,top,width:w,height:h,radius}=shape,bottom=top+h,cx=x+w/2;
  let material=materials.get(color);
  if(!material){const stops=starlightBeamStops(color);material={stops,edge:stops.at(-1)!.color};materials.set(color,material);}
  const {stops,edge}=material;
  const shimmer=held&&!reducedMotion?Math.sin(now*.0022+x*.012):0;
  ctx.save();

  // Localized base bloom carries more energy than the upper silhouette.
  if(!economical){
  const glowRadius=Math.min(32,w*.9);
  const bloom=ctx.createRadialGradient(cx,bottom-1,0,cx,bottom-1,glowRadius);
  bloom.addColorStop(0,`${edge}80`);bloom.addColorStop(.3,`${color}48`);bloom.addColorStop(1,`${color}00`);
  ctx.fillStyle=bloom;ctx.fillRect(cx-glowRadius,bottom-glowRadius,glowRadius*2,glowRadius*1.6);
  }

  const body=ctx.createLinearGradient(0,top,0,bottom);
  for(const stop of stops)body.addColorStop(stop.offset,stop.color);
  ctx.fillStyle=body;ctx.shadowColor=`${color}b0`;ctx.shadowBlur=economical?0:held?14:9;
  ctx.beginPath();ctx.roundRect(x,top,w,h,radius);ctx.fill();ctx.shadowBlur=0;

  // A feathered oval lights the lower interior instead of whitening the whole bar.
  if(!economical){
  ctx.save();ctx.clip();
  ctx.save();
  ctx.globalAlpha*=.9+shimmer*.09;
  ctx.translate(cx,bottom-h*(.29+shimmer*.012));ctx.scale(w*.48,Math.max(8,h*.56));
  const inner=ctx.createRadialGradient(0,0,0,0,0,1);
  inner.addColorStop(0,`${edge}70`);inner.addColorStop(.35,`${edge}38`);
  inner.addColorStop(.72,`${color}16`);inner.addColorStop(1,`${color}00`);
  ctx.fillStyle=inner;ctx.fillRect(-1,-1,2,2);ctx.restore();

  const coreRadius=Math.max(8,w*.82);
  const core=ctx.createRadialGradient(cx,bottom-1,0,cx,bottom-1,coreRadius);
  core.addColorStop(0,`${edge}fa`);core.addColorStop(.24,`${edge}b0`);
  core.addColorStop(.6,`${color}38`);core.addColorStop(1,`${color}00`);
  ctx.fillStyle=core;ctx.fillRect(x,bottom-coreRadius,w,coreRadius+1);
  ctx.restore();
  }

  // Pale, graduated rim light has a soft halo rather than a uniform flat outline.
  const rim=ctx.createLinearGradient(0,top,0,bottom);
  rim.addColorStop(0,`${edge}38`);rim.addColorStop(.4,`${edge}78`);
  rim.addColorStop(.78,`${edge}c4`);rim.addColorStop(1,edge);
  ctx.strokeStyle=rim;ctx.lineWidth=.95;
  ctx.shadowColor=`${color}b8`;ctx.shadowBlur=economical?0:5;
  ctx.stroke();ctx.shadowBlur=0;

  const lip=ctx.createLinearGradient(x,0,x+w,0);
  lip.addColorStop(0,`${edge}00`);lip.addColorStop(.25,`${edge}78`);
  lip.addColorStop(.5,edge);lip.addColorStop(.75,`${edge}78`);lip.addColorStop(1,`${edge}00`);
  ctx.fillStyle=lip;ctx.shadowColor=edge;ctx.shadowBlur=economical?0:3;
  ctx.fillRect(x+radius*.5,bottom-1.5,w-radius,1);
  ctx.restore();
}
