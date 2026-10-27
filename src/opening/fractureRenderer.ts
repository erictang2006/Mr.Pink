import {logoFragments,sourceEdgeAnchors,type Point} from './fragments';
import {clamp,createRevealParticles,fractureSettings,fractureLightColor,fragmentPose,fragmentStart,fragmentFeedsPiano,fragmentLandingAt,particlePose,smooth,sourcePoint,type RevealBounds} from './choreography';

type CachedPiece={warm:HTMLCanvasElement;violet:HTMLCanvasElement;cool:HTMLCanvasElement;seam:HTMLCanvasElement;x:number;y:number;width:number;height:number};
function surface(width:number,height:number){const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);return canvas;}
function trace(ctx:CanvasRenderingContext2D,polygon:readonly Point[],sx:number,sy:number){ctx.beginPath();polygon.forEach(([x,y],i)=>{if(i)ctx.lineTo(x*sx,y*sy);else ctx.moveTo(x*sx,y*sy);});ctx.closePath();}
export function makeFractureArtwork(image:HTMLImageElement) {
  const w=image.naturalWidth,h=image.naturalHeight;
  const tint=(color:string)=>{const canvas=surface(w,h),ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,w,h);return canvas;};
  const warm=tint('#8d1e25'),violet=tint('#b098df'),cool=tint('#d8edff');
  const edges=sourceEdgeAnchors(warm.getContext('2d')!.getImageData(0,0,w,h).data,w,h);
  const pieces:CachedPiece[]=logoFragments.map(fragment=>{
    const xs=fragment.polygon.map(p=>p[0]*w/100),ys=fragment.polygon.map(p=>p[1]*h/100);
    const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y,padding=16;
    const cache=(source:HTMLCanvasElement,color:string)=>{
      const mask=surface(width+padding*2,height+padding*2),m=mask.getContext('2d')!;
      m.translate(padding-x,padding-y);trace(m,fragment.polygon,w/100,h/100);m.clip();m.drawImage(source,0,0);
      const result=surface(mask.width,mask.height),r=result.getContext('2d')!;
      // Bloom is baked once; no per-particle canvas blur or full-frame filters.
      r.shadowColor=color;r.shadowBlur=9;r.drawImage(mask,0,0);r.shadowBlur=0;
      return result;
    };
    const seam=surface(width+padding*2,height+padding*2),s=seam.getContext('2d')!;
    s.translate(padding-x,padding-y);trace(s,fragment.polygon,w/100,h/100);s.strokeStyle='#ffd7d2';s.lineWidth=2.2;s.stroke();
    s.globalCompositeOperation='destination-in';s.drawImage(image,0,0);
    const seamBloom=surface(seam.width,seam.height),light=seamBloom.getContext('2d')!;
    light.shadowColor='#ff3757';light.shadowBlur=fractureSettings.seamBloom;light.drawImage(seam,0,0);
    return {warm:cache(warm,'#ef3049aa'),violet:cache(violet,'#b098df88'),cool:cache(cool,'#9ecbff88'),seam:seamBloom,x:x-padding,y:y-padding,width:width+padding*2,height:height+padding*2};
  });
  const sprites=['#ee485e','#ffd29c','#c1aeff','#bde6ff'].map(color=>{
    const canvas=surface(48,48),ctx=canvas.getContext('2d')!,g=ctx.createRadialGradient(24,24,0,24,24,24);
    g.addColorStop(0,'#fff9f2');g.addColorStop(.1,color);g.addColorStop(.3,color+'8c');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(0,0,48,48);return canvas;
  });
  return {warm,pieces,sprites,edges};
}
export type FractureArtwork=ReturnType<typeof makeFractureArtwork>;
const particles=createRevealParticles();
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,alpha:number,color:string) {
  if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(.18,color+'b0');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);ctx.restore();
}
export function drawFracture(ctx:CanvasRenderingContext2D,ms:number,b:RevealBounds,art:FractureArtwork,reducedMotion=false,quality:0|1|2=0) {
  if(ms<0||ms>=fractureSettings.duration)return;
  const {logo}=b,scale=logo.width/art.warm.width;
  const charge=smooth(ms/fractureSettings.energy)*(1-smooth((ms-fractureSettings.energyFadeAt)/fractureSettings.energyFadeFor));
  const vibration=ms<fractureSettings.centerAt?Math.sin(ms*.11)*Math.sin(ms*.041)*.65*charge:0;
  ctx.save();ctx.translate(vibration,0);
  glow(ctx,b.width/2,b.height*.35,logo.width*.42,charge*.5,'#eb2848');
  if(reducedMotion){ctx.globalAlpha=1-smooth((ms-fractureSettings.energy)/(fractureSettings.duration-fractureSettings.energy));ctx.drawImage(art.warm,logo.x,logo.y,logo.width,logo.height);ctx.restore();return;}
  // During buildup the exact intact logo still carries the recognizable silhouette.
  if(ms<fractureSettings.centerAt){ctx.drawImage(art.warm,logo.x,logo.y,logo.width,logo.height);}
  else for(let i=0;i<logoFragments.length;i++) {
    const fragment=logoFragments[i],pose=fragmentPose(fragment,ms,b),piece=art.pieces[i],origin=sourcePoint(fragment.origin,b);
    if(pose.alpha<=.001)continue;
    ctx.save();
    if(fragmentFeedsPiano(fragment)){ctx.beginPath();ctx.rect(0,0,b.width,b.keyboardY);ctx.clip();}
    ctx.translate(origin[0]+pose.x,origin[1]+pose.y);ctx.rotate(pose.rotation);ctx.scale(pose.scaleX,pose.scaleY);
    const x=logo.x+piece.x*scale-origin[0],y=logo.y+piece.y*scale-origin[1];
    const violet=clamp(pose.cool*2),blue=clamp(pose.cool*2-1);
    ctx.globalAlpha=pose.alpha*(1-violet);ctx.drawImage(piece.warm,x,y,piece.width*scale,piece.height*scale);
    if(violet>.001){ctx.globalAlpha=pose.alpha*violet*(1-blue);ctx.drawImage(piece.violet,x,y,piece.width*scale,piece.height*scale);}
    if(blue>.001){ctx.globalAlpha=pose.alpha*blue;ctx.drawImage(piece.cool,x,y,piece.width*scale,piece.height*scale);}
    ctx.restore();
  }
  // Luminous seams use the cut planes through the ORIGINAL alpha, illuminated center-out.
  if(ms<fractureSettings.seamsUntil) {
    const radius=logo.width*(.04+.83*smooth(ms/fractureSettings.seamReach));
    ctx.save();ctx.beginPath();ctx.arc(b.width/2,b.height*.35,radius,0,Math.PI*2);ctx.clip();
    for(let i=0;i<logoFragments.length;i++) {
      const fragment=logoFragments[i],piece=art.pieces[i],pose=fragmentPose(fragment,ms,b),origin=sourcePoint(fragment.origin,b);
      ctx.save();
      if(fragmentFeedsPiano(fragment)){ctx.beginPath();ctx.rect(0,0,b.width,b.keyboardY);ctx.clip();}
      ctx.translate(origin[0]+pose.x,origin[1]+pose.y);ctx.rotate(pose.rotation);ctx.scale(pose.scaleX,pose.scaleY);
      ctx.globalAlpha=fractureSettings.gapLight*charge*pose.alpha;
      ctx.drawImage(piece.seam,logo.x+piece.x*scale-origin[0],logo.y+piece.y*scale-origin[1],piece.width*scale,piece.height*scale);
      ctx.restore();
    }ctx.restore();
  }
  ctx.restore();
  ctx.save();ctx.globalCompositeOperation='lighter';
  // Sampled ribbons follow the descending logo into the real keyboard boundary.
  if(quality===0)for(const fragment of logoFragments) {
    const age=ms-fragmentStart(fragment),pose=fragmentPose(fragment,ms,b);
    if(age<fractureSettings.trailDelay||pose.alpha<.01)continue;
    const origin=sourcePoint(fragment.origin,b);
    ctx.beginPath();for(let j=0;j<=9;j++){const p=fragmentPose(fragment,ms-(9-j)*fractureSettings.trailStep,b),x=origin[0]+p.x,y=origin[1]+p.y;if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
    const down=fragmentFeedsPiano(fragment),energy=smooth((ms-fractureSettings.transformAt)/250);
    ctx.strokeStyle=fractureLightColor(pose.cool);
    if(down){ctx.lineWidth=10;ctx.globalAlpha=pose.alpha*energy*.09;ctx.stroke();}
    ctx.lineWidth=down?3: .7;ctx.globalAlpha=Math.min(.52,age/600)*pose.alpha;ctx.stroke();
    if(down){ctx.strokeStyle='#eef4ff';ctx.lineWidth=.8;ctx.globalAlpha=pose.alpha*energy*.55;ctx.stroke();}
  }
  for(let index=0;quality<2&&index<particles.length;index+=quality===1?2:1) {
    const particle=particles[index],edges=art.edges[particle.fragment];
    const anchor=edges[index%edges.length];
    const pose=particlePose(particle,ms,b,anchor);if(pose.alpha<=.001)continue;
    ctx.globalAlpha=pose.alpha;
    if(particle.kind==='shard') {
      ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(particle.phase+ms*.001);ctx.fillStyle=fractureLightColor(pose.cool);
      ctx.beginPath();ctx.moveTo(-particle.size,-particle.size*.35);ctx.lineTo(particle.size*1.5,0);ctx.lineTo(-particle.size*.3,particle.size*.65);ctx.closePath();ctx.fill();ctx.restore();
    }else {
      const warm=particle.spread>.75?1:0,size=particle.size*8;
      const stage=clamp(pose.cool*2),late=clamp(pose.cool*2-1);
      ctx.globalAlpha=pose.alpha*(1-stage);ctx.drawImage(art.sprites[warm],pose.x-size/2,pose.y-size/2,size,size);
      ctx.globalAlpha=pose.alpha*stage*(1-late);ctx.drawImage(art.sprites[2],pose.x-size/2,pose.y-size/2,size,size);
      ctx.globalAlpha=pose.alpha*late;ctx.drawImage(art.sprites[3],pose.x-size/2,pose.y-size/2,size,size);
      ctx.globalAlpha=pose.alpha;
      if(particle.kind==='energy'&&particle.size>1.7){ctx.fillStyle='#eff7ff';ctx.fillRect(pose.x-2.3,pose.y-.35,4.6,.7);ctx.fillRect(pose.x-.35,pose.y-2.3,.7,4.6);}
    }
  }
  // Local pools arrive with the descending pieces, then join the horizontal reveal sweep.
  for(const fragment of logoFragments)if(fragmentFeedsPiano(fragment)) {
    const arrival=fragmentLandingAt(fragment),age=ms-arrival;
    const light=smooth((age+120)/120)*(1-smooth(age/fractureSettings.landingGlow));
    if(light<=.001)continue;
    const pose=fragmentPose(fragment,arrival,b),origin=sourcePoint(fragment.origin,b),x=origin[0]+pose.x;
    glow(ctx,x,b.keyboardY-2,Math.min(52,b.width*.035),light*.3,'#b5d9ff');
  }
  const wave=smooth((ms-fractureSettings.transformAt)/(fractureSettings.duration-fractureSettings.transformAt));
  const waveAlpha=Math.sin(wave*Math.PI)*.65;
  if(waveAlpha>.001) {
    const x=b.width*(-.05+wave*1.1),reach=b.width*.17;
    const g=ctx.createLinearGradient(x-reach,0,x+reach,0);g.addColorStop(0,'#98ceff00');g.addColorStop(.5,'#e1f3ff');g.addColorStop(1,'#b3caff00');
    ctx.globalAlpha=waveAlpha;ctx.strokeStyle=g;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-reach,b.keyboardY-1);ctx.lineTo(x+reach,b.keyboardY-1);ctx.stroke();
    glow(ctx,x,b.keyboardY-2,Math.min(95,b.width*.065),waveAlpha*.45,'#9ecfff');
  }
  ctx.restore();
}
