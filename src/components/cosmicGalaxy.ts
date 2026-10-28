import { cosmicGalaxyGeometry } from '../piano/cosmicGeometry';
import {showColor} from '../theme/mrPinkShow';
// A face-on texture rotates inside the tilted projection. Detail is baked once per size.
let cached: { size: number; canvas: HTMLCanvasElement } | undefined;
let failedSize = 0;
const random = (seed: number) => (Math.sin(seed * 127.1 + 4.7) * 43758.5453 % 1 + 1) % 1;

function galaxySprite(size: number): HTMLCanvasElement {
  if (cached?.size === size) return cached.canvas;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.width=canvas.height=1; throw new Error('Galaxy texture unavailable'); }
  ctx.setTransform(size / 2, 0, 0, size / 2, size / 2, size / 2);
  const cloud = (x: number, y: number, radius: number, color: string) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, "#00000000");
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  cloud(0, 0, .99, "#28528f45");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  cloud(0, 0, .9, "#455da34c");
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 130; i++) {
      const r = .08 + i / 130 * .82;
      const angle = arm * Math.PI * 2 / 3 + r * 7.3;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      cloud(x, y, .025 + r * .065, arm === 1 ? showColor('#8b78c62e','#a07fbd2e') : "#69b7e738");
      if(i%3===0)cloud(x, y, .009 + r * .019, '#a9deff32');
    }
  }
  // Seeded dust clusters give the spiral arms texture without per-frame randomness.
  for (let i = 0; i < 4800; i++) {
    const r = Math.sqrt(random(i * 5 + 3)) * .92;
    const arm = i % 3;
    const angle = arm * Math.PI * 2 / 3 + r * 7.3 + (random(i * 7 + 11) - .5) * (.24 + r * .3);
    const spread = (random(i * 3 + 19) - .5) * .08;
    const x = Math.cos(angle) * (r + spread), y = Math.sin(angle) * (r + spread);
    ctx.globalAlpha = (.2 + random(i * 13) * .65) * (1 - r * .55);
    ctx.fillStyle = r < .22 ? "#eaf6ff" : i % 5 === 0 ? showColor('#b8abea','#c5aedf') : "#b0e1ff";
    ctx.beginPath(); ctx.arc(x, y, .0008 + random(i * 17) ** 5 * .004, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  // Thin dark seams keep the galaxy from becoming a flat luminous disk.
  for (let arm = 0; arm < 3; arm++) {
    ctx.strokeStyle = "#03091985"; ctx.lineWidth = .018;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const r = .14 + i / 90 * .69, angle = arm * Math.PI * 2 / 3 + r * 7.3 + .12;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  cloud(0, 0, .27, "#abcfeea0");
  cloud(0, 0, .12, "#e7f6fff0");
  cloud(0, 0, .048, "#ffffff");
  ctx.restore();
  // A compact supernova-like core and diffraction rays, rather than a large white wash.
  cloud(0, 0, .16, "#a3d9ff55");
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let ray = 0; ray < 8; ray++) {
    const angle = ray * Math.PI / 4, length = ray % 2 === 0 ? .23 : .1;
    const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
    gradient.addColorStop(0, "#e8f7ffa0"); gradient.addColorStop(1, "#9ddaff00");
    ctx.strokeStyle = gradient; ctx.lineWidth = .002;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length); ctx.stroke();
  }
  cloud(0, 0, .025, "#ffffff");
  ctx.restore();
  if(cached)cached.canvas.width=cached.canvas.height=1;
  cached = { size, canvas };
  return canvas;
}

function safeGalaxySprite(size: number) {
  if(failedSize===size)return undefined;
  try{return galaxySprite(size);}catch{failedSize=size;return undefined;}
}

/** Prepare the same cached final sprite during an idle slice, ahead of the galaxy-formation frame. */
export function prepareCosmicGalaxy(width:number,height:number){
 const {radius}=cosmicGalaxyGeometry(width,height);
 if(radius>=1)safeGalaxySprite(Math.max(256,Math.min(1200,Math.ceil(radius*2*Math.min(window.devicePixelRatio||1,2)))));
}

export function drawCosmicGalaxy(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, reducedMotion: boolean,geometry?:{x:number;y:number;radius:number},corePulse=0,secondaryMotion=true,roundness=0): void {
  const base = cosmicGalaxyGeometry(width,height);
  const radius = geometry?.radius??base.radius;
  if (radius < 1) return;
  const size = Math.max(256, Math.min(1200, Math.ceil(base.radius * 2 * Math.min(window.devicePixelRatio || 1, 2))));
  const sprite = safeGalaxySprite(size);
  ctx.save();
  ctx.translate(geometry?.x??base.x, geometry?.y??base.y);
  const circular=Math.max(0,Math.min(1,roundness));
  ctx.rotate(-.48*(1-circular));ctx.scale(1,.53+.47*circular);
  ctx.rotate(reducedMotion ? 0 : (now % 900000) / 900000 * Math.PI * 2);
  ctx.globalAlpha *= .96;
  if(sprite)ctx.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
  else{
    // Texture/context failure must never stop the existing note-render/input loop.
    const fallback=ctx.createRadialGradient(0,0,0,0,0,radius*.6);
    fallback.addColorStop(0,'#f2faff');fallback.addColorStop(.12,'#b6dfff');fallback.addColorStop(.4,'#497db254');fallback.addColorStop(1,'#223d7900');
    ctx.fillStyle=fallback;ctx.fillRect(-radius*.6,-radius*.6,radius*1.2,radius*1.2);
  }
  // Thirty-six slow drifting arm stars; detail density comes from the cached texture.
  if(!reducedMotion&&secondaryMotion)for(let i=0;i<36;i++){
    const r=.24+(i%12)/12*.62,angle=i%3*Math.PI*2/3+r*7.3+Math.sin(now*.00013+i)*.018;
    const x=Math.cos(angle)*r*radius,y=Math.sin(angle)*r*radius;
    ctx.fillStyle=i%5?'#c2e7ff88':'#c5b6ec88';ctx.beginPath();ctx.arc(x,y,.6+(i%7===0?.6:0),0,Math.PI*2);ctx.fill();
  }
  if(corePulse>.001){
    const pulse=ctx.createRadialGradient(0,0,0,0,0,radius*.19);
    pulse.addColorStop(0,`rgba(239,250,255,${Math.min(1,corePulse)*.55})`);pulse.addColorStop(.28,`rgba(137,208,255,${Math.min(1,corePulse)*.22})`);pulse.addColorStop(1,'#99d9ff00');
    ctx.fillStyle=pulse;ctx.fillRect(-radius*.19,-radius*.19,radius*.38,radius*.38);
  }
  ctx.restore();
}
