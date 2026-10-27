import {revealClamp,revealEase,rosesRevealSettings} from '../piano/rosesReveal';
const tau=Math.PI*2;
const accretionArms=Array.from({length:5},(_,arm)=>Array.from({length:45},(_,i)=>{
  const t=i/44,r=.19+t*.76,a=arm*tau/5+t*6.4;
  return {x:Math.cos(a)*r,y:Math.sin(a)*r};
}));
const revealPetals=Array.from({length:rosesRevealSettings.petals},(_,i)=>{
  const angle=i*2.399963;
  return {i,angle,cos:Math.cos(angle),sin:Math.sin(angle),spread:.45+Math.sin(i*4.1)**2*.45,delay:i%4*24,life:1250+i%5*110,size:4+i%5};
});
/** Small fixed-budget accretion system. No allocation of particles or audio hooks per frame. */
export function drawBlackHole(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,now:number,level:number,build:number,reduced:boolean){
  if(r<1)return;
  const inheritedAlpha=ctx.globalAlpha;
  const time=reduced?0:now,spin=time*.00012*(1+level*.5),pink=revealClamp(build);
  ctx.save();ctx.translate(x,y);
  const interior=ctx.createRadialGradient(0,0,r*.08,0,0,r);interior.addColorStop(0,'#01030a');interior.addColorStop(.46,'#020613');interior.addColorStop(.82,'#0b1c40');interior.addColorStop(1,'#030a19');
  ctx.fillStyle=interior;ctx.beginPath();ctx.arc(0,0,r,0,tau);ctx.fill();
  const cos=Math.cos(spin),sin=Math.sin(spin);
  for(let arm=0;arm<accretionArms.length;arm++){
    ctx.beginPath();const points=accretionArms[arm];
    for(let i=0;i<points.length;i++){
      const point=points[i],px=(point.x*cos-point.y*sin)*r,py=(point.x*sin+point.y*cos)*r*.76;
      if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
    }
    ctx.strokeStyle=arm%2?`rgba(144,151,255,${.32+level*.24})`:`rgba(${80+Math.round(pink*120)},${190-Math.round(pink*40)},255,${.38+level*.26})`;
    ctx.lineWidth=1.3+level*1.4;ctx.stroke();
  }
  for(let i=0;i<34;i++){
    const t=(i/34+time*.000025*(1+level))%1,rad=r*(.93-t*.69),a=i*2.399963+spin+t*4;
    ctx.globalAlpha=inheritedAlpha*((.35+level*.4)*Math.sin(t*Math.PI));ctx.fillStyle=i%4===0&&pink>.3?'#f6b3ef':'#bdefff';
    const s=i%8===0?2:1;ctx.fillRect(Math.cos(a)*rad,Math.sin(a)*rad*.76,s,s);
  }
  ctx.globalAlpha=inheritedAlpha;
  const halo=ctx.createRadialGradient(0,0,r*.13,0,0,r*.37);halo.addColorStop(0,'#03050c');halo.addColorStop(.42,'#1d4389');halo.addColorStop(.6,`rgba(142,221,255,${.6+level*.35})`);halo.addColorStop(1,'#16418a00');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,r*.37,0,tau);ctx.fill();
  ctx.fillStyle='#01030a';ctx.beginPath();ctx.arc(0,0,r*(.19-level*.015),0,tau);ctx.fill();ctx.restore();
}
export function drawAlbumReveal(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,age:number,reduced:boolean){
  if(age<0||age>rosesRevealSettings.residual)return;
  const inheritedAlpha=ctx.globalAlpha;
  const t=revealClamp(age/rosesRevealSettings.albumReveal),flash=Math.sin(Math.PI*revealClamp(age/480))*(1-revealEase(age/700));
  ctx.save();
  if(flash>.001){
    const glow=ctx.createRadialGradient(x,y,0,x,y,r*1.3);glow.addColorStop(0,`rgba(255,249,255,${flash*.9})`);glow.addColorStop(.18,`rgba(255,178,222,${flash*.55})`);glow.addColorStop(1,'#ff93d400');ctx.fillStyle=glow;ctx.fillRect(x-r*1.3,y-r*1.3,r*2.6,r*2.6);
  }
  for(let i=0;i<2;i++){
    ctx.globalAlpha=inheritedAlpha*((1-t)*.85);ctx.strokeStyle=i?'#ff9bdc':'#a2f3ff';ctx.lineWidth=2.2-i*.6;
    ctx.beginPath();ctx.arc(x,y,r*(.14+revealEase(t)*(1.65+i*.17)),0,tau);ctx.stroke();
  }
  if(!reduced)for(const petal of revealPetals){
    const i=petal.i,u=revealClamp((age-petal.delay)/petal.life);if(u<=0||u>=1)continue;
    const a=petal.angle,spread=r*petal.spread,distance=r*.3+spread*(1-(1-u)**2),px=x+petal.cos*distance+Math.sin(u*4+i)*r*.07,py=y+petal.sin*distance+u*u*r*.38;
    const size=petal.size*Math.min(1,r/180);ctx.save();ctx.translate(px,py);ctx.rotate(a+u*(i%2?2:-2));ctx.scale(.65+Math.cos(u*3+i)*.2,1);ctx.globalAlpha=inheritedAlpha*(Math.sin(u*Math.PI)**.7);ctx.fillStyle=i%3?'#f78bc8':'#ffd2e9';ctx.beginPath();ctx.moveTo(0,-size);ctx.bezierCurveTo(size*1.5,-size,size,size,0,size);ctx.bezierCurveTo(-size,size*.5,-size,-size*.6,0,-size);ctx.fill();ctx.restore();
  }
  ctx.restore();
}
