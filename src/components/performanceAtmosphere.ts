import { burstEnvelope, traceOrb, type LevelsOrb } from "./levelsOrb";
import { drawCosmicGalaxy } from "./cosmicGalaxy";
import { drawObservatoryBackdrop, drawObservatoryMotion, type CosmicResponseFrame } from './cosmicObservatory';
import {showColor} from '../theme/mrPinkShow';

const stars = Array.from({ length: 110 }, (_, i) => ({
  x: ((Math.sin(i * 127.1 + 3) * 43758.5453) % 1 + 1) % 1,
  y: ((Math.sin(i * 269.5 + 7) * 23728.173) % 1 + 1) % 1,
  size: i % 17 === 0 ? 1.6 : i % 5 === 0 ? 1 : .65,
}));

export const cosmicStars=stars;

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, center: string, edge = "#00000000") {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius);
  fill.addColorStop(0, center); fill.addColorStop(1, edge);
  ctx.fillStyle = fill; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawCosmicBackdrop(ctx:CanvasRenderingContext2D,width:number,height:number){
  ctx.globalAlpha=1;ctx.fillStyle='#080D19';ctx.fillRect(0,0,width,height);
  ctx.globalAlpha=.65;
  glow(ctx,width*.58,height*.34,width*.46,'#172c5148');
  glow(ctx,width*.25,height*.64,width*.31,'#153f552a');
  glow(ctx,width*.82,height*.5,width*.3,showColor('#34354e28','#43334f28'));
  ctx.globalAlpha=1;
  drawObservatoryBackdrop(ctx,width,height);
}
/** Static nebula/planets/distant dust; moving foreground, galaxy and reactions stay live. */
export class CosmicBackdropCache {
  private canvas?:HTMLCanvasElement;
  private width=0;private height=0;private failed=false;
  get(width:number,height:number){
    if(width<=0||height<=0)return undefined;
    if((this.canvas||this.failed)&&this.width===width&&this.height===height)return this.canvas;
    this.width=width;this.height=height;this.failed=false;
    try{
      const canvas=this.canvas??document.createElement('canvas');
      const ratio=Math.min(1,Math.sqrt(600000/(width*height)));
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      const ctx=canvas.getContext('2d',{alpha:false});if(!ctx){canvas.width=canvas.height=1;this.canvas=undefined;this.failed=true;return undefined;}
      ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);drawCosmicBackdrop(ctx,width,height);
      this.canvas=canvas;this.width=width;this.height=height;return canvas;
    }catch{this.canvas=undefined;this.failed=true;return undefined;}
  }
  release(){if(this.canvas)this.canvas.width=this.canvas.height=1;this.canvas=undefined;this.width=this.height=0;this.failed=false;}
}

export function drawCosmicScene(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, reducedMotion: boolean,hideGalaxy=false,opacity=1,backdrop?:CanvasImageSource,response?:CosmicResponseFrame,secondaryMotion=true) {
  ctx.save();ctx.globalAlpha*=opacity;
  if(backdrop)ctx.drawImage(backdrop,0,0,width,height);
  else{
    ctx.fillStyle = "#080D19"; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalAlpha = .65*opacity;
    glow(ctx, width * .58, height * .34, width * .46, "#172c5148");
    glow(ctx, width * .25, height * .64, width * .31, "#153f552a");
    glow(ctx, width * .82, height * .5, width * .3, showColor('#34354e28','#43334f28'));
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = Math.min(1,.9+(response?.light??0)*.12)*opacity;
  if(!hideGalaxy)drawCosmicGalaxy(ctx, width, height, now, reducedMotion,undefined,response?.core,secondaryMotion);
  ctx.restore();
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const depth=.35+(i%3)*.55;
    const drift = reducedMotion ? 0 : Math.sin(now * .000025 + i) * 3 * depth;
    const x = star.x * width + drift, y = star.y * height * .94+(reducedMotion?0:Math.cos(now*.000018+i)*1.5*depth);
    let nearby=0;for(const pulse of response?.pulses??[])nearby+=Math.max(0,1-Math.abs(star.x-pulse.x)/.14)*Math.exp(-(now-pulse.at)/250)*.18;
    ctx.globalAlpha = Math.min(.95,opacity*(.2+(i%7)*.06+(reducedMotion?0:Math.sin(now*.00035+i)*.06)+nearby));
    ctx.fillStyle = i % 13 === 0 ? "#b4b8e8" : "#c3dcf6";
    ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2); ctx.fill();
    if (star.size > 1) {
      ctx.globalAlpha *= .3; ctx.fillRect(x - 4, y - .3, 8, .6); ctx.fillRect(x - .3, y - 4, .6, 8);
    }
  }
  ctx.save();ctx.globalAlpha=opacity;
  drawObservatoryMotion(ctx,width,height,now,reducedMotion||!secondaryMotion,response);
  ctx.restore();
  ctx.globalAlpha = .65*opacity;
  const horizon = ctx.createLinearGradient(0, height - 95, 0, height);
  horizon.addColorStop(0, "#15325200"); horizon.addColorStop(1, "#2c638730");
  ctx.fillStyle = horizon; ctx.fillRect(0, Math.max(0, height - 95), width, 95);
  ctx.restore();
}

