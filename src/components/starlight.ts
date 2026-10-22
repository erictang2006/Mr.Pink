import type { LiveNote } from '../piano/liveNotes';

const pitchColors = new Map<number,string>();
const stops = [[36,118,201,255],[56,120,223,255],[72,139,158,255],[88,197,155,255],[96,240,166,255]];
/** Continuous, restrained pitch palette shared by keys, trails and stardust. */
export function starlightColor(midi: number): string {
  const pitch = Math.max(36, Math.min(96, midi));
  const cached=pitchColors.get(pitch);if(cached)return cached;
  const index = Math.max(0, stops.findIndex(stop => stop[0] >= pitch) - 1);
  const a = stops[index], b = stops[Math.min(index + 1, stops.length - 1)];
  const t = Math.max(0, Math.min(1, (pitch - a[0]) / (b[0] - a[0] || 1)));
  const color = '#' + [1,2,3].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2,'0')).join('');
  if(Number.isInteger(pitch))pitchColors.set(pitch,color);
  return color;
}
const mixLight = (from:string,to:string,amount:number) => '#' + [1,3,5].map(index => Math.round(parseInt(from.slice(index,index+2),16)*(1-amount)+parseInt(to.slice(index,index+2),16)*amount).toString(16).padStart(2,'0')).join('');

/** Energy gathers smoothly at the lower edge, retaining the note's blue/violet hue. */
export function starlightBeamStops(color:string): {offset:number;color:string}[] {
  return [
    {offset:0,color:mixLight(color,'#14203b',.5)},
    {offset:.35,color:mixLight(color,'#14203b',.12)},
    {offset:.55,color},
    {offset:.82,color:mixLight(color,'#f6f6ff',.35)},
    {offset:.96,color:mixLight(color,'#f6f6ff',.68)},
    {offset:1,color:mixLight(color,'#f6f6ff',.91)},
  ];
}

/** Wider beams stay centered on their existing pitch columns; short gates retain a readable cap. */
export function starlightNoteShape(key: { x:number; width:number; black:boolean }, top:number, bottom:number) {
  const width = Math.min(key.black ? 30 : 44, key.width * (key.black ? .64 : .6));
  const height = Math.max(10,bottom-top);
  return {x:key.x+(key.width-width)/2,width,top:bottom-height,height,radius:Math.min(6,width*.24)};
}
export const starlightLimits = {particles:768,pulses:48,shimmerPerFrame:12} as const;

const ease = (t: number) => { const v = Math.max(0,Math.min(1,t)); return v*v*(3-2*v); };
export type KeyLight = { level: number; depth: number; held: boolean };
type KeyState = { start: number; release: number | null; releaseLevel: number; sustained: boolean; level: number; attackFrom: number };

/** Presentation envelopes only. Neither these lights nor their tails own audio notes. */
export class StarlightKeys {
  private keys = new Map<number, KeyState>();
  needsFrame = false;
  update(active: Set<number>, sustained: Set<number>, now: number, reducedMotion = false): Map<number, KeyLight> {
    this.needsFrame = false;
    for (const midi of active) {
      const previous = this.keys.get(midi);
      if (!previous || previous.release !== null) this.keys.set(midi, {start:now,release:null,releaseLevel:0,sustained:false,level:previous?.level ?? 0,attackFrom:Math.max(.18,previous?.level ?? 0)});
    }
    const frame = new Map<number, KeyLight>();
    for (const [midi, state] of this.keys) {
      const held = active.has(midi), sustaining = !held && sustained.has(midi);
      if (held) {
        state.level = reducedMotion ? 1 : state.attackFrom + (1-state.attackFrom) * ease((now-state.start)/135);
        if (!reducedMotion) this.needsFrame = true;
      } else {
        if (state.release === null || state.sustained && !sustaining) {
          state.release = now; state.releaseLevel = state.level;
        }
        state.level = state.releaseLevel * (1-ease((now-state.release)/480));
        if (now-state.release < 480) this.needsFrame = true;
        if (sustaining) state.level = Math.max(.12,state.level);
      }
      state.sustained = sustaining;
      if (!held && !sustaining && state.level < .001) { this.keys.delete(midi); continue; }
      const shimmer = held && !reducedMotion ? 1 - .03*(.5+.5*Math.sin(now*.0024+midi*.7))*ease((now-state.start)/135) : 1;
      frame.set(midi,{level:state.level*shimmer,depth:held?(reducedMotion?1:ease((now-state.start)/75)):0,held});
    }
    return frame;
  }
  clear() { this.keys.clear(); this.needsFrame=false; }
}

