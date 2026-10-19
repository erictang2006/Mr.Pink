import { burstEnvelope, traceOrb, type LevelsOrb } from "./levelsOrb";
import { drawCosmicGalaxy } from "./cosmicGalaxy";

const stars = Array.from({ length: 110 }, (_, i) => ({
  x: ((Math.sin(i * 127.1 + 3) * 43758.5453) % 1 + 1) % 1,
  y: ((Math.sin(i * 269.5 + 7) * 23728.173) % 1 + 1) % 1,
  size: i % 17 === 0 ? 1.6 : i % 5 === 0 ? 1 : .65,
}));

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, center: string, edge = "#00000000") {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius);
  fill.addColorStop(0, center); fill.addColorStop(1, edge);
  ctx.fillStyle = fill; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function drawCosmicScene(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, reducedMotion: boolean) {
  ctx.fillStyle = "#030711"; ctx.fillRect(0, 0, width, height);
  glow(ctx, width * .58, height * .34, width * .46, "#172c5148");
  glow(ctx, width * .25, height * .64, width * .31, "#153f552a");
  glow(ctx, width * .82, height * .5, width * .3, "#34354e28");
  drawCosmicGalaxy(ctx, width, height, now, reducedMotion);
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const drift = reducedMotion ? 0 : Math.sin(now * .000025 + i) * 3;
    const x = star.x * width + drift, y = star.y * height * .94;
    ctx.globalAlpha = .18 + (i % 7) * .055 + (reducedMotion ? 0 : Math.sin(now * .00035 + i) * .06);
    ctx.fillStyle = i % 13 === 0 ? "#e9d9b6" : "#c3dcf6";
    ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2); ctx.fill();
    if (star.size > 1) {
      ctx.globalAlpha *= .3; ctx.fillRect(x - 4, y - .3, 8, .6); ctx.fillRect(x - .3, y - 4, .6, 8);
    }
  }
  ctx.globalAlpha = 1;
  const horizon = ctx.createLinearGradient(0, height - 95, 0, height);
  horizon.addColorStop(0, "#15325200"); horizon.addColorStop(1, "#2c638730");
  ctx.fillStyle = horizon; ctx.fillRect(0, Math.max(0, height - 95), width, 95);
}

export function drawLevelsScene(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, energy: number, reducedMotion: boolean, orb: LevelsOrb) {
  ctx.fillStyle = "#050510"; ctx.fillRect(0, 0, width, height);
  const x = width * .5, y = height * .46;
  const radius = Math.min(width * .16, height * .255);
  const deformation = reducedMotion ? .18 : 1;
  const shape = orb.shape;
  const time = reducedMotion ? 0 : now * .001;
  glow(ctx, x - radius * .8, y, radius * 3.1, `rgba(33,137,177,${.09 + energy * .045})`);
  glow(ctx, x + radius, y, radius * 3, `rgba(139,40,168,${.1 + energy * .05})`);
  ctx.save();
  ctx.strokeStyle = "#60519c19"; ctx.lineWidth = 1;
  // A restrained stage floor gives the sphere depth without obscuring the note lanes.
  for (let i = -7; i <= 7; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * width * .025, height * .77); ctx.lineTo(x + i * width * .15, height); ctx.stroke();
  }
  for (const fraction of [.8, .84, .9, .98]) { ctx.beginPath(); ctx.moveTo(0, height * fraction); ctx.lineTo(width, height * fraction); ctx.stroke(); }

  ctx.globalAlpha = 1;
  if (!reducedMotion) {
    for (const ghost of orb.ghosts) {
      ctx.globalAlpha = .15 * (1 - ghost.ageMs / 170) * orb.activity;
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
      ctx.globalAlpha = (1 - progress) ** 2 * Math.min(.9, spark.strength * .7);
      ctx.strokeStyle = Math.cos(angle) < 0 ? "#70ffff" : "#eda1ff";
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px - Math.cos(angle) * tail, py - Math.sin(angle) * tail); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = "#e2fcff"; ctx.beginPath(); ctx.arc(px, py, 1 + spark.strength * .6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const rim = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  rim.addColorStop(0, "#62ffff"); rim.addColorStop(.48, "#9199ff"); rim.addColorStop(1, "#f276e0");
  const fill = ctx.createRadialGradient(x - radius * .3, y - radius * .3, radius * .05, x, y, radius);
  fill.addColorStop(0, "#3479973d"); fill.addColorStop(.65, "#202a5b4a"); fill.addColorStop(.9, "#474e9f40"); fill.addColorStop(1, "#b487ef57");
  ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 2;
  ctx.shadowColor = "#857bff"; ctx.shadowBlur = 20 + energy * 17;
  traceOrb(ctx, x, y, radius, shape, deformation);
  ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  // The core is steady; activity adds edge-local plasma flicker, not whole-screen flashes.
  if (!reducedMotion && orb.activity > .02) {
    ctx.globalAlpha = orb.activity * (.2 + .06 * Math.sin(now * .025));
    ctx.strokeStyle = "#d9faff"; ctx.lineWidth = .85;
    traceOrb(ctx, x, y, radius, shape, 1.025); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * .06 + i * .66);
    ctx.globalAlpha = .12 + energy * .06; ctx.lineWidth = .9; ctx.strokeStyle = rim;
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
    ctx.globalAlpha = 1;
    glow(ctx, px, py, radius * (.11 + burst.strength * .07), `rgba(${cos < 0 ? "70,240,255" : "235,105,255"},${flash * .38})`);
    if (burst.sharpness > .55) {
      const base = radius * .94, half = radius * .028;
      ctx.globalAlpha = flash * .7; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x + cos * base - sin * half, y + sin * base + cos * half);
      ctx.lineTo(px, py); ctx.lineTo(x + cos * (base + radius * .06) + sin * half, y + sin * (base + radius * .06) - cos * half); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}