export function drawLevelsScene(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, energy: number, reducedMotion: boolean, orb: LevelsOrb,transition?:{grid:number;orb:number;boost:number;orbitAdvance:number}) {
  ctx.fillStyle = "#050510"; ctx.fillRect(0, 0, width, height);
  const x = width * .5, y = height * .46;
  const radius = Math.min(width * .16, height * .255);
  const opacity=transition?.orb??1,grid=transition?.grid??1;
  const deformation = (reducedMotion ? .18 : 1)*(1-(transition?.boost??0)*.7);
  const shape = orb.shape;
  const time = reducedMotion ? 0 : now * .001;
  if(grid>.001){
    glow(ctx, x - radius * .8, y, radius * 3.1, `rgba(33,137,177,${(.09 + energy * .045)*grid})`);
    glow(ctx, x + radius, y, radius * 3, `rgba(${showColor('139,40,168','151,48,141')},${(.1 + energy * .05)*grid})`);
  }
  ctx.save();
  ctx.globalAlpha=grid;
  ctx.strokeStyle = "#60519c19"; ctx.lineWidth = 1;
  // A restrained stage floor gives the sphere depth without obscuring the note lanes.
  for (let i = -7; i <= 7; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * width * .025, height * .77); ctx.lineTo(x + i * width * .15, height); ctx.stroke();
  }
  for (const fraction of [.8, .84, .9, .98]) { ctx.beginPath(); ctx.moveTo(0, height * fraction); ctx.lineTo(width, height * fraction); ctx.stroke(); }

  if(opacity<=.001){ctx.restore();return;}
  ctx.globalAlpha = (1)*opacity;
  if (!reducedMotion) {
    for (const ghost of orb.ghosts) {
      ctx.globalAlpha = (.15 * (1 - ghost.ageMs / 170) * orb.activity)*opacity;
      ctx.lineWidth = 1.3; ctx.strokeStyle = "#8acaff";
      traceOrb(ctx, x, y, radius, ghost.shape, 1); ctx.stroke();
    }
    for (const spark of orb.sparks) {
      const progress = spark.ageMs / spark.lifeMs;
      const seconds = spark.ageMs / 1000;
      const angle = spark.angle + spark.drift * seconds;
      const distance = radius * (1 + spark.strength * .3 + seconds * spark.speed);
      const tail = radius * (.035 + spark.speed * .035);
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
      ctx.globalAlpha = ((1 - progress) ** 2 * Math.min(.9, spark.strength * .7))*opacity;
      ctx.strokeStyle = Math.cos(angle) < 0 ? "#70ffff" : "#eda1ff";
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px - Math.cos(angle) * tail, py - Math.sin(angle) * tail); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = "#e2fcff"; ctx.beginPath(); ctx.arc(px, py, 1 + spark.strength * .6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = (1)*opacity;
  const rim = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  rim.addColorStop(0, "#62ffff"); rim.addColorStop(.48, "#9199ff"); rim.addColorStop(1, showColor('#f276e0','#f28dce'));
  const fill = ctx.createRadialGradient(x - radius * .3, y - radius * .3, radius * .05, x, y, radius);
  fill.addColorStop(0, "#3479973d"); fill.addColorStop(.65, "#202a5b4a"); fill.addColorStop(.9, "#474e9f40"); fill.addColorStop(1, "#b487ef57");
  ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 2;
  ctx.shadowColor = "#857bff"; ctx.shadowBlur = 20 + energy * 17+(transition?.boost??0)*18;
  traceOrb(ctx, x, y, radius, shape, deformation);
  ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  // The core is steady; activity adds edge-local plasma flicker, not whole-screen flashes.
  if (!reducedMotion && orb.activity > .02) {
    ctx.globalAlpha = (orb.activity * (.2 + .06 * Math.sin(now * .025)))*opacity;
    ctx.strokeStyle = "#d9faff"; ctx.lineWidth = .85;
    traceOrb(ctx, x, y, radius, shape, 1.025); ctx.stroke(); ctx.globalAlpha = (1)*opacity;
  }
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * .06+(transition?.orbitAdvance??0) + i * .66);
    ctx.globalAlpha = (.12 + energy * .06)*opacity; ctx.lineWidth = .9; ctx.strokeStyle = rim;
    ctx.scale(1, .25 + i * .1);
    traceOrb(ctx, 0, 0, radius * .94, shape, deformation * .7); ctx.stroke(); ctx.restore();
  }
  if (!reducedMotion) for (const burst of orb.bursts) {
    const flash = burstEnvelope(burst.ageMs) * Math.min(1.5, burst.strength);
    if (flash < .03) continue;
    const index = ((Math.round(burst.angle / (Math.PI * 2) * shape.length) % shape.length) + shape.length) % shape.length;
    const reach = radius * (1 + Math.max(0, shape[index]));
    const cos = Math.cos(burst.angle), sin = Math.sin(burst.angle);
    const px = x + cos * reach, py = y + sin * reach;
    const color = cos < 0 ? "#67ffff" : "#f79dff";
    ctx.globalAlpha = (1)*opacity;
    glow(ctx, px, py, radius * (.11 + burst.strength * .07), `rgba(${cos < 0 ? "70,240,255" : "235,105,255"},${flash * .38})`);
    if (burst.sharpness > .55) {
      const base = radius * .94, half = radius * .028;
      ctx.globalAlpha = (flash * .7)*opacity; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x + cos * base - sin * half, y + sin * base + cos * half);
      ctx.lineTo(px, py); ctx.lineTo(x + cos * (base + radius * .06) + sin * half, y + sin * (base + radius * .06) - cos * half); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}
