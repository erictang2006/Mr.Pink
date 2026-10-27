/** Fine detail is baked into the bounded backdrop once. Only the sparse foreground moves. */
export const observatorySettings = { dust: 1800, clouds: 72, responses: 8, meteorPeriod: 14500, meteorLife: 1050 } as const;
const tau = Math.PI * 2;
const seeded = (i: number) => (Math.sin(i * 127.1 + 4.7) * 43758.5453 % 1 + 1) % 1;
const dust = Array.from({ length: observatorySettings.dust }, (_, i) => ({
  x: seeded(i * 5 + 1), spread: (seeded(i * 7 + 3) - .5) * (seeded(i * 11 + 8) + .12),
  size: .3 + seeded(i * 13 + 9) ** 5 * 1.2, alpha: .1 + seeded(i * 17 + 6) * .38,
}));
const bandY = (x: number) => .52 + Math.sin(x * 5.4 - .7) * .12;
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, squash = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, squash);
  const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  fill.addColorStop(0, color); fill.addColorStop(1, '#00000000');
  ctx.fillStyle = fill; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
}

export function drawObservatoryBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  // A broad, textured Milky Way. Dim the left/center at source to protect the note lanes.
  for (let i = 0; i < observatorySettings.clouds; i++) {
    const x = i / (observatorySettings.clouds - 1), y = bandY(x);
    const prominence = .35 + .65 * x;
    cloud(ctx, x * width, (y + (seeded(i + 9) - .5) * .13) * height,
      width * (.035 + seeded(i + 21) * .055),
      `rgba(${i % 5 === 0 ? '97,91,161' : '46,116,173'},${(.05 + seeded(i + 12) * .08) * prominence})`, .38);
  }
  for (let i = 0; i < dust.length; i++) {
    const p = dust[i], x = p.x * width, y = (bandY(p.x) + p.spread * .24) * height;
    ctx.globalAlpha = p.alpha * (.25 + p.x * .75);
    ctx.fillStyle = i % 7 === 0 ? '#aca9e5' : '#b2dfff';
    ctx.fillRect(x, y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // Dark dust lanes cross the band, giving it depth without drawing over live notes.
  for (let i = 0; i < 22; i++) {
    const x = i / 21;
    cloud(ctx, x * width, (bandY(x) + .018) * height, width * .039, '#02071375', .18);
  }
  // Two distant worlds, deliberately small and unlabelled.
  for (const planet of [{ x: .155, y: .39, r: .043 }, { x: .071, y: .78, r: .022 }]) {
    const x = planet.x * width, y = planet.y * height, r = Math.min(width, height) * planet.r;
    cloud(ctx, x, y, r * 1.28, '#67a9e62c');
    const fill = ctx.createRadialGradient(x - r * .6, y - r * .7, r * .06, x + r * .2, y + r * .15, r * 1.35);
    fill.addColorStop(0, '#7894b8'); fill.addColorStop(.17, '#31475e'); fill.addColorStop(.5, '#07111f'); fill.addColorStop(1, '#020612');
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, tau); ctx.fill();
    ctx.strokeStyle = '#9ccdf55c'; ctx.lineWidth = .65; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
  }
  // A gentle upper vignette protects the title and top-right HUD.
  const shade = ctx.createLinearGradient(0, 0, 0, height * .36);
  shade.addColorStop(0, '#030814a8'); shade.addColorStop(1, '#03081400');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height * .36); ctx.restore();
}

export type CosmicPulse = { at: number; x: number; midi: number };
export type CosmicResponseFrame = { core: number; light: number; pulses: readonly CosmicPulse[] };
/** Visual input only. No timers, musical scheduling, sustained-audio reads or new event listeners. */
export class CosmicResponse {
  private pulses: CosmicPulse[] = [];
  impulse(midi: number, x: number, at: number) {
    this.pulses.push({ midi, x: Math.max(0, Math.min(1, x)), at });
    if (this.pulses.length > observatorySettings.responses) this.pulses.splice(0, this.pulses.length - observatorySettings.responses);
  }
  frame(now: number): CosmicResponseFrame {
    this.pulses = this.pulses.filter(p => now >= p.at && now - p.at < 850);
    let core = 0, light = 0;
    for (const p of this.pulses) {
      const strength = Math.exp(-(now - p.at) / 250);
      light += strength * .11; if (p.midi < 60) core += strength * .32;
    }
    return { core: Math.min(1, core), light: Math.min(.55, light), pulses: this.pulses };
  }
  clear() { this.pulses = []; }
}

export function drawObservatoryMotion(ctx: CanvasRenderingContext2D, width: number, height: number, now: number, reduced: boolean, response?: CosmicResponseFrame) {
  ctx.save();
  if (!reduced) {
    // A fixed 28 motes in two depths gently drift around the nebula band.
    for (let i = 0; i < 28; i++) {
      const depth = i % 2 ? 1 : .45, x = (seeded(i + 91) * width + Math.sin(now * .00004 + i) * 9 * depth);
      const y = bandY(x / width) * height + Math.cos(now * .00007 + i) * height * .075;
      ctx.globalAlpha = (.08 + seeded(i + 18) * .16) * (.4 + x / width * .6);
      ctx.fillStyle = i % 4 ? '#9ccfe9' : '#b4abe6';
      ctx.beginPath(); ctx.arc(x, y, i % 9 ? .7 : 1.2, 0, tau); ctx.fill();
    }
    const cycle = Math.floor(now / observatorySettings.meteorPeriod), age = now % observatorySettings.meteorPeriod;
    if (age < observatorySettings.meteorLife) {
      const t = age / observatorySettings.meteorLife, x = width * (.92 - t * .2), y = height * (.14 + seeded(cycle + 71) * .13 + t * .22);
      const tail = width * .06, alpha = Math.sin(t * Math.PI) * .6;
      const streak = ctx.createLinearGradient(x + tail, y - tail * .58, x, y);
      streak.addColorStop(0, '#8ccfff00'); streak.addColorStop(1, `rgba(214,240,255,${alpha})`);
      ctx.strokeStyle = streak; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x + tail, y - tail * .58); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(241,249,255,${alpha})`; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, tau); ctx.fill();
    }
  }
  // High-register attacks make small, local stars, behind the falling-note layer.
  for (const pulse of response?.pulses ?? []) {
    if (pulse.midi < 72) continue;
    const age = (now - pulse.at) / 850;
    for (let i = 0; i < (reduced ? 1 : 3); i++) {
      const x = pulse.x * width + Math.sin(pulse.midi + i * 3) * (12 + i * 13);
      const y = height * (.37 + seeded(pulse.midi + i * 5) * .27) - (reduced ? 0 : age * 16);
      const r = (1 - age) * (i === 0 ? 3 : 1.8);
      ctx.globalAlpha = (1 - age) ** 2 * .65; ctx.fillStyle = '#daf2ff';
      ctx.fillRect(x - r, y - .45, r * 2, .9); ctx.fillRect(x - .45, y - r, .9, r * 2);
      ctx.beginPath(); ctx.arc(x, y, .85, 0, tau); ctx.fill();
    }
  }
  ctx.restore();
}
