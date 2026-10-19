const tau = Math.PI * 2;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const points = 128;
const circle = Array.from({ length: points }, (_, i) => ({ x: Math.cos(i / points * tau), y: Math.sin(i / points * tau) }));

export type OrbBurst = { angle: number; strength: number; sharpness: number; ageMs: number; seed: number };
export type OrbSpark = { angle: number; speed: number; drift: number; ageMs: number; lifeMs: number; strength: number };
const random = (seed: number) => (Math.sin(seed * 127.1 + 9.2) * 43758.5453 % 1 + 1) % 1;
export const burstEnvelope = (ageMs: number) => Math.max(0, (1 - Math.exp(-ageMs / 12)) * Math.exp(-ageMs / 165) * (1 - ageMs / 850));

/** Pitch biases a hemisphere; mid-register events roam through all directions. */
export function orbDirection(midi: number, id: number, low: number, high: number): number {
  const position = (midi - low) / Math.max(1, high - low);
  const variation = Math.sin(id * 2.399963 + midi * .73);
  if (position < .38) return Math.PI - .22 + variation * .6;
  if (position > .62) return -.22 + variation * .6;
  return (id * 2.399963 + midi * .51) % tau;
}

/** A bounded, damped circular spring mesh. The base radius/center never scale. */
export class LevelsOrb {
  private displacement = new Float64Array(points);
  private velocity = new Float64Array(points);
  private acceleration = new Float64Array(points);
  private clockMs = 0;
  private ghostMs = 0;
  private serial = 0;
  readonly shape = new Float64Array(points);
  bursts: OrbBurst[] = [];
  sparks: OrbSpark[] = [];
  ghosts: { shape: Float64Array; ageMs: number }[] = [];
  activity = 0;

  impulse(angle: number, strength: number, sharpness = .55): void {
    strength = Math.max(0, Math.min(1.8, strength));
    sharpness = Math.max(0, Math.min(1, sharpness));
    const seed = ++this.serial;
    this.bursts.push({ angle, strength, sharpness, ageMs: 0, seed });
    this.bursts = this.bursts.slice(-24);
    this.activity = Math.min(1, this.activity + .1 + strength * .22);
    const count = 4 + Math.floor(strength * 5);
    for (let i = 0; i < count; i++) this.sparks.push({
      angle: angle + (random(seed * 19 + i) - .5) * .65,
      speed: .8 + random(seed * 37 + i) * 1.5,
      drift: (random(seed * 11 + i) - .5) * .9,
      ageMs: 0, lifeMs: 260 + random(seed * 7 + i) * 380, strength,
    });
    this.sparks = this.sparks.slice(-160);
    for (let i = 0; i < this.velocity.length; i++) {
      const direction = i / this.velocity.length * tau;
      const pull = Math.exp(-.5 * (wrap(direction - angle) / .29) ** 2);
      const sideRipple = Math.exp(-.5 * (wrap(direction - angle - Math.PI * .55) / .4) ** 2);
      this.velocity[i] = Math.max(-7, Math.min(7, this.velocity[i] + strength * (pull + sideRipple * .24) * 7));
    }
  }

  update(elapsedMs: number): void {
    const elapsed = Math.max(0, elapsedMs);
    this.clockMs += elapsed;
    this.activity *= Math.exp(-elapsed / 280);
    this.bursts = this.bursts.filter(burst => (burst.ageMs += elapsed) < 850);
    this.sparks = this.sparks.filter(spark => (spark.ageMs += elapsed) < spark.lifeMs);
    this.ghosts = this.ghosts.filter(ghost => (ghost.ageMs += elapsed) < 170);
    // Small simulation steps make the spring stable at 30/60/120 Hz and after stalls.
    const duration = Math.max(0, Math.min(64, elapsedMs)) / 1000;
    const steps = Math.max(1, Math.ceil(duration * 240));
    const dt = duration / steps, n = this.shape.length;
    for (let step = 0; step < steps; step++) {
      let mean = 0, meanVelocity = 0;
      for (let i = 0; i < n; i++) this.acceleration[i] = -100 * this.displacement[i] - 13 * this.velocity[i]
        + 140 * (this.displacement[(i + n - 1) % n] + this.displacement[(i + 1) % n] - 2 * this.displacement[i]);
      for (let i = 0; i < n; i++) {
        this.velocity[i] += this.acceleration[i] * dt;
        this.displacement[i] += this.velocity[i] * dt;
        mean += this.displacement[i] / n; meanVelocity += this.velocity[i] / n;
      }
      // Remove the uniform expansion mode: local bulges, not a growing/shrinking circle.
      for (let i = 0; i < n; i++) { this.displacement[i] -= mean; this.velocity[i] -= meanVelocity; }
    }
    for (let i = 0; i < n; i++) {
      const angle = i / n * tau;
      let spikes = 0;
      for (const burst of this.bursts) {
        const distance = wrap(angle - burst.angle);
        const width = .135 - burst.sharpness * .083;
        // A narrow exponential peak keeps a pointed tip, separate from the broad springs.
        const peak = Math.exp(-Math.abs(distance) / width);
        spikes += peak * burstEnvelope(burst.ageMs) * burst.strength * (.18 + burst.sharpness * .42);
      }
      const turbulence = this.activity ** 1.5 * .017 * (Math.sin(angle * 17 + this.clockMs * .023) + .5 * Math.sin(angle * 31 - this.clockMs * .031));
      const body = .46 * Math.tanh(this.displacement[i] / .46);
      this.shape[i] = Math.max(-.32, Math.min(.68, body + spikes + turbulence));
    }
    this.ghostMs += elapsed;
    if (this.activity > .12 && this.ghostMs >= 40) {
      this.ghosts.push({ shape: this.shape.slice(), ageMs: 0 });
      this.ghosts = this.ghosts.slice(-3); this.ghostMs = 0;
    }
  }
}

export function traceOrb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, shape: Float64Array, amount = 1): void {
  const count = shape.length;
  const point = (index: number) => {
    const i = (index + count) % count;
    const r = radius * (1 + shape[i] * amount);
    return { x: x + circle[i].x * r, y: y + circle[i].y * r };
  };
  const first = point(0);
  ctx.beginPath(); ctx.moveTo(first.x, first.y);
  // Periodic Catmull–Rom → cubic Bézier keeps the entire rim smooth, including its seam.
  for (let i = 0; i < count; i++) {
    const a = point(i - 1), b = point(i), c = point(i + 1), d = point(i + 2);
    ctx.bezierCurveTo(b.x + (c.x - a.x) / 6, b.y + (c.y - a.y) / 6,
      c.x - (d.x - b.x) / 6, c.y - (d.y - b.y) / 6, c.x, c.y);
  }
  ctx.closePath();
}
