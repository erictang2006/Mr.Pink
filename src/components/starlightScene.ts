import type { pianoGeometry } from '../piano/geometry';
import type { LiveNote } from '../piano/liveNotes';
import { StarlightScene, starlightColor, starlightBeamStops, starlightParticleOpacity } from './starlight';

// Small cached halos avoid hundreds of live shadow blurs per frame.
const halos = new Map<string, HTMLCanvasElement>();
function starHalo(color:string): HTMLCanvasElement {
  const cached=halos.get(color);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=40;
  const ctx=canvas.getContext('2d')!;
  const halo=ctx.createRadialGradient(20,20,0,20,20,20);
  halo.addColorStop(0,starlightBeamStops(color).at(-1)!.color);halo.addColorStop(.14,starlightBeamStops(color).at(-1)!.color);
  halo.addColorStop(.26,`${color}ed`);halo.addColorStop(.48,`${color}65`);halo.addColorStop(1,`${color}00`);
  ctx.fillStyle=halo;ctx.fillRect(0,0,40,40);
  halos.set(color,canvas);return canvas;
}

/** Effects originate where the existing reverse-falling bars meet the key boundary. */
export function drawStarlightScene(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  geometry: ReturnType<typeof pianoGeometry>, notes: LiveNote[],
  scene: StarlightScene, now: number, reducedMotion: boolean,
) {
  scene.update(notes, now, reducedMotion);
  const illumination = new Map<number,number>();
  for(const note of notes) {
    const sinceRelease = note.physicalEndMs === null ? 0 : now-note.physicalEndMs;
    if(sinceRelease>480)continue;
    const attack = Math.min(1,.18+(now-note.startMs)/135);
    const tail = note.physicalEndMs===null?1:Math.max(0,1-sinceRelease/480)**2;
    illumination.set(note.midi,Math.max(illumination.get(note.midi)??0,attack*tail*(note.assisted?.55:1)));
  }
  const energy=Math.min(1,[...illumination.values()].reduce((a,b)=>a+b,0)/7);
  ctx.save();
  const atmosphere=ctx.createLinearGradient(0,height-70,0,height);
  atmosphere.addColorStop(0,'#76c9ff00');atmosphere.addColorStop(1,`rgba(76,139,184,${.025+energy*.035})`);
  ctx.fillStyle=atmosphere;ctx.fillRect(0,Math.max(0,height-70),width,70);
  for(const [midi,level] of illumination) {
    const key=geometry.keys.get(midi);if(!key)continue;
    const x=key.x+key.width/2,color=starlightColor(midi),beamHeight=Math.min(110,height*.23);
    ctx.globalAlpha=level;
    const beam=ctx.createLinearGradient(0,height-beamHeight,0,height);
    beam.addColorStop(0,`${color}00`);beam.addColorStop(.8,`${color}0e`);beam.addColorStop(1,`${color}65`);
    ctx.fillStyle=beam;ctx.fillRect(x-key.width*.4,height-beamHeight,key.width*.8,beamHeight);
    const pool=ctx.createRadialGradient(x,height,0,x,height,key.width*1.5);
    pool.addColorStop(0,`${starlightBeamStops(color).at(-1)!.color}dc`);pool.addColorStop(.18,`${color}9c`);pool.addColorStop(.4,`${color}28`);pool.addColorStop(1,`${color}00`);
    ctx.fillStyle=pool;ctx.fillRect(x-key.width*1.5,height-key.width*1.5,key.width*3,key.width*1.5);
  }
  for(const pulse of scene.pulses) {
    const key=geometry.keys.get(pulse.midi);if(!key)continue;
    const t=Math.max(0,(now-pulse.born)/420),x=key.x+key.width/2,color=starlightColor(pulse.midi);
    ctx.globalAlpha=(1-t)**2*Math.min(1,pulse.strength*1.18);
    const radius=key.width*(.8+t*1.2);
    ctx.drawImage(starHalo(color),x-radius,height-radius,radius*2,radius*2);
    const edge=ctx.createLinearGradient(x-key.width*.32,0,x+key.width*.32,0);
    edge.addColorStop(0,`${color}00`);edge.addColorStop(.5,starlightBeamStops(color).at(-1)!.color);edge.addColorStop(1,`${color}00`);
    ctx.fillStyle=edge;ctx.shadowColor=color;ctx.shadowBlur=reducedMotion?0:12;
    ctx.fillRect(x-key.width*.32,height-3,key.width*.64,3);
    ctx.shadowBlur=0;
    if(!reducedMotion) {
      ctx.strokeStyle=`${color}90`;ctx.lineWidth=1;
      ctx.beginPath();ctx.ellipse(x,height-1,key.width*(.28+t*.8),2+t*5,0,Math.PI,Math.PI*2);ctx.stroke();
    }
  }
  if(!reducedMotion)for(const star of scene.particles) {
    const key=geometry.keys.get(star.midi);if(!key)continue;
    const age=(now-star.born)/1000;
    const sway=star.sway*(Math.sin(star.phase+age*star.frequency)-Math.sin(star.phase));
    const x=key.x+key.width*(.5+star.offset)+star.drift*age+sway;
    const y=height-3-star.speed*age*(1-.12*Math.min(age,1.8));
    ctx.globalAlpha=starlightParticleOpacity(star,now);
    const color=starlightColor(star.midi),r=star.size*4;
    // The sprite contains the near-white core and feathered halo in one draw.
    ctx.drawImage(starHalo(color),x-r,y-r,r*2,r*2);
    if(star.size>3){ctx.globalAlpha*=.65;ctx.fillStyle=starlightBeamStops(color).at(-1)!.color;ctx.fillRect(x-4,y-.45,8,.9);ctx.fillRect(x-.45,y-4,.9,8);}

  }
  ctx.restore();
}
