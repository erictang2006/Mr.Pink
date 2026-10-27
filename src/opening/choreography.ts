import {logoFragments,type LogoFragment,type Point} from './fragments';

/** Authored milliseconds relative to fracture start; playbackScale stretches the visual timeline. */
export const fractureSettings = {
  playbackScale:2,
  energy:250, centerAt:250, ringAt:500, transformAt:700, duration:1400,
  separation:210, flightSettle:220, dissolveAt:790, dissolveEnd:1365,
  energyFadeAt:450, energyFadeFor:500, seamsUntil:850, seamReach:650,
  trailDelay:140, trailStep:14,
  landingAt:1120, landingStagger:.35, landingGlow:180, streamStretch:1.7, streamNarrow:.86,
  spawnLag:100, spawnStagger:230, atmosphereStagger:200,
  shardMinLife:300, shardLifeRange:260, energyMinLife:570, energyLifeRange:350,
  colorTransition:600, particleColorTransition:500, seamBloom:7, gapLight:.55,
  maxDpr:1.5, maxPixels:3_000_000, shards:34, energyParticles:92, atmosphereParticles:38,
  firstNoteDuration:950, firstNoteParticles:26, seed:419,
} as const;
export const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
export const random=(seed:number)=>{const value=Math.sin(seed*127.1+fractureSettings.seed)*43758.5453;return value-Math.floor(value);};
export type RevealBounds = {width:number;height:number;logo:{x:number;y:number;width:number;height:number};keyboardY:number;galaxy:Point};
export function revealBounds(width:number,height:number,keyboardY=height*.7):RevealBounds {
  const size=Math.min(width*.36,height*.6);
  return {width,height,logo:{x:width/2-size/2,y:height*.35-size*824/798/2,width:size,height:size*824/798},keyboardY,galaxy:[width*.8,keyboardY*.49]};
}
export const sourcePoint=(point:Point,b:RevealBounds):Point=>[b.logo.x+point[0]/100*b.logo.width,b.logo.y+point[1]/100*b.logo.height];
export function fragmentStart(fragment:LogoFragment) {return (fragment.role==='ring'?fractureSettings.ringAt:fractureSettings.centerAt)+fragment.delay;}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function bezier(a:Point,b:Point,c:Point,d:Point,t:number):Point {
  const s=1-t;return [s*s*s*a[0]+3*s*s*t*b[0]+3*s*t*t*c[0]+t*t*t*d[0],s*s*s*a[1]+3*s*s*t*b[1]+3*s*t*t*c[1]+t*t*t*d[1]];
}
/** Only the two small upper inlays drift into the stars; all major logo mass feeds the piano. */
export const fragmentFeedsPiano=(fragment:LogoFragment)=>fragment.role!=='upper';
export const fragmentLandingAt=(fragment:LogoFragment)=>fractureSettings.landingAt+fragment.delay*fractureSettings.landingStagger;
/** Small center-out gaps, then a gently arcing, accelerating downward pull. */
export function fragmentPose(fragment:LogoFragment,ms:number,b:RevealBounds) {
  const start=fragmentStart(fragment), local=ms-start;
  const separation=smooth(local/fractureSettings.separation);
  const down=fragmentFeedsPiano(fragment);
  const endAt=down?fragmentLandingAt(fragment):fractureSettings.duration-fractureSettings.flightSettle;
  const flight=clamp((local-fractureSettings.separation*.52)/(endAt-start-fractureSettings.separation*.52));
  const t=flight*flight;
  const origin=sourcePoint(fragment.origin,b),side=fragment.origin[0]<50?-1:1;
  let end:Point,control1:Point,control2:Point;
  if(down) {
    // Preserve source ordering as the logo opens into a wider keyboard-sized fan.
    end=[b.width*(.23+fragment.origin[0]/100*.54),b.keyboardY];
    const arc=fragment.role==='ring'?.22:.08;
    control1=[origin[0]+side*b.logo.width*arc,origin[1]+b.logo.height*.12];
    control2=[lerp(origin[0],end[0],.8),lerp(origin[1],b.keyboardY,.72)];
  }else {
    end=[b.galaxy[0]+side*b.width*.035,b.galaxy[1]+fragment.turn*b.height*.13];
    control1=[origin[0]+side*b.logo.width*.12,origin[1]-b.logo.height*.07];
    control2=[b.galaxy[0]-b.width*.13,b.galaxy[1]-b.height*.08];
  }
  const p=bezier(origin,control1,control2,end,t);
  const fade=smooth((ms-(fractureSettings.dissolveAt+fragment.delay*.35))/(fractureSettings.dissolveEnd-fractureSettings.dissolveAt-fragment.delay*.35));
  return {x:p[0]-origin[0]+side*separation*6*(1-t),y:p[1]-origin[1]+(down?5:-3)*separation*(1-t),rotation:fragment.turn*(separation*.2+t*(down?.55:1.1)),scaleX:1+fragment.depth*separation-(down?fractureSettings.streamNarrow:.7)*fade,scaleY:1+fragment.depth*separation+(down?fractureSettings.streamStretch:-.7)*fade,alpha:1-fade,cool:smooth((ms-fractureSettings.transformAt)/fractureSettings.colorTransition),flight};
}
export type RevealParticle = {kind:'shard'|'energy'|'atmosphere';fragment:number;born:number;life:number;size:number;spread:number;phase:number};
export function createRevealParticles():RevealParticle[] {
  const kinds=['shard','energy','atmosphere'] as const;
  return kinds.flatMap(kind=>Array.from({length:kind==='shard'?fractureSettings.shards:kind==='energy'?fractureSettings.energyParticles:fractureSettings.atmosphereParticles},(_,i)=>{
    const seed=i+({shard:0,energy:101,atmosphere:233}[kind]);
    const fragment=Math.floor(random(seed+1)*logoFragments.length),start=fragmentStart(logoFragments[fragment]);
    const born=kind==='atmosphere'?fractureSettings.transformAt+random(seed+4)*fractureSettings.atmosphereStagger:start+fractureSettings.spawnLag+random(seed+4)*fractureSettings.spawnStagger;
    return {kind,fragment,born,life:Math.min(fractureSettings.duration-born-15,kind==='shard'?fractureSettings.shardMinLife+random(seed+5)*fractureSettings.shardLifeRange:fractureSettings.energyMinLife+random(seed+5)*fractureSettings.energyLifeRange),size:kind==='shard'?2+random(seed+2)*3.5:kind==='atmosphere'?.45+random(seed+2)*.65:.7+random(seed+2)*1.5,spread:random(seed+6)*2-1,phase:random(seed+7)*Math.PI*2};
  }));
}
export function particlePose(p:RevealParticle,ms:number,b:RevealBounds,anchor:Point=logoFragments[p.fragment].origin) {
  const t=clamp((ms-p.born)/p.life),fragment=logoFragments[p.fragment];
  // Trails retain a small lag behind their parent fragment, rather than scattering radially.
  const pose=fragmentPose(fragment,Math.min(ms,p.born+t*p.life*.94),b),origin=sourcePoint(fragment.origin,b);
  const angle=pose.rotation,dx=(anchor[0]-fragment.origin[0])/100*b.logo.width*pose.scaleX,dy=(anchor[1]-fragment.origin[1])/100*b.logo.height*pose.scaleY;
  const edgeX=dx*Math.cos(angle)-dy*Math.sin(angle),edgeY=dx*Math.sin(angle)+dy*Math.cos(angle);
  // A contour point follows the rotating source piece before dispersing along its trail.
  const attachment=1-smooth(t);
  const spread=Math.sin(t*Math.PI)*b.logo.width*.09*p.spread;
  const x=origin[0]+pose.x+edgeX*attachment+spread,rawY=origin[1]+pose.y+edgeY*attachment+Math.sin(p.phase+t*3)*spread*.25+(fragmentFeedsPiano(fragment)?t*18:-t*14);
  const y=fragmentFeedsPiano(fragment)?Math.min(b.keyboardY-1,rawY):rawY;
  return {x,y,alpha:ms<p.born||ms>=p.born+p.life?0:smooth(t/.12)*(1-t)**.8*.85,cool:smooth((ms-fractureSettings.transformAt)/fractureSettings.particleColorTransition)};
}

/** Armed at handoff and consumed only by the existing successful physical-note dispatch. */
export class FirstNoteCue {
  private armed=false;
  arm(){this.armed=true;}
  reset(){this.armed=false;}
  consume(){if(!this.armed)return false;this.armed=false;return true;}
}

/** Continuous palette shared by solid shards and trails; no hue switches between frames. */
export function fractureLightColor(cool:number):string {
  const stops=[[239,74,94],[186,143,239],[194,225,255],[245,249,255]];
  const value=clamp(cool)*(stops.length-1),index=Math.min(stops.length-2,Math.floor(value)),t=value-index;
  return '#'+stops[index].map((channel,i)=>Math.round(channel+(stops[index+1][i]-channel)*t).toString(16).padStart(2,'0')).join('');
}