export type StarParticle = { midi:number; born:number; life:number; offset:number; drift:number; speed:number; size:number; strength:number; kind:'impact'|'shimmer'|'release'; phase:number; sway:number; frequency:number };
export type ContactPulse = { midi:number; born:number; strength:number };
const random = (seed:number) => { const value=Math.sin(seed*127.1+3.2)*43758.5453; return value-Math.floor(value); };

/** Impacts are brightest on the first frame; ongoing dust eases in gently. */
export function starlightParticleOpacity(star:StarParticle,now:number):number {
  const age=now-star.born,t=age/star.life;
  if(age<0||t>=1)return 0;
  const onset=star.kind==='impact'?1:Math.min(1,age/65);
  return onset*(1-t)**.9*Math.min(1,star.strength*1.75);
}

/** Bounded particles reuse the visualizer's animation loop; no timers or DOM nodes. */
export class StarlightScene {
  particles: StarParticle[] = [];
  pulses: ContactPulse[] = [];
  private seen = new Map<number, {released:boolean; end:number; shimmer:number}>();
  update(notes: LiveNote[], now:number, reducedMotion=false): void {
    const recent = notes.filter(note=>!this.seen.has(note.id)&&now-note.startMs<120);
    const heldCount=notes.filter(note=>note.physicalEndMs===null).length;
    const chordStrength=Math.min(1,.48+Math.sqrt(recent.length)*.18);
    let shimmerBudget=starlightLimits.shimmerPerFrame;
    for(const note of notes) {
      let seen=this.seen.get(note.id);
      if(!seen) {
        seen={released:false,end:now,shimmer:now};this.seen.set(note.id,seen);
        if(now-note.startMs<120) {
          const strength=chordStrength*(note.assisted?.55:1);
          this.pulses.push({midi:note.midi,born:note.startMs,strength});
          if(!reducedMotion) {
            const count=Math.min(2*Math.round(12+strength*14),Math.max(8,Math.floor(starlightLimits.particles*.8/Math.max(1,recent.length))));
            this.emit(note.midi,note.id,note.startMs,strength,count,'impact');
          }
        }
      }
      seen.end=now;
      if(note.physicalEndMs!==null&&!seen.released) {
        seen.released=true;
        if(!reducedMotion&&now-note.physicalEndMs<120)this.emit(note.midi,note.id+700,now,.4,4,'release');
      }
      const sounding=note.physicalEndMs===null||note.endMs===null;
      if(!reducedMotion&&sounding&&now-seen.shimmer>=90&&shimmerBudget>0) {
        const age=Math.min(1,(now-note.startMs)/1800);
        const strength=(.35+age*.22+Math.min(.15,heldCount*.015))*(note.assisted?.6:1)*(note.physicalEndMs===null?1:.6);
        const count=Math.min(shimmerBudget,age>.5?3:2);
        this.emit(note.midi,note.id+Math.floor(now/90)*31,now,strength,count,'shimmer');
        shimmerBudget-=count;seen.shimmer=now;
      }
    }
    this.particles=this.particles.filter(star=>now-star.born<star.life).slice(-starlightLimits.particles);
    this.pulses=this.pulses.filter(pulse=>now-pulse.born<420).slice(-starlightLimits.pulses);
    for(const [id,state] of this.seen)if(now-state.end>4600)this.seen.delete(id);
  }
  private emit(midi:number,seed:number,now:number,strength:number,count:number,kind:StarParticle['kind']) {
    for(let i=0;i<count;i++) {
      const variant=random(seed+i*19);
      // Mostly fine dust, some readable sparkles, and a few larger star cores.
      const size=variant<.67?.65+random(seed+i*17)*.8:variant<.94?1.6+random(seed+i*17)*1.2:3.1+random(seed+i*17)*1.2;
      const impact=kind==='impact';
      this.particles.push({midi,born:now,life:impact?900+random(seed+i*3)*850:720+random(seed+i*3)*650,
        offset:(random(seed+i*7)-.5)*(impact?1.2:.65),drift:(random(seed+i*11)-.5)*(impact?110:35),
        speed:impact?58+random(seed+i*13)*82:24+random(seed+i*13)*40,size:impact?size:size*.7,strength,kind,
        phase:random(seed+i*23)*Math.PI*2,sway:1.5+random(seed+i*29)*4,frequency:1.6+random(seed+i*31)*2});
    }
  }
  clear() { this.particles=[];this.pulses=[];this.seen.clear(); }
}
