// The detailed dust is rendered once on resize; each animation frame draws one sprite.
let cached: { size: number; canvas: HTMLCanvasElement } | undefined;
const random = (seed: number) => (Math.sin(seed * 127.1 + 4.7) * 43758.5453 % 1 + 1) % 1;

function galaxySprite(size: number): HTMLCanvasElement {
  if (cached?.size === size) return cached.canvas;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(size / 2, 0, 0, size / 2, size / 2, size / 2);
  const cloud = (x: number, y: number, radius: number, color: string) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, "#00000000");
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  cloud(0, 0, .96, "#284a892a");
  ctx.save(); ctx.rotate(-.48); ctx.scale(1, .53);
  ctx.globalCompositeOperation = "screen";
  cloud(0, 0, .82, "#5662ae48");
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 95; i++) {
      const r = .1 + i / 95 * .77;
      const angle = arm * Math.PI * 2 / 3 + r * 7.3;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      cloud(x, y, .045 + r * .1, arm === 1 ? "#8b6ab118" : "#598cbe22");
    }
  }
  // Seeded dust clusters give the spiral arms texture without per-frame randomness.
  for (let i = 0; i < 2400; i++) {
    const r = Math.sqrt(random(i * 5 + 3)) * .88;
    const arm = i % 3;
    const angle = arm * Math.PI * 2 / 3 + r * 7.3 + (random(i * 7 + 11) - .5) * (.24 + r * .3);
    const spread = (random(i * 3 + 19) - .5) * .08;
    const x = Math.cos(angle) * (r + spread), y = Math.sin(angle) * (r + spread);
    ctx.globalAlpha = (.13 + random(i * 13) * .55) * (1 - r * .75);
    ctx.fillStyle = r < .29 ? "#fff0d0" : i % 5 === 0 ? "#c5a4ed" : "#a7d8ff";
    ctx.beginPath(); ctx.arc(x, y, .001 + random(i * 17) ** 4 * .005, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  // Thin dark seams keep the galaxy from becoming a flat luminous disk.
  for (let arm = 0; arm < 3; arm++) {
    ctx.strokeStyle = "#07112750"; ctx.lineWidth = .013;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const r = .14 + i / 90 * .69, angle = arm * Math.PI * 2 / 3 + r * 7.3 + .12;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  cloud(0, 0, .34, "#b9ccebb0");
  cloud(0, 0, .16, "#fff0ccec");
  cloud(0, 0, .06, "#fff9ed");
  ctx.restore();
  // A compact supernova-like core and diffraction rays, rather than a large white wash.
  cloud(0, 0, .16, "#a3d9ff55");
  ctx.save(); ctx.globalCompositeOperation = "screen";
  for (let ray = 0; ray < 8; ray++) {
    const angle = ray * Math.PI / 4, length = ray % 2 === 0 ? .23 : .1;
    const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
    gradient.addColorStop(0, "#fff6d9a0"); gradient.addColorStop(1, "#9ddaff00");
    ctx.strokeStyle = gradient; ctx.lineWidth = .002;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length); ctx.stroke();
  }
  cloud(0, 0, .025, "#ffffff");
  ctx.restore();
  cached = { size, canvas };
  return canvas;
}

export function drawCosmicGalaxy(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, reducedMotion: boolean): void {
  const radius = Math.min(width * .21, height * .37);
  if (radius < 1) return;
  const size = Math.max(256, Math.min(1200, Math.ceil(radius * 2 * Math.min(window.devicePixelRatio || 1, 2))));
  const sprite = galaxySprite(size);
  const drift = reducedMotion ? 0 : Math.sin(now * .00012) * 1.5;
  ctx.save();
  ctx.translate(width * .8, height * .49 + drift);
  ctx.rotate(reducedMotion ? 0 : Math.sin(now * .000035) * .012);
  ctx.globalAlpha *= .9;
  ctx.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}
