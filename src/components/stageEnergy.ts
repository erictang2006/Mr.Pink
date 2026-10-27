export type StageActivity = {
  playing?: boolean; intensity?: number; drop?: boolean;
  beatKey?: string; hitKey?: string;
  hitKind?: 'kick' | 'clap'; drumKey?: number;
  buildProgress?: number;
};
export type EnergyAttack = { id: number; midi: number };
export type EnergyRing = { ageMs: number; strength: number };
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));

/** Visual state only. Beat IDs come from existing playback snapshots, never a new clock. */
export class StageEnergy {
  rings: EnergyRing[] = [];
  level = 0;
  pulse = 0;
  bias = 0;
  drop = 0;
  build = 0;
  shock = 0;
  thump = 0;
  flash = 0;
  private wasDropping = false;
  private lastNoteId = 0;
  private lastBeat?: string;
  private lastHit?: string;
  private lastDrumKey?: number;
  private sinceRing = Infinity;

  update(elapsedMs: number, attacks: readonly EnergyAttack[], activity: StageActivity, audioLevel = 0) {
    const elapsed = Math.max(0, elapsedMs);
    const dt = Math.min(120, elapsed);
    this.sinceRing += elapsed;
    this.pulse *= Math.exp(-elapsed / 220);
    this.shock *= Math.exp(-elapsed / 650);
    this.thump *= Math.exp(-elapsed / 260);
    this.flash *= Math.exp(-elapsed / 135);
    this.rings = this.rings.filter(ring => (ring.ageMs += elapsed) < 1350);
    const fresh = attacks.filter(note => note.id > this.lastNoteId);
    for (const note of fresh) this.lastNoteId = Math.max(this.lastNoteId, note.id);
    const pitches = [...new Set(fresh.map(note => note.midi))];
    const newBeat = !!activity.beatKey && activity.beatKey !== this.lastBeat;
    const newHit = !!activity.hitKey && activity.hitKey !== this.lastHit;
    const newDrum = activity.drumKey !== undefined && activity.drumKey !== this.lastDrumKey;
    this.lastBeat = activity.beatKey; this.lastHit = activity.hitKey;
    this.lastDrumKey = activity.drumKey;
    const dropping = !!activity.playing && !!activity.drop;
    const dropEntrance = dropping && !this.wasDropping;
    this.wasDropping = dropping;
    this.drop += ((dropping ? 1 : 0) - this.drop) * (1 - Math.exp(-dt / 500));
    this.build += ((activity.playing ? clamp(activity.buildProgress ?? 0) : 0) - this.build) * (1 - Math.exp(-dt / 350));
    let strength = 0;
    if (pitches.length) {
      const mean = pitches.reduce((sum,pitch) => sum+pitch,0)/pitches.length;
      this.bias += (clamp((mean-64)/28,-1,1)-this.bias)*.35;
      strength = .16 + Math.min(7,pitches.length)*.075 + (mean<55?.2:0);
    }
    if ((activity.playing && newBeat) || newHit) strength = Math.max(strength, dropping ? .85 : .38);
    if (newHit) {
      strength = Math.max(strength,.65);
      if (newDrum && activity.hitKind === 'kick') this.thump = 1;
      if (newDrum && activity.hitKind === 'clap') this.flash = 1;
    }
    if (dropEntrance) {
      strength = 1; this.shock = 1;
    }
    if (strength) {
      this.pulse = Math.max(this.pulse, strength);
      if (dropEntrance || this.sinceRing >= 170 && (pitches.length > 0 || newHit || activity.playing && newBeat)) {
        this.rings.push({ageMs:0,strength}); this.rings = this.rings.slice(-8); this.sinceRing=0;
      }
    }
    const target = clamp(audioLevel*.65 + this.pulse*.6 + (activity.playing ? clamp(activity.intensity??0)*.27 : 0) + this.drop*.12 + this.build*.1);
    this.level += (target-this.level)*(1-Math.exp(-dt/(target>this.level?80:550)));
    this.bias *= Math.exp(-elapsed/2800);
  }
}

export function stageOrbGeometry(width: number, height: number, now: number, energy: StageEnergy, reduced: boolean) {
  const breathe = reduced ? 0 : Math.sin(now*.00085)*.018;
  const radius = Math.max(0,Math.min(width*.34,height*.35))*(1+breathe+(reduced?0:energy.pulse*.065+energy.level*.025));
  return {x:width*.5+(reduced?0:energy.bias*radius*.04),y:height*.49-(reduced?0:energy.bias*radius*.025),radius};
}
